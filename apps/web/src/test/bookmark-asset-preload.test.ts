import { describe, expect, it } from "vitest";
import type { Bookmark, BookmarkAsset } from "@bookmark/shared";

import { getBookmarkAssetPreloadBatches } from "../lib/bookmark-asset-preload";
import {
  loadBookmarkAssetsForBookmarks,
  preloadMissingBookmarkAssets,
  queueBookmarkAssetPreload
} from "../components/dashboard-bookmark-asset-preload";

function createBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: overrides.id ?? "bookmark-1",
    folderId: overrides.folderId ?? null,
    tagIds: overrides.tagIds ?? [],
    url: overrides.url ?? "https://example.com",
    isFavorite: overrides.isFavorite ?? false,
    isHidden: overrides.isHidden ?? false,
    isTrashed: overrides.isTrashed ?? false,
    trashedAt: overrides.trashedAt ?? null,
    bookmarkColor: overrides.bookmarkColor ?? null,
    urlColor: overrides.urlColor ?? null,
    sourceTitle: overrides.sourceTitle ?? null,
    sourceContent: overrides.sourceContent ?? null,
    sourceSummary: overrides.sourceSummary ?? null,
    userTitle: overrides.userTitle ?? null,
    userContent: overrides.userContent ?? null,
    userSummary: overrides.userSummary ?? null,
    displayTitle: overrides.displayTitle ?? overrides.id ?? "Bookmark",
    displayContent: overrides.displayContent ?? "",
    displaySummary: overrides.displaySummary ?? "",
    createdAt: overrides.createdAt ?? "2026-04-27T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-27T00:00:00.000Z"
  };
}

function createBookmarkAsset(overrides: Partial<BookmarkAsset> = {}): BookmarkAsset {
  return {
    id: overrides.id ?? "asset-1",
    bookmarkId: overrides.bookmarkId ?? "bookmark-1",
    assetType: overrides.assetType ?? "image",
    mimeType: overrides.mimeType ?? "image/webp",
    width: overrides.width ?? 512,
    height: overrides.height ?? 320,
    sortOrder: overrides.sortOrder ?? 0,
    contentUrl: overrides.contentUrl ?? "/asset.webp",
    thumbnailUrl: overrides.thumbnailUrl,
    createdAt: overrides.createdAt ?? "2026-04-27T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-27T00:00:00.000Z"
  };
}

