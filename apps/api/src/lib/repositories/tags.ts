import type { CreateTagRequest, Tag } from "@bookmark/shared";

type TagRow = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type TagRecord = Tag & {
  userId: string;
};

export type CreateTagInput = CreateTagRequest & {
  userId: string;
};

export type TagRepository = {
  listByUser(userId: string): Promise<TagRecord[]>;
  create(input: CreateTagInput): Promise<TagRecord>;
};

function toTagRecord(row: TagRow): TagRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toTagResponse(tag: TagRecord): Tag {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt
  };
}

export function createTagRepository(db: D1Database): TagRepository {
  return {
    async listByUser(userId) {
      const result = await db
        .prepare(
          `SELECT
            id,
            user_id,
            name,
            color,
            created_at,
            updated_at
          FROM tags
          WHERE user_id = ?
          ORDER BY created_at ASC`
        )
        .bind(userId)
        .all<TagRow>();

      return result.results.map(toTagRecord);
    },
    async create(input) {
      const tagId = crypto.randomUUID();
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO tags (
            id,
            user_id,
            name,
            color,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(tagId, input.userId, input.name, input.color ?? null, now, now)
        .run();

      const row = await db
        .prepare(
          `SELECT
            id,
            user_id,
            name,
            color,
            created_at,
            updated_at
          FROM tags
          WHERE user_id = ? AND id = ?`
        )
        .bind(input.userId, tagId)
        .first<TagRow>();

      if (!row) {
        throw new Error("tag_create_failed");
      }

      return toTagRecord(row);
    }
  };
}
