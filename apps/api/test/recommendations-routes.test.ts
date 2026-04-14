import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createSessionValue } from "../src/lib/auth/session";
import type {
  BookmarkRecord,
  BookmarkRepository
} from "../src/lib/repositories/bookmarks";

const sessionSecret = "bookmark-recommendation-test-secret";
const fakeUser = {
  uid: "firebase-user-1",
  email: "keygenerator25@gmail.com",
  name: "Bookmark Tester",
  picture: "https://example.com/avatar.png"
};

function createInMemoryBookmarkRepository(): BookmarkRepository {
  const bookmarks = new Map<string, BookmarkRecord>();

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
    id: "bookmark-favorite",
    userId: fakeUser.uid,
    url: "https://example.com/favorite",
    normalizedUrl: "https://example.com/favorite",
    isFavorite: true,
    userTitle: "Favorite link"
  });
  const recentBookmark = createRecord({
    id: "bookmark-recent",
    userId: fakeUser.uid,
    url: "https://example.com/recent",
    normalizedUrl: "https://example.com/recent",
    userTitle: "Recent link"
  });
  const frequentBookmark = createRecord({
    id: "bookmark-frequent",
    userId: fakeUser.uid,
    url: "https://example.com/frequent",
    normalizedUrl: "https://example.com/frequent",
    userTitle: "Frequent link"
  });

  [favoriteBookmark, recentBookmark, frequentBookmark].forEach((bookmark) => {
    bookmarks.set(bookmark.id, bookmark);
  });

  return {
    async listByUser(userId) {
      return Array.from(bookmarks.values()).filter((bookmark) => bookmark.userId === userId);
    },
    async searchByUser(userId) {
      return Array.from(bookmarks.values()).filter((bookmark) => bookmark.userId === userId);
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

      bookmarks.delete(bookmarkId);
      return true;
    },
    async update() {
      throw new Error("not_implemented_for_test");
    }
  };
}

function createInMemoryActivityRepository() {
  const recentBookmarkIds = ["bookmark-recent"];
  const frequentBookmarkIds = ["bookmark-frequent"];
  const openedBookmarkIds: string[] = [];

  return {
    async recordOpen(_: string, bookmarkId: string) {
      openedBookmarkIds.push(bookmarkId);
    },
    async listRecentBookmarkIds() {
      return recentBookmarkIds;
    },
    async listFrequentBookmarkIds() {
      return frequentBookmarkIds;
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
  it("returns favorite, recent, and frequent bookmark recommendations", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      bookmarkActivityRepository: createInMemoryActivityRepository()
    } as Parameters<typeof createApp>[0]);

    const res = await authenticatedRequest(app, "/api/recommendations");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      favorites: [
        {
          id: "bookmark-favorite",
          displayTitle: "Favorite link"
        }
      ],
      recent: [
        {
          id: "bookmark-recent",
          displayTitle: "Recent link"
        }
      ],
      frequent: [
        {
          id: "bookmark-frequent",
          displayTitle: "Frequent link"
        }
      ]
    });
  });

  it("records bookmark open activity for the authenticated user", async () => {
    const bookmarkActivityRepository = createInMemoryActivityRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      bookmarkActivityRepository
    } as Parameters<typeof createApp>[0]);

    const res = await authenticatedRequest(app, "/api/bookmarks/bookmark-recent/open", {
      method: "POST"
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true
    });
    expect(bookmarkActivityRepository.getOpenedBookmarkIds()).toEqual([
      "bookmark-recent"
    ]);
  });
});
