import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createSessionValue } from "../src/lib/auth/session";
import type { BookmarkOpenStat } from "../src/lib/repositories/bookmark-activity";
import type {
  BookmarkListFilters,
  BookmarkListOptions,
  BookmarkRecord,
  BookmarkRepository
} from "../src/lib/repositories/bookmarks";

const sessionSecret = "bookmark-recommendation-test-secret";
const fakeUser = {
  uid: "firebase-user-1",
  email: "user@example.com",
  name: "Bookmark Tester",
  picture: "https://example.com/avatar.png"
};

function createInMemoryBookmarkRepository(): BookmarkRepository & {
  getListCalls(): Array<{
    userId: string;
    filters: BookmarkListFilters;
    options: BookmarkListOptions | undefined;
  }>;
} {
  const bookmarks = new Map<string, BookmarkRecord>();
  const listCalls: Array<{
    userId: string;
    filters: BookmarkListFilters;
    options: BookmarkListOptions | undefined;
  }> = [];

  function createRecord(
    partial: Partial<BookmarkRecord> & {
      id: string;
      userId: string;
      url: string;
      normalizedUrl: string;
    }
  ): BookmarkRecord {
      return {
        id: partial.id,
        userId: partial.userId,
        folderId: partial.folderId ?? null,
        tagIds: partial.tagIds ?? [],
        url: partial.url,
        normalizedUrl: partial.normalizedUrl,
        isFavorite: partial.isFavorite ?? false,
        isHidden: partial.isHidden ?? false,
        isTrashed: partial.isTrashed ?? false,
        trashedAt: partial.trashedAt ?? null,
        bookmarkColor: partial.bookmarkColor ?? null,
      urlColor: partial.urlColor ?? null,
      sourceTitle: partial.sourceTitle ?? null,
      sourceContent: partial.sourceContent ?? null,
      sourceSummary: partial.sourceSummary ?? null,
      userTitle: partial.userTitle ?? null,
      userContent: partial.userContent ?? null,
      userSummary: partial.userSummary ?? null,
      displayTitle:
        partial.displayTitle ??
        partial.userTitle ??
        partial.sourceTitle ??
        "",
      displayContent:
        partial.displayContent ??
        partial.userContent ??
        partial.sourceContent ??
        "",
      displaySummary:
        partial.displaySummary ??
        partial.userSummary ??
        partial.sourceSummary ??
        "",
      createdAt: partial.createdAt ?? "2026-04-14T01:00:00.000Z",
      updatedAt: partial.updatedAt ?? "2026-04-14T01:00:00.000Z"
    };
  }

  const favoriteBookmark = createRecord({
    id: "bookmark-favorite-active",
    userId: fakeUser.uid,
    folderId: "folder-a",
    tagIds: ["tag-a"],
    url: "https://example.com/favorite-active",
    normalizedUrl: "https://example.com/favorite-active",
    isFavorite: true,
    userTitle: "Favorite active link",
    userContent: "Favorite active full content",
    updatedAt: "2026-04-14T03:00:00.000Z"
  });
  const passiveFavoriteBookmark = createRecord({
    id: "bookmark-favorite-passive",
    userId: fakeUser.uid,
    folderId: "folder-b",
    tagIds: ["tag-b"],
    url: "https://example.com/favorite-passive",
    normalizedUrl: "https://example.com/favorite-passive",
    isFavorite: true,
    userTitle: "Favorite passive link",
    updatedAt: "2026-04-14T01:00:00.000Z"
  });
  const contextBookmark = createRecord({
    id: "bookmark-context",
    userId: fakeUser.uid,
    folderId: "folder-a",
    tagIds: ["tag-a"],
    url: "https://example.com/context",
    normalizedUrl: "https://example.com/context",
    userTitle: "Context link",
    updatedAt: "2026-04-14T02:00:00.000Z"
  });
  const plainBookmark = createRecord({
    id: "bookmark-plain",
    userId: fakeUser.uid,
    folderId: "folder-b",
    tagIds: ["tag-c"],
    url: "https://example.com/plain",
    normalizedUrl: "https://example.com/plain",
    userTitle: "Plain link",
    updatedAt: "2026-04-14T02:00:00.000Z"
  });
  const unopenedBookmark = createRecord({
    id: "bookmark-unopened",
    userId: fakeUser.uid,
    folderId: "folder-c",
    tagIds: [],
    url: "https://example.com/unopened",
    normalizedUrl: "https://example.com/unopened",
    userTitle: "Unopened link",
    updatedAt: "2026-04-14T04:00:00.000Z"
  });
  const trashedFavoriteBookmark = createRecord({
    id: "bookmark-trashed-favorite",
    userId: fakeUser.uid,
    folderId: "folder-trash",
    tagIds: [],
    url: "https://example.com/trashed-favorite",
    normalizedUrl: "https://example.com/trashed-favorite",
    isFavorite: true,
    isTrashed: true,
    trashedAt: "2026-04-14T05:00:00.000Z",
    userTitle: "Trashed favorite link",
    updatedAt: "2026-04-14T05:00:00.000Z"
  });

  [
    favoriteBookmark,
    passiveFavoriteBookmark,
    contextBookmark,
    plainBookmark,
    unopenedBookmark,
    trashedFavoriteBookmark
  ].forEach((bookmark) => {
    bookmarks.set(bookmark.id, bookmark);
  });

  return {
    async listByUser(userId, filters = {}, options) {
      listCalls.push({ userId, filters, options });
      return Array.from(bookmarks.values()).filter((bookmark) => {
        if (bookmark.userId !== userId) {
          return false;
        }

        const trashMode = filters.trashMode ?? "active";
        if (trashMode === "active" && bookmark.isTrashed) {
          return false;
        }
        if (trashMode === "trashed" && !bookmark.isTrashed) {
          return false;
        }

        return true;
      });
    },
    async searchByUser(userId, _query, _mode, filters = {}) {
      return this.listByUser(userId, filters);
    },
    async create(input) {
      const bookmark = createRecord({
        id: `bookmark-${bookmarks.size + 1}`,
        userId: input.userId,
        folderId: input.folderId ?? null,
        tagIds: input.tagIds ?? [],
        url: input.url,
        normalizedUrl: input.normalizedUrl,
        isFavorite: input.isFavorite ?? false,
        isHidden: input.isHidden ?? false,
        isTrashed: false,
        trashedAt: null,
        bookmarkColor: input.bookmarkColor ?? null,
        urlColor: input.urlColor ?? null,
        sourceTitle: input.sourceTitle ?? null,
        sourceContent: input.sourceContent ?? null,
        sourceSummary: input.sourceSummary ?? null,
        userTitle: input.userTitle ?? null,
        userContent: input.userContent ?? null,
        userSummary: input.userSummary ?? null
      });

      bookmarks.set(bookmark.id, bookmark);
      return bookmark;
    },
    async getByUserAndId(userId, bookmarkId) {
      const bookmark = bookmarks.get(bookmarkId);
      if (!bookmark || bookmark.userId !== userId) {
        return null;
      }

      return bookmark;
    },
    async delete(bookmarkId, userId) {
      const bookmark = bookmarks.get(bookmarkId);
      if (!bookmark || bookmark.userId !== userId) {
        return false;
      }

      bookmarks.set(bookmarkId, {
        ...bookmark,
        isTrashed: true,
        trashedAt: "2026-04-14T06:00:00.000Z"
      });
      return true;
    },
    async restore(bookmarkId, userId) {
      const bookmark = bookmarks.get(bookmarkId);
      if (!bookmark || bookmark.userId !== userId) {
        return null;
      }

      const restored = {
        ...bookmark,
        isTrashed: false,
        trashedAt: null
      };
      bookmarks.set(bookmarkId, restored);
      return restored;
    },
    async permanentlyDelete(bookmarkId, userId) {
      const bookmark = bookmarks.get(bookmarkId);
      if (!bookmark || bookmark.userId !== userId) {
        return false;
      }

      bookmarks.delete(bookmarkId);
      return true;
    },
    async update() {
      throw new Error("not_implemented_for_test");
    },
    getListCalls() {
      return listCalls;
    }
  };
}

