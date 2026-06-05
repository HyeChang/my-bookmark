import type {
  CreateMemoRequest,
  Memo,
  MemoAsset,
  MemoRichContent,
  MemoSortMode,
  UpdateMemoRequest
} from "@bookmark/shared";

type MemoRow = {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  content_json: string;
  content_text: string;
  is_favorite: number;
  is_hidden: number;
  is_locked: number;
  memo_color: string | null;
  asset_count: number | string | null;
  created_at: string;
  updated_at: string;
};

type MemoTagLinkRow = {
  memo_id: string;
  tag_id: string;
};

type MemoCoverAssetRow = {
  id: string;
  memo_id: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const MEMO_RELATION_QUERY_CHUNK_SIZE = 90;
const D1_LIKE_PATTERN_MAX_BYTES = 50;
export const MEMO_LIST_CONTENT_TEXT_MAX_LENGTH = 240;
const EMPTY_MEMO_CONTENT_JSON_TEXT = '{"type":"doc","content":[]}';

export type MemoRecord = Memo & {
  userId: string;
};

export type CreateMemoInput = CreateMemoRequest & {
  userId: string;
};

export type UpdateMemoInput = UpdateMemoRequest;

export type MemoListFilters = {
  query?: string;
  folderId?: string | null;
  folderIds?: Array<string | null>;
  tagId?: string;
  favorite?: boolean;
  includeHidden?: boolean;
  includeLocked?: boolean;
  redactLocked?: boolean;
};

export type MemoListPagination = {
  limit: number;
  offset: number;
};

export type MemoPageOptions = {
  pagination: MemoListPagination;
  contentMode?: "full" | "summary";
  sort?: MemoSortMode;
};

export type MemoListPage = {
  memos: MemoRecord[];
  total: number;
};

export type MemoRepository = {
  pageByUser(
    userId: string,
    filters: MemoListFilters,
    options: MemoPageOptions
  ): Promise<MemoListPage>;
  getByUserAndId(
    userId: string,
    memoId: string,
    options?: { includeHidden?: boolean; includeLocked?: boolean }
  ): Promise<MemoRecord | null>;
  create(input: CreateMemoInput): Promise<MemoRecord>;
  update(
    memoId: string,
    userId: string,
    input: UpdateMemoInput
  ): Promise<MemoRecord | null>;
  delete(memoId: string, userId: string): Promise<boolean>;
};

function toMemoRecord(row: MemoRow): MemoRecord {
  return {
    id: row.id,
    userId: row.user_id,
    folderId: row.folder_id,
    tagIds: [],
    title: row.title,
    contentJson: JSON.parse(row.content_json) as MemoRichContent,
    contentText: row.content_text,
    isFavorite: row.is_favorite === 1,
    isHidden: row.is_hidden === 1,
    isLocked: row.is_locked === 1,
    memoColor: row.memo_color,
    assetCount: Number(row.asset_count ?? 0),
    coverAsset: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toMemoCoverAsset(row: MemoCoverAssetRow): MemoAsset {
  return {
    id: row.id,
    memoId: row.memo_id,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    sortOrder: row.sort_order,
    contentUrl: `/api/memos/${row.memo_id}/assets/${row.id}/content`,
    thumbnailUrl: `/api/memos/${row.memo_id}/assets/${row.id}/thumbnail`,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toMemoResponse(memo: MemoRecord): Memo {
  return {
    id: memo.id,
    folderId: memo.folderId,
    tagIds: memo.tagIds,
    title: memo.title,
    contentJson: memo.contentJson,
    contentText: memo.contentText,
    isFavorite: memo.isFavorite,
    isHidden: memo.isHidden,
    isLocked: memo.isLocked,
    memoColor: memo.memoColor,
    assetCount: memo.assetCount,
    coverAsset: memo.coverAsset,
    createdAt: memo.createdAt,
    updatedAt: memo.updatedAt
  };
}

export function createEmptyMemoContent(): MemoRichContent {
  return {
    type: "doc",
    content: []
  };
}

export function summarizeMemoContentText(contentText: string) {
  if (contentText.length <= MEMO_LIST_CONTENT_TEXT_MAX_LENGTH) {
    return contentText;
  }

  return `${contentText.slice(0, MEMO_LIST_CONTENT_TEXT_MAX_LENGTH)}...`;
}

function normalizeTagIds(tagIds: string[] | undefined) {
  if (!tagIds) {
    return [];
  }

  return Array.from(
    new Set(
      tagIds
        .filter((tagId): tagId is string => typeof tagId === "string")
        .map((tagId) => tagId.trim())
        .filter(Boolean)
    )
  );
}

function normalizeFolderIds(folderIds: Array<string | null> | undefined) {
  if (!folderIds) {
    return [];
  }

  return Array.from(
    new Set(
      folderIds
        .map((folderId) => (typeof folderId === "string" ? folderId.trim() : folderId))
        .filter((folderId): folderId is string | null => folderId === null || !!folderId)
    )
  );
}

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function createSafeLikePattern(value: string) {
  let escapedQuery = "";

  for (const character of value) {
    const escapedCharacter = escapeLikePattern(character);
    const candidate = `%${escapedQuery}${escapedCharacter}%`;
    if (getUtf8ByteLength(candidate) > D1_LIKE_PATTERN_MAX_BYTES) {
      break;
    }

    escapedQuery += escapedCharacter;
  }

  return escapedQuery ? `%${escapedQuery}%` : "";
}

function chunkValues<TValue>(values: TValue[], chunkSize: number) {
  const chunks: TValue[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
}

function getMemoListOrderBy(sort: MemoSortMode = "updated_desc") {
  switch (sort) {
    case "updated_asc":
      return "updated_at ASC, id ASC";
    case "title_asc":
      return "LOWER(title) ASC, updated_at DESC, id ASC";
    case "title_desc":
      return "LOWER(title) DESC, updated_at DESC, id ASC";
    default:
      return "updated_at DESC, id ASC";
  }
}

export function createMemoRepository(db: D1Database): MemoRepository {
  async function loadMemoTagIds(userId: string, memoIds: string[]) {
    const tagIdsByMemoId = new Map<string, string[]>();

    if (memoIds.length === 0) {
      return tagIdsByMemoId;
    }

    for (const memoIdChunk of chunkValues(memoIds, MEMO_RELATION_QUERY_CHUNK_SIZE)) {
      const placeholders = memoIdChunk.map(() => "?").join(", ");
      const result = await db
        .prepare(
          `SELECT
            mtl.memo_id,
            mtl.tag_id
          FROM memo_tag_links mtl
          INNER JOIN memo_tags mt ON mt.id = mtl.tag_id
          WHERE mt.user_id = ? AND mtl.memo_id IN (${placeholders})
          ORDER BY mtl.memo_id ASC, mtl.tag_id ASC`
        )
        .bind(userId, ...memoIdChunk)
        .all<MemoTagLinkRow>();

      for (const row of result.results) {
        const currentTagIds = tagIdsByMemoId.get(row.memo_id) ?? [];
        currentTagIds.push(row.tag_id);
        tagIdsByMemoId.set(row.memo_id, currentTagIds);
      }
    }

    return tagIdsByMemoId;
  }

  async function loadMemoCoverAssets(userId: string, memoIds: string[]) {
    const coverAssetsByMemoId = new Map<string, MemoAsset>();

    if (memoIds.length === 0) {
      return coverAssetsByMemoId;
    }

    for (const memoIdChunk of chunkValues(memoIds, MEMO_RELATION_QUERY_CHUNK_SIZE)) {
      const placeholders = memoIdChunk.map(() => "?").join(", ");
      const result = await db
        .prepare(
          `SELECT
            ma.id,
            ma.memo_id,
            ma.mime_type,
            ma.width,
            ma.height,
            ma.sort_order,
            ma.created_at,
            ma.updated_at
          FROM memo_assets ma
          WHERE ma.user_id = ?
            AND ma.memo_id IN (${placeholders})
            AND NOT EXISTS (
              SELECT 1
              FROM memo_assets later
              WHERE later.user_id = ma.user_id
                AND later.memo_id = ma.memo_id
                AND (
                  later.sort_order > ma.sort_order
                  OR (
                    later.sort_order = ma.sort_order
                    AND later.created_at > ma.created_at
                  )
                  OR (
                    later.sort_order = ma.sort_order
                    AND later.created_at = ma.created_at
                    AND later.id > ma.id
                  )
                )
            )
          ORDER BY ma.memo_id ASC`
        )
        .bind(userId, ...memoIdChunk)
        .all<MemoCoverAssetRow>();

      for (const row of result.results) {
        coverAssetsByMemoId.set(row.memo_id, toMemoCoverAsset(row));
      }
    }

    return coverAssetsByMemoId;
  }

  async function attachMemoRelations(
    userId: string,
    memos: MemoRecord[],
    options: { skipLockedCoverAssets?: boolean } = {}
  ) {
    const memoIds = memos.map((memo) => memo.id);
    const coverAssetMemoIds = options.skipLockedCoverAssets
      ? memos.filter((memo) => !memo.isLocked).map((memo) => memo.id)
      : memoIds;
    const [tagIdsByMemoId, coverAssetsByMemoId] = await Promise.all([
      loadMemoTagIds(userId, memoIds),
      loadMemoCoverAssets(userId, coverAssetMemoIds)
    ]);

    return memos.map((memo) => ({
      ...memo,
      tagIds: tagIdsByMemoId.get(memo.id) ?? [],
      coverAsset: coverAssetsByMemoId.get(memo.id) ?? null
    }));
  }

  async function assertOwnedFolderId(userId: string, folderId: string | null | undefined) {
    if (!folderId) {
      return;
    }

    const row = await db
      .prepare(
        `SELECT id
        FROM memo_folders
        WHERE user_id = ? AND id = ?`
      )
      .bind(userId, folderId)
      .first<{ id: string }>();

    if (!row) {
      throw new Error("invalid_folder_id");
    }
  }

  async function assertOwnedTagIds(userId: string, tagIds: string[]) {
    const normalizedTagIds = normalizeTagIds(tagIds);
    if (normalizedTagIds.length === 0) {
      return normalizedTagIds;
    }

    const placeholders = normalizedTagIds.map(() => "?").join(", ");
    const result = await db
      .prepare(
        `SELECT id
        FROM memo_tags
        WHERE user_id = ? AND id IN (${placeholders})`
      )
      .bind(userId, ...normalizedTagIds)
      .all<{ id: string }>();

    const ownedTagIds = new Set(result.results.map((row) => row.id));
    if (ownedTagIds.size !== normalizedTagIds.length) {
      throw new Error("invalid_tag_ids");
    }

    return normalizedTagIds;
  }

  async function replaceMemoTags(memoId: string, tagIds: string[]) {
    await db
      .prepare("DELETE FROM memo_tag_links WHERE memo_id = ?")
      .bind(memoId)
      .run();

    if (tagIds.length === 0) {
      return;
    }

    await db.batch(
      tagIds.map((tagId) =>
        db
          .prepare(
            `INSERT INTO memo_tag_links (
              memo_id,
              tag_id
            ) VALUES (?, ?)`
          )
          .bind(memoId, tagId)
      )
    );
  }

  function createMemoListQuery(userId: string, filters: MemoListFilters = {}) {
    const conditions = ["memos.user_id = ?"];
    const values: Array<string | number> = [userId];

    if ("folderId" in filters) {
      if (filters.folderId === null) {
        conditions.push("folder_id IS NULL");
      } else if (filters.folderId) {
        conditions.push("folder_id = ?");
        values.push(filters.folderId);
      }
    }

    if (filters.folderIds) {
      const folderIds = normalizeFolderIds(filters.folderIds);
      const concreteFolderIds = folderIds.filter(
        (folderId): folderId is string => folderId !== null
      );
      const includesUnfiled = folderIds.some((folderId) => folderId === null);

      if (concreteFolderIds.length === 0 && !includesUnfiled) {
        conditions.push("0 = 1");
      } else if (concreteFolderIds.length === 0) {
        conditions.push("folder_id IS NULL");
      } else {
        const placeholders = concreteFolderIds.map(() => "?").join(", ");
        conditions.push(
          includesUnfiled
            ? `(folder_id IN (${placeholders}) OR folder_id IS NULL)`
            : `folder_id IN (${placeholders})`
        );
        values.push(...concreteFolderIds);
      }
    }

    if (filters.tagId?.trim()) {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM memo_tag_links mtl
          INNER JOIN memo_tags mt ON mt.id = mtl.tag_id
          WHERE mtl.memo_id = memos.id
            AND mt.user_id = ?
            AND mtl.tag_id = ?
        )`
      );
      values.push(userId, filters.tagId.trim());
    }

    if (filters.favorite === true) {
      conditions.push("is_favorite = ?");
      values.push(1);
    } else if (filters.favorite === false) {
      conditions.push("is_favorite = ?");
      values.push(0);
    }

    if (filters.includeHidden !== true) {
      conditions.push("memos.is_hidden = ?");
      values.push(0);
    }
    if (filters.includeLocked !== true) {
      conditions.push("memos.is_locked = ?");
      values.push(0);
    }

    const normalizedQuery = filters.query?.trim().toLowerCase();
    if (normalizedQuery) {
      const likeQuery = createSafeLikePattern(normalizedQuery);
      conditions.push(
        `(LOWER(title) LIKE ? ESCAPE '\\' OR LOWER(content_text) LIKE ? ESCAPE '\\')`
      );
      values.push(likeQuery, likeQuery);
    }

    return {
      whereClause: conditions.join(" AND "),
      values
    };
  }

  async function listMemosByUser(
    userId: string,
    filters: MemoListFilters,
    options: MemoPageOptions
  ) {
    const query = createMemoListQuery(userId, filters);
    const orderByClause = getMemoListOrderBy(options.sort);
    const shouldSummarizeContent = options.contentMode === "summary";
    const contentJsonExpression = filters.redactLocked
      ? `CASE
          WHEN is_locked = 1 THEN '${EMPTY_MEMO_CONTENT_JSON_TEXT}'
          ELSE ${shouldSummarizeContent ? `'${EMPTY_MEMO_CONTENT_JSON_TEXT}'` : "content_json"}
        END`
      : shouldSummarizeContent
        ? `'${EMPTY_MEMO_CONTENT_JSON_TEXT}'`
        : "content_json";
    const summaryContentTextExpression = `CASE
          WHEN LENGTH(content_text) > ${MEMO_LIST_CONTENT_TEXT_MAX_LENGTH}
            THEN SUBSTR(content_text, 1, ${MEMO_LIST_CONTENT_TEXT_MAX_LENGTH}) || '...'
          ELSE content_text
        END`;
    const contentTextExpression = filters.redactLocked
      ? `CASE
          WHEN is_locked = 1 THEN ''
          ELSE ${shouldSummarizeContent ? summaryContentTextExpression : "content_text"}
        END`
      : shouldSummarizeContent
        ? summaryContentTextExpression
        : "content_text";
    const assetCountSelect = filters.redactLocked
      ? `CASE
          WHEN is_locked = 1 THEN 0
          ELSE (
            SELECT COUNT(*)
            FROM memo_assets ma
            WHERE ma.user_id = memos.user_id AND ma.memo_id = memos.id
          )
        END AS asset_count`
      : `(
          SELECT COUNT(*)
          FROM memo_assets ma
          WHERE ma.user_id = memos.user_id AND ma.memo_id = memos.id
        ) AS asset_count`;
    const result = await db
      .prepare(
        `SELECT
          id,
          user_id,
          folder_id,
          title,
          ${contentJsonExpression} AS content_json,
          ${contentTextExpression} AS content_text,
          is_favorite,
          is_hidden,
          is_locked,
          memo_color,
          ${assetCountSelect},
          created_at,
          updated_at
        FROM memos
        WHERE ${query.whereClause}
        ORDER BY ${orderByClause}
        LIMIT ? OFFSET ?`
      )
      .bind(...query.values, options.pagination.limit, options.pagination.offset)
      .all<MemoRow>();

    return attachMemoRelations(userId, result.results.map(toMemoRecord), {
      skipLockedCoverAssets: filters.redactLocked === true
    });
  }

  async function countMemosByUser(userId: string, filters: MemoListFilters) {
    const query = createMemoListQuery(userId, filters);
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS total
        FROM memos
        WHERE ${query.whereClause}`
      )
      .bind(...query.values)
      .first<{ total: number | string | null }>();
    const total = Number(row?.total ?? 0);

    return Number.isFinite(total) && total > 0 ? total : 0;
  }

  async function getByUserAndId(
    userId: string,
    memoId: string,
    options: { includeHidden?: boolean; includeLocked?: boolean } = {}
  ) {
    const hiddenCondition = options.includeHidden === true ? "" : " AND is_hidden = 0";
    const lockedCondition = options.includeLocked === true ? "" : " AND is_locked = 0";
    const row = await db
      .prepare(
        `SELECT
          id,
          user_id,
          folder_id,
          title,
          content_json,
          content_text,
          is_favorite,
          is_hidden,
          is_locked,
          memo_color,
          (
            SELECT COUNT(*)
            FROM memo_assets ma
            WHERE ma.user_id = memos.user_id AND ma.memo_id = memos.id
          ) AS asset_count,
          created_at,
          updated_at
        FROM memos
        WHERE user_id = ? AND id = ?${hiddenCondition}${lockedCondition}`
      )
      .bind(userId, memoId)
      .first<MemoRow>();

    if (!row) {
      return null;
    }

    const [memo] = await attachMemoRelations(userId, [toMemoRecord(row)]);
    return memo ?? null;
  }

  return {
    async pageByUser(userId, filters = {}, options) {
      if (!options?.pagination) {
        throw new Error("missing_pagination");
      }

      const [memos, total] = await Promise.all([
        listMemosByUser(userId, filters, options),
        countMemosByUser(userId, filters)
      ]);

      return {
        memos,
        total
      };
    },
    getByUserAndId,
    async create(input) {
      await assertOwnedFolderId(input.userId, input.folderId);
      const tagIds = await assertOwnedTagIds(input.userId, input.tagIds ?? []);
      const memoId = crypto.randomUUID();
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO memos (
            id,
            user_id,
            folder_id,
            title,
            content_json,
            content_text,
            is_favorite,
            is_hidden,
            is_locked,
            memo_color,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          memoId,
          input.userId,
          input.folderId ?? null,
          input.title,
          JSON.stringify(input.contentJson),
          input.contentText,
          input.isFavorite ? 1 : 0,
          input.isHidden ? 1 : 0,
          input.isLocked ? 1 : 0,
          input.memoColor ?? null,
          now,
          now
        )
        .run();

      await replaceMemoTags(memoId, tagIds);

      const memo = await getByUserAndId(input.userId, memoId, {
        includeHidden: true,
        includeLocked: true
      });
      if (!memo) {
        throw new Error("memo_create_failed");
      }

      return memo;
    },
    async update(memoId, userId, input) {
      const existingMemo = await getByUserAndId(userId, memoId, {
        includeHidden: true,
        includeLocked: true
      });
      if (!existingMemo) {
        return null;
      }

      if ("folderId" in input) {
        await assertOwnedFolderId(userId, input.folderId);
      }

      const nextTagIds =
        "tagIds" in input ? await assertOwnedTagIds(userId, input.tagIds ?? []) : null;
      const assignments: string[] = [];
      const values: Array<string | number | null> = [];

      if ("folderId" in input) {
        assignments.push("folder_id = ?");
        values.push(input.folderId ?? null);
      }
      if ("title" in input) {
        assignments.push("title = ?");
        values.push(input.title ?? "");
      }
      if ("contentJson" in input) {
        assignments.push("content_json = ?");
        values.push(JSON.stringify(input.contentJson));
      }
      if ("contentText" in input) {
        assignments.push("content_text = ?");
        values.push(input.contentText ?? "");
      }
      if ("isFavorite" in input) {
        assignments.push("is_favorite = ?");
        values.push(input.isFavorite ? 1 : 0);
      }
      if ("isHidden" in input) {
        assignments.push("is_hidden = ?");
        values.push(input.isHidden ? 1 : 0);
      }
      if ("isLocked" in input) {
        assignments.push("is_locked = ?");
        values.push(input.isLocked ? 1 : 0);
      }
      if ("memoColor" in input) {
        assignments.push("memo_color = ?");
        values.push(input.memoColor ?? null);
      }

      if (assignments.length === 0 && nextTagIds === null) {
        return existingMemo;
      }

      const updatedAt = new Date().toISOString();

      if (assignments.length > 0) {
        assignments.push("updated_at = ?");
        values.push(updatedAt);

        await db
          .prepare(
            `UPDATE memos
            SET ${assignments.join(", ")}
            WHERE id = ? AND user_id = ?`
          )
          .bind(...values, memoId, userId)
          .run();
      }

      if (nextTagIds !== null) {
        await replaceMemoTags(memoId, nextTagIds);

        if (assignments.length === 0) {
          await db
            .prepare(
              `UPDATE memos
              SET updated_at = ?
              WHERE id = ? AND user_id = ?`
            )
            .bind(updatedAt, memoId, userId)
            .run();
        }
      }

      return getByUserAndId(userId, memoId, { includeHidden: true, includeLocked: true });
    },
    async delete(memoId, userId) {
      const existingMemo = await getByUserAndId(userId, memoId, {
        includeHidden: true,
        includeLocked: true
      });
      if (!existingMemo) {
        return false;
      }

      await db.batch([
        db
          .prepare("DELETE FROM memo_tag_links WHERE memo_id = ?")
          .bind(memoId),
        db
          .prepare(
            `DELETE FROM memo_assets
            WHERE user_id = ? AND memo_id = ?`
          )
          .bind(userId, memoId),
        db
          .prepare(
            `DELETE FROM memos
            WHERE id = ? AND user_id = ?`
          )
          .bind(memoId, userId)
      ]);

      return true;
    }
  };
}
