import type {
  Bookmark,
  BookmarkSearchMode,
  CreateBookmarkRequest,
  UpdateBookmarkRequest
} from "@bookmark/shared";

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

type BookmarkTagRow = {
  bookmark_id: string;
  tag_id: string;
};

type BookmarkTagNameRow = {
  bookmark_id: string;
  name: string;
};

type FolderRow = {
  id: string;
  name: string;
};

export type BookmarkRecord = Bookmark & {
  userId: string;
  normalizedUrl: string;
};

export type CreateBookmarkInput = CreateBookmarkRequest & {
  userId: string;
  normalizedUrl: string;
};

export type UpdateBookmarkInput = UpdateBookmarkRequest & {
  sourceTitle?: string | null;
  sourceContent?: string | null;
  sourceSummary?: string | null;
};

export type BookmarkListFilters = {
  favoriteOnly?: boolean;
  folderId?: string;
  tagIds?: string[];
  bookmarkColor?: string;
  urlColor?: string;
  summaryState?: "with" | "without";
};

export type BookmarkRepository = {
  listByUser(userId: string, filters?: BookmarkListFilters): Promise<BookmarkRecord[]>;
  searchByUser(
    userId: string,
    query: string,
    mode: BookmarkSearchMode,
    filters?: BookmarkListFilters
  ): Promise<BookmarkRecord[]>;
  create(input: CreateBookmarkInput): Promise<BookmarkRecord>;
  getByUserAndId(userId: string, bookmarkId: string): Promise<BookmarkRecord | null>;
  delete(bookmarkId: string, userId: string): Promise<boolean>;
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
    tagIds: [],
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
    tagIds: bookmark.tagIds,
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
  async function loadBookmarkTagIds(userId: string, bookmarkIds: string[]) {
    const tagIdsByBookmarkId = new Map<string, string[]>();

    if (bookmarkIds.length === 0) {
      return tagIdsByBookmarkId;
    }

    const placeholders = bookmarkIds.map(() => "?").join(", ");
    const result = await db
      .prepare(
        `SELECT
          bt.bookmark_id,
          bt.tag_id
        FROM bookmark_tags bt
        INNER JOIN tags t ON t.id = bt.tag_id
        WHERE t.user_id = ? AND bt.bookmark_id IN (${placeholders})
        ORDER BY bt.bookmark_id ASC, bt.tag_id ASC`
      )
      .bind(userId, ...bookmarkIds)
      .all<BookmarkTagRow>();

    for (const row of result.results) {
      const currentTagIds = tagIdsByBookmarkId.get(row.bookmark_id) ?? [];
      currentTagIds.push(row.tag_id);
      tagIdsByBookmarkId.set(row.bookmark_id, currentTagIds);
    }

    return tagIdsByBookmarkId;
  }

  async function attachBookmarkTagIds(userId: string, bookmarks: BookmarkRecord[]) {
    const tagIdsByBookmarkId = await loadBookmarkTagIds(
      userId,
      bookmarks.map((bookmark) => bookmark.id)
    );

    return bookmarks.map((bookmark) => ({
      ...bookmark,
      tagIds: tagIdsByBookmarkId.get(bookmark.id) ?? []
    }));
  }

  async function loadBookmarkTagNames(userId: string, bookmarkIds: string[]) {
    const tagNamesByBookmarkId = new Map<string, string[]>();

    if (bookmarkIds.length === 0) {
      return tagNamesByBookmarkId;
    }

    const placeholders = bookmarkIds.map(() => "?").join(", ");
    const result = await db
      .prepare(
        `SELECT
          bt.bookmark_id,
          t.name
        FROM bookmark_tags bt
        INNER JOIN tags t ON t.id = bt.tag_id
        WHERE t.user_id = ? AND bt.bookmark_id IN (${placeholders})
        ORDER BY bt.bookmark_id ASC, t.name ASC`
      )
      .bind(userId, ...bookmarkIds)
      .all<BookmarkTagNameRow>();

    for (const row of result.results) {
      const currentNames = tagNamesByBookmarkId.get(row.bookmark_id) ?? [];
      currentNames.push(row.name);
      tagNamesByBookmarkId.set(row.bookmark_id, currentNames);
    }

    return tagNamesByBookmarkId;
  }

  async function loadFolderNames(userId: string, folderIds: string[]) {
    const folderNamesById = new Map<string, string>();

    if (folderIds.length === 0) {
      return folderNamesById;
    }

    const placeholders = folderIds.map(() => "?").join(", ");
    const result = await db
      .prepare(
        `SELECT
          id,
          name
        FROM folders
        WHERE user_id = ? AND id IN (${placeholders})`
      )
      .bind(userId, ...folderIds)
      .all<FolderRow>();

    for (const row of result.results) {
      folderNamesById.set(row.id, row.name);
    }

    return folderNamesById;
  }

  async function listBookmarksByUser(userId: string) {
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

    return attachBookmarkTagIds(userId, result.results.map(toBookmarkRecord));
  }

  function matchesBookmarkQuery(
    bookmark: BookmarkRecord,
    query: string,
    mode: BookmarkSearchMode,
    tagNames: string[],
    folderName: string
  ) {
    const normalizedQuery = query.toLowerCase();

    if (mode === "title") {
      return bookmark.displayTitle.toLowerCase().includes(normalizedQuery);
    }

    if (mode === "content") {
      return bookmark.displayContent.toLowerCase().includes(normalizedQuery);
    }

    if (mode === "folder") {
      return folderName.toLowerCase().includes(normalizedQuery);
    }

    const tagText = tagNames.join(" ").toLowerCase();
    return (
      bookmark.displayTitle.toLowerCase().includes(normalizedQuery) ||
      bookmark.displayContent.toLowerCase().includes(normalizedQuery) ||
      tagText.includes(normalizedQuery)
    );
  }

  function matchesBookmarkFilters(bookmark: BookmarkRecord, filters: BookmarkListFilters) {
    const normalizedBookmarkColor = bookmark.bookmarkColor?.trim().toLowerCase() ?? "";
    const normalizedUrlColor = bookmark.urlColor?.trim().toLowerCase() ?? "";

    if (filters.favoriteOnly && !bookmark.isFavorite) {
      return false;
    }

    if (filters.folderId && bookmark.folderId !== filters.folderId) {
      return false;
    }

    if (filters.tagIds && !filters.tagIds.every((tagId) => bookmark.tagIds.includes(tagId))) {
      return false;
    }

    if (
      filters.bookmarkColor &&
      normalizedBookmarkColor !== filters.bookmarkColor.trim().toLowerCase()
    ) {
      return false;
    }

    if (filters.urlColor && normalizedUrlColor !== filters.urlColor.trim().toLowerCase()) {
      return false;
    }

    if (filters.summaryState === "with" && bookmark.displaySummary.trim().length === 0) {
      return false;
    }

    if (filters.summaryState === "without" && bookmark.displaySummary.trim().length > 0) {
      return false;
    }

    return true;
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

  async function assertOwnedTagIds(userId: string, tagIds: string[]) {
    const normalizedTagIds = normalizeTagIds(tagIds);
    if (normalizedTagIds.length === 0) {
      return normalizedTagIds;
    }

    const placeholders = normalizedTagIds.map(() => "?").join(", ");
    const result = await db
      .prepare(
        `SELECT id
        FROM tags
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

  async function replaceBookmarkTags(bookmarkId: string, tagIds: string[]) {
    await db
      .prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?")
      .bind(bookmarkId)
      .run();

    if (tagIds.length === 0) {
      return;
    }

    await db.batch(
      tagIds.map((tagId) =>
        db
          .prepare(
            `INSERT INTO bookmark_tags (
              bookmark_id,
              tag_id
            ) VALUES (?, ?)`
          )
          .bind(bookmarkId, tagId)
      )
    );
  }

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

    if (!row) {
      return null;
    }

    const [bookmark] = await attachBookmarkTagIds(userId, [toBookmarkRecord(row)]);
    return bookmark ?? null;
  }

  return {
    async listByUser(userId, filters = {}) {
      const bookmarks = await listBookmarksByUser(userId);
      return bookmarks.filter((bookmark) => matchesBookmarkFilters(bookmark, filters));
    },
    async searchByUser(userId, query, mode, filters = {}) {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) {
        return this.listByUser(userId, filters);
      }

      const bookmarks = await this.listByUser(userId, filters);
      const tagNamesByBookmarkId = await loadBookmarkTagNames(
        userId,
        bookmarks.map((bookmark) => bookmark.id)
      );
      const folderNamesById = await loadFolderNames(
        userId,
        Array.from(
          new Set(
            bookmarks
              .map((bookmark) => bookmark.folderId)
              .filter((folderId): folderId is string => Boolean(folderId))
          )
        )
      );

      return bookmarks.filter((bookmark) =>
        matchesBookmarkQuery(
          bookmark,
          normalizedQuery,
          mode,
          tagNamesByBookmarkId.get(bookmark.id) ?? [],
          bookmark.folderId ? folderNamesById.get(bookmark.folderId) ?? "" : ""
        )
      );
    },
    async create(input) {
      const bookmarkId = crypto.randomUUID();
      const now = new Date().toISOString();
      const tagIds = await assertOwnedTagIds(input.userId, input.tagIds ?? []);

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

      await replaceBookmarkTags(bookmarkId, tagIds);

      const bookmark = await getByUserAndId(input.userId, bookmarkId);
      if (!bookmark) {
        throw new Error("bookmark_create_failed");
      }

      return bookmark;
    },
    getByUserAndId,
    async delete(bookmarkId, userId) {
      const existingBookmark = await getByUserAndId(userId, bookmarkId);
      if (!existingBookmark) {
        return false;
      }

      await db.batch([
        db
          .prepare("DELETE FROM bookmark_tags WHERE bookmark_id = ?")
          .bind(bookmarkId),
        db
          .prepare(
            `DELETE FROM bookmark_activity
            WHERE user_id = ? AND bookmark_id = ?`
          )
          .bind(userId, bookmarkId),
        db
          .prepare(
            `DELETE FROM bookmark_extraction_logs
            WHERE bookmark_id = ?`
          )
          .bind(bookmarkId),
        db
          .prepare(
            `DELETE FROM bookmark_assets
            WHERE user_id = ? AND bookmark_id = ?`
          )
          .bind(userId, bookmarkId),
        db
          .prepare(
            `DELETE FROM bookmarks
            WHERE id = ? AND user_id = ?`
          )
          .bind(bookmarkId, userId)
      ]);

      return true;
    },
    async update(bookmarkId, userId, input) {
      const existingBookmark = await getByUserAndId(userId, bookmarkId);
      if (!existingBookmark) {
        return null;
      }

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
      if ("sourceTitle" in input) {
        assignments.push("source_title = ?");
        values.push(input.sourceTitle ?? null);
      }
      if ("userContent" in input) {
        assignments.push("user_content = ?");
        values.push(input.userContent ?? null);
      }
      if ("sourceContent" in input) {
        assignments.push("source_content = ?");
        values.push(input.sourceContent ?? null);
      }
      if ("userSummary" in input) {
        assignments.push("user_summary = ?");
        values.push(input.userSummary ?? null);
      }
      if ("sourceSummary" in input) {
        assignments.push("source_summary = ?");
        values.push(input.sourceSummary ?? null);
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

      const nextTagIds =
        "tagIds" in input ? await assertOwnedTagIds(userId, input.tagIds ?? []) : null;

      if (assignments.length === 0 && nextTagIds === null) {
        return existingBookmark;
      }

      const updatedAt = new Date().toISOString();

      if (assignments.length > 0) {
        assignments.push("updated_at = ?");
        values.push(updatedAt);

        await db
          .prepare(
            `UPDATE bookmarks
            SET ${assignments.join(", ")}
            WHERE id = ? AND user_id = ?`
          )
          .bind(...values, bookmarkId, userId)
          .run();
      }

      if (nextTagIds !== null) {
        await replaceBookmarkTags(bookmarkId, nextTagIds);

        if (assignments.length === 0) {
          await db
            .prepare(
              `UPDATE bookmarks
              SET updated_at = ?
              WHERE id = ? AND user_id = ?`
            )
            .bind(updatedAt, bookmarkId, userId)
            .run();
        }
      }

      return getByUserAndId(userId, bookmarkId);
    }
  };
}