function createInMemoryActivityRepository() {
  const openStats: BookmarkOpenStat[] = [
    {
      bookmarkId: "bookmark-favorite-active",
      openCount: 4,
      lastOpenedAt: "2026-04-14T04:30:00.000Z"
    },
    {
      bookmarkId: "bookmark-context",
      openCount: 2,
      lastOpenedAt: "2026-04-14T04:00:00.000Z"
    },
    {
      bookmarkId: "bookmark-plain",
      openCount: 2,
      lastOpenedAt: "2026-04-14T04:00:00.000Z"
    },
    {
      bookmarkId: "bookmark-favorite-passive",
      openCount: 1,
      lastOpenedAt: "2026-04-14T03:00:00.000Z"
    }
  ];
  const openedBookmarkIds: string[] = [];

  return {
    async recordOpen(_: string, bookmarkId: string) {
      openedBookmarkIds.push(bookmarkId);
    },
    async listRecentBookmarkIds() {
      return openStats
        .slice()
        .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt))
        .map((entry) => entry.bookmarkId);
    },
    async listFrequentBookmarkIds() {
      return openStats
        .slice()
        .sort(
          (left, right) =>
            right.openCount - left.openCount ||
            right.lastOpenedAt.localeCompare(left.lastOpenedAt)
        )
        .map((entry) => entry.bookmarkId);
    },
    async listOpenStats() {
      return openStats;
    },
    getOpenedBookmarkIds() {
      return openedBookmarkIds;
    }
  };
}

