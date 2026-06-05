import type {
  Bookmark,
  BookmarkCounts,
  BookmarkTrashMode,
  BookmarkSearchMode,
  BookmarkSortMode,
  BookmarkTagMode,
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
  is_hidden: number;
  trashed_at: string | null;
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

type BookmarkCountRow = {
  folder_id: string | null;
  is_hidden: number;
  is_favorite: number;
  is_trashed: number;
  count: number;
};

type BookmarkRecommendationSection = "favorites" | "recent" | "frequent";

type BookmarkRecommendationRow = BookmarkRow & {
  recommendation_section: BookmarkRecommendationSection;
  recommendation_rank: number;
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
  folderIds?: string[];
  tagIds?: string[];
  tagMode?: BookmarkTagMode;
  trashMode?: BookmarkTrashMode;
  bookmarkColor?: string;
  urlColor?: string;
  summaryState?: "with" | "without";
};

export type BookmarkListOptions = {
  contentMode?: "full" | "summary";
};

export type BookmarkListPagination = {
  limit: number;
  offset: number;
};

export type BookmarkSearchQuery = {
  query: string;
  mode: BookmarkSearchMode;
};

export type BookmarkPageOptions = BookmarkListOptions & {
  pagination: BookmarkListPagination;
  search?: BookmarkSearchQuery;
  sort?: BookmarkSortMode;
};

export type BookmarkListPage = {
  bookmarks: BookmarkRecord[];
  total: number;
};

export type BookmarkRecommendationOptions = BookmarkListOptions & {
  limit?: number;
};

export type BookmarkRecommendationSections = Record<
  BookmarkRecommendationSection,
  BookmarkRecord[]
>;

export type BookmarkRepository = {
  listByUser(
    userId: string,
    filters?: BookmarkListFilters,
    options?: BookmarkListOptions
  ): Promise<BookmarkRecord[]>;
  countByUser?(userId: string): Promise<BookmarkCounts>;
  pageByUser?(
    userId: string,
    filters?: BookmarkListFilters,
    options?: BookmarkPageOptions
  ): Promise<BookmarkListPage>;
  listRecommendationsByUser?(
    userId: string,
    options?: BookmarkRecommendationOptions
  ): Promise<BookmarkRecommendationSections>;
  searchByUser(
    userId: string,
    query: string,
    mode: BookmarkSearchMode,
    filters?: BookmarkListFilters,
    options?: BookmarkListOptions
  ): Promise<BookmarkRecord[]>;
  create(input: CreateBookmarkInput): Promise<BookmarkRecord>;
  getByUserAndId(userId: string, bookmarkId: string): Promise<BookmarkRecord | null>;
  delete(bookmarkId: string, userId: string): Promise<boolean>;
  restore(bookmarkId: string, userId: string): Promise<BookmarkRecord | null>;
  permanentlyDelete(bookmarkId: string, userId: string): Promise<boolean>;
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
    isHidden: row.is_hidden === 1,
    isTrashed: row.trashed_at !== null,
    trashedAt: row.trashed_at,
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
    isHidden: bookmark.isHidden,
    isTrashed: bookmark.isTrashed,
    trashedAt: bookmark.trashedAt,
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

function truncateBookmarkListText(value: string) {
  const normalizedValue = value.trim();
  if (normalizedValue.length <= 320) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 320).trimEnd()}...`;
}

export function toBookmarkListResponse(bookmark: BookmarkRecord): Bookmark {
  return {
    ...toBookmarkResponse(bookmark),
    sourceContent: null,
    userContent: null,
    displayContent: truncateBookmarkListText(bookmark.displayContent),
    contentTruncated: true
  };
}

function createBookmarkCountBucket() {
  return {
    total: 0,
    visible: 0
  };
}

export function createEmptyBookmarkCounts(): BookmarkCounts {
  return {
    active: createBookmarkCountBucket(),
    favorite: createBookmarkCountBucket(),
    trashed: createBookmarkCountBucket(),
    unfiled: createBookmarkCountBucket(),
    byFolderId: {}
  };
}

function addToBookmarkCountBucket(
  bucket: { total: number; visible: number },
  count: number,
  isHidden: boolean
) {
  bucket.total += count;
  if (!isHidden) {
    bucket.visible += count;
  }
}

export function aggregateBookmarkCounts(
  bookmarks: Array<Pick<BookmarkRecord, "folderId" | "isFavorite" | "isHidden" | "isTrashed">>
): BookmarkCounts {
  const counts = createEmptyBookmarkCounts();

  for (const bookmark of bookmarks) {
    const isHidden = bookmark.isHidden === true;

    if (bookmark.isTrashed === true) {
      addToBookmarkCountBucket(counts.trashed, 1, isHidden);
      continue;
    }

    addToBookmarkCountBucket(counts.active, 1, isHidden);
    if (bookmark.isFavorite === true) {
      addToBookmarkCountBucket(counts.favorite, 1, isHidden);
    }

    if (!bookmark.folderId) {
      addToBookmarkCountBucket(counts.unfiled, 1, isHidden);
      continue;
    }

    const folderBucket = counts.byFolderId[bookmark.folderId] ?? createBookmarkCountBucket();
    addToBookmarkCountBucket(folderBucket, 1, isHidden);
    counts.byFolderId[bookmark.folderId] = folderBucket;
  }

  return counts;
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

  function escapeLikePattern(value: string) {
    return value.replace(/[\\%_]/g, "\\$&");
  }

  function addBookmarkSearchConditions(
    conditions: string[],
    values: Array<string | number>,
    userId: string,
    search?: BookmarkSearchQuery
  ) {
    const normalizedQuery = search?.query.trim().toLowerCase();
    if (!normalizedQuery) {
      return;
    }

    const likeQuery = `%${escapeLikePattern(normalizedQuery)}%`;
    const titleSearchSql =
      "LOWER(COALESCE(NULLIF(TRIM(COALESCE(user_title, source_title, '')), ''), url)) LIKE ? ESCAPE '\\'";
    const contentSearchSql =
      "LOWER(COALESCE(user_content, source_content, '')) LIKE ? ESCAPE '\\'";

    if (search.mode === "title") {
      conditions.push(titleSearchSql);
      values.push(likeQuery);
      return;
    }

    if (search.mode === "content") {
      conditions.push(contentSearchSql);
      values.push(likeQuery);
      return;
    }

    if (search.mode === "folder") {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM folders f
          WHERE f.id = bookmarks.folder_id
            AND f.user_id = ?
            AND LOWER(f.name) LIKE ? ESCAPE '\\'
        )`
      );
      values.push(userId, likeQuery);
      return;
    }

    conditions.push(
      `(
        ${titleSearchSql}
        OR LOWER(url) LIKE ? ESCAPE '\\'
        OR ${contentSearchSql}
        OR EXISTS (
          SELECT 1
          FROM bookmark_tags bt
          INNER JOIN tags t ON t.id = bt.tag_id
          WHERE bt.bookmark_id = bookmarks.id
            AND t.user_id = ?
            AND LOWER(t.name) LIKE ? ESCAPE '\\'
        )
      )`
    );
    values.push(likeQuery, likeQuery, likeQuery, userId, likeQuery);
  }

  function createBookmarkListQuery(
    userId: string,
    filters: BookmarkListFilters,
    search?: BookmarkSearchQuery
  ) {
    const conditions = ["bookmarks.user_id = ?"];
    const values: Array<string | number> = [userId];
    const trashMode = filters.trashMode ?? "active";

    if (trashMode === "active") {
      conditions.push("trashed_at IS NULL");
    } else if (trashMode === "trashed") {
      conditions.push("trashed_at IS NOT NULL");
    }

    if (filters.favoriteOnly) {
      conditions.push("is_favorite = ?");
      values.push(1);
    }

    if (filters.folderId) {
      conditions.push("folder_id = ?");
      values.push(filters.folderId);
    }

    if (filters.folderIds) {
      const normalizedFolderIds = Array.from(
        new Set(
          filters.folderIds
            .filter((folderId): folderId is string => typeof folderId === "string")
            .map((folderId) => folderId.trim())
        )
      );
      const concreteFolderIds = normalizedFolderIds.filter(Boolean);
      const includesUnfiled = normalizedFolderIds.some((folderId) => !folderId);

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

    const tagIds = normalizeTagIds(filters.tagIds);
    if (filters.tagIds && tagIds.length === 0 && filters.tagMode === "or") {
      conditions.push("0 = 1");
    } else if (tagIds.length > 0) {
      const placeholders = tagIds.map(() => "?").join(", ");

      if (filters.tagMode === "or") {
        conditions.push(
          `EXISTS (
            SELECT 1
            FROM bookmark_tags bt
            INNER JOIN tags t ON t.id = bt.tag_id
            WHERE bt.bookmark_id = bookmarks.id
              AND t.user_id = ?
              AND bt.tag_id IN (${placeholders})
          )`
        );
        values.push(userId, ...tagIds);
      } else {
        conditions.push(
          `(SELECT COUNT(DISTINCT bt.tag_id)
            FROM bookmark_tags bt
            INNER JOIN tags t ON t.id = bt.tag_id
            WHERE bt.bookmark_id = bookmarks.id
              AND t.user_id = ?
              AND bt.tag_id IN (${placeholders})
          ) = ?`
        );
        values.push(userId, ...tagIds, tagIds.length);
      }
    }

    if (filters.bookmarkColor) {
      conditions.push("LOWER(TRIM(COALESCE(bookmark_color, ''))) = ?");
      values.push(filters.bookmarkColor.trim().toLowerCase());
    }

    if (filters.urlColor) {
      conditions.push("LOWER(TRIM(COALESCE(url_color, ''))) = ?");
      values.push(filters.urlColor.trim().toLowerCase());
    }

    if (filters.summaryState === "with") {
      conditions.push("TRIM(COALESCE(user_summary, source_summary, '')) <> ''");
    } else if (filters.summaryState === "without") {
      conditions.push("TRIM(COALESCE(user_summary, source_summary, '')) = ''");
    }

    addBookmarkSearchConditions(conditions, values, userId, search);

    return {
      whereClause: conditions.join(" AND "),
      values
    };
  }

  type BookmarkListQueryOptions = BookmarkListOptions & {
    search?: BookmarkSearchQuery;
    pagination?: BookmarkListPagination;
    sort?: BookmarkSortMode;
  };

  function getBookmarkListOrderBy(sort: BookmarkSortMode = "created_desc") {
    const titleExpression =
      "LOWER(COALESCE(NULLIF(TRIM(COALESCE(user_title, source_title, '')), ''), url))";
    const siteExpression =
      "LOWER(REPLACE(REPLACE(REPLACE(normalized_url, 'https://www.', ''), 'http://www.', ''), 'https://', ''))";

    switch (sort) {
      case "created_asc":
        return "created_at ASC, id ASC";
      case "opened_desc":
        return [
          "CASE WHEN bookmark_open_stats.last_opened_at IS NULL THEN 1 ELSE 0 END ASC",
          "bookmark_open_stats.last_opened_at DESC",
          "bookmark_open_stats.open_count DESC",
          "created_at DESC",
          "id ASC"
        ].join(", ");
      case "title_asc":
        return `${titleExpression} ASC, created_at DESC, id ASC`;
      case "title_desc":
        return `${titleExpression} DESC, created_at DESC, id ASC`;
      case "site_asc":
        return `${siteExpression} ASC, ${titleExpression} ASC, created_at DESC, id ASC`;
      case "site_desc":
        return `${siteExpression} DESC, ${titleExpression} ASC, created_at DESC, id ASC`;
      default:
        return "created_at DESC, id ASC";
    }
  }

  async function listBookmarksByUser(
    userId: string,
    filters: BookmarkListFilters,
    options: BookmarkListQueryOptions = {}
  ) {
    const query = createBookmarkListQuery(userId, filters, options.search);
    const shouldSummarizeContent = options.contentMode === "summary";
    const sourceContentSelect = shouldSummarizeContent
      ? "SUBSTR(source_content, 1, 320) AS source_content"
      : "source_content";
    const userContentSelect = shouldSummarizeContent
      ? "SUBSTR(user_content, 1, 320) AS user_content"
      : "user_content";
    const paginationValues = options.pagination
      ? [options.pagination.limit, options.pagination.offset]
      : [];
    const paginationClause = options.pagination ? " LIMIT ? OFFSET ?" : "";
    const activityJoinValues = options.sort === "opened_desc" ? [userId] : [];
    const activityJoinClause =
      options.sort === "opened_desc"
        ? `LEFT JOIN (
          SELECT
            bookmark_id,
            COUNT(*) AS open_count,
            MAX(occurred_at) AS last_opened_at
          FROM bookmark_activity
          WHERE user_id = ? AND event_type = 'open'
          GROUP BY bookmark_id
        ) bookmark_open_stats ON bookmark_open_stats.bookmark_id = bookmarks.id`
        : "";
    const orderByClause = getBookmarkListOrderBy(options.sort);
    const result = await db
      .prepare(
        `SELECT
          id,
          user_id,
          folder_id,
          url,
          normalized_url,
          is_favorite,
          is_hidden,
          trashed_at,
          bookmark_color,
          url_color,
          source_title,
          ${sourceContentSelect},
          source_summary,
          user_title,
          ${userContentSelect},
          user_summary,
          created_at,
          updated_at
        FROM bookmarks
        ${activityJoinClause}
        WHERE ${query.whereClause}
        ORDER BY ${orderByClause}${paginationClause}`
      )
      .bind(...activityJoinValues, ...query.values, ...paginationValues)
      .all<BookmarkRow>();

    return attachBookmarkTagIds(userId, result.results.map(toBookmarkRecord));
  }

  async function countBookmarksByUser(
    userId: string,
    filters: BookmarkListFilters,
    search?: BookmarkSearchQuery
  ) {
    const query = createBookmarkListQuery(userId, filters, search);
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS total
        FROM bookmarks
        WHERE ${query.whereClause}`
      )
      .bind(...query.values)
      .first<{ total: number | string | null }>();
    const total = Number(row?.total ?? 0);

    return Number.isFinite(total) && total > 0 ? total : 0;
  }

  async function listRecommendationsByUser(
    userId: string,
    options: BookmarkRecommendationOptions = {}
  ): Promise<BookmarkRecommendationSections> {
    const limit =
      Number.isInteger(options.limit) && (options.limit ?? 0) > 0
        ? Math.min(options.limit ?? 5, 20)
        : 5;
    const shouldSummarizeContent = options.contentMode === "summary";
    const sourceContentSelect = shouldSummarizeContent
      ? "SUBSTR(b.source_content, 1, 320) AS source_content"
      : "b.source_content";
    const userContentSelect = shouldSummarizeContent
      ? "SUBSTR(b.user_content, 1, 320) AS user_content"
      : "b.user_content";
    const result = await db
      .prepare(
        `WITH open_stats AS (
          SELECT
            bookmark_id,
            COUNT(*) AS recommendation_open_count,
            MAX(occurred_at) AS recommendation_last_opened_at
          FROM bookmark_activity
          WHERE user_id = ? AND event_type = 'open'
          GROUP BY bookmark_id
        ),
        latest_context AS (
          SELECT
            b.id AS bookmark_id,
            b.folder_id
          FROM bookmarks b
          INNER JOIN open_stats os ON os.bookmark_id = b.id
          WHERE b.user_id = ? AND b.trashed_at IS NULL
          ORDER BY
            os.recommendation_last_opened_at DESC,
            os.recommendation_open_count DESC
          LIMIT 1
        ),
        active_bookmarks AS (
          SELECT
            b.id,
            b.user_id,
            b.folder_id,
            b.url,
            b.normalized_url,
            b.is_favorite,
            b.is_hidden,
            b.trashed_at,
            b.bookmark_color,
            b.url_color,
            b.source_title,
            ${sourceContentSelect},
            b.source_summary,
            b.user_title,
            ${userContentSelect},
            b.user_summary,
            b.created_at,
            b.updated_at,
            COALESCE(os.recommendation_open_count, 0) AS recommendation_open_count,
            os.recommendation_last_opened_at AS recommendation_last_opened_at,
            (
              CASE
                WHEN (SELECT folder_id FROM latest_context) IS NOT NULL
                  AND (SELECT folder_id FROM latest_context) = b.folder_id
                THEN 2
                ELSE 0
              END
              +
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM latest_context lc
                  INNER JOIN bookmark_tags context_bt
                    ON context_bt.bookmark_id = lc.bookmark_id
                  INNER JOIN bookmark_tags current_bt
                    ON current_bt.bookmark_id = b.id
                    AND current_bt.tag_id = context_bt.tag_id
                )
                THEN 1
                ELSE 0
              END
            ) AS recommendation_context_score
          FROM bookmarks b
          LEFT JOIN open_stats os ON os.bookmark_id = b.id
          WHERE b.user_id = ? AND b.trashed_at IS NULL
        ),
        favorites_ranked AS (
          SELECT
            0 AS recommendation_section_sort,
            'favorites' AS recommendation_section,
            ROW_NUMBER() OVER (
              ORDER BY
                recommendation_open_count DESC,
                COALESCE(recommendation_last_opened_at, '') DESC,
                recommendation_context_score DESC,
                updated_at DESC,
                created_at DESC,
                id ASC
            ) AS recommendation_rank,
            *
          FROM active_bookmarks
          WHERE is_favorite = 1
        ),
        recent_ranked AS (
          SELECT
            1 AS recommendation_section_sort,
            'recent' AS recommendation_section,
            ROW_NUMBER() OVER (
              ORDER BY
                CASE WHEN recommendation_last_opened_at IS NOT NULL THEN 1 ELSE 0 END DESC,
                COALESCE(recommendation_last_opened_at, '') DESC,
                recommendation_context_score DESC,
                is_favorite DESC,
                updated_at DESC,
                created_at DESC,
                id ASC
            ) AS recommendation_rank,
            *
          FROM active_bookmarks
        ),
        frequent_ranked AS (
          SELECT
            2 AS recommendation_section_sort,
            'frequent' AS recommendation_section,
            ROW_NUMBER() OVER (
              ORDER BY
                recommendation_open_count DESC,
                recommendation_context_score DESC,
                COALESCE(recommendation_last_opened_at, '') DESC,
                is_favorite DESC,
                updated_at DESC,
                created_at DESC,
                id ASC
            ) AS recommendation_rank,
            *
          FROM active_bookmarks
        )
        SELECT *
        FROM (
          SELECT * FROM favorites_ranked WHERE recommendation_rank <= ?
          UNION ALL
          SELECT * FROM recent_ranked WHERE recommendation_rank <= ?
          UNION ALL
          SELECT * FROM frequent_ranked WHERE recommendation_rank <= ?
        )
        ORDER BY recommendation_section_sort ASC, recommendation_rank ASC`
      )
      .bind(userId, userId, userId, limit, limit, limit)
      .all<BookmarkRecommendationRow>();

    const bookmarks = await attachBookmarkTagIds(
      userId,
      result.results.map((row) => toBookmarkRecord(row))
    );
    const sections: BookmarkRecommendationSections = {
      favorites: [],
      recent: [],
      frequent: []
    };

    result.results.forEach((row, index) => {
      const bookmark = bookmarks[index];
      if (bookmark) {
        sections[row.recommendation_section].push(bookmark);
      }
    });

    return sections;
  }

  function matchesBookmarkFilters(bookmark: BookmarkRecord, filters: BookmarkListFilters) {
    const normalizedBookmarkColor = bookmark.bookmarkColor?.trim().toLowerCase() ?? "";
    const normalizedUrlColor = bookmark.urlColor?.trim().toLowerCase() ?? "";

    if (filters.favoriteOnly && !bookmark.isFavorite) {
      return false;
    }

    const trashMode = filters.trashMode ?? "active";
    if (trashMode === "active" && bookmark.isTrashed) {
      return false;
    }
    if (trashMode === "trashed" && !bookmark.isTrashed) {
      return false;
    }

    if (filters.folderId && bookmark.folderId !== filters.folderId) {
      return false;
    }

    if (filters.folderIds && !filters.folderIds.includes(bookmark.folderId ?? "")) {
      return false;
    }

    if (filters.tagIds) {
      const filterTagIds = normalizeTagIds(filters.tagIds);
      if (filterTagIds.length === 0 && filters.tagMode === "or") {
        return false;
      }

      const tagMatcher =
        filters.tagMode === "or"
          ? filterTagIds.some((tagId) => bookmark.tagIds.includes(tagId))
          : filterTagIds.every((tagId) => bookmark.tagIds.includes(tagId));

      if (!tagMatcher) {
        return false;
      }
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
          is_hidden,
          trashed_at,
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
    listRecommendationsByUser,
    async pageByUser(userId, filters = {}, options) {
      if (!options?.pagination) {
        throw new Error("missing_pagination");
      }

      const search =
        options.search && options.search.query.trim().length > 0
          ? options.search
          : undefined;
      const [bookmarks, total] = await Promise.all([
        listBookmarksByUser(userId, filters, {
          contentMode: options.contentMode,
          pagination: options.pagination,
          search,
          sort: options.sort
        }),
        countBookmarksByUser(userId, filters, search)
      ]);

      return {
        bookmarks,
        total
      };
    },
    async countByUser(userId) {
      const result = await db
        .prepare(
          `SELECT
            folder_id,
            is_hidden,
            is_favorite,
            CASE WHEN trashed_at IS NULL THEN 0 ELSE 1 END AS is_trashed,
            COUNT(*) AS count
          FROM bookmarks
          WHERE user_id = ?
          GROUP BY folder_id, is_hidden, is_favorite, is_trashed`
        )
        .bind(userId)
        .all<BookmarkCountRow>();
      const counts = createEmptyBookmarkCounts();

      for (const row of result.results) {
        const rowCount = Number(row.count);
        if (!Number.isFinite(rowCount) || rowCount <= 0) {
          continue;
        }

        const isHidden = row.is_hidden === 1;
        if (row.is_trashed === 1) {
          addToBookmarkCountBucket(counts.trashed, rowCount, isHidden);
          continue;
        }

        addToBookmarkCountBucket(counts.active, rowCount, isHidden);
        if (row.is_favorite === 1) {
          addToBookmarkCountBucket(counts.favorite, rowCount, isHidden);
        }

        if (!row.folder_id) {
          addToBookmarkCountBucket(counts.unfiled, rowCount, isHidden);
          continue;
        }

        const folderBucket = counts.byFolderId[row.folder_id] ?? createBookmarkCountBucket();
        addToBookmarkCountBucket(folderBucket, rowCount, isHidden);
        counts.byFolderId[row.folder_id] = folderBucket;
      }

      return counts;
    },
    async listByUser(userId, filters = {}, options = {}) {
      const bookmarks = await listBookmarksByUser(userId, filters, options);
      return bookmarks.filter((bookmark) => matchesBookmarkFilters(bookmark, filters));
    },
    async searchByUser(userId, query, mode, filters = {}, options = {}) {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) {
        return this.listByUser(userId, filters, options);
      }

      const bookmarks = await listBookmarksByUser(userId, filters, {
        ...options,
        search: {
          query: normalizedQuery,
          mode
        }
      });
      return bookmarks.filter((bookmark) => matchesBookmarkFilters(bookmark, filters));
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
          is_hidden,
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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          bookmarkId,
          input.userId,
          input.folderId ?? null,
          input.url,
          input.normalizedUrl,
          input.isFavorite ? 1 : 0,
          input.isHidden ? 1 : 0,
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

      if (existingBookmark.isTrashed) {
        return true;
      }

      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE bookmarks
          SET trashed_at = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`
        )
        .bind(now, now, bookmarkId, userId)
        .run();

      return true;
    },
    async restore(bookmarkId, userId) {
      const existingBookmark = await getByUserAndId(userId, bookmarkId);
      if (!existingBookmark) {
        return null;
      }

      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE bookmarks
          SET trashed_at = ?, updated_at = ?
          WHERE id = ? AND user_id = ?`
        )
        .bind(null, now, bookmarkId, userId)
        .run();

      return getByUserAndId(userId, bookmarkId);
    },
    async permanentlyDelete(bookmarkId, userId) {
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

      if ("url" in input) {
        const normalizedUrl = normalizeBookmarkUrl(input.url ?? "");
        assignments.push("url = ?");
        values.push(normalizedUrl);
        assignments.push("normalized_url = ?");
        values.push(normalizedUrl);
      }
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
      if ("isHidden" in input) {
        assignments.push("is_hidden = ?");
        values.push(input.isHidden ? 1 : 0);
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
