import type { Bookmark, CreateBookmarkRequest, UpdateBookmarkRequest } from "@bookmark/shared";

export type BookmarkDisplayRow = {
  id: string;
  user_title: string | null;
  source_title: string | null;
  user_content: string | null;
  source_content: string | null;
  user_summary: string | null;
  source_summary: string | null;
};

type BookmarkRow = {
  id: string;
  user_id: string;
  folder_id: string | null;
  url: string;
  normalized_url: string;
  is_favorite: number;
  bookmark_color: string | null;
  url_color: string | null;
  source_title: string | null;
  source_content: string | null;
  source_summary: string | null;
  user_title: string | null;
  user_content: string | null;
  user_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type BookmarkRecord = Bookmark & {
  userId: string;
  normalizedUrl: string;
};

export type CreateBookmarkInput = CreateBookmarkRequest & {
  userId: string;
  normalizedUrl: string;
};

export type UpdateBookmarkInput = UpdateBookmarkRequest;

export type BookmarkRepository = {
  listByUser(userId: string): Promise<BookmarkRecord[]>;
  create(input: CreateBookmarkInput): Promise<BookmarkRecord>;
  getByUserAndId(userId: string, bookmarkId: string): Promise<BookmarkRecord | null>;
  update(
    bookmarkId: string,
    userId: string,
    input: UpdateBookmarkInput
  ): Promise<BookmarkRecord | null>;
};

export function toDisplayBookmark(row: BookmarkDisplayRow) {
  return {
    ...row,
    displayTitle: row.user_title ?? row.source_title ?? "",
    displayContent: row.user_content ?? row.source_content ?? "",
    displaySummary: row.user_summary ?? row.source_summary ?? ""
  };
}

function toBookmarkRecord(row: BookmarkRow): BookmarkRecord {
  const display = toDisplayBookmark({
    id: row.id,
    user_title: row.user_title,
    source_title: row.source_title,
    user_content: row.user_content,
    source_content: row.source_content,
    user_summary: row.user_summary,
    source_summary: row.source_summary
  });

  return {
    id: row.id,
    userId: row.user_id,
    folderId: row.folder_id,
    url: row.url,
    normalizedUrl: row.normalized_url,
    isFavorite: row.is_favorite === 1,
    bookmarkColor: row.bookmark_color,
    urlColor: row.url_color,
    sourceTitle: row.source_title,
    sourceContent: row.source_content,
    sourceSummary: row.source_summary,
    userTitle: row.user_title,
    userContent: row.user_content,
    userSummary: row.user_summary,
    displayTitle: display.displayTitle,
    displayContent: display.displayContent,
    displaySummary: display.displaySummary,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toBookmarkResponse(bookmark: BookmarkRecord): Bookmark {
  return {
    id: bookmark.id,
    folderId: bookmark.folderId,
    url: bookmark.url,
    isFavorite: bookmark.isFavorite,
    bookmarkColor: bookmark.bookmarkColor,
    urlColor: bookmark.urlColor,
    sourceTitle: bookmark.sourceTitle,
    sourceContent: bookmark.sourceContent,
    sourceSummary: bookmark.sourceSummary,
    userTitle: bookmark.userTitle,
    userContent: bookmark.userContent,
    userSummary: bookmark.userSummary,
    displayTitle: bookmark.displayTitle,
    displayContent: bookmark.displayContent,
    displaySummary: bookmark.displaySummary,
    createdAt: bookmark.createdAt,
    updatedAt: bookmark.updatedAt
  };
}

export function normalizeBookmarkUrl(url: string) {
  return new URL(url).toString();
}

export function createBookmarkRepository(db: D1Database): BookmarkRepository {
  async function getByUserAndId(userId: string, bookmarkId: string) {
    const row = await db
      .prepare(
        `SELECT
          id,
          user_id,
          folder_id,
          url,
          normalized_url,
          is_favorite,
          bookmark_color,
          url_color,
          source_title,
          source_content,
          source_summary,
          user_title,
          user_content,
          user_summary,
          created_at,
          updated_at
        FROM bookmarks
        WHERE user_id = ? AND id = ?`
      )
      .bind(userId, bookmarkId)
      .first<BookmarkRow>();

    return row ? toBookmarkRecord(row) : null;
  }

  return {
    async listByUser(userId) {
      const result = await db
        .prepare(
          `SELECT
            id,
            user_id,
            folder_id,
            url,
            normalized_url,
            is_favorite,
            bookmark_color,
            url_color,
            source_title,
            source_content,
            source_summary,
            user_title,
            user_content,
            user_summary,
            created_at,
            updated_at
          FROM bookmarks
          WHERE user_id = ?
          ORDER BY created_at DESC`
        )
        .bind(userId)
        .all<BookmarkRow>();

      return result.results.map(toBookmarkRecord);
    },
    async create(input) {
      const bookmarkId = crypto.randomUUID();
      const now = new Date().toISOString();

      await db
        .prepare(
          `INSERT INTO bookmarks (
            id,
            user_id,
            folder_id,
            url,
            normalized_url,
            is_favorite,
            bookmark_color,
            url_color,
            source_title,
            source_content,
            source_summary,
            user_title,
            user_content,
            user_summary,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          bookmarkId,
          input.userId,
          input.folderId ?? null,
          input.url,
          input.normalizedUrl,
          input.isFavorite ? 1 : 0,
          input.bookmarkColor ?? null,
          input.urlColor ?? null,
          input.sourceTitle ?? null,
          input.sourceContent ?? null,
          input.sourceSummary ?? null,
          input.userTitle ?? null,
          input.userContent ?? null,
          input.userSummary ?? null,
          now,
          now
        )
        .run();

      const bookmark = await getByUserAndId(input.userId, bookmarkId);
      if (!bookmark) {
        throw new Error("bookmark_create_failed");
      }

      return bookmark;
    },
    getByUserAndId,
    async update(bookmarkId, userId, input) {
      const assignments: string[] = [];
      const values: Array<string | number | null> = [];

      if ("folderId" in input) {
        assignments.push("folder_id = ?");
        values.push(input.folderId ?? null);
      }
      if ("userTitle" in input) {
        assignments.push("user_title = ?");
        values.push(input.userTitle ?? null);
      }
      if ("userContent" in input) {
        assignments.push("user_content = ?");
        values.push(input.userContent ?? null);
      }
      if ("userSummary" in input) {
        assignments.push("user_summary = ?");
        values.push(input.userSummary ?? null);
      }
      if ("isFavorite" in input) {
        assignments.push("is_favorite = ?");
        values.push(input.isFavorite ? 1 : 0);
      }
      if ("bookmarkColor" in input) {
        assignments.push("bookmark_color = ?");
        values.push(input.bookmarkColor ?? null);
      }
      if ("urlColor" in input) {
        assignments.push("url_color = ?");
        values.push(input.urlColor ?? null);
      }

      if (assignments.length === 0) {
        return getByUserAndId(userId, bookmarkId);
      }

      assignments.push("updated_at = ?");
      values.push(new Date().toISOString());

      await db
        .prepare(
          `UPDATE bookmarks
          SET ${assignments.join(", ")}
          WHERE id = ? AND user_id = ?`
        )
        .bind(...values, bookmarkId, userId)
        .run();

      return getByUserAndId(userId, bookmarkId);
    }
  };
}
