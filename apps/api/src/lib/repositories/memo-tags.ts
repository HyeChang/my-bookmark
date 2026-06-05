import type {
  CreateMemoTagRequest,
  MemoTag,
  UpdateMemoTagRequest
} from "@bookmark/shared";

type MemoTagRow = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type MemoTagRecord = MemoTag & {
  userId: string;
};

export type CreateMemoTagInput = CreateMemoTagRequest & {
  userId: string;
};

export type MemoTagRepository = {
  listByUser(userId: string): Promise<MemoTagRecord[]>;
  create(input: CreateMemoTagInput): Promise<MemoTagRecord>;
  update(
    tagId: string,
    userId: string,
    input: UpdateMemoTagRequest
  ): Promise<MemoTagRecord | null>;
  delete(tagId: string, userId: string): Promise<boolean>;
};

function toMemoTagRecord(row: MemoTagRow): MemoTagRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toMemoTagResponse(tag: MemoTagRecord): MemoTag {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt
  };
}

export function createMemoTagRepository(db: D1Database): MemoTagRepository {
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
        FROM memo_tags
        WHERE user_id = ? AND id = ?`
      )
      .bind(userId, tagId)
      .first<MemoTagRow>();

    return row ? toMemoTagRecord(row) : null;
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
          FROM memo_tags
          WHERE user_id = ?
          ORDER BY created_at ASC, id ASC`
        )
        .bind(userId)
        .all<MemoTagRow>();

      return result.results.map(toMemoTagRecord);
    },
    async create(input) {
      const tagId = crypto.randomUUID();
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO memo_tags (
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
        throw new Error("memo_tag_create_failed");
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
          `UPDATE memo_tags
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
            `DELETE FROM memo_tag_links
            WHERE tag_id = ?`
          )
          .bind(tagId),
        db
          .prepare(
            `DELETE FROM memo_tags
            WHERE id = ? AND user_id = ?`
          )
          .bind(tagId, userId)
      ]);

      return true;
    }
  };
}
