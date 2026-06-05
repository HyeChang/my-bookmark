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
  BookmarkListFilters,
  BookmarkRecord,
  BookmarkRepository
} from "../src/lib/repositories/bookmarks";
import { normalizeBookmarkUrl } from "../src/lib/repositories/bookmarks";
import type { BookmarkAssetStorage } from "../src/lib/storage/assets";

const sessionSecret = "bookmark-test-secret";
const fakeUser = {
  uid: "firebase-user-1",
  email: "user@example.com",
  name: "Bookmark Tester",
  picture: "https://example.com/avatar.png"
};

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function createInMemoryFolderRepository() {
  type FolderRecord = {
    id: string;
    userId: string;
    name: string;
    color: string | null;
    icon: string | null;
    isHidden: boolean;
    parentFolderId: string | null;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  };

  const folders = new Map<string, FolderRecord>();

  return {
    async listByUser(userId: string) {
      return Array.from(folders.values()).filter((folder) => folder.userId === userId);
    },
    async create(input: {
      userId: string;
      name: string;
      color?: string | null;
      icon?: string | null;
      isHidden?: boolean;
      parentFolderId?: string | null;
    }) {
      const now = "2026-04-13T10:00:00.000Z";
      const folder: FolderRecord = {
        id: `folder-${folders.size + 1}`,
        userId: input.userId,
        name: input.name,
        color: input.color ?? null,
        icon: input.icon ?? null,
        isHidden: input.isHidden ?? false,
        parentFolderId: input.parentFolderId ?? null,
        sortOrder: folders.size,
        createdAt: now,
        updatedAt: now
      };

      folders.set(folder.id, folder);
      return folder;
    },
    async update() {
      return null;
    },
    async delete() {
      return false;
    }
  };
}

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
    const searchableTitle = (bookmark.displayTitle.trim() || bookmark.url).toLowerCase();
    const searchableUrl = bookmark.url.toLowerCase();
    const tagText = bookmark.tagIds
      .map((tagId) => tagNames.get(tagId) ?? "")
      .join(" ")
      .toLowerCase();
    const folderName = (bookmark.folderId ? folderNames.get(bookmark.folderId) : "")?.toLowerCase() ?? "";

    if (mode === "title") {
      return searchableTitle.includes(normalizedQuery);
    }

    if (mode === "content") {
      return bookmark.displayContent.toLowerCase().includes(normalizedQuery);
    }

    if (mode === "folder") {
      return folderName.includes(normalizedQuery);
    }

    return (
      searchableTitle.includes(normalizedQuery) ||
      searchableUrl.includes(normalizedQuery) ||
      bookmark.displayContent.toLowerCase().includes(normalizedQuery) ||
      tagText.includes(normalizedQuery)
    );
  }

  function matchesFilters(bookmark: BookmarkWithTags, filters: BookmarkListFilters = {}) {
    const normalizedBookmarkColor = bookmark.bookmarkColor?.trim().toLowerCase() ?? "";
    const normalizedUrlColor = bookmark.urlColor?.trim().toLowerCase() ?? "";
    const trashMode = filters.trashMode ?? "active";

    if (trashMode === "active" && bookmark.isTrashed) {
      return false;
    }

    if (trashMode === "trashed" && !bookmark.isTrashed) {
      return false;
    }

    if (filters.favoriteOnly && !bookmark.isFavorite) {
      return false;
    }

    if (filters.folderId && bookmark.folderId !== filters.folderId) {
      return false;
    }

    if (filters.folderIds && !filters.folderIds.includes(bookmark.folderId ?? "")) {
      return false;
    }

    if (filters.tagIds) {
      const tagMatcher =
        filters.tagMode === "or"
          ? filters.tagIds.some((tagId) => bookmark.tagIds.includes(tagId))
          : filters.tagIds.every((tagId) => bookmark.tagIds.includes(tagId));

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

  return {
    async listByUser(userId, filters = {}) {
      return Array.from(bookmarks.values()).filter(
        (bookmark) => bookmark.userId === userId && matchesFilters(bookmark, filters)
      );
    },
    async searchByUser(userId, query, mode, filters = {}) {
      return Array.from(bookmarks.values()).filter(
        (bookmark) =>
          bookmark.userId === userId &&
          matchesFilters(bookmark, filters) &&
          matchesQuery(bookmark, query, mode)
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

      bookmarks.set(bookmarkId, {
        ...bookmark,
        isTrashed: true,
        trashedAt: "2026-04-13T10:00:00.000Z",
        updatedAt: "2026-04-13T10:00:00.000Z"
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
        trashedAt: null,
        updatedAt: "2026-04-13T11:00:00.000Z"
      } as BookmarkWithTags;

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
    async update(bookmarkId, userId, input) {
      const bookmark = bookmarks.get(bookmarkId);
      if (!bookmark || bookmark.userId !== userId) {
        return null;
      }

      const updated = {
        ...bookmark,
        url: input.url === undefined ? bookmark.url : normalizeBookmarkUrl(input.url),
        normalizedUrl:
          input.url === undefined ? bookmark.normalizedUrl : normalizeBookmarkUrl(input.url),
        folderId: input.folderId === undefined ? bookmark.folderId : input.folderId,
        isFavorite: input.isFavorite ?? bookmark.isFavorite,
        isHidden: "isHidden" in input ? (input.isHidden ?? false) : bookmark.isHidden,
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
  const entries: Array<{ userId: string; bookmarkId: string; occurredAt: string }> = [];
  let openSequence = 0;

  return {
    async recordOpen(userId: string, bookmarkId: string) {
      entries.push({
        userId,
        bookmarkId,
        occurredAt: new Date(Date.UTC(2026, 3, 14, 0, openSequence)).toISOString()
      });
      openSequence += 1;
    },
    async listRecentBookmarkIds(userId: string) {
      return entries
        .filter((entry) => entry.userId === userId)
        .slice()
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .map((entry) => entry.bookmarkId);
    },
    async listFrequentBookmarkIds(userId: string) {
      const stats = await this.listOpenStats(userId);
      return stats
        .slice()
        .sort(
          (left, right) =>
            right.openCount - left.openCount ||
            right.lastOpenedAt.localeCompare(left.lastOpenedAt)
        )
        .map((entry) => entry.bookmarkId);
    },
    async listOpenStats(userId: string) {
      const counts = new Map<string, { openCount: number; lastOpenedAt: string }>();
      for (const entry of entries.filter((entry) => entry.userId === userId)) {
        const current = counts.get(entry.bookmarkId);
        counts.set(entry.bookmarkId, {
          openCount: (current?.openCount ?? 0) + 1,
          lastOpenedAt:
            current && current.lastOpenedAt.localeCompare(entry.occurredAt) > 0
              ? current.lastOpenedAt
              : entry.occurredAt
        });
      }

      return Array.from(counts.entries()).map(([bookmarkId, value]) => ({
        bookmarkId,
        openCount: value.openCount,
        lastOpenedAt: value.lastOpenedAt
      }));
    }
  } satisfies BookmarkActivityRepository;
}

function createSeededBookmarkActivityRepository(
  stats: Array<{ bookmarkId: string; openCount: number; lastOpenedAt: string }>
) {
  return {
    async recordOpen() {
      return;
    },
    async listRecentBookmarkIds() {
      return stats
        .slice()
        .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt))
        .map((entry) => entry.bookmarkId);
    },
    async listFrequentBookmarkIds() {
      return stats
        .slice()
        .sort(
          (left, right) =>
            right.openCount - left.openCount ||
            right.lastOpenedAt.localeCompare(left.lastOpenedAt)
        )
        .map((entry) => entry.bookmarkId);
    },
    async listOpenStats() {
      return stats;
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

  it("creates a hidden bookmark and returns hidden state in the response", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    const res = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/hidden-post",
        userTitle: "Hidden title",
        isHidden: true
      })
    });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      bookmark: {
        url: "https://example.com/hidden-post",
        userTitle: "Hidden title",
        isHidden: true
      }
    });
  });

  it("creates a bookmark with a valid extension bearer token", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      ...( {
        extensionTokenRepository: {
          async findByRawToken(rawToken: string) {
            if (rawToken !== "ext-valid-token") {
              return null;
            }

            return {
              id: "token-1",
              userId: fakeUser.uid,
              label: "Chrome desktop",
              createdAt: "2026-04-17T10:00:00.000Z",
              updatedAt: "2026-04-17T10:00:00.000Z",
              revokedAt: null,
              user: fakeUser
            };
          }
        }
      } as any)
    } as Parameters<typeof createApp>[0]);

    const res = await app.request("http://example.com/api/bookmarks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer ext-valid-token"
      },
      body: JSON.stringify({
        url: "https://extension.example.com/capture",
        userTitle: "Captured from extension"
      })
    });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      bookmark: {
        url: "https://extension.example.com/capture",
        userTitle: "Captured from extension"
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

  it("paginates bookmark list responses with limit and offset metadata", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    for (let index = 1; index <= 25; index += 1) {
      await authenticatedRequest(app, "/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          url: `https://example.com/page-${index}`,
          userTitle: `Page ${index}`
        })
      });
    }

    const firstPageRes = await authenticatedRequest(app, "/api/bookmarks?limit=20&offset=0");
    const secondPageRes = await authenticatedRequest(app, "/api/bookmarks?limit=20&offset=20");

    expect(firstPageRes.status).toBe(200);
    await expect(firstPageRes.json()).resolves.toMatchObject({
      bookmarks: expect.arrayContaining([
        expect.objectContaining({
          userTitle: "Page 1"
        })
      ]),
      pagination: {
        limit: 20,
        offset: 0,
        total: 25,
        hasMore: true
      }
    });

    expect(secondPageRes.status).toBe(200);
    const secondPagePayload = (await secondPageRes.json()) as {
      bookmarks: Array<{ userTitle: string | null }>;
      pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
      };
    };
    expect(secondPagePayload.bookmarks).toHaveLength(5);
    expect(secondPagePayload.pagination).toEqual({
      limit: 20,
      offset: 20,
      total: 25,
      hasMore: false
    });
  });

  it("uses repository-level pagination for sorted list pages", async () => {
    const baseRepository = createInMemoryBookmarkRepository();
    const pageCalls: Array<{
      userId: string;
      filters: BookmarkListFilters;
      pagination: { limit: number; offset: number };
      search?: { query: string; mode: string };
      sort?: string;
    }> = [];
    const repository = {
      ...baseRepository,
      async pageByUser(
        userId: string,
        filters: BookmarkListFilters = {},
        options: {
          contentMode?: "full" | "summary";
          pagination: { limit: number; offset: number };
          search?: { query: string; mode: string };
          sort?: string;
        }
      ) {
        pageCalls.push({
          userId,
          filters,
          pagination: options.pagination,
          search: options.search,
          sort: options.sort
        });

        const bookmarks = options.search
          ? await baseRepository.searchByUser(
              userId,
              options.search.query,
              options.search.mode as never,
              filters,
              options
            )
          : await baseRepository.listByUser(userId, filters, options);

        return {
          bookmarks: bookmarks.slice(
            options.pagination.offset,
            options.pagination.offset + options.pagination.limit
          ),
          total: bookmarks.length
        };
      }
    } as BookmarkRepository;
    const app = createApp({
      sessionSecret,
      bookmarkRepository: repository
    } as Parameters<typeof createApp>[0]);

    for (let index = 1; index <= 25; index += 1) {
      await authenticatedRequest(app, "/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          url: `https://example.com/db-page-${index}`,
          userTitle: `DB Page ${index}`
        })
      });
    }

    const res = await authenticatedRequest(
      app,
      "/api/bookmarks?limit=20&offset=20&sort=title_asc"
    );

    expect(res.status).toBe(200);
    expect(pageCalls).toHaveLength(1);
    expect(pageCalls[0]).toMatchObject({
      userId: fakeUser.uid,
      pagination: {
        limit: 20,
        offset: 20
      },
      search: undefined,
      sort: "title_asc"
    });
    const payload = (await res.json()) as {
      bookmarks: Array<{ userTitle: string | null }>;
      pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
      };
    };
    expect(payload.bookmarks).toHaveLength(5);
    expect(payload.pagination).toEqual({
      limit: 20,
      offset: 20,
      total: 25,
      hasMore: false
    });
  });

  it("uses repository-level pagination for opened-desc list pages", async () => {
    const baseRepository = createInMemoryBookmarkRepository();
    const pageCalls: Array<{
      pagination: { limit: number; offset: number };
      sort?: string;
    }> = [];
    const repository = {
      ...baseRepository,
      async pageByUser(
        userId: string,
        filters: BookmarkListFilters = {},
        options: {
          contentMode?: "full" | "summary";
          pagination: { limit: number; offset: number };
          sort?: string;
        }
      ) {
        pageCalls.push({
          pagination: options.pagination,
          sort: options.sort
        });
        const bookmarks = await baseRepository.listByUser(userId, filters, options);

        return {
          bookmarks: bookmarks.slice(
            options.pagination.offset,
            options.pagination.offset + options.pagination.limit
          ),
          total: bookmarks.length
        };
      }
    } as BookmarkRepository;
    const app = createApp({
      sessionSecret,
      bookmarkRepository: repository
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/opened-page",
        userTitle: "Opened page"
      })
    });

    const res = await authenticatedRequest(
      app,
      "/api/bookmarks?sort=opened_desc&limit=20&offset=0"
    );

    expect(res.status).toBe(200);
    expect(pageCalls).toEqual([
      {
        pagination: {
          limit: 20,
          offset: 0
        },
        sort: "opened_desc"
      }
    ]);
    const payload = (await res.json()) as {
      pagination: {
        limit: number;
        offset: number;
        total: number;
        hasMore: boolean;
      };
    };
    expect(payload.pagination).toEqual({
      limit: 20,
      offset: 0,
      total: 1,
      hasMore: false
    });
  });

  it("returns bookmark count summaries without loading full bookmark payloads", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/unfiled",
        userTitle: "Unfiled"
      })
    });
    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/folder",
        userTitle: "Folder",
        folderId: "folder-reading",
        isFavorite: true
      })
    });
    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/hidden",
        userTitle: "Hidden",
        folderId: "folder-reading",
        isHidden: true
      })
    });
    const trashedCreateRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/trash",
        userTitle: "Trash",
        folderId: "folder-archive"
      })
    });
    const trashedPayload = (await trashedCreateRes.json()) as {
      bookmark: { id: string };
    };
    await authenticatedRequest(app, `/api/bookmarks/${trashedPayload.bookmark.id}`, {
      method: "DELETE"
    });

    const res = await authenticatedRequest(app, "/api/bookmarks/counts");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      counts: {
        active: {
          total: 3,
          visible: 2
        },
        favorite: {
          total: 1,
          visible: 1
        },
        trashed: {
          total: 1,
          visible: 1
        },
        unfiled: {
          total: 1,
          visible: 1
        },
        byFolderId: {
          "folder-reading": {
            total: 2,
            visible: 1
          }
        }
      }
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

  it("searches bookmarks by URL substring in all and title modes when no title is set", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://chatgpt.com/",
        userTitle: null,
        sourceTitle: null,
        userContent: "",
        sourceContent: null
      })
    });

    const integratedRes = await authenticatedRequest(
      app,
      "/api/bookmarks?mode=all&query=ch"
    );
    const titleRes = await authenticatedRequest(
      app,
      "/api/bookmarks?mode=title&query=ch"
    );

    expect(integratedRes.status).toBe(200);
    await expect(integratedRes.json()).resolves.toMatchObject({
      bookmarks: [
        {
          url: "https://chatgpt.com/"
        }
      ]
    });

    expect(titleRes.status).toBe(200);
    await expect(titleRes.json()).resolves.toMatchObject({
      bookmarks: [
        {
          url: "https://chatgpt.com/"
        }
      ]
    });
  });

  it("filters bookmarks by favorite, folder, and multiple tags without a search query", async () => {
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
        isFavorite: true,
        tagIds: ["tag-research", "tag-video"]
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/video",
        folderId: "folder-reading",
        userTitle: "Video list",
        isFavorite: true,
        tagIds: ["tag-research"]
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/archive",
        folderId: "folder-archive",
        userTitle: "Archived paper",
        isFavorite: true,
        tagIds: ["tag-research", "tag-video"]
      })
    });

    const filteredRes = await authenticatedRequest(
      app,
      "/api/bookmarks?favorite=1&folderId=folder-reading&tagId=tag-research&tagId=tag-video"
    );

    expect(filteredRes.status).toBe(200);
    await expect(filteredRes.json()).resolves.toMatchObject({
      bookmarks: [
        {
          url: "https://example.com/paper"
        }
      ]
    });
  });

  it("returns compact bookmark list payloads while preserving full content in detail responses", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);
    const longContent = Array.from({ length: 60 }, (_, index) => `문단 ${index + 1}`).join(" ");

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/long-content",
        userTitle: "Long content bookmark",
        userContent: longContent,
        userSummary: null
      })
    });
    const created = (await createRes.json()) as {
      bookmark: BookmarkRecord;
    };

    const listRes = await authenticatedRequest(app, "/api/bookmarks");
    const detailRes = await authenticatedRequest(app, `/api/bookmarks/${created.bookmark.id}`);

    expect(listRes.status).toBe(200);
    await expect(listRes.json()).resolves.toMatchObject({
      bookmarks: [
        {
          id: created.bookmark.id,
          userContent: null,
          sourceContent: null,
          displayContent: expect.stringMatching(/^문단 1/),
          contentTruncated: true
        }
      ]
    });

    expect(detailRes.status).toBe(200);
    await expect(detailRes.json()).resolves.toMatchObject({
      bookmark: {
        id: created.bookmark.id,
        userContent: longContent,
        displayContent: longContent
      }
    });
  });

  it("includes descendant folders in bookmark filtering when requested", async () => {
    const folderRepository = createInMemoryFolderRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      folderRepository
    } as Parameters<typeof createApp>[0]);

    const parentFolderRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Reading"
      })
    });
    const parentFolder = (await parentFolderRes.json()) as {
      folder: { id: string };
    };

    const childFolderRes = await authenticatedRequest(app, "/api/folders", {
      method: "POST",
      body: JSON.stringify({
        name: "Papers",
        parentFolderId: parentFolder.folder.id
      })
    });
    const childFolder = (await childFolderRes.json()) as {
      folder: { id: string };
    };

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/parent-folder",
        folderId: parentFolder.folder.id,
        userTitle: "Parent folder bookmark"
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/child-folder",
        folderId: childFolder.folder.id,
        userTitle: "Child folder bookmark"
      })
    });

    const filteredRes = await authenticatedRequest(
      app,
      `/api/bookmarks?folderId=${parentFolder.folder.id}&includeDescendantFolders=1`
    );

    expect(filteredRes.status).toBe(200);
    await expect(filteredRes.json()).resolves.toMatchObject({
      bookmarks: [
        { url: "https://example.com/parent-folder" },
        { url: "https://example.com/child-folder" }
      ]
    });
  });

  it("applies multiple tag filters together with a search query", async () => {
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
        isFavorite: true,
        tagIds: ["tag-research", "tag-video"]
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/video",
        folderId: "folder-reading",
        userTitle: "AI video",
        userContent: "Transformer notes",
        isFavorite: true,
        tagIds: ["tag-research"]
      })
    });

    const filteredSearchRes = await authenticatedRequest(
      app,
      "/api/bookmarks?mode=content&query=transformer&tagId=tag-research&tagId=tag-video"
    );

    expect(filteredSearchRes.status).toBe(200);
    await expect(filteredSearchRes.json()).resolves.toMatchObject({
      bookmarks: [
        {
          url: "https://example.com/paper"
        }
      ]
    });
  });

  it("applies multiple tag filters with OR mode", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/research-video",
        folderId: "folder-reading",
        userTitle: "Research and video",
        tagIds: ["tag-research", "tag-video"]
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/research-only",
        folderId: "folder-reading",
        userTitle: "Research only",
        tagIds: ["tag-research"]
      })
    });

    const filteredRes = await authenticatedRequest(
      app,
      "/api/bookmarks?tagId=tag-research&tagId=tag-video&tagMode=or"
    );

    expect(filteredRes.status).toBe(200);
    await expect(filteredRes.json()).resolves.toMatchObject({
      bookmarks: [
        { url: "https://example.com/research-video" },
        { url: "https://example.com/research-only" }
      ]
    });
  });

  it("rejects invalid tag mode values", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    const res = await authenticatedRequest(
      app,
      "/api/bookmarks?tagId=tag-research&tagMode=invalid"
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "invalid_tag_mode"
    });
  });

  it("filters bookmarks by bookmark color, url color, and summary presence", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/highlighted",
        userTitle: "Highlighted paper",
        bookmarkColor: "#FFAA00",
        urlColor: "#112233",
        userSummary: "Summary exists"
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/no-url-color",
        userTitle: "Missing URL color",
        bookmarkColor: "#FFAA00",
        userSummary: "Summary exists"
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/no-summary",
        userTitle: "Missing summary",
        bookmarkColor: "#FFAA00",
        urlColor: "#112233"
      })
    });

    const filteredRes = await authenticatedRequest(
      app,
      "/api/bookmarks?bookmarkColor=%23ffaa00&urlColor=%23112233&summaryState=with"
    );

    expect(filteredRes.status).toBe(200);
    await expect(filteredRes.json()).resolves.toMatchObject({
      bookmarks: [
        {
          url: "https://example.com/highlighted"
        }
      ]
    });
  });

  it("applies summary absence filter together with a search query", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/without-summary",
        userTitle: "Digest note",
        userContent: "Digest content"
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/with-summary",
        userTitle: "Digest note",
        userContent: "Digest content",
        userSummary: "Digest summary"
      })
    });

    const filteredRes = await authenticatedRequest(
      app,
      "/api/bookmarks?mode=title&query=digest&summaryState=without"
    );

    expect(filteredRes.status).toBe(200);
    await expect(filteredRes.json()).resolves.toMatchObject({
      bookmarks: [
        {
          url: "https://example.com/without-summary"
        }
      ]
    });
  });

  it("sorts bookmarks by most recent open when sort=opened_desc", async () => {
    const bookmarkRepository = createInMemoryBookmarkRepository();
    const bookmarkActivityRepository = createInMemoryBookmarkActivityRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository,
      bookmarkActivityRepository
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/first",
        userTitle: "First bookmark"
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/second",
        userTitle: "Second bookmark"
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/unopened",
        userTitle: "Unopened bookmark"
      })
    });

    await authenticatedRequest(app, "/api/bookmarks/bookmark-1/open", {
      method: "POST"
    });
    await authenticatedRequest(app, "/api/bookmarks/bookmark-2/open", {
      method: "POST"
    });

    const res = await authenticatedRequest(app, "/api/bookmarks?sort=opened_desc");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      bookmarks: [
        { url: "https://example.com/second" },
        { url: "https://example.com/first" },
        { url: "https://example.com/unopened" }
      ]
    });
  });

  it("sorts bookmarks by title and site when requested", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository()
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://zeta.example.com/article",
        userTitle: "Beta link"
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://alpha.example.com/article",
        userTitle: "Alpha link"
      })
    });

    const titleRes = await authenticatedRequest(app, "/api/bookmarks?sort=title_asc");
    const siteRes = await authenticatedRequest(app, "/api/bookmarks?sort=site_desc");

    expect(titleRes.status).toBe(200);
    await expect(titleRes.json()).resolves.toMatchObject({
      bookmarks: [
        { url: "https://alpha.example.com/article" },
        { url: "https://zeta.example.com/article" }
      ]
    });

    expect(siteRes.status).toBe(200);
    await expect(siteRes.json()).resolves.toMatchObject({
      bookmarks: [
        { url: "https://zeta.example.com/article" },
        { url: "https://alpha.example.com/article" }
      ]
    });
  });

  it("filters bookmarks by createdWithin when set to 7d", async () => {
    const baseRepository = createInMemoryBookmarkRepository();
    const repository: BookmarkRepository = {
      ...baseRepository,
      async create(input) {
        const created = await baseRepository.create(input);

        if (input.url.includes("recent-created")) {
          const recentDate = isoDaysAgo(2);
          created.createdAt = recentDate;
          created.updatedAt = recentDate;
        }

        if (input.url.includes("old-created")) {
          const oldDate = isoDaysAgo(40);
          created.createdAt = oldDate;
          created.updatedAt = oldDate;
        }

        return created;
      }
    };
    const app = createApp({
      sessionSecret,
      bookmarkRepository: repository
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/recent-created",
        userTitle: "Recent created"
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/old-created",
        userTitle: "Old created"
      })
    });

    const res = await authenticatedRequest(app, "/api/bookmarks?createdWithin=7d");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      bookmarks: [{ url: "https://example.com/recent-created" }]
    });
  });

  it("filters bookmarks by openedWithin when set to 7d", async () => {
    const repository = createInMemoryBookmarkRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository: repository,
      bookmarkActivityRepository: createSeededBookmarkActivityRepository([
        {
          bookmarkId: "bookmark-1",
          openCount: 2,
          lastOpenedAt: isoDaysAgo(2)
        },
        {
          bookmarkId: "bookmark-2",
          openCount: 4,
          lastOpenedAt: isoDaysAgo(40)
        }
      ])
    } as Parameters<typeof createApp>[0]);

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/recent-opened",
        userTitle: "Recent opened"
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/old-opened",
        userTitle: "Old opened"
      })
    });

    await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/unopened-filtered",
        userTitle: "Never opened"
      })
    });

    const res = await authenticatedRequest(app, "/api/bookmarks?openedWithin=7d");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      bookmarks: [{ url: "https://example.com/recent-opened" }]
    });
  });

  it("rejects invalid date filter values", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      bookmarkActivityRepository: createInMemoryBookmarkActivityRepository()
    } as Parameters<typeof createApp>[0]);

    const createdRes = await authenticatedRequest(
      app,
      "/api/bookmarks?createdWithin=14d"
    );
    const openedRes = await authenticatedRequest(app, "/api/bookmarks?openedWithin=14d");

    expect(createdRes.status).toBe(400);
    await expect(createdRes.json()).resolves.toMatchObject({
      error: "invalid_created_within"
    });

    expect(openedRes.status).toBe(400);
    await expect(openedRes.json()).resolves.toMatchObject({
      error: "invalid_opened_within"
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

  it("updates a bookmark URL for the authenticated user", async () => {
    const repository = createInMemoryBookmarkRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository: repository
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/before",
        userTitle: "Editable URL"
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
          url: "https://example.com/after?utm_source=test"
        })
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      bookmark: {
        id: created.bookmark.id,
        url: "https://example.com/after?utm_source=test"
      }
    });
  });

  it("rejects an invalid bookmark URL update", async () => {
    const repository = createInMemoryBookmarkRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository: repository
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/before",
        userTitle: "Invalid URL edit"
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
          url: "not a url"
        })
      }
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_url" });
  });

  it("updates hidden state for an existing bookmark", async () => {
    const repository = createInMemoryBookmarkRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository: repository
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/hidden-state",
        userTitle: "Hidden state bookmark"
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
          isHidden: true
        })
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      bookmark: {
        id: created.bookmark.id,
        isHidden: true
      }
    });
  });

  it("keeps a hidden bookmark hidden when patching unrelated fields", async () => {
    const repository = createInMemoryBookmarkRepository();
    const app = createApp({
      sessionSecret,
      bookmarkRepository: repository
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/hidden-unchanged",
        userTitle: "Hidden bookmark",
        isHidden: true
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
          userTitle: "Renamed bookmark"
        })
      }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      bookmark: {
        id: created.bookmark.id,
        userTitle: "Renamed bookmark",
        isHidden: true
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

  it("moves a bookmark to trash, restores it, and permanently deletes it", async () => {
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

    const trashListRes = await authenticatedRequest(app, "/api/bookmarks?trashed=1");
    await expect(trashListRes.json()).resolves.toMatchObject({
      bookmarks: [
        {
          id: created.bookmark.id,
          isTrashed: true,
          trashedAt: "2026-04-13T10:00:00.000Z"
        }
      ]
    });

    const trashedDetailRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}?trashed=1`
    );
    expect(trashedDetailRes.status).toBe(200);

    const restoreRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}/restore`,
      {
        method: "POST"
      }
    );
    expect(restoreRes.status).toBe(200);
    await expect(restoreRes.json()).resolves.toMatchObject({
      bookmark: {
        id: created.bookmark.id,
        isTrashed: false,
        trashedAt: null
      }
    });

    const restoredListRes = await authenticatedRequest(app, "/api/bookmarks");
    await expect(restoredListRes.json()).resolves.toMatchObject({
      bookmarks: [
        {
          id: created.bookmark.id,
          isTrashed: false,
          trashedAt: null
        }
      ]
    });

    await authenticatedRequest(app, `/api/bookmarks/${created.bookmark.id}`, {
      method: "DELETE"
    });
    const permanentDeleteRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}/permanent`,
      {
        method: "DELETE"
      }
    );
    expect(permanentDeleteRes.status).toBe(200);
    await expect(permanentDeleteRes.json()).resolves.toEqual({ ok: true });

    const finalTrashListRes = await authenticatedRequest(app, "/api/bookmarks?trashed=1");
    await expect(finalTrashListRes.json()).resolves.toEqual({ bookmarks: [] });
  });

  it("serves bookmark asset content with a private immutable cache policy", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      bookmarkAssetRepository: createInMemoryBookmarkAssetRepository(),
      assetStorage: createInMemoryAssetStorage()
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/cover",
        userTitle: "Cover bookmark"
      })
    });
    const created = (await createRes.json()) as {
      bookmark: BookmarkRecord;
    };
    const formData = new FormData();
    formData.set("file", new File(["image-bytes"], "cover.png", { type: "image/png" }));

    const sessionValue = await createSessionValue(fakeUser, sessionSecret);
    const uploadRes = await app.request(
      `http://example.com/api/bookmarks/${created.bookmark.id}/assets`,
      {
        method: "POST",
        headers: {
          cookie: `bookmark_session=${sessionValue}`
        },
        body: formData
      }
    );
    const uploaded = (await uploadRes.json()) as {
      asset: { id: string };
    };

    const contentRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}/assets/${uploaded.asset.id}/content`
    );

    expect(contentRes.status).toBe(200);
    expect(contentRes.headers.get("content-type")).toBe("image/png");
    expect(contentRes.headers.get("cache-control")).toBe(
      "private, max-age=604800, immutable"
    );
    expect(await contentRes.text()).toBe("image-bytes");
  });
});
