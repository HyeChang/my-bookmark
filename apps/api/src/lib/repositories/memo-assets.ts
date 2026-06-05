import type { MemoAsset } from "@bookmark/shared";

type MemoAssetRow = {
  id: string;
  memo_id: string;
  user_id: string;
  object_key: string;
  thumbnail_object_key: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type MemoAssetRecord = MemoAsset & {
  userId: string;
  objectKey: string;
  thumbnailObjectKey: string;
};

export type CreateMemoAssetInput = {
  userId: string;
  memoId: string;
  objectKey: string;
  thumbnailObjectKey: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
};

export type MemoAssetRepository = {
  listByMemo(userId: string, memoId: string): Promise<MemoAssetRecord[]>;
  getById(
    userId: string,
    memoId: string,
    assetId: string
  ): Promise<MemoAssetRecord | null>;
  create(input: CreateMemoAssetInput): Promise<MemoAssetRecord>;
  delete(userId: string, memoId: string, assetId: string): Promise<boolean>;
};

function toMemoAssetRecord(row: MemoAssetRow): MemoAssetRecord {
  return {
    id: row.id,
    memoId: row.memo_id,
    userId: row.user_id,
    objectKey: row.object_key,
    thumbnailObjectKey: row.thumbnail_object_key,
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

export function toMemoAssetResponse(asset: MemoAssetRecord): MemoAsset {
  return {
    id: asset.id,
    memoId: asset.memoId,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    sortOrder: asset.sortOrder,
    contentUrl: `/api/memos/${asset.memoId}/assets/${asset.id}/content`,
    thumbnailUrl: `/api/memos/${asset.memoId}/assets/${asset.id}/thumbnail`,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt
  };
}

export function createMemoAssetRepository(db: D1Database): MemoAssetRepository {
  async function assertOwnedMemoId(userId: string, memoId: string) {
    const row = await db
      .prepare(
        `SELECT id
        FROM memos
        WHERE user_id = ? AND id = ?`
      )
      .bind(userId, memoId)
      .first<{ id: string }>();

    if (!row) {
      throw new Error("invalid_memo_id");
    }
  }

  async function getById(userId: string, memoId: string, assetId: string) {
    const row = await db
      .prepare(
        `SELECT
          id,
          memo_id,
          user_id,
          object_key,
          thumbnail_object_key,
          mime_type,
          width,
          height,
          sort_order,
          created_at,
          updated_at
        FROM memo_assets
        WHERE user_id = ? AND memo_id = ? AND id = ?`
      )
      .bind(userId, memoId, assetId)
      .first<MemoAssetRow>();

    return row ? toMemoAssetRecord(row) : null;
  }

  return {
    async listByMemo(userId, memoId) {
      const result = await db
        .prepare(
          `SELECT
            id,
            memo_id,
            user_id,
            object_key,
            thumbnail_object_key,
            mime_type,
            width,
            height,
            sort_order,
            created_at,
            updated_at
          FROM memo_assets
          WHERE user_id = ? AND memo_id = ?
          ORDER BY sort_order ASC, created_at ASC, id ASC`
        )
        .bind(userId, memoId)
        .all<MemoAssetRow>();

      return result.results.map(toMemoAssetRecord);
    },
    getById,
    async create(input) {
      await assertOwnedMemoId(input.userId, input.memoId);

      const assetId = crypto.randomUUID();
      const now = new Date().toISOString();
      const nextSortOrderResult = await db
        .prepare(
          `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_sort_order
          FROM memo_assets
          WHERE user_id = ? AND memo_id = ?`
        )
        .bind(input.userId, input.memoId)
        .first<{ next_sort_order: number }>();

      await db
        .prepare(
          `INSERT INTO memo_assets (
            id,
            memo_id,
            user_id,
            object_key,
            thumbnail_object_key,
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
          input.memoId,
          input.userId,
          input.objectKey,
          input.thumbnailObjectKey,
          input.mimeType,
          input.width ?? null,
          input.height ?? null,
          nextSortOrderResult?.next_sort_order ?? 0,
          now,
          now
        )
        .run();

      const asset = await getById(input.userId, input.memoId, assetId);
      if (!asset) {
        throw new Error("memo_asset_create_failed");
      }

      return asset;
    },
    async delete(userId, memoId, assetId) {
      const asset = await getById(userId, memoId, assetId);
      if (!asset) {
        return false;
      }

      await db
        .prepare(
          `DELETE FROM memo_assets
          WHERE user_id = ? AND memo_id = ? AND id = ?`
        )
        .bind(userId, memoId, assetId)
        .run();

      return true;
    }
  };
}
