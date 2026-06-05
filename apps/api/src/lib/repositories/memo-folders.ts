import type {
  CreateMemoFolderRequest,
  MemoFolder,
  MoveMemoFolderRequest,
  ReorderMemoFoldersRequest,
  UpdateMemoFolderRequest
} from "@bookmark/shared";

type MemoFolderRow = {
  id: string;
  user_id: string;
  parent_folder_id: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  is_hidden: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MemoFolderRecord = MemoFolder & {
  userId: string;
};

export type CreateMemoFolderInput = CreateMemoFolderRequest & {
  userId: string;
};

export type MemoFolderRepository = {
  listByUser(userId: string): Promise<MemoFolderRecord[]>;
  create(input: CreateMemoFolderInput): Promise<MemoFolderRecord>;
  update(
    folderId: string,
    userId: string,
    input: UpdateMemoFolderRequest
  ): Promise<MemoFolderRecord | null>;
  reorder(
    userId: string,
    input: ReorderMemoFoldersRequest
  ): Promise<MemoFolderRecord[]>;
  move(
    folderId: string,
    userId: string,
    input: MoveMemoFolderRequest
  ): Promise<MemoFolderRecord[] | null>;
  delete(folderId: string, userId: string): Promise<boolean>;
  listDescendantIds(userId: string, folderId: string): Promise<string[]>;
};

function toMemoFolderRecord(row: MemoFolderRow): MemoFolderRecord {
  return {
    id: row.id,
    userId: row.user_id,
    parentFolderId: row.parent_folder_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isHidden: row.is_hidden === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toMemoFolderResponse(folder: MemoFolderRecord): MemoFolder {
  return {
    id: folder.id,
    parentFolderId: folder.parentFolderId,
    name: folder.name,
    color: folder.color,
    icon: folder.icon,
    isHidden: folder.isHidden ?? false,
    sortOrder: folder.sortOrder,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt
  };
}

export function createMemoFolderRepository(db: D1Database): MemoFolderRepository {
  async function listByUser(userId: string) {
    const result = await db
      .prepare(
        `SELECT
          id,
          user_id,
          parent_folder_id,
          name,
          color,
          icon,
          is_hidden,
          sort_order,
          created_at,
          updated_at
        FROM memo_folders
        WHERE user_id = ?
        ORDER BY sort_order ASC, created_at ASC, id ASC`
      )
      .bind(userId)
      .all<MemoFolderRow>();

    return result.results.map(toMemoFolderRecord);
  }

  async function getByUserAndId(userId: string, folderId: string) {
    const row = await db
      .prepare(
        `SELECT
          id,
          user_id,
          parent_folder_id,
          name,
          color,
          icon,
          is_hidden,
          sort_order,
          created_at,
          updated_at
        FROM memo_folders
        WHERE user_id = ? AND id = ?`
      )
      .bind(userId, folderId)
      .first<MemoFolderRow>();

    return row ? toMemoFolderRecord(row) : null;
  }

  async function listDescendantIds(userId: string, folderId: string) {
    const folders = await listByUser(userId);
    const childrenByParentId = new Map<string, MemoFolderRecord[]>();

    for (const folder of folders) {
      if (!folder.parentFolderId) {
        continue;
      }

      const siblings = childrenByParentId.get(folder.parentFolderId) ?? [];
      siblings.push(folder);
      childrenByParentId.set(folder.parentFolderId, siblings);
    }

    const descendantIds: string[] = [];
    const queue = [...(childrenByParentId.get(folderId) ?? [])];

    while (queue.length > 0) {
      const folder = queue.shift();
      if (!folder) {
        continue;
      }

      descendantIds.push(folder.id);
      queue.push(...(childrenByParentId.get(folder.id) ?? []));
    }

    return descendantIds;
  }

  async function assertParentFolder(
    userId: string,
    parentFolderId: string | null | undefined,
    currentFolderId?: string
  ) {
    if (!parentFolderId) {
      return;
    }

    if (currentFolderId && parentFolderId === currentFolderId) {
      throw new Error("invalid_parent_folder_id");
    }

    const parentFolder = await getByUserAndId(userId, parentFolderId);
    if (!parentFolder) {
      throw new Error("invalid_parent_folder_id");
    }

    if (currentFolderId) {
      const descendantIds = await listDescendantIds(userId, currentFolderId);
      if (descendantIds.includes(parentFolderId)) {
        throw new Error("invalid_parent_folder_id");
      }
    }
  }

  function sortFolders(leftFolder: MemoFolderRecord, rightFolder: MemoFolderRecord) {
    return (
      leftFolder.sortOrder - rightFolder.sortOrder ||
      leftFolder.createdAt.localeCompare(rightFolder.createdAt)
    );
  }

  return {
    listByUser,
    async create(input) {
      await assertParentFolder(input.userId, input.parentFolderId);

      const folderId = crypto.randomUUID();
      const now = new Date().toISOString();
      const siblingFolders = (await listByUser(input.userId)).filter(
        (folder) => folder.parentFolderId === (input.parentFolderId ?? null)
      );
      const sortOrder =
        siblingFolders.length === 0
          ? 0
          : Math.max(...siblingFolders.map((folder) => folder.sortOrder)) + 1;

      await db
        .prepare(
          `INSERT INTO memo_folders (
            id,
            user_id,
            parent_folder_id,
            name,
            color,
            icon,
            is_hidden,
            sort_order,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          folderId,
          input.userId,
          input.parentFolderId ?? null,
          input.name,
          input.color ?? null,
          input.icon ?? null,
          input.isHidden ? 1 : 0,
          sortOrder,
          now,
          now
        )
        .run();

      const folder = await getByUserAndId(input.userId, folderId);
      if (!folder) {
        throw new Error("memo_folder_create_failed");
      }

      return folder;
    },
    async update(folderId, userId, input) {
      const existingFolder = await getByUserAndId(userId, folderId);
      if (!existingFolder) {
        return null;
      }

      if ("parentFolderId" in input) {
        await assertParentFolder(userId, input.parentFolderId, folderId);
      }

      const assignments: string[] = [];
      const values: Array<string | number | null> = [];

      if ("name" in input) {
        assignments.push("name = ?");
        values.push(input.name ?? null);
      }
      if ("color" in input) {
        assignments.push("color = ?");
        values.push(input.color ?? null);
      }
      if ("icon" in input) {
        assignments.push("icon = ?");
        values.push(input.icon ?? null);
      }
      if ("isHidden" in input) {
        assignments.push("is_hidden = ?");
        values.push(input.isHidden ? 1 : 0);
      }
      if ("parentFolderId" in input) {
        assignments.push("parent_folder_id = ?");
        values.push(input.parentFolderId ?? null);
      }

      if (assignments.length === 0) {
        return existingFolder;
      }

      assignments.push("updated_at = ?");
      values.push(new Date().toISOString());

      await db
        .prepare(
          `UPDATE memo_folders
          SET ${assignments.join(", ")}
          WHERE id = ? AND user_id = ?`
        )
        .bind(...values, folderId, userId)
        .run();

      return getByUserAndId(userId, folderId);
    },
    async reorder(userId, input) {
      const now = new Date().toISOString();

      await db.batch(
        input.folderIds.map((folderId, index) =>
          db
            .prepare(
              `UPDATE memo_folders
              SET sort_order = ?,
                  updated_at = ?
              WHERE id = ? AND user_id = ?`
            )
            .bind(index, now, folderId, userId)
        )
      );

      return listByUser(userId);
    },
    async move(folderId, userId, input) {
      const folder = await getByUserAndId(userId, folderId);
      if (!folder) {
        return null;
      }

      await assertParentFolder(userId, input.parentFolderId, folderId);

      const now = new Date().toISOString();
      const nextParentFolderId = input.parentFolderId ?? null;
      const allFolders = await listByUser(userId);
      const previousSiblingFolders = allFolders
        .filter(
          (currentFolder) =>
            currentFolder.parentFolderId === folder.parentFolderId &&
            currentFolder.id !== folderId
        )
        .sort(sortFolders);
      const nextSiblingFolders = allFolders
        .filter(
          (currentFolder) =>
            currentFolder.parentFolderId === nextParentFolderId &&
            currentFolder.id !== folderId
        )
        .sort(sortFolders);

      const statements = [
        ...previousSiblingFolders.map((currentFolder, index) =>
          db
            .prepare(
              `UPDATE memo_folders
              SET sort_order = ?,
                  updated_at = ?
              WHERE id = ? AND user_id = ?`
            )
            .bind(index, now, currentFolder.id, userId)
        ),
        ...nextSiblingFolders.map((currentFolder, index) =>
          db
            .prepare(
              `UPDATE memo_folders
              SET parent_folder_id = ?,
                  sort_order = ?,
                  updated_at = ?
              WHERE id = ? AND user_id = ?`
            )
            .bind(nextParentFolderId, index, now, currentFolder.id, userId)
        ),
        db
          .prepare(
            `UPDATE memo_folders
            SET parent_folder_id = ?,
                sort_order = ?,
                updated_at = ?
            WHERE id = ? AND user_id = ?`
          )
          .bind(nextParentFolderId, nextSiblingFolders.length, now, folderId, userId)
      ];

      await db.batch(statements);

      return listByUser(userId);
    },
    async delete(folderId, userId) {
      const existingFolder = await getByUserAndId(userId, folderId);
      if (!existingFolder) {
        return false;
      }

      const now = new Date().toISOString();
      await db.batch([
        db
          .prepare(
            `UPDATE memos
            SET folder_id = NULL,
                updated_at = ?
            WHERE user_id = ? AND folder_id = ?`
          )
          .bind(now, userId, folderId),
        db
          .prepare(
            `UPDATE memo_folders
            SET parent_folder_id = NULL,
                updated_at = ?
            WHERE user_id = ? AND parent_folder_id = ?`
          )
          .bind(now, userId, folderId),
        db
          .prepare(
            `DELETE FROM memo_folders
            WHERE id = ? AND user_id = ?`
          )
          .bind(folderId, userId)
      ]);

      return true;
    },
    listDescendantIds
  };
}
