import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createSessionValue } from "../src/lib/auth/session";
import type {
  BookmarkAssetRepository,
  BookmarkAssetRecord
} from "../src/lib/repositories/bookmark-assets";
import type {
  BookmarkActivityRepository
} from "../src/lib/repositories/bookmark-activity";
import type {
  BookmarkRecord,
  BookmarkRepository
} from "../src/lib/repositories/bookmarks";
import type { BookmarkAssetStorage } from "../src/lib/storage/assets";

const sessionSecret = "bookmark-test-secret";
const fakeUser = {
  uid: "firebase-user-1",
  email: "keygenerator25@gmail.com",
  name: "Bookmark Tester",
  picture: "https://example.com/avatar.png"
};

function createInMemoryBookmarkRepository(): BookmarkRepository {
  type BookmarkWithTags = BookmarkRecord & {
    tagIds: string[];
  };

  const bookmarks = new Map<string, BookmarkWithTags>();
  const folderNames = new Map<string, string>([
    ["folder-reading", "Reading"],
    ["folder-archive", "Archive"]
  ]);
  const tagNames = new Map<string, string>([
    ["tag-research", "research"],
    ["tag-video", "video"]
  ]);

  function matchesQuery(bookmark: BookmarkWithTags, query: string, mode: string) {
    const normalizedQuery = query.toLowerCase();
    const tagText = bookmark.tagIds
      .map((tagId) => tagNames.get(tagId) ?? "")
      .join(" ")
      .toLowerCase();
    const folderName = (bookmark.folderId ? folderNames.get(bookmark.folderId) : "")?.toLowerCase() ?? "";

    if (mode === "title") {
      return bookmark.displayTitle.toLowerCase().includes(normalizedQuery);
    }

    if (mode === "content") {
      return bookmark.displayContent.toLowerCase().includes(normalizedQuery);
    }

    if (mode === "folder") {
      return folderName.includes(normalizedQuery);
    }

    return (
      bookmark.displayTitle.toLowerCase().includes(normalizedQuery) ||
      bookmark.displayContent.toLowerCase().includes(normalizedQuery) ||
      tagText.includes(normalizedQuery)
    );
  }

  return {
    async listByUser(userId) {
      return Array.from(bookmarks.values()).filter((bookmark) => bookmark.userId === userId);
    },
    async searchByUser(userId, query, mode) {
      return Array.from(bookmarks.values()).filter(
        (bookmark) => bookmark.userId === userId && matchesQuery(bookmark, query, mode)
      );
    },
    async create(input) {
      const now = "2026-04-13T08:00:00.000Z";
      const bookmark = {
        id: `bookmark-${bookmarks.size + 1}`,
        userId: input.userId,
        folderId: input.folderId ?? null,
        url: input.url,
        normalizedUrl: input.normalizedUrl,
        isFavorite: input.isFavorite,
        bookmarkColor: input.bookmarkColor ?? null,
        urlColor: input.urlColor ?? null,
        sourceTitle: input.sourceTitle ?? null,
        sourceContent: input.sourceContent ?? null,
        sourceSummary: input.sourceSummary ?? null,
        userTitle: input.userTitle ?? null,
        userContent: input.userContent ?? null,
        userSummary: input.userSummary ?? null,
        createdAt: now,
        updatedAt: now,
        displayTitle: input.userTitle ?? input.sourceTitle ?? "",
        displayContent: input.userContent ?? input.sourceContent ?? "",
        displaySummary: input.userSummary ?? input.sourceSummary ?? "",
        tagIds: input.tagIds ?? []
      } as BookmarkWithTags;

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
    async update(bookmarkId, userId, input) {
      const bookmark = bookmarks.get(bookmarkId);
      if (!bookmark || bookmark.userId !== userId) {
        return null;
      }

      const updated = {
        ...bookmark,
        folderId: input.folderId === undefined ? bookmark.folderId : input.folderId,
        isFavorite: input.isFavorite ?? bookmark.isFavorite,
        bookmarkColor:
          input.bookmarkColor === undefined ? bookmark.bookmarkColor : input.bookmarkColor,
        urlColor: input.urlColor === undefined ? bookmark.urlColor : input.urlColor,
        sourceTitle:
          input.sourceTitle === undefined ? bookmark.sourceTitle : input.sourceTitle,
        sourceContent:
          input.sourceContent === undefined ? bookmark.sourceContent : input.sourceContent,
        sourceSummary:
          input.sourceSummary === undefined ? bookmark.sourceSummary : input.sourceSummary,
        userTitle: input.userTitle === undefined ? bookmark.userTitle : input.userTitle,
        userContent:
          input.userContent === undefined ? bookmark.userContent : input.userContent,
        userSummary:
          input.userSummary === undefined ? bookmark.userSummary : input.userSummary,
        updatedAt: "2026-04-13T09:00:00.000Z",
        tagIds: input.tagIds === undefined ? bookmark.tagIds : input.tagIds
      } as BookmarkWithTags;

      updated.displayTitle = updated.userTitle ?? updated.sourceTitle ?? "";
      updated.displayContent = updated.userContent ?? updated.sourceContent ?? "";
      updated.displaySummary = updated.userSummary ?? updated.sourceSummary ?? "";

      bookmarks.set(bookmarkId, updated);
      return updated;
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

function createInMemoryBookmarkAssetRepository() {
  const assets = new Map<string, BookmarkAssetRecord>();

  return {
    async listByBookmark(userId: string, bookmarkId: string) {
      return Array.from(assets.values()).filter(
        (asset) => asset.userId === userId && asset.bookmarkId === bookmarkId
      );
    },
    async getById(userId: string, bookmarkId: string, assetId: string) {
      const asset = assets.get(assetId);
      if (!asset || asset.userId !== userId || asset.bookmarkId !== bookmarkId) {
        return null;
      }

      return asset;
    },
    async create(input: {
      bookmarkId: string;
      userId: string;
      assetType: "image" | "capture";
      objectKey: string;
      mimeType: string;
    }) {
      const asset: BookmarkAssetRecord = {
        id: `asset-${assets.size + 1}`,
        bookmarkId: input.bookmarkId,
        userId: input.userId,
        assetType: input.assetType,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        width: null,
        height: null,
        sortOrder: assets.size,
        contentUrl: `/api/bookmarks/${input.bookmarkId}/assets/asset-${assets.size + 1}/content`,
        createdAt: "2026-04-13T08:00:00.000Z",
        updatedAt: "2026-04-13T08:00:00.000Z"
      };

      assets.set(asset.id, asset);
      return asset;
    },
    async delete(userId: string, bookmarkId: string, assetId: string) {
      const asset = assets.get(assetId);
      if (!asset || asset.userId !== userId || asset.bookmarkId !== bookmarkId) {
        return false;
      }

      assets.delete(assetId);
      return true;
    }
  } satisfies BookmarkAssetRepository;
}

function createInMemoryBookmarkActivityRepository() {
  const entries: Array<{ userId: string; bookmarkId: string }> = [];

  return {
    async recordOpen(userId: string, bookmarkId: string) {
      entries.push({ userId, bookmarkId });
    },
    async listRecentBookmarkIds(userId: string) {
      return entries.filter((entry) => entry.userId === userId).map((entry) => entry.bookmarkId);
    },
    async listFrequentBookmarkIds(userId: string) {
      return entries.filter((entry) => entry.userId === userId).map((entry) => entry.bookmarkId);
    }
  } satisfies BookmarkActivityRepository;
}

function createInMemoryAssetStorage() {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();

  return {
    async put(objectKey: string, body: ArrayBuffer, contentType: string) {
      objects.set(objectKey, {
        body: new Uint8Array(body),
        contentType
      });
    },
    async get(objectKey: string) {
      return objects.get(objectKey) ?? null;
    },
    async delete(objectKey: string) {
      objects.delete(objectKey);
    }
  } satisfies BookmarkAssetStorage;
}

describe("bookmark routes", () => {
  it("rejects anonymous bookmark listing requests", async () => {
    const app = createApp();

    const res = await app.request("http://example.com/api/bookmarks");

    expect(res.status).toBe(401);
  });

  it("creates a bookmark with manual values and favorite state", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    const res = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/post",
        userTitle: "Manual title",
        userContent: "Manual content",
        userSummary: "Manual summary",
        isFavorite: true,
        urlColor: "#0f172a",
        bookmarkColor: "#f59e0b",
        tagIds: ["tag-1", "tag-2"]
      })
    });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      bookmark: {
        url: "https://example.com/post",
        userTitle: "Manual title",
        userContent: "Manual content",
        userSummary: "Manual summary",
        displayTitle: "Manual title",
        displayContent: "Manual content",
        displaySummary: "Manual summary",
        isFavorite: true,
        urlColor: "#0f172a",
        bookmarkColor: "#f59e0b",
        tagIds: ["tag-1", "tag-2"]
      }
    });
  });

  it("creates a bookmark with extracted source values when manual values are empty", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      bookmarkExtractor: {
        extract: async (url) => ({
          url,
          normalizedUrl: new URL(url).toString(),
          sourceTitle: "Extracted title",
          sourceContent: "Extracted body",
          sourceSummary: "Extracted summary"
        })
      }
    } as Parameters<typeof createApp>[0]);

    const res = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/extracted"
      })
    });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      bookmark: {
        url: "https://example.com/extracted",
        sourceTitle: "Extracted title",
        sourceContent: "Extracted body",
        sourceSummary: "Extracted summary",
        displayTitle: "Extracted title",
        displayContent: "Extracted body",
        displaySummary: "Extracted summary"
      }
    });
  });

  it("lists bookmarks for the authenticated user", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/post",
        userTitle: "Manual title",
        tagIds: ["tag-1"]
      })
    });

    const res = await authenticatedRequest(app, "/api/bookmarks");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      bookmarks: [
        {
          url: "https://example.com/post",
          displayTitle: "Manual title",
          tagIds: ["tag-1"]
        }
      ]
    });
  });

  it("searches bookmarks by integrated mode and folder mode", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/paper",
        folderId: "folder-reading",
        userTitle: "AI paper",
        userContent: "Transformer notes",
        tagIds: ["tag-research"]
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/video",
        folderId: "folder-archive",
        userTitle: "Video list",
        userContent: "Watch later",
        tagIds: ["tag-video"]
      })
    });

    const integratedRes = await authenticatedRequest(
      app,
      "/api/bookmarks?mode=all&query=research"
    );
    const folderRes = await authenticatedRequest(
      app,
      "/api/bookmarks?mode=folder&query=reading"
    );

    expect(integratedRes.status).toBe(200);
    await expect(integratedRes.json()).resolves.toMatchObject({
      bookmarks: [
        {
          url: "https://example.com/paper"
        }
      ]
    });

    expect(folderRes.status).toBe(200);
    await expect(folderRes.json()).resolves.toMatchObject({
      bookmarks: [
        {
          url: "https://example.com/paper"
        }
      ]
    });
  });

  it("loads bookmark details for the authenticated user", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/post",
        userTitle: "Detail title",
        userContent: "Detail content",
        userSummary: "Detail summary",
        tagIds: ["tag-1"]
      })
    });
    const created = (await createRes.json()) as {
      bookmark: BookmarkRecord;
    };

    const detailRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}`
    );

    expect(detailRes.status).toBe(200);
    await expect(detailRes.json()).resolves.toMatchObject({
      bookmark: {
        id: created.bookmark.id,
        userTitle: "Detail title",
        userContent: "Detail content",
        userSummary: "Detail summary",
        tagIds: ["tag-1"]
      }
    });
  });

  it("updates an existing bookmark for the authenticated user", async () => {
    const repository = createInMemoryBookmarkRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository: repository
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/post",
        userTitle: "Before title",
        isFavorite: false,
        tagIds: ["tag-1"]
      })
    });
    const created = (await createRes.json()) as {
      bookmark: BookmarkRecord;
    };

    const res = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          userTitle: "After title",
          isFavorite: true,
          tagIds: ["tag-2", "tag-3"]
        })
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      bookmark: {
        id: created.bookmark.id,
        userTitle: "After title",
        displayTitle: "After title",
        isFavorite: true,
        tagIds: ["tag-2", "tag-3"]
      }
    });
  });

  it("reextracts source values for an existing bookmark", async () => {
    const repository = createInMemoryBookmarkRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository: repository,
      bookmarkExtractor: {
        extract: async (url) => ({
          url,
          normalizedUrl: new URL(url).toString(),
          sourceTitle: "Retried source title",
          sourceContent: "Retried source content",
          sourceSummary: "Retried source summary"
        })
      }
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/post",
        userTitle: "Manual title",
        sourceTitle: "Old source title",
        sourceContent: "Old source content",
        sourceSummary: "Old source summary"
      })
    });
    const created = (await createRes.json()) as {
      bookmark: BookmarkRecord;
    };

    const res = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}/reextract`,
      {
        method: "POST"
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      bookmark: {
        id: created.bookmark.id,
        userTitle: "Manual title",
        sourceTitle: "Retried source title",
        sourceContent: "Retried source content",
        sourceSummary: "Retried source summary",
        displayTitle: "Manual title"
      }
    });
  });

  it("deletes a bookmark and rejects subsequent detail requests", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      bookmarkAssetRepository: createInMemoryBookmarkAssetRepository(),
      bookmarkActivityRepository: createInMemoryBookmarkActivityRepository(),
      assetStorage: createInMemoryAssetStorage()
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/delete-bookmark",
        userTitle: "Delete bookmark"
      })
    });
    const created = (await createRes.json()) as {
      bookmark: BookmarkRecord;
    };

    const deleteRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}`,
      {
        method: "DELETE"
      }
    );

    expect(deleteRes.status).toBe(204);

    const detailRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}`
    );
    expect(detailRes.status).toBe(404);

    const listRes = await authenticatedRequest(app, "/api/bookmarks");
    await expect(listRes.json()).resolves.toMatchObject({
      bookmarks: []
    });
  });
});
