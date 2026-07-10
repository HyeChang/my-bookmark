import { describe, expect, it } from "vitest";
import type { Bookmark, BookmarkCounts } from "@bookmark/shared";

import {
  loadDashboardBookmarkData
} from "../components/dashboard-data-loaders";
import {
  DEFAULT_BOOKMARK_PAGE_SIZE,
  emptyBookmarkSearchDraft
} from "../components/dashboard-bookmark-utils";

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
  it("loads the first bookmark page and counts without downloading the full inventory", async () => {
    const started: string[] = [];
    const firstBookmark = createBookmark("filtered");
    const pendingLoads: Array<() => void> = [];

    const resultPromise = loadDashboardBookmarkData({
      activeDashboardView: "bookmarks",
      search: { ...emptyBookmarkSearchDraft, query: "docs" },
      loadBookmarkPage: async (search) => {
        started.push(`page:${search.query}:${search.limit}:${search.offset}`);
        await new Promise<void>((resolve) => pendingLoads.push(resolve));
        return {
          bookmarks: [firstBookmark],
          pagination: {
            limit: search.limit,
            offset: search.offset,
            total: 1,
            hasMore: false
          }
        };
      },
      loadBookmarkCounts: async () => {
        started.push("counts");
        await new Promise<void>((resolve) => pendingLoads.push(resolve));
        return emptyCounts;
      }
    });

    expect(started).toEqual([`page:docs:${DEFAULT_BOOKMARK_PAGE_SIZE}:0`, "counts"]);
    pendingLoads.forEach((resolve) => resolve());

    await expect(resultPromise).resolves.toMatchObject({
      visibleBookmarks: [firstBookmark],
      inventoryBookmarks: [],
      bookmarkCounts: emptyCounts,
      bookmarkPage: {
        bookmarks: [firstBookmark]
      },
      hasFullInventory: false
    });
  });

  it("loads home favorites and counts in parallel", async () => {
    const started: string[] = [];
    const favoriteBookmark = createBookmark("favorite", { isFavorite: true });
    const pendingLoads: Array<() => void> = [];

    const resultPromise = loadDashboardBookmarkData({
      activeDashboardView: "home",
      search: emptyBookmarkSearchDraft,
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

  it("keeps the bookmark page usable when the counts request fails", async () => {
    const visibleBookmark = createBookmark("visible", { folderId: "folder-1" });
    const hiddenBookmark = createBookmark("hidden", {
      folderId: "folder-1",
      isFavorite: true,
      isHidden: true
    });

    await expect(loadDashboardBookmarkData({
      activeDashboardView: "bookmarks",
      search: emptyBookmarkSearchDraft,
      loadBookmarkPage: async () => ({
        bookmarks: [visibleBookmark, hiddenBookmark],
        pagination: null
      }),
      loadBookmarkCounts: async () => {
        throw new Error("counts unavailable");
      }
    })).resolves.toMatchObject({
      visibleBookmarks: [visibleBookmark, hiddenBookmark],
      bookmarkCounts: {
        active: { total: 2, visible: 1 },
        favorite: { total: 1, visible: 0 },
        byFolderId: {
          "folder-1": { total: 2, visible: 1 }
        }
      }
    });
  });
});
