type BookmarkActivityRow = {
  bookmark_id: string;
};

export type BookmarkActivityRepository = {
  recordOpen(userId: string, bookmarkId: string): Promise<void>;
  listRecentBookmarkIds(userId: string, limit?: number): Promise<string[]>;
  listFrequentBookmarkIds(userId: string, limit?: number): Promise<string[]>;
};

export function createBookmarkActivityRepository(
  db: D1Database
): BookmarkActivityRepository {
  async function selectBookmarkIds(
    statement: D1PreparedStatement
  ): Promise<string[]> {
    const result = await statement.all<BookmarkActivityRow>();
    return result.results.map((row) => row.bookmark_id);
  }

  return {
    async recordOpen(userId, bookmarkId) {
      await db
        .prepare(
          `INSERT INTO bookmark_activity (
            id,
            bookmark_id,
            user_id,
            event_type,
            occurred_at
          ) VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          bookmarkId,
          userId,
          "open",
          new Date().toISOString()
        )
        .run();
    },
    async listRecentBookmarkIds(userId, limit = 5) {
      return selectBookmarkIds(
        db
          .prepare(
            `SELECT
              bookmark_id
            FROM bookmark_activity
            WHERE user_id = ? AND event_type = 'open'
            GROUP BY bookmark_id
            ORDER BY MAX(occurred_at) DESC
            LIMIT ?`
          )
          .bind(userId, limit)
      );
    },
    async listFrequentBookmarkIds(userId, limit = 5) {
      return selectBookmarkIds(
        db
          .prepare(
            `SELECT
              bookmark_id
            FROM bookmark_activity
            WHERE user_id = ? AND event_type = 'open'
            GROUP BY bookmark_id
            ORDER BY COUNT(*) DESC, MAX(occurred_at) DESC
            LIMIT ?`
          )
          .bind(userId, limit)
      );
    }
  };
}
