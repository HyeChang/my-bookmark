import { describe, expect, it } from "vitest";
import type { Bookmark } from "@bookmark/shared";

import { getBookmarkAssetPreloadBatches } from "../lib/bookmark-asset-preload";

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
});
