import type {
  BookmarkAsset,
  BookmarkAssetType
} from "@bookmark/shared";

type BookmarkAssetRow = {
  id: string;
  bookmark_id: string;
  user_id: string;
  asset_type: string;
  object_key: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BookmarkAssetRecord = BookmarkAsset & {
  userId: string;
  objectKey: string;
};

export type CreateBookmarkAssetInput = {
  bookmarkId: string;
  userId: string;
  assetType: BookmarkAssetType;
  objectKey: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
};

export type BookmarkAssetRepository = {
  listByBookmark(userId: string, bookmarkId: string): Promise<BookmarkAssetRecord[]>;
  getById(
    userId: string,
    bookmarkId: string,
    assetId: string
  ): Promise<BookmarkAssetRecord | null>;
  create(input: CreateBookmarkAssetInput): Promise<BookmarkAssetRecord>;
};

type BookmarkAssetResponseOptions = {
  bookmarkId: string;
};

function toBookmarkAssetRecord(row: BookmarkAssetRow): BookmarkAssetRecord {
  return {
    id: row.id,
    bookmarkId: row.bookmark_id,
    userId: row.user_id,
    assetType: row.asset_type as BookmarkAssetType,
    objectKey: row.object_key,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    sortOrder: row.sort_order,
    contentUrl: `/api/bookmarks/${row.bookmark_id}/assets/${row.id}/content`,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toBookmarkAssetResponse(
  asset: BookmarkAssetRecord,
  options?: BookmarkAssetResponseOptions
): BookmarkAsset {
  return {
    id: asset.id,
    bookmarkId: asset.bookmarkId,
    assetType: asset.assetType,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    sortOrder: asset.sortOrder,
    contentUrl:
      options?.bookmarkId
        ? `/api/bookmarks/${options.bookmarkId}/assets/${asset.id}/content`
        : asset.contentUrl,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt
  };
}

export function createBookmarkAssetRepository(db: D1Database): BookmarkAssetRepository {
  async function getById(userId: string, bookmarkId: string, assetId: string) {
    const row = await db
      .prepare(
        `SELECT
          id,
          bookmark_id,
          user_id,
          asset_type,
          object_key,
          mime_type,
          width,
          height,
          sort_order,
          created_at,
          updated_at
        FROM bookmark_assets
        WHERE user_id = ? AND bookmark_id = ? AND id = ?`
      )
      .bind(userId, bookmarkId, assetId)
      .first<BookmarkAssetRow>();

    return row ? toBookmarkAssetRecord(row) : null;
  }

  return {
    async listByBookmark(userId, bookmarkId) {
      const result = await db
        .prepare(
          `SELECT
            id,
            bookmark_id,
            user_id,
            asset_type,
            object_key,
            mime_type,
            width,
            height,
            sort_order,
            created_at,
            updated_at
          FROM bookmark_assets
          WHERE user_id = ? AND bookmark_id = ?
          ORDER BY sort_order ASC, created_at ASC`
        )
        .bind(userId, bookmarkId)
        .all<BookmarkAssetRow>();

      return result.results.map(toBookmarkAssetRecord);
    },
    getById,
    async create(input) {
      const assetId = crypto.randomUUID();
      const now = new Date().toISOString();
      const nextSortOrderResult = await db
        .prepare(
          `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_sort_order
          FROM bookmark_assets
          WHERE user_id = ? AND bookmark_id = ?`
        )
        .bind(input.userId, input.bookmarkId)
        .first<{ next_sort_order: number }>();

      await db
        .prepare(
          `INSERT INTO bookmark_assets (
            id,
            bookmark_id,
            user_id,
            asset_type,
            object_key,
            mime_type,
            width,
            height,
            sort_order,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          assetId,
          input.bookmarkId,
          input.userId,
          input.assetType,
          input.objectKey,
          input.mimeType,
          input.width ?? null,
          input.height ?? null,
          nextSortOrderResult?.next_sort_order ?? 0,
          now,
          now
        )
        .run();

      const asset = await getById(input.userId, input.bookmarkId, assetId);
      if (!asset) {
        throw new Error("bookmark_asset_create_failed");
      }

      return asset;
    }
  };
}
