import { startTransition } from "react";
import type { Bookmark, BookmarkAsset } from "@bookmark/shared";

import {
  getBookmarkAssetPreloadBatches,
  type BookmarkAssetPreloadDashboardView,
  type BookmarkAssetPreloadViewMode
} from "../lib/bookmark-asset-preload";
import {
  BOOKMARK_VIRTUALIZATION_THRESHOLD,
  BOOKMARK_VIRTUAL_WINDOW_SIZE
} from "./dashboard-bookmark-virtualization";

export type BookmarkAssetsByBookmarkId = Record<string, BookmarkAsset[]>;

type MutableRef<T> = {
  current: T;
};

type BookmarkAssetsStateSetter = (
  updater: (latestAssetsByBookmarkId: BookmarkAssetsByBookmarkId) => BookmarkAssetsByBookmarkId
) => void;

type BookmarkAssetLoaderOptions = {
  loadBookmarkAssetsByBookmarks: (bookmarkIds: string[]) => Promise<BookmarkAssetsByBookmarkId>;
  loadBookmarkAssets: (bookmarkId: string) => Promise<BookmarkAsset[]>;
};

type PreloadMissingBookmarkAssetsOptions = {
  bookmarksToLoad: Bookmark[];
  currentAssetsByBookmarkId: BookmarkAssetsByBookmarkId;
  preloadingBookmarkAssetIds: Set<string>;
  loadBookmarkAssetsForBookmarks?: (
    bookmarksToLoad: Bookmark[]
  ) => Promise<BookmarkAssetsByBookmarkId>;
  setBookmarkAssetsByBookmarkId: BookmarkAssetsStateSetter;
  transition?: (applyUpdate: () => void) => void;
} & BookmarkAssetLoaderOptions;

type DashboardBookmarkAssetPreloadCandidatesOptions = {
  dashboardView: BookmarkAssetPreloadDashboardView;
  bookmarkViewMode: BookmarkAssetPreloadViewMode;
  shouldUseCompactMobileCards: boolean;
};

type QueueBookmarkAssetPreloadOptions = PreloadMissingBookmarkAssetsOptions &
  DashboardBookmarkAssetPreloadCandidatesOptions & {
    deferredBookmarkAssetPreloadTimerRef: MutableRef<
      ReturnType<typeof globalThis.setTimeout> | null
    >;
  };

export async function loadBookmarkAssetsForBookmarks(
  bookmarksToLoad: Bookmark[],
  options: BookmarkAssetLoaderOptions
) {
  const bookmarkIds = bookmarksToLoad.map((bookmark) => bookmark.id);

  try {
    return await options.loadBookmarkAssetsByBookmarks(bookmarkIds);
  } catch {
    const assetEntries = await Promise.all(
      bookmarksToLoad.map(async (bookmark) => {
        try {
          const assets = await options.loadBookmarkAssets(bookmark.id);
          return [bookmark.id, assets] as const;
        } catch {
          return [bookmark.id, [] as BookmarkAsset[]] as const;
        }
      })
    );

    return Object.fromEntries(assetEntries) as BookmarkAssetsByBookmarkId;
  }
}

export async function preloadMissingBookmarkAssets(
  options: PreloadMissingBookmarkAssetsOptions
) {
  const bookmarksMissingAssets = options.bookmarksToLoad.filter(
    (bookmark) =>
      options.currentAssetsByBookmarkId[bookmark.id] === undefined &&
      !options.preloadingBookmarkAssetIds.has(bookmark.id)
  );
  if (bookmarksMissingAssets.length === 0) {
    return;
  }

  for (const bookmark of bookmarksMissingAssets) {
    options.preloadingBookmarkAssetIds.add(bookmark.id);
  }

  try {
    const loadBookmarks =
      options.loadBookmarkAssetsForBookmarks ??
      ((nextBookmarksToLoad: Bookmark[]) =>
        loadBookmarkAssetsForBookmarks(nextBookmarksToLoad, options));
    const nextBookmarkAssetsByBookmarkId = await loadBookmarks(bookmarksMissingAssets);
    const transition = options.transition ?? startTransition;

    transition(() => {
      options.setBookmarkAssetsByBookmarkId((latestAssetsByBookmarkId) => {
        const missingAssetEntries = Object.entries(nextBookmarkAssetsByBookmarkId).filter(
          ([bookmarkId]) => latestAssetsByBookmarkId[bookmarkId] === undefined
        );
        if (missingAssetEntries.length === 0) {
          return latestAssetsByBookmarkId;
        }

        return {
          ...latestAssetsByBookmarkId,
          ...Object.fromEntries(missingAssetEntries)
        };
      });
    });
  } finally {
    for (const bookmark of bookmarksMissingAssets) {
      options.preloadingBookmarkAssetIds.delete(bookmark.id);
    }
  }
}

export function getDashboardBookmarkAssetPreloadCandidates(
  bookmarksToLoad: Bookmark[],
  options: DashboardBookmarkAssetPreloadCandidatesOptions
) {
  if (
    options.dashboardView === "bookmarks" &&
    (options.bookmarkViewMode === "list" || options.bookmarkViewMode === "title") &&
    bookmarksToLoad.length > BOOKMARK_VIRTUALIZATION_THRESHOLD
  ) {
    const visibleWindowSize = options.shouldUseCompactMobileCards
      ? 28
      : BOOKMARK_VIRTUAL_WINDOW_SIZE;
    return bookmarksToLoad.slice(0, visibleWindowSize);
  }

  return bookmarksToLoad;
}

export function queueBookmarkAssetPreload(options: QueueBookmarkAssetPreloadOptions) {
  if (options.deferredBookmarkAssetPreloadTimerRef.current) {
    globalThis.clearTimeout(options.deferredBookmarkAssetPreloadTimerRef.current);
    options.deferredBookmarkAssetPreloadTimerRef.current = null;
  }

  const preloadCandidates = getDashboardBookmarkAssetPreloadCandidates(
    options.bookmarksToLoad,
    options
  ).filter(
    (bookmark) =>
      options.currentAssetsByBookmarkId[bookmark.id] === undefined &&
      !options.preloadingBookmarkAssetIds.has(bookmark.id)
  );
  if (preloadCandidates.length === 0) {
    return;
  }

  const batches = getBookmarkAssetPreloadBatches(preloadCandidates, {
    dashboardView: options.dashboardView,
    bookmarkViewMode: options.bookmarkViewMode
  });

  const preloadAssets = (bookmarksToLoad: Bookmark[]) =>
    preloadMissingBookmarkAssets({
      ...options,
      bookmarksToLoad,
      currentAssetsByBookmarkId: options.currentAssetsByBookmarkId
    });

  if (batches.eager.length > 0) {
    void preloadAssets(batches.eager);
  }

  if (batches.deferred.length === 0) {
    return;
  }

  options.deferredBookmarkAssetPreloadTimerRef.current = globalThis.setTimeout(() => {
    void preloadAssets(batches.deferred);
    options.deferredBookmarkAssetPreloadTimerRef.current = null;
  }, 500);
}
