type BookmarkActivityRow = {
  bookmark_id: string;
};

type BookmarkOpenStatRow = {
  bookmark_id: string;
  open_count: number;
  last_opened_at: string;
};

export type BookmarkOpenStat = {
  bookmarkId: string;
  openCount: number;
  lastOpenedAt: string;
};

export type BookmarkActivityRepository = {
  recordOpen(userId: string, bookmarkId: string): Promise<void>;
  listRecentBookmarkIds(userId: string, limit?: number): Promise<string[]>;
  listFrequentBookmarkIds(userId: string, limit?: number): Promise<string[]>;
  listOpenStats(userId: string, limit?: number): Promise<BookmarkOpenStat[]>;
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
      const stats = await this.listOpenStats(userId, limit);
      return stats.map((entry) => entry.bookmarkId);
    },
    async listFrequentBookmarkIds(userId, limit = 5) {
      const stats = await this.listOpenStats(userId);
      return stats
        .slice()
        .sort(
          (left, right) =>
            right.openCount - left.openCount ||
            right.lastOpenedAt.localeCompare(left.lastOpenedAt)
        )
        .slice(0, limit)
        .map((entry) => entry.bookmarkId);
    },
    async listOpenStats(userId, limit = 50) {
      const result = await db
        .prepare(
          `SELECT
            bookmark_id,
            COUNT(*) AS open_count,
            MAX(occurred_at) AS last_opened_at
          FROM bookmark_activity
          WHERE user_id = ? AND event_type = 'open'
          GROUP BY bookmark_id
          ORDER BY last_opened_at DESC, open_count DESC
          LIMIT ?`
        )
        .bind(userId, limit)
        .all<BookmarkOpenStatRow>();

      return result.results.map((row) => ({
        bookmarkId: row.bookmark_id,
        openCount: Number(row.open_count),
        lastOpenedAt: row.last_opened_at
      }));
    }
  };
}
