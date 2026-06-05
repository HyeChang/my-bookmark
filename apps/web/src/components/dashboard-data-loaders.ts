import type { Bookmark, BookmarkCounts } from "@bookmark/shared";

import type { BookmarkPage } from "../lib/bookmarks";
import type { BookmarkSearchDraft } from "./BookmarkResultsPanel";
import {
  DEFAULT_BOOKMARK_PAGE_SIZE,
  emptyBookmarkSearchDraft,
  hasActiveBookmarkSearch,
  normalizeBookmarkSearchDraft
} from "./dashboard-bookmark-utils";

type LoadBookmarks = (search: BookmarkSearchDraft) => Promise<Bookmark[]>;
type LoadBookmarkPage = (
  search: BookmarkSearchDraft & { limit: number; offset: number }
) => Promise<BookmarkPage>;
type LoadBookmarkCounts = () => Promise<BookmarkCounts>;

export type DashboardBookmarkCollections = {
  normalizedSearch: BookmarkSearchDraft;
  visibleBookmarks: Bookmark[];
  inventoryBookmarks: Bookmark[];
};

export type DashboardBookmarkData = DashboardBookmarkCollections & {
  bookmarkCounts: BookmarkCounts | null;
  homeFavoriteBookmarks: Bookmark[] | null;
  hasFullInventory: boolean;
  usesFullInventoryFallback: boolean;
};

export async function loadBookmarkCollections({
  search,
  loadBookmarks
}: {
  search: BookmarkSearchDraft;
  loadBookmarks: LoadBookmarks;
}): Promise<DashboardBookmarkCollections> {
  const normalizedSearch = normalizeBookmarkSearchDraft(search);

  if (hasActiveBookmarkSearch(normalizedSearch)) {
    const [visibleBookmarks, inventoryBookmarks] = await Promise.all([
      loadBookmarks(normalizedSearch),
      loadBookmarks(emptyBookmarkSearchDraft)
    ]);

    return {
      normalizedSearch,
      visibleBookmarks,
      inventoryBookmarks
    };
  }

  const visibleBookmarks = await loadBookmarks(normalizedSearch);

  return {
    normalizedSearch,
    visibleBookmarks,
    inventoryBookmarks: visibleBookmarks
  };
}

export async function loadDashboardBookmarkData({
  activeDashboardView,
  search,
  loadBookmarks,
  loadBookmarkPage,
  loadBookmarkCounts,
  onHomeFallback
}: {
  activeDashboardView: string;
  search: BookmarkSearchDraft;
  loadBookmarks: LoadBookmarks;
  loadBookmarkPage: LoadBookmarkPage;
  loadBookmarkCounts: LoadBookmarkCounts;
  onHomeFallback?: () => void;
}): Promise<DashboardBookmarkData> {
  const normalizedSearch = normalizeBookmarkSearchDraft(search);

  if (activeDashboardView !== "home" || hasActiveBookmarkSearch(normalizedSearch)) {
    const collections = await loadBookmarkCollections({
      search: normalizedSearch,
      loadBookmarks
    });
    return {
      ...collections,
      bookmarkCounts: null,
      homeFavoriteBookmarks: null,
      hasFullInventory: true,
      usesFullInventoryFallback: false
    };
  }

  try {
    const [favoritePage, nextBookmarkCounts] = await Promise.all([
      loadBookmarkPage({
        ...emptyBookmarkSearchDraft,
        favoriteOnly: true,
        limit: DEFAULT_BOOKMARK_PAGE_SIZE,
        offset: 0
      }),
      loadBookmarkCounts()
    ]);

    return {
      normalizedSearch,
      visibleBookmarks: [],
      inventoryBookmarks: [],
      bookmarkCounts: nextBookmarkCounts,
      homeFavoriteBookmarks: favoritePage.bookmarks,
      hasFullInventory: false,
      usesFullInventoryFallback: false
    };
  } catch {
    onHomeFallback?.();
    const collections = await loadBookmarkCollections({
      search: normalizedSearch,
      loadBookmarks
    });
    return {
      ...collections,
      bookmarkCounts: null,
      homeFavoriteBookmarks: null,
      hasFullInventory: true,
      usesFullInventoryFallback: true
    };
  }
}
