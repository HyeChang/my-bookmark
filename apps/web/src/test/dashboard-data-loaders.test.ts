import { describe, expect, it } from "vitest";
import type { Bookmark, BookmarkCounts } from "@bookmark/shared";

import {
  loadBookmarkCollections,
  loadDashboardBookmarkData
} from "../components/dashboard-data-loaders";
import {
  DEFAULT_BOOKMARK_PAGE_SIZE,
  emptyBookmarkSearchDraft
} from "../components/dashboard-bookmark-utils";
import type { BookmarkSearchDraft } from "../components/BookmarkResultsPanel";

function createBookmark(id: string, overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id,
    folderId: null,
    tagIds: [],
    url: `https://example.com/${id}`,
    isFavorite: false,
    isHidden: false,
    isTrashed: false,
    trashedAt: null,
    bookmarkColor: null,
    urlColor: null,
    sourceTitle: null,
    sourceContent: null,
    sourceSummary: null,
    userTitle: null,
    userContent: null,
    userSummary: null,
    displayTitle: id,
    displayContent: "",
    displaySummary: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

const emptyCounts: BookmarkCounts = {
  active: { total: 0, visible: 0 },
  favorite: { total: 0, visible: 0 },
  trashed: { total: 0, visible: 0 },
  unfiled: { total: 0, visible: 0 },
  byFolderId: {}
};

describe("dashboard data loaders", () => {
  it("loads filtered bookmarks and full inventory in parallel", async () => {
    const startedSearches: BookmarkSearchDraft[] = [];
    const firstBookmark = createBookmark("filtered");
    const secondBookmark = createBookmark("inventory");
    const pendingLoads: Array<() => void> = [];

    const resultPromise = loadBookmarkCollections({
      search: { ...emptyBookmarkSearchDraft, query: "docs" },
      loadBookmarks: async (search) => {
        startedSearches.push(search);
        await new Promise<void>((resolve) => pendingLoads.push(resolve));
        return search.query ? [firstBookmark] : [secondBookmark];
      }
    });

    expect(startedSearches).toHaveLength(2);
    pendingLoads.forEach((resolve) => resolve());

    await expect(resultPromise).resolves.toMatchObject({
      visibleBookmarks: [firstBookmark],
      inventoryBookmarks: [secondBookmark]
    });
  });

  it("loads home favorites and counts in parallel", async () => {
    const started: string[] = [];
    const favoriteBookmark = createBookmark("favorite", { isFavorite: true });
    const pendingLoads: Array<() => void> = [];

    const resultPromise = loadDashboardBookmarkData({
      activeDashboardView: "home",
      search: emptyBookmarkSearchDraft,
      loadBookmarks: async () => [],
      loadBookmarkPage: async (search) => {
        started.push(`page:${search.limit}:${search.offset}:${String(search.favoriteOnly)}`);
        await new Promise<void>((resolve) => pendingLoads.push(resolve));
        return {
          bookmarks: [favoriteBookmark],
          pagination: null
        };
      },
      loadBookmarkCounts: async () => {
        started.push("counts");
        await new Promise<void>((resolve) => pendingLoads.push(resolve));
        return emptyCounts;
      }
    });

    expect(started).toEqual([
      `page:${DEFAULT_BOOKMARK_PAGE_SIZE}:0:true`,
      "counts"
    ]);
    pendingLoads.forEach((resolve) => resolve());

    await expect(resultPromise).resolves.toMatchObject({
      visibleBookmarks: [],
      inventoryBookmarks: [],
      bookmarkCounts: emptyCounts,
      homeFavoriteBookmarks: [favoriteBookmark],
      hasFullInventory: false,
      usesFullInventoryFallback: false
    });
  });
});