async function authenticatedRequest(
  app: ReturnType<typeof createApp>,
  path: string,
  init?: RequestInit
) {
  const sessionValue = await createSessionValue(fakeUser, sessionSecret);

  return app.request(`http://example.com${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
      cookie: `bookmark_session=${sessionValue}`
    }
  });
}

describe("recommendation routes", () => {
  it("returns recommendation sections ordered by activity and context", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      bookmarkActivityRepository: createInMemoryActivityRepository()
    } as Parameters<typeof createApp>[0]);

    const res = await authenticatedRequest(app, "/api/recommendations");

    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      favorites: Array<{ id: string; displayTitle: string }>;
      recent: Array<{ id: string; displayTitle: string }>;
      frequent: Array<{ id: string; displayTitle: string }>;
    };

    expect(payload.favorites.map((bookmark) => bookmark.id)).toEqual([
      "bookmark-favorite-active",
      "bookmark-favorite-passive"
    ]);
    expect(payload.recent.slice(0, 3).map((bookmark) => bookmark.id)).toEqual([
      "bookmark-favorite-active",
      "bookmark-context",
      "bookmark-plain"
    ]);
    expect(payload.frequent.slice(0, 3).map((bookmark) => bookmark.id)).toEqual([
      "bookmark-favorite-active",
      "bookmark-context",
      "bookmark-plain"
    ]);
    expect(payload.recent.at(-1)?.id).toBe("bookmark-unopened");
    expect(payload.frequent.at(-1)?.id).toBe("bookmark-unopened");
    expect([
      ...payload.favorites,
      ...payload.recent,
      ...payload.frequent
    ].map((bookmark) => bookmark.id)).not.toContain("bookmark-trashed-favorite");
  });

  it("returns compact recommendation payloads without full content", async () => {
    const bookmarkRepository = createInMemoryBookmarkRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository,
      bookmarkActivityRepository: createInMemoryActivityRepository()
    } as Parameters<typeof createApp>[0]);

    const res = await authenticatedRequest(app, "/api/recommendations");

    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      favorites: Array<{
        id: string;
        userContent: string | null;
        displayContent: string;
        contentTruncated?: boolean;
      }>;
    };

    expect(bookmarkRepository.getListCalls()[0]).toMatchObject({
      userId: fakeUser.uid,
      filters: {},
      options: {
        contentMode: "summary"
      }
    });
    expect(payload.favorites[0]).toMatchObject({
      id: "bookmark-favorite-active",
      userContent: null,
      displayContent: "Favorite active full content",
      contentTruncated: true
    });
  });

  it("uses optimized recommendation repository results without loading every bookmark", async () => {
    const baseRepository = createInMemoryBookmarkRepository();
    const optimizedBookmark = await baseRepository.getByUserAndId(
      fakeUser.uid,
      "bookmark-favorite-active"
    );
    if (!optimizedBookmark) {
      throw new Error("missing_test_bookmark");
    }

    const bookmarkRepository = {
      ...baseRepository,
      async listRecommendationsByUser(userId: string) {
        expect(userId).toBe(fakeUser.uid);

        return {
          favorites: [optimizedBookmark],
          recent: [optimizedBookmark],
          frequent: [optimizedBookmark]
        };
      }
    } as BookmarkRepository;
    const app = createApp({
      sessionSecret,
      bookmarkRepository
    } as Parameters<typeof createApp>[0]);

    const res = await authenticatedRequest(app, "/api/recommendations");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      favorites: [{ id: "bookmark-favorite-active" }],
      recent: [{ id: "bookmark-favorite-active" }],
      frequent: [{ id: "bookmark-favorite-active" }]
    });
    expect(baseRepository.getListCalls()).toHaveLength(0);
  });

  it("records bookmark open activity for the authenticated user", async () => {
    const bookmarkActivityRepository = createInMemoryActivityRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      bookmarkActivityRepository
    } as Parameters<typeof createApp>[0]);

    const res = await authenticatedRequest(app, "/api/bookmarks/bookmark-context/open", {
      method: "POST"
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true
    });
    expect(bookmarkActivityRepository.getOpenedBookmarkIds()).toEqual([
      "bookmark-context"
    ]);
  });
});
