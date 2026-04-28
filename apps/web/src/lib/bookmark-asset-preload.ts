import type { Bookmark } from "@bookmark/shared";

export type BookmarkAssetPreloadDashboardView = "home" | "bookmarks";
export type BookmarkAssetPreloadViewMode = "list" | "card" | "title" | "moodboard";

type BookmarkAssetPreloadOptions = {
  dashboardView: BookmarkAssetPreloadDashboardView;
  bookmarkViewMode: BookmarkAssetPreloadViewMode;
  eagerLimit?: number;
};

export const DEFAULT_BOOKMARK_ASSET_PRELOAD_EAGER_LIMIT = 18;

export function getBookmarkAssetPreloadBatches(
  bookmarks: Bookmark[],
  options: BookmarkAssetPreloadOptions
) {
  const eagerLimit = Math.max(0, options.eagerLimit ?? DEFAULT_BOOKMARK_ASSET_PRELOAD_EAGER_LIMIT);
  const activeBookmarks = bookmarks.filter((bookmark) => bookmark.isTrashed !== true);
  const candidates = (() => {
    if (options.dashboardView === "home") {
      const favoriteBookmarks = activeBookmarks.filter((bookmark) => bookmark.isFavorite);
      const regularBookmarks = activeBookmarks.filter((bookmark) => !bookmark.isFavorite);
      return [...favoriteBookmarks, ...regularBookmarks];
    }

    if (options.bookmarkViewMode === "title") {
      return [];
    }

    return bookmarks;
  })();

  return {
    eager: candidates.slice(0, eagerLimit),
    deferred: candidates.slice(eagerLimit)
  };
}
