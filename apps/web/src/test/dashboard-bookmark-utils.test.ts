import { describe, expect, it } from "vitest";
import type { Bookmark, Folder } from "@bookmark/shared";

import {
  filterBookmarksForFolderOverviewSearch,
  getBookmarkSearchSummaryItems,
  getExtensionFolderIds,
  moveFolderToSiblingPosition,
  normalizeBookmarkSearchDraft
} from "../components/dashboard-bookmark-utils";
import type { BookmarkSearchDraft } from "../components/BookmarkResultsPanel";

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

function createFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: overrides.id ?? "folder-1",
    name: overrides.name ?? "Folder",
    color: overrides.color ?? null,
    icon: overrides.icon ?? null,
    isHidden: overrides.isHidden ?? false,
    parentFolderId: overrides.parentFolderId ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? "2026-04-27T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-27T00:00:00.000Z"
  };
}

function createSearchDraft(overrides: Partial<BookmarkSearchDraft> = {}): BookmarkSearchDraft {
  return {
    query: "",
    mode: "all",
    sort: "created_desc",
    createdWithin: "all",
    openedWithin: "all",
    favoriteOnly: false,
    folderId: "",
    includeDescendantFolders: false,
    tagIds: [],
    tagMode: "and",
    bookmarkColor: "",
    urlColor: "",
    summaryState: "all",
    ...overrides
  };
}

describe("dashboard bookmark utilities", () => {
  it("normalizes search drafts before applying dashboard filters", () => {
    const normalized = normalizeBookmarkSearchDraft(
      createSearchDraft({
        query: "  react  ",
        folderId: "   ",
        includeDescendantFolders: true,
        tagIds: ["tag-1", " tag-1 ", "", "tag-2"],
        tagMode: "or",
        bookmarkColor: " #123456 "
      })
    );

    expect(normalized).toMatchObject({
      query: "react",
      folderId: "",
      includeDescendantFolders: false,
      tagIds: ["tag-1", "tag-2"],
      tagMode: "or",
      bookmarkColor: "#123456"
    });
  });

  it("builds removable search summary items without keeping stale tag mode", () => {
    const items = getBookmarkSearchSummaryItems(
      createSearchDraft({
        query: "docs",
        mode: "title",
        tagIds: ["tag-1"],
        tagMode: "or"
      }),
      {
        getFolderName: (folderId) => folderId ?? "미분류",
        getTagNames: () => ["프론트엔드"]
      }
    );

    expect(items.map((item) => item.key)).toEqual([
      "query:docs",
      "mode:title",
      "tag:tag-1",
      "tagMode"
    ]);
    expect(items.find((item) => item.key === "tag:tag-1")?.nextSearch).toMatchObject({
      tagIds: [],
      tagMode: "and"
    });
  });

  it("keeps extension folders and descendants out of user-facing folder sets", () => {
    const extensionRoot = createFolder({ id: "extension-root", name: "확장" });
    const extensionChild = createFolder({
      id: "extension-child",
      name: "자동 저장",
      parentFolderId: extensionRoot.id
    });
    const userFolder = createFolder({ id: "user-folder", name: "개인" });

    expect(
      Array.from(getExtensionFolderIds([extensionRoot, extensionChild, userFolder])).sort()
    ).toEqual(["extension-child", "extension-root"]);
  });

  it("filters folder overview bookmarks with descendant folders only when requested", () => {
    const folders = [
      createFolder({ id: "root", name: "Root" }),
      createFolder({ id: "child", name: "Child", parentFolderId: "root" })
    ];
    const bookmarks = [
      createBookmark({ id: "root-bookmark", folderId: "root" }),
      createBookmark({ id: "child-bookmark", folderId: "child" }),
      createBookmark({ id: "other-bookmark", folderId: null })
    ];

    expect(
      filterBookmarksForFolderOverviewSearch(
        bookmarks,
        folders,
        createSearchDraft({ folderId: "root" })
      ).map((bookmark) => bookmark.id)
    ).toEqual(["root-bookmark"]);
    expect(
      filterBookmarksForFolderOverviewSearch(
        bookmarks,
        folders,
        createSearchDraft({ folderId: "root", includeDescendantFolders: true })
      ).map((bookmark) => bookmark.id)
    ).toEqual(["root-bookmark", "child-bookmark"]);
  });

  it("moves a sibling folder directly to the requested boundary", () => {
    const folders = [
      createFolder({ id: "a", sortOrder: 0 }),
      createFolder({ id: "b", sortOrder: 1 }),
      createFolder({ id: "c", sortOrder: 2 })
    ];

    expect(moveFolderToSiblingPosition(folders, "c", "top").map((folder) => folder.id)).toEqual([
      "c",
      "a",
      "b"
    ]);
    expect(moveFolderToSiblingPosition(folders, "a", "bottom").map((folder) => folder.id)).toEqual([
      "b",
      "c",
      "a"
    ]);
  });
});