describe("bookmark asset preload planning", () => {
  it("prioritizes active favorite bookmarks before deferred home preload work", () => {
    const batches = getBookmarkAssetPreloadBatches(
      [
        createBookmark({ id: "regular-1" }),
        createBookmark({ id: "favorite-1", isFavorite: true }),
        createBookmark({ id: "favorite-trashed", isFavorite: true, isTrashed: true }),
        createBookmark({ id: "favorite-2", isFavorite: true })
      ],
      {
        dashboardView: "home",
        bookmarkViewMode: "list",
        eagerLimit: 1
      }
    );

    expect(batches.eager.map((bookmark) => bookmark.id)).toEqual(["favorite-1"]);
    expect(batches.deferred.map((bookmark) => bookmark.id)).toEqual([
      "favorite-2",
      "regular-1"
    ]);
  });

  it("skips bookmark asset preloading when the list view does not render covers", () => {
    const batches = getBookmarkAssetPreloadBatches(
      [
        createBookmark({ id: "bookmark-1" }),
        createBookmark({ id: "bookmark-2" })
      ],
      {
        dashboardView: "bookmarks",
        bookmarkViewMode: "title",
        eagerLimit: 1
      }
    );

    expect(batches.eager).toEqual([]);
    expect(batches.deferred).toEqual([]);
  });

  it("falls back to per-bookmark asset loads when the batch endpoint fails", async () => {
    const bookmarks = [
      createBookmark({ id: "bookmark-1" }),
      createBookmark({ id: "bookmark-2" })
    ];
    const singleCalls: string[] = [];

    const assetsByBookmarkId = await loadBookmarkAssetsForBookmarks(bookmarks, {
      loadBookmarkAssetsByBookmarks: async () => {
        throw new Error("batch failed");
      },
      loadBookmarkAssets: async (bookmarkId) => {
        singleCalls.push(bookmarkId);
        if (bookmarkId === "bookmark-2") {
          throw new Error("single failed");
        }
        return [createBookmarkAsset({ id: "asset-1", bookmarkId })];
      }
    });

    expect(singleCalls).toEqual(["bookmark-1", "bookmark-2"]);
    expect(assetsByBookmarkId).toEqual({
      "bookmark-1": [createBookmarkAsset({ id: "asset-1", bookmarkId: "bookmark-1" })],
      "bookmark-2": []
    });
  });

  it("preloads only missing bookmark assets and merges them without replacing newer cache entries", async () => {
    const preloadingBookmarkAssetIds = new Set(["bookmark-loading"]);
    let latestAssetsByBookmarkId: Record<string, BookmarkAsset[]> = {
      "bookmark-cached": [createBookmarkAsset({ id: "cached", bookmarkId: "bookmark-cached" })]
    };
    const loadedBookmarkIds: string[] = [];

    await preloadMissingBookmarkAssets({
      bookmarksToLoad: [
        createBookmark({ id: "bookmark-cached" }),
        createBookmark({ id: "bookmark-loading" }),
        createBookmark({ id: "bookmark-new" })
      ],
      currentAssetsByBookmarkId: latestAssetsByBookmarkId,
      preloadingBookmarkAssetIds,
      loadBookmarkAssetsForBookmarks: async (bookmarksToLoad) => {
        loadedBookmarkIds.push(...bookmarksToLoad.map((bookmark) => bookmark.id));
        latestAssetsByBookmarkId["bookmark-new"] = [
          createBookmarkAsset({ id: "newer", bookmarkId: "bookmark-new" })
        ];
        return {
          "bookmark-new": [createBookmarkAsset({ id: "loaded", bookmarkId: "bookmark-new" })]
        };
      },
      setBookmarkAssetsByBookmarkId: (updater) => {
        latestAssetsByBookmarkId = updater(latestAssetsByBookmarkId);
      },
      transition: (applyUpdate) => applyUpdate()
    });

    expect(loadedBookmarkIds).toEqual(["bookmark-new"]);
    expect(preloadingBookmarkAssetIds.has("bookmark-new")).toBe(false);
    expect(latestAssetsByBookmarkId["bookmark-new"]).toEqual([
      createBookmarkAsset({ id: "newer", bookmarkId: "bookmark-new" })
    ]);
  });

  it("queues eager bookmark asset preloads and replaces pending deferred work", () => {
    const preloadingBookmarkAssetIds = new Set<string>();
    const deferredBookmarkAssetPreloadTimerRef = { current: null as ReturnType<typeof setTimeout> | null };
    const loadedBatches: string[][] = [];

    queueBookmarkAssetPreload({
      bookmarksToLoad: Array.from({ length: 22 }, (_, index) =>
        createBookmark({ id: `bookmark-${index + 1}` })
      ),
      currentAssetsByBookmarkId: {},
      dashboardView: "bookmarks",
      bookmarkViewMode: "card",
      shouldUseCompactMobileCards: false,
      preloadingBookmarkAssetIds,
      deferredBookmarkAssetPreloadTimerRef,
      loadBookmarkAssetsForBookmarks: async (bookmarksToLoad) => {
        loadedBatches.push(bookmarksToLoad.map((bookmark) => bookmark.id));
        return {};
      },
      setBookmarkAssetsByBookmarkId: () => undefined,
      transition: (applyUpdate) => applyUpdate()
    });
    const firstDeferredTimer = deferredBookmarkAssetPreloadTimerRef.current;

    queueBookmarkAssetPreload({
      bookmarksToLoad: [createBookmark({ id: "replacement" })],
      currentAssetsByBookmarkId: {},
      dashboardView: "bookmarks",
      bookmarkViewMode: "card",
      shouldUseCompactMobileCards: false,
      preloadingBookmarkAssetIds,
      deferredBookmarkAssetPreloadTimerRef,
      loadBookmarkAssetsForBookmarks: async (bookmarksToLoad) => {
        loadedBatches.push(bookmarksToLoad.map((bookmark) => bookmark.id));
        return {};
      },
      setBookmarkAssetsByBookmarkId: () => undefined,
      transition: (applyUpdate) => applyUpdate()
    });

    expect(loadedBatches[0]).toHaveLength(18);
    expect(loadedBatches[1]).toEqual(["replacement"]);
    expect(deferredBookmarkAssetPreloadTimerRef.current).not.toBe(firstDeferredTimer);
  });
});
