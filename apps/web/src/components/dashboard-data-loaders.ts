import type { Bookmark, BookmarkCounts } from "@bookmark/shared";

import type { BookmarkPage } from "../lib/bookmarks";
import type { BookmarkSearchDraft } from "./BookmarkResultsPanel";
import {
  DEFAULT_BOOKMARK_PAGE_SIZE,
  emptyBookmarkSearchDraft,
  hasActiveBookmarkSearch,
  normalizeBookmarkSearchDraft
} from "./dashboard-bookmark-utils";

type LoadBookmarkPage = (
  search: BookmarkSearchDraft & { limit: number; offset: number }
) => Promise<BookmarkPage>;
type LoadBookmarkCounts = () => Promise<BookmarkCounts>;

function createBookmarkCountBucket() {
  return { total: 0, visible: 0 };
}

function addBookmarkToCountBucket(
  bucket: { total: number; visible: number },
  isHidden: boolean
) {
  bucket.total += 1;
  if (!isHidden) {
    bucket.visible += 1;
  }
}

function deriveBookmarkCounts(bookmarks: Bookmark[]): BookmarkCounts {
  const counts: BookmarkCounts = {
    active: createBookmarkCountBucket(),
    favorite: createBookmarkCountBucket(),
    trashed: createBookmarkCountBucket(),
    unfiled: createBookmarkCountBucket(),
    byFolderId: {}
  };

  for (const bookmark of bookmarks) {
    const isHidden = bookmark.isHidden === true;
    if (bookmark.isTrashed === true) {
      addBookmarkToCountBucket(counts.trashed, isHidden);
      continue;
    }

    addBookmarkToCountBucket(counts.active, isHidden);
    if (bookmark.isFavorite === true) {
      addBookmarkToCountBucket(counts.favorite, isHidden);
    }
    if (!bookmark.folderId) {
      addBookmarkToCountBucket(counts.unfiled, isHidden);
      continue;
    }

    const folderBucket = counts.byFolderId[bookmark.folderId] ?? createBookmarkCountBucket();
    addBookmarkToCountBucket(folderBucket, isHidden);
    counts.byFolderId[bookmark.folderId] = folderBucket;
  }

  return counts;
}

export type DashboardBookmarkCollections = {
  normalizedSearch: BookmarkSearchDraft;
  visibleBookmarks: Bookmark[];
  inventoryBookmarks: Bookmark[];
};

export type DashboardBookmarkData = DashboardBookmarkCollections & {
  bookmarkCounts: BookmarkCounts | null;
  bookmarkPage: BookmarkPage | null;
  homeFavoriteBookmarks: Bookmark[] | null;
  hasFullInventory: boolean;
  usesFullInventoryFallback: boolean;
};

export async function loadDashboardBookmarkData({
  activeDashboardView,
  search,
  loadBookmarkPage,
  loadBookmarkCounts,
  pageSize = DEFAULT_BOOKMARK_PAGE_SIZE,
  onHomeFallback
}: {
  activeDashboardView: string;
  search: BookmarkSearchDraft;
  loadBookmarkPage: LoadBookmarkPage;
  loadBookmarkCounts: LoadBookmarkCounts;
  pageSize?: number;
  onHomeFallback?: () => void;
}): Promise<DashboardBookmarkData> {
  const normalizedSearch = normalizeBookmarkSearchDraft(search);

  if (activeDashboardView !== "home" || hasActiveBookmarkSearch(normalizedSearch)) {
    const [bookmarkPage, bookmarkCounts] = await Promise.all([
      loadBookmarkPage({
        ...normalizedSearch,
        limit: pageSize,
        offset: 0
      }),
      loadBookmarkCounts().catch(() => null)
    ]);
    return {
      normalizedSearch,
      visibleBookmarks: bookmarkPage.bookmarks,
      inventoryBookmarks: [],
      bookmarkCounts: bookmarkCounts ?? deriveBookmarkCounts(bookmarkPage.bookmarks),
      bookmarkPage,
      homeFavoriteBookmarks: null,
      hasFullInventory: false,
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
      loadBookmarkCounts().catch(() => null)
    ]);

    return {
      normalizedSearch,
      visibleBookmarks: [],
      inventoryBookmarks: [],
      bookmarkCounts: nextBookmarkCounts ?? deriveBookmarkCounts(favoritePage.bookmarks),
      bookmarkPage: null,
      homeFavoriteBookmarks: favoritePage.bookmarks,
      hasFullInventory: false,
      usesFullInventoryFallback: false
    };
  } catch {
    onHomeFallback?.();
    const bookmarkPage = await loadBookmarkPage({
      ...normalizedSearch,
      limit: pageSize,
      offset: 0
    });
    return {
      normalizedSearch,
      visibleBookmarks: bookmarkPage.bookmarks,
      inventoryBookmarks: [],
      bookmarkCounts: deriveBookmarkCounts(bookmarkPage.bookmarks),
      bookmarkPage,
      homeFavoriteBookmarks: null,
      hasFullInventory: false,
      usesFullInventoryFallback: true
    };
  }
}
