import type {
  CreateFolderRequest,
  Folder,
  MoveFolderRequest,
  ReorderFoldersRequest,
  UpdateFolderRequest
} from "@bookmark/shared";

type FolderRow = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  is_hidden: number;
  parent_folder_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type FolderRecord = Folder & {
  userId: string;
};

export type CreateFolderInput = CreateFolderRequest & {
  userId: string;
};

export type FolderRepository = {
  listByUser(userId: string): Promise<FolderRecord[]>;
  create(input: CreateFolderInput): Promise<FolderRecord>;
  update(
    folderId: string,
    userId: string,
    input: UpdateFolderRequest
  ): Promise<FolderRecord | null>;
  reorder(
    userId: string,
    input: ReorderFoldersRequest
  ): Promise<FolderRecord[]>;
  move(
    folderId: string,
    userId: string,
    input: MoveFolderRequest
  ): Promise<FolderRecord[] | null>;
  delete(folderId: string, userId: string): Promise<boolean>;
};

function toFolderRecord(row: FolderRow): FolderRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isHidden: row.is_hidden === 1,
    parentFolderId: row.parent_folder_id,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toFolderResponse(folder: FolderRecord): Folder {
  return {
    id: folder.id,
    name: folder.name,
    color: folder.color,
    icon: folder.icon,
    isHidden: folder.isHidden ?? false,
    parentFolderId: folder.parentFolderId,
    sortOrder: folder.sortOrder,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt
  };
}

export function createFolderRepository(db: D1Database): FolderRepository {
  async function listByUser(userId: string) {
    const result = await db
      .prepare(
        `SELECT
          id,
          user_id,
          name,
          color,
          icon,
          is_hidden,
          parent_folder_id,
          sort_order,
          created_at,
          updated_at
        FROM folders
        WHERE user_id = ?
        ORDER BY sort_order ASC, created_at ASC`
      )
      .bind(userId)
      .all<FolderRow>();

    return result.results.map(toFolderRecord);
  }

  async function getByUserAndId(userId: string, folderId: string) {
    const row = await db
      .prepare(
        `SELECT
          id,
          user_id,
          name,
          color,
          icon,
          is_hidden,
          parent_folder_id,
          sort_order,
          created_at,
          updated_at
        FROM folders
        WHERE user_id = ? AND id = ?`
      )
      .bind(userId, folderId)
      .first<FolderRow>();

    return row ? toFolderRecord(row) : null;
  }

  function sortFolders(leftFolder: FolderRecord, rightFolder: FolderRecord) {
    return (
      leftFolder.sortOrder - rightFolder.sortOrder ||
      leftFolder.createdAt.localeCompare(rightFolder.createdAt)
    );
  }

  return {
    listByUser,
    async create(input) {
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
          `INSERT INTO folders (
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
        throw new Error("folder_create_failed");
      }

      return folder;
    },
    async update(folderId, userId, input) {
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
        return getByUserAndId(userId, folderId);
      }

      assignments.push("updated_at = ?");
      values.push(new Date().toISOString());

      await db
        .prepare(
          `UPDATE folders
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
              `UPDATE folders
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
              `UPDATE folders
              SET sort_order = ?,
                  updated_at = ?
              WHERE id = ? AND user_id = ?`
            )
            .bind(index, now, currentFolder.id, userId)
        ),
        ...nextSiblingFolders.map((currentFolder, index) =>
          db
            .prepare(
              `UPDATE folders
              SET parent_folder_id = ?,
                  sort_order = ?,
                  updated_at = ?
              WHERE id = ? AND user_id = ?`
            )
            .bind(nextParentFolderId, index, now, currentFolder.id, userId)
        ),
        db
          .prepare(
            `UPDATE folders
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

      await db.batch([
        db
          .prepare(
            `UPDATE bookmarks
            SET folder_id = NULL,
                updated_at = ?
            WHERE user_id = ? AND folder_id = ?`
          )
          .bind(new Date().toISOString(), userId, folderId),
        db
          .prepare(
            `UPDATE folders
            SET parent_folder_id = NULL,
                updated_at = ?
            WHERE user_id = ? AND parent_folder_id = ?`
          )
          .bind(new Date().toISOString(), userId, folderId),
        db
          .prepare(
            `DELETE FROM folders
            WHERE id = ? AND user_id = ?`
          )
          .bind(folderId, userId)
      ]);

      return true;
    }
  };
}
