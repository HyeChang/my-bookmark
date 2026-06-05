import { describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";

import {
  createBookmarkRepository,
  toDisplayBookmark
} from "../../src/lib/repositories/bookmarks";

describe("toDisplayBookmark", () => {
  it("prefers user fields over source fields", () => {
    const bookmark = toDisplayBookmark({
      id: "bookmark-1",
      user_title: "Manual title",
      source_title: "Source title",
      user_content: "Manual content",
      source_content: "Source content",
      user_summary: "Manual summary",
      source_summary: "Source summary"
    });

    expect(bookmark.displayTitle).toBe("Manual title");
    expect(bookmark.displayContent).toBe("Manual content");
    expect(bookmark.displaySummary).toBe("Manual summary");
  });

  it("falls back to source fields when user fields are empty", () => {
    const bookmark = toDisplayBookmark({
      id: "bookmark-2",
      user_title: null,
      source_title: "Source title",
      user_content: null,
      source_content: "Source content",
      user_summary: null,
      source_summary: "Source summary"
    });

    expect(bookmark.displayTitle).toBe("Source title");
    expect(bookmark.displayContent).toBe("Source content");
    expect(bookmark.displaySummary).toBe("Source summary");
  });
});

function createInMemoryD1() {
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

  const bookmarks = new Map<string, BookmarkRow>();

  function createStatement(sql: string) {
    const normalizedSql = sql.replace(/\s+/g, " ").trim();
    let params: unknown[] = [];

    const statement = {
      bind(...nextParams: unknown[]) {
        params = nextParams;
        return statement;
      },
      async run() {
        if (normalizedSql.startsWith("INSERT INTO bookmarks")) {
          const row: BookmarkRow = {
            id: String(params[0]),
            user_id: String(params[1]),
            folder_id: (params[2] as string | null) ?? null,
            url: String(params[3]),
            normalized_url: String(params[4]),
            is_favorite: Number(params[5] ?? 0),
            is_hidden: Number(params[6] ?? 0),
            trashed_at: null,
            bookmark_color: (params[7] as string | null) ?? null,
            url_color: (params[8] as string | null) ?? null,
            source_title: (params[9] as string | null) ?? null,
            source_content: (params[10] as string | null) ?? null,
            source_summary: (params[11] as string | null) ?? null,
            user_title: (params[12] as string | null) ?? null,
            user_content: (params[13] as string | null) ?? null,
            user_summary: (params[14] as string | null) ?? null,
            created_at: String(params[15]),
            updated_at: String(params[16])
          };

          bookmarks.set(row.id, row);
          return { success: true };
        }

        if (normalizedSql.startsWith("UPDATE bookmarks")) {
          const bookmarkId = String(params[params.length - 2]);
          const userId = String(params[params.length - 1]);
          const bookmark = bookmarks.get(bookmarkId);
          if (!bookmark || bookmark.user_id !== userId) {
            return { success: true };
          }

          let index = 0;
          const columnOrder: Array<keyof BookmarkRow> = [
            "url",
            "normalized_url",
            "folder_id",
            "user_title",
            "source_title",
            "user_content",
            "source_content",
            "user_summary",
            "source_summary",
            "is_favorite",
            "is_hidden",
            "trashed_at",
            "bookmark_color",
            "url_color"
          ];

          for (const column of columnOrder) {
            if (!normalizedSql.includes(`${column} = ?`)) {
              continue;
            }

            const value = params[index++];
            if (column === "is_favorite" || column === "is_hidden") {
              bookmark[column] = Number(value) as never;
            } else {
              bookmark[column] = (value as string | null) ?? null;
            }
          }

          if (normalizedSql.includes("updated_at = ?")) {
            bookmark.updated_at = String(params[index++]);
          }

          bookmarks.set(bookmarkId, bookmark);
          return { success: true };
        }

        if (normalizedSql.startsWith("DELETE FROM bookmarks")) {
          if (normalizedSql.includes("id IN")) {
            const userId = String(params[0]);
            const bookmarkIds = params.slice(1).map(String);
            for (const bookmarkId of bookmarkIds) {
              const bookmark = bookmarks.get(bookmarkId);
              if (bookmark?.user_id === userId && bookmark.trashed_at !== null) {
                bookmarks.delete(bookmarkId);
              }
            }
            return { success: true };
          }

          const bookmarkId = String(params[0]);
          const userId = String(params[1]);
          const bookmark = bookmarks.get(bookmarkId);
          if (bookmark?.user_id === userId) {
            bookmarks.delete(bookmarkId);
          }
          return { success: true };
        }

        return { success: true };
      },
      async first() {
        if (normalizedSql.includes("FROM bookmarks") && normalizedSql.includes("AND id = ?")) {
          const userId = String(params[0]);
          const bookmarkId = String(params[1]);
          const bookmark = bookmarks.get(bookmarkId);
          return bookmark && bookmark.user_id === userId ? bookmark : null;
        }

        return null;
      },
      async all() {
        if (normalizedSql.includes("FROM bookmarks")) {
          const userId = String(params[0]);
          const results = Array.from(bookmarks.values())
            .filter((bookmark) => bookmark.user_id === userId)
            .sort((left, right) => right.created_at.localeCompare(left.created_at));

          return { results };
        }

        return { results: [] };
      }
    };

    return statement;
  }

  return {
    prepare(sql: string) {
      return createStatement(sql);
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      for (const statement of statements) {
        await statement.run();
      }
      return [];
    }
  } as unknown as D1Database;
}

function createRecordingD1() {
  const preparedStatements: Array<{ sql: string; params: unknown[] }> = [];

  function createStatement(sql: string) {
    const normalizedSql = sql.replace(/\s+/g, " ").trim();
    let params: unknown[] = [];

    const statement = {
      bind(...nextParams: unknown[]) {
        params = nextParams;
        preparedStatements.push({
          sql: normalizedSql,
          params: [...params]
        });
        return statement;
      },
      async run() {
        return { success: true };
      },
      async first() {
        return null;
      },
      async all() {
        return { results: [] };
      }
    };

    return statement;
  }

  return {
    db: {
      prepare(sql: string) {
        return createStatement(sql);
      },
      async batch(statements: Array<{ run: () => Promise<unknown> }>) {
        for (const statement of statements) {
          await statement.run();
        }
        return [];
      }
    } as unknown as D1Database,
    preparedStatements
  };
}

describe("createBookmarkRepository", () => {
  it("pushes scalar list filters into the bookmark SQL query", async () => {
    const { db, preparedStatements } = createRecordingD1();
    const repository = createBookmarkRepository(db);

    await repository.listByUser("user-1", {
      favoriteOnly: true,
      folderId: "folder-1",
      trashMode: "active",
      bookmarkColor: "#FFAA00",
      urlColor: "#112233",
      summaryState: "with"
    });

    const listStatement = preparedStatements.find((statement) =>
      statement.sql.includes("FROM bookmarks")
    );

    expect(listStatement?.sql).toContain("trashed_at IS NULL");
    expect(listStatement?.sql).toContain("is_favorite = ?");
    expect(listStatement?.sql).toContain("folder_id = ?");
    expect(listStatement?.sql).toContain("LOWER(TRIM(COALESCE(bookmark_color, ''))) = ?");
    expect(listStatement?.sql).toContain("LOWER(TRIM(COALESCE(url_color, ''))) = ?");
    expect(listStatement?.sql).toContain("TRIM(COALESCE(user_summary, source_summary, '')) <> ''");
    expect(listStatement?.params).toEqual([
      "user-1",
      1,
      "folder-1",
      "#ffaa00",
      "#112233"
    ]);
  });

  it("pushes tag intersection filters into the bookmark SQL query", async () => {
    const { db, preparedStatements } = createRecordingD1();
    const repository = createBookmarkRepository(db);

    await repository.listByUser("user-1", {
      tagIds: ["tag-a", " tag-b ", "tag-a"],
      tagMode: "and"
    });

    const listStatement = preparedStatements.find((statement) =>
      statement.sql.includes("FROM bookmarks")
    );

    expect(listStatement?.sql).toContain("COUNT(DISTINCT bt.tag_id)");
    expect(listStatement?.sql).toContain("bt.tag_id IN (?, ?)");
    expect(listStatement?.params).toEqual(["user-1", "user-1", "tag-a", "tag-b", 2]);
  });

  it("pushes all-mode search into the bookmark SQL query", async () => {
    const { db, preparedStatements } = createRecordingD1();
    const repository = createBookmarkRepository(db);

    await repository.searchByUser("user-1", "Alpha", "all", {
      favoriteOnly: true
    });

    const searchStatement = preparedStatements.find(
      (statement) =>
        statement.sql.includes("FROM bookmarks") &&
        statement.sql.includes("ORDER BY created_at DESC")
    );

    expect(searchStatement?.sql).toContain("LOWER(COALESCE(NULLIF(TRIM(COALESCE(user_title, source_title, '')), ''), url)) LIKE ? ESCAPE '\\'");
    expect(searchStatement?.sql).toContain("LOWER(url) LIKE ? ESCAPE '\\'");
    expect(searchStatement?.sql).toContain("LOWER(COALESCE(user_content, source_content, '')) LIKE ? ESCAPE '\\'");
    expect(searchStatement?.sql).toContain("LOWER(t.name) LIKE ? ESCAPE '\\'");
    expect(searchStatement?.params).toEqual([
      "user-1",
      1,
      "%alpha%",
      "%alpha%",
      "%alpha%",
      "user-1",
      "%alpha%"
    ]);
  });

  it("pushes folder search into the bookmark SQL query", async () => {
    const { db, preparedStatements } = createRecordingD1();
    const repository = createBookmarkRepository(db);

    await repository.searchByUser("user-1", "Work", "folder");

    const searchStatement = preparedStatements.find(
      (statement) =>
        statement.sql.includes("FROM bookmarks") &&
        statement.sql.includes("ORDER BY created_at DESC")
    );

    expect(searchStatement?.sql).toContain("FROM folders f");
    expect(searchStatement?.sql).toContain("f.id = bookmarks.folder_id");
    expect(searchStatement?.sql).toContain("LOWER(f.name) LIKE ? ESCAPE '\\'");
    expect(searchStatement?.params).toEqual(["user-1", "user-1", "%work%"]);
  });

  it("pushes paginated search pages into SQL with a matching count query", async () => {
    const { db, preparedStatements } = createRecordingD1();
    const repository = createBookmarkRepository(db) as ReturnType<
      typeof createBookmarkRepository
    > & {
      pageByUser(
        userId: string,
        filters: {
          favoriteOnly?: boolean;
        },
        options: {
          contentMode: "summary";
          pagination: { limit: number; offset: number };
          search: { query: string; mode: "all" };
        }
      ): Promise<{ bookmarks: unknown[]; total: number }>;
    };

    await repository.pageByUser(
      "user-1",
      {
        favoriteOnly: true
      },
      {
        contentMode: "summary",
        pagination: {
          limit: 20,
          offset: 40
        },
        search: {
          query: "Alpha",
          mode: "all"
        }
      }
    );

    const pageStatement = preparedStatements.find(
      (statement) =>
        statement.sql.includes("FROM bookmarks") &&
        statement.sql.includes("ORDER BY created_at DESC") &&
        statement.sql.includes("LIMIT ? OFFSET ?")
    );
    const countStatement = preparedStatements.find((statement) =>
      statement.sql.includes("COUNT(*) AS total")
    );

    expect(pageStatement?.sql).toContain("SUBSTR(source_content, 1, 320) AS source_content");
    expect(pageStatement?.params).toEqual([
      "user-1",
      1,
      "%alpha%",
      "%alpha%",
      "%alpha%",
      "user-1",
      "%alpha%",
      20,
      40
    ]);
    expect(countStatement?.sql).toContain("FROM bookmarks");
    expect(countStatement?.sql).toContain("is_favorite = ?");
    expect(countStatement?.sql).toContain("LOWER(url) LIKE ? ESCAPE '\\'");
    expect(countStatement?.sql).not.toContain("ORDER BY created_at DESC");
    expect(countStatement?.sql).not.toContain("LIMIT ? OFFSET ?");
    expect(countStatement?.params).toEqual([
      "user-1",
      1,
      "%alpha%",
      "%alpha%",
      "%alpha%",
      "user-1",
      "%alpha%"
    ]);
  });

  it("pushes requested sort order into paginated SQL", async () => {
    const { db, preparedStatements } = createRecordingD1();
    const repository = createBookmarkRepository(db) as ReturnType<
      typeof createBookmarkRepository
    > & {
      pageByUser(
        userId: string,
        filters: Record<string, never>,
        options: {
          contentMode: "summary";
          pagination: { limit: number; offset: number };
          sort: "created_asc" | "title_asc" | "title_desc" | "site_asc" | "site_desc";
        }
      ): Promise<{ bookmarks: unknown[]; total: number }>;
    };

    await repository.pageByUser("user-1", {}, {
      contentMode: "summary",
      pagination: {
        limit: 20,
        offset: 0
      },
      sort: "created_asc"
    });
    await repository.pageByUser("user-1", {}, {
      contentMode: "summary",
      pagination: {
        limit: 20,
        offset: 0
      },
      sort: "title_asc"
    });
    await repository.pageByUser("user-1", {}, {
      contentMode: "summary",
      pagination: {
        limit: 20,
        offset: 0
      },
      sort: "site_desc"
    });

    const pageStatements = preparedStatements.filter(
      (statement) =>
        statement.sql.includes("FROM bookmarks") &&
        statement.sql.includes("LIMIT ? OFFSET ?")
    );

    expect(pageStatements[0]?.sql).toContain("ORDER BY created_at ASC");
    expect(pageStatements[1]?.sql).toContain(
      "ORDER BY LOWER(COALESCE(NULLIF(TRIM(COALESCE(user_title, source_title, '')), ''), url)) ASC"
    );
    expect(pageStatements[2]?.sql).toContain("ORDER BY LOWER(REPLACE(");
    expect(pageStatements[2]?.sql).toContain("normalized_url");
    expect(pageStatements[2]?.sql).toContain(") DESC");
  });

  it("pushes opened-desc pagination into SQL with activity stats", async () => {
    const { db, preparedStatements } = createRecordingD1();
    const repository = createBookmarkRepository(db) as ReturnType<
      typeof createBookmarkRepository
    > & {
      pageByUser(
        userId: string,
        filters: Record<string, never>,
        options: {
          contentMode: "summary";
          pagination: { limit: number; offset: number };
          sort: "opened_desc";
        }
      ): Promise<{ bookmarks: unknown[]; total: number }>;
    };

    await repository.pageByUser("user-1", {}, {
      contentMode: "summary",
      pagination: {
        limit: 20,
        offset: 0
      },
      sort: "opened_desc"
    });

    const pageStatement = preparedStatements.find(
      (statement) =>
        statement.sql.includes("FROM bookmarks") &&
        statement.sql.includes("bookmark_activity") &&
        statement.sql.includes("LIMIT ? OFFSET ?")
    );

    expect(pageStatement?.sql).toContain("LEFT JOIN");
    expect(pageStatement?.sql).toContain("COUNT(*) AS open_count");
    expect(pageStatement?.sql).toContain("MAX(occurred_at) AS last_opened_at");
    expect(pageStatement?.sql).toContain(
      "ORDER BY CASE WHEN bookmark_open_stats.last_opened_at IS NULL THEN 1 ELSE 0 END ASC"
    );
    expect(pageStatement?.sql).toContain("bookmark_open_stats.last_opened_at DESC");
    expect(pageStatement?.params).toEqual(["user-1", "user-1", 20, 0]);
  });

  it("loads recommendation sections with a ranked SQL query", async () => {
    const { db, preparedStatements } = createRecordingD1();
    const repository = createBookmarkRepository(db) as ReturnType<
      typeof createBookmarkRepository
    > & {
      listRecommendationsByUser(
        userId: string,
        options: {
          contentMode: "summary";
          limit: number;
        }
      ): Promise<{ favorites: unknown[]; recent: unknown[]; frequent: unknown[] }>;
    };

    await repository.listRecommendationsByUser("user-1", {
      contentMode: "summary",
      limit: 5
    });

    const recommendationStatement = preparedStatements.find((statement) =>
      statement.sql.includes("recommendation_section")
    );

    expect(recommendationStatement?.sql).toContain("WITH open_stats AS");
    expect(recommendationStatement?.sql).toContain("FROM bookmark_activity");
    expect(recommendationStatement?.sql).toContain("latest_context AS");
    expect(recommendationStatement?.sql).toContain("ROW_NUMBER() OVER");
    expect(recommendationStatement?.sql).toContain("favorites");
    expect(recommendationStatement?.sql).toContain("recent");
    expect(recommendationStatement?.sql).toContain("frequent");
    expect(recommendationStatement?.sql).toContain("recommendation_rank <= ?");
    expect(recommendationStatement?.sql).toContain("trashed_at IS NULL");
    expect(recommendationStatement?.sql).toContain("SUBSTR(b.source_content, 1, 320) AS source_content");
    expect(recommendationStatement?.params).toEqual([
      "user-1",
      "user-1",
      "user-1",
      5,
      5,
      5
    ]);
  });

  it("uses aggregate SQL for bookmark count summaries", async () => {
    const { db, preparedStatements } = createRecordingD1();
    const repository = createBookmarkRepository(db);

    await repository.countByUser("user-1");

    const countStatement = preparedStatements.find((statement) =>
      statement.sql.includes("COUNT(*) AS count")
    );

    expect(countStatement?.sql).toContain("folder_id");
    expect(countStatement?.sql).toContain("is_hidden");
    expect(countStatement?.sql).toContain("is_favorite");
    expect(countStatement?.sql).toContain("CASE WHEN trashed_at IS NULL THEN 0 ELSE 1 END AS is_trashed");
    expect(countStatement?.sql).toContain("GROUP BY folder_id, is_hidden, is_favorite, is_trashed");
    expect(countStatement?.params).toEqual(["user-1"]);
  });

  it("persists hidden state through create, get, list, and update", async () => {
    const repository = createBookmarkRepository(createInMemoryD1());

    const created = await repository.create({
      userId: "user-1",
      normalizedUrl: "https://example.com/hidden",
      url: "https://example.com/hidden",
      isFavorite: false,
      isHidden: true
    });

    expect(created.isHidden).toBe(true);

    const fetched = await repository.getByUserAndId("user-1", created.id);
    expect(fetched?.isHidden).toBe(true);

    const listed = await repository.listByUser("user-1");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.isHidden).toBe(true);

    const updatedWithoutHidden = await repository.update(created.id, "user-1", {
      userTitle: "Renamed title"
    });

    expect(updatedWithoutHidden?.isHidden).toBe(true);

    const updatedHidden = await repository.update(created.id, "user-1", {
      isHidden: false
    });

    expect(updatedHidden?.isHidden).toBe(false);

    const fetchedAfterUpdate = await repository.getByUserAndId("user-1", created.id);
    expect(fetchedAfterUpdate?.isHidden).toBe(false);
  });

  it("persists URL changes through create, get, list, and update", async () => {
    const repository = createBookmarkRepository(createInMemoryD1());

    const created = await repository.create({
      userId: "user-1",
      normalizedUrl: "https://example.com/before",
      url: "https://example.com/before",
      isFavorite: false
    });

    const updated = await repository.update(created.id, "user-1", {
      url: "https://example.com/after?utm_source=test"
    });

    expect(updated?.url).toBe("https://example.com/after?utm_source=test");

    const fetched = await repository.getByUserAndId("user-1", created.id);
    expect(fetched?.url).toBe("https://example.com/after?utm_source=test");

    const listed = await repository.listByUser("user-1");
    expect(listed[0]?.url).toBe("https://example.com/after?utm_source=test");
  });

  it("moves bookmarks to trash, restores them, and permanently deletes them", async () => {
    const repository = createBookmarkRepository(createInMemoryD1());

    const created = await repository.create({
      userId: "user-1",
      normalizedUrl: "https://example.com/trash",
      url: "https://example.com/trash",
      userTitle: "Trash me"
    });

    expect(created.isTrashed).toBe(false);
    expect(created.trashedAt).toBeNull();

    await expect(repository.delete(created.id, "user-1")).resolves.toBe(true);

    await expect(repository.listByUser("user-1")).resolves.toEqual([]);

    const trashed = await repository.listByUser("user-1", { trashMode: "trashed" });
    expect(trashed).toHaveLength(1);
    expect(trashed[0]).toMatchObject({
      id: created.id,
      isTrashed: true
    });
    expect(trashed[0]?.trashedAt).toEqual(expect.any(String));

    const restored = await repository.restore(created.id, "user-1");
    expect(restored).toMatchObject({
      id: created.id,
      isTrashed: false,
      trashedAt: null
    });

    await expect(repository.listByUser("user-1")).resolves.toHaveLength(1);

    await repository.delete(created.id, "user-1");
    await expect(repository.permanentlyDelete(created.id, "user-1")).resolves.toBe(true);
    await expect(repository.listByUser("user-1", { trashMode: "all" })).resolves.toEqual([]);
  });

  it("empties only trashed bookmarks for one user", async () => {
    const repository = createBookmarkRepository(createInMemoryD1());

    const firstTrashed = await repository.create({
      userId: "user-1",
      normalizedUrl: "https://example.com/trash-one",
      url: "https://example.com/trash-one",
      userTitle: "Trash one"
    });
    const secondTrashed = await repository.create({
      userId: "user-1",
      normalizedUrl: "https://example.com/trash-two",
      url: "https://example.com/trash-two",
      userTitle: "Trash two"
    });
    const activeBookmark = await repository.create({
      userId: "user-1",
      normalizedUrl: "https://example.com/active",
      url: "https://example.com/active",
      userTitle: "Active bookmark"
    });
    const otherUserTrashed = await repository.create({
      userId: "user-2",
      normalizedUrl: "https://example.com/other-user-trash",
      url: "https://example.com/other-user-trash",
      userTitle: "Other user trash"
    });

    await repository.delete(firstTrashed.id, "user-1");
    await repository.delete(secondTrashed.id, "user-1");
    await repository.delete(otherUserTrashed.id, "user-2");

    await expect(repository.emptyTrash("user-1")).resolves.toBe(2);

    await expect(repository.listByUser("user-1", { trashMode: "trashed" })).resolves.toEqual([]);
    await expect(repository.listByUser("user-1")).resolves.toMatchObject([
      {
        id: activeBookmark.id,
        isTrashed: false
      }
    ]);
    await expect(repository.listByUser("user-2", { trashMode: "trashed" })).resolves.toMatchObject([
      {
        id: otherUserTrashed.id,
        isTrashed: true
      }
    ]);
  });

  it("persists hidden state through real D1 create, get, list, and update", async () => {
    const mf = new Miniflare({
      modules: true,
      script: "",
      d1Databases: { bookmark: "bookmark" }
    });

    try {
      const db = await mf.getD1Database("bookmark");
      for (const statement of [
        `CREATE TABLE users (
          id TEXT PRIMARY KEY,
          firebase_uid TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          name TEXT,
          avatar_url TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        `CREATE TABLE bookmarks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          folder_id TEXT,
          url TEXT NOT NULL,
          normalized_url TEXT NOT NULL,
          is_favorite INTEGER NOT NULL DEFAULT 0,
          is_hidden INTEGER NOT NULL DEFAULT 0,
          trashed_at TEXT,
          bookmark_color TEXT,
          url_color TEXT,
          source_title TEXT,
          source_content TEXT,
          source_summary TEXT,
          source_description TEXT,
          source_thumbnail_url TEXT,
          user_title TEXT,
          user_content TEXT,
          user_summary TEXT,
          extraction_status TEXT NOT NULL DEFAULT 'pending',
          summary_status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        `CREATE TABLE tags (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          color TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        `CREATE TABLE bookmark_tags (
          bookmark_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (bookmark_id, tag_id),
          FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id),
          FOREIGN KEY (tag_id) REFERENCES tags(id)
        )`,
        `CREATE TABLE bookmark_assets (
          id TEXT PRIMARY KEY,
          bookmark_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          asset_type TEXT NOT NULL,
          object_key TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          width INTEGER,
          height INTEGER,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        `CREATE TABLE bookmark_activity (
          id TEXT PRIMARY KEY,
          bookmark_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )`,
        `CREATE TABLE bookmark_extraction_logs (
          id TEXT PRIMARY KEY,
          bookmark_id TEXT NOT NULL,
          attempted_at TEXT NOT NULL,
          success INTEGER NOT NULL DEFAULT 0,
          failure_reason TEXT,
          extractor_source TEXT,
          FOREIGN KEY (bookmark_id) REFERENCES bookmarks(id)
        )`
      ]) {
        await db.prepare(statement).run();
      }

      await db
        .prepare(
          `INSERT INTO users (
            id,
            firebase_uid,
            email,
            name,
            avatar_url,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          "user-1",
          "firebase-user-1",
          "keygenerator25@gmail.com",
          "Bookmark Tester",
          "https://example.com/avatar.png",
          "2026-04-17T00:00:00.000Z",
          "2026-04-17T00:00:00.000Z"
        )
        .run();

      const repository = createBookmarkRepository(db);

      const created = await repository.create({
        userId: "user-1",
        normalizedUrl: "https://example.com/hidden-d1",
        url: "https://example.com/hidden-d1",
        isFavorite: false,
        isHidden: true
      });

      expect(created.isHidden).toBe(true);

      const fetched = await repository.getByUserAndId("user-1", created.id);
      expect(fetched?.isHidden).toBe(true);

      const listed = await repository.listByUser("user-1");
      expect(listed).toHaveLength(1);
      expect(listed[0]?.isHidden).toBe(true);

      const updatedWithoutHidden = await repository.update(created.id, "user-1", {
        userTitle: "D1 renamed title"
      });
      expect(updatedWithoutHidden?.isHidden).toBe(true);

      const updatedHidden = await repository.update(created.id, "user-1", {
        isHidden: false
      });
      expect(updatedHidden?.isHidden).toBe(false);

      const fetchedAfterUpdate = await repository.getByUserAndId("user-1", created.id);
      expect(fetchedAfterUpdate?.isHidden).toBe(false);

      await expect(repository.delete(created.id, "user-1")).resolves.toBe(true);
      await expect(repository.listByUser("user-1")).resolves.toEqual([]);
      const trashed = await repository.listByUser("user-1", { trashMode: "trashed" });
      expect(trashed[0]).toMatchObject({
        id: created.id,
        isTrashed: true
      });
      expect(trashed[0]?.trashedAt).toEqual(expect.any(String));

      const restored = await repository.restore(created.id, "user-1");
      expect(restored).toMatchObject({
        id: created.id,
        isTrashed: false,
        trashedAt: null
      });

      await repository.delete(created.id, "user-1");
      await expect(repository.permanentlyDelete(created.id, "user-1")).resolves.toBe(true);
      await expect(repository.listByUser("user-1", { trashMode: "all" })).resolves.toEqual([]);
    } finally {
      await mf.dispose();
    }
  });
});
