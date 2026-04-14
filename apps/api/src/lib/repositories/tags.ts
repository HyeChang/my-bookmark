import type { CreateTagRequest, Tag, UpdateTagRequest } from "@bookmark/shared";

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
  update(tagId: string, userId: string, input: UpdateTagRequest): Promise<TagRecord | null>;
  delete(tagId: string, userId: string): Promise<boolean>;
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
  async function getByUserAndId(userId: string, tagId: string) {
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
      .bind(userId, tagId)
      .first<TagRow>();

    return row ? toTagRecord(row) : null;
  }

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

      const tag = await getByUserAndId(input.userId, tagId);
      if (!tag) {
        throw new Error("tag_create_failed");
      }

      return tag;
    },
    async update(tagId, userId, input) {
      const assignments: string[] = [];
      const values: Array<string | null> = [];

      if ("name" in input) {
        assignments.push("name = ?");
        values.push(input.name ?? null);
      }
      if ("color" in input) {
        assignments.push("color = ?");
        values.push(input.color ?? null);
      }

      if (assignments.length === 0) {
        return getByUserAndId(userId, tagId);
      }

      assignments.push("updated_at = ?");
      values.push(new Date().toISOString());

      await db
        .prepare(
          `UPDATE tags
          SET ${assignments.join(", ")}
          WHERE id = ? AND user_id = ?`
        )
        .bind(...values, tagId, userId)
        .run();

      return getByUserAndId(userId, tagId);
    },
    async delete(tagId, userId) {
      const existingTag = await getByUserAndId(userId, tagId);
      if (!existingTag) {
        return false;
      }

      await db.batch([
        db
          .prepare(
            `DELETE FROM bookmark_tags
            WHERE tag_id = ?`
          )
          .bind(tagId),
        db
          .prepare(
            `DELETE FROM tags
            WHERE id = ? AND user_id = ?`
          )
          .bind(tagId, userId)
      ]);

      return true;
    }
  };
}
