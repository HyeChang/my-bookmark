import JSZip from "jszip";
import type { Bookmark, BookmarkAsset, Folder, Tag } from "@bookmark/shared";
import { describe, expect, it, vi } from "vitest";

import {
  createBookmarkBackupZipBlob,
  importBookmarkBackupZipBlob,
  type BookmarkExportPayload
} from "../lib/bookmark-export";

function createBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: "bookmark-1",
    folderId: "folder-1",
    tagIds: ["tag-1"],
    url: "https://example.com",
    isFavorite: true,
    isHidden: false,
    isTrashed: false,
    trashedAt: null,
    bookmarkColor: "#f59e0b",
    urlColor: "#0f172a",
    sourceTitle: "Source title",
    sourceContent: "Source content",
    sourceSummary: "Source summary",
    userTitle: "User title",
    userContent: "User content",
    userSummary: "User summary",
    displayTitle: "User title",
    displayContent: "User content",
    displaySummary: "User summary",
    createdAt: "2026-04-13T08:00:00.000Z",
    updatedAt: "2026-04-13T08:00:00.000Z",
    ...overrides
  };
}

function createFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "folder-1",
    name: "Reading",
    color: "#2563eb",
    icon: "book",
    isHidden: false,
    parentFolderId: null,
    sortOrder: 0,
    createdAt: "2026-04-13T08:00:00.000Z",
    updatedAt: "2026-04-13T08:00:00.000Z",
    ...overrides
  };
}

function createTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: "tag-1",
    name: "research",
    color: "#16a34a",
    createdAt: "2026-04-13T08:00:00.000Z",
    updatedAt: "2026-04-13T08:00:00.000Z",
    ...overrides
  };
}

function createAsset(overrides: Partial<BookmarkAsset> = {}): BookmarkAsset {
  return {
    id: "asset-1",
    bookmarkId: "bookmark-1",
    assetType: "image",
    mimeType: "image/png",
    width: 640,
    height: 360,
    sortOrder: 0,
    contentUrl: "/api/bookmarks/bookmark-1/assets/asset-1/content",
    thumbnailUrl: "/api/bookmarks/bookmark-1/assets/asset-1/thumbnail",
    createdAt: "2026-04-13T08:00:00.000Z",
    updatedAt: "2026-04-13T08:00:00.000Z",
    ...overrides
  };
}

describe("bookmark import/export", () => {
  it("exports bookmark data and image files into a backup zip", async () => {
    const payload: BookmarkExportPayload = {
      exportedAt: "2026-06-10T00:00:00.000Z",
      bookmarks: [createBookmark()],
      folders: [createFolder()],
      tags: [createTag()],
      bookmarkAssetsByBookmarkId: {
        "bookmark-1": [createAsset()]
      }
    };
    const fetchAssetBlob = vi.fn(async (url: string) =>
      new Blob([url.includes("thumbnail") ? "thumbnail-bytes" : "content-bytes"], {
        type: "image/png"
      })
    );

    const zipBlob = await createBookmarkBackupZipBlob(payload, { fetchAssetBlob });
    const zip = await JSZip.loadAsync(zipBlob);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));

    expect(manifest).toMatchObject({
      kind: "bookmarks",
      version: 2,
      bookmarks: [expect.objectContaining({ id: "bookmark-1" })],
      assetFilesByBookmarkId: {
        "bookmark-1": [
          {
            assetId: "asset-1",
            contentPath: "assets/bookmarks/bookmark-1/asset-1/content",
            thumbnailPath: "assets/bookmarks/bookmark-1/asset-1/thumbnail"
          }
        ]
      }
    });
    expect(
      await zip.file("assets/bookmarks/bookmark-1/asset-1/content")!.async("string")
    ).toBe("content-bytes");
    expect(
      await zip.file("assets/bookmarks/bookmark-1/asset-1/thumbnail")!.async("string")
    ).toBe("thumbnail-bytes");
  });

  it("imports folders, tags, bookmarks, and bookmark assets with remapped ids", async () => {
    const zipBlob = await createBookmarkBackupZipBlob(
      {
        exportedAt: "2026-06-10T00:00:00.000Z",
        bookmarks: [createBookmark()],
        folders: [createFolder()],
        tags: [createTag()],
        bookmarkAssetsByBookmarkId: {
          "bookmark-1": [createAsset()]
        }
      },
      {
        fetchAssetBlob: async () => new Blob(["content-bytes"], { type: "image/png" })
      }
    );
    const createFolderAction = vi.fn(async () => createFolder({ id: "new-folder-1" }));
    const createTagAction = vi.fn(async () => createTag({ id: "new-tag-1" }));
    const createBookmarkAction = vi.fn(async () =>
      createBookmark({
        id: "new-bookmark-1",
        folderId: "new-folder-1",
        tagIds: ["new-tag-1"]
      })
    );
    const uploadBookmarkAssetAction = vi.fn(async () =>
      createAsset({ id: "new-asset-1", bookmarkId: "new-bookmark-1" })
    );

    const result = await importBookmarkBackupZipBlob(zipBlob, {
      createFolder: createFolderAction,
      createTag: createTagAction,
      createBookmark: createBookmarkAction,
      uploadBookmarkAsset: uploadBookmarkAssetAction
    });

    expect(createFolderAction).toHaveBeenCalledWith({
      name: "Reading",
      color: "#2563eb",
      icon: "book",
      isHidden: false,
      parentFolderId: null
    });
    expect(createTagAction).toHaveBeenCalledWith({
      name: "research",
      color: "#16a34a"
    });
    expect(createBookmarkAction).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: "new-folder-1",
        tagIds: ["new-tag-1"],
        userTitle: "User title",
        sourceTitle: "Source title"
      })
    );
    expect(uploadBookmarkAssetAction).toHaveBeenCalledWith(
      "new-bookmark-1",
      expect.objectContaining({
        name: "asset-1.png",
        type: "image/png"
      })
    );
    expect(result).toEqual({
      folders: 1,
      tags: 1,
      bookmarks: 1,
      assets: 1,
      skippedAssets: 0
    });
  });

  it("round-trips nested folders and image-backed bookmarks with remapped ids", async () => {
    const parentFolder = createFolder({
      id: "folder-parent",
      name: "Parent",
      sortOrder: 10
    });
    const childFolder = createFolder({
      id: "folder-child",
      name: "Child",
      parentFolderId: "folder-parent",
      sortOrder: 0
    });
    const nestedBookmark = createBookmark({
      id: "bookmark-child",
      folderId: "folder-child",
      url: "https://example.com/nested"
    });
    const nestedAsset = createAsset({
      id: "asset-child",
      bookmarkId: "bookmark-child",
      contentUrl: "/api/bookmarks/bookmark-child/assets/asset-child/content",
      thumbnailUrl: "/api/bookmarks/bookmark-child/assets/asset-child/thumbnail"
    });

    const zipBlob = await createBookmarkBackupZipBlob(
      {
        exportedAt: "2026-06-10T00:00:00.000Z",
        bookmarks: [nestedBookmark],
        folders: [childFolder, parentFolder],
        tags: [createTag()],
        bookmarkAssetsByBookmarkId: {
          "bookmark-child": [nestedAsset]
        }
      },
      {
        fetchAssetBlob: async (url) =>
          new Blob([url.includes("thumbnail") ? "nested-thumbnail" : "nested-content"], {
            type: "image/png"
          })
      }
    );
    const zip = await JSZip.loadAsync(zipBlob);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));

    expect(manifest).toMatchObject({
      folders: [
        expect.objectContaining({
          id: "folder-child",
          parentFolderId: "folder-parent"
        }),
        expect.objectContaining({
          id: "folder-parent",
          parentFolderId: null
        })
      ],
      bookmarks: [
        expect.objectContaining({
          id: "bookmark-child",
          folderId: "folder-child"
        })
      ],
      assetFilesByBookmarkId: {
        "bookmark-child": [
          expect.objectContaining({
            assetId: "asset-child",
            contentPath: "assets/bookmarks/bookmark-child/asset-child/content",
            thumbnailPath: "assets/bookmarks/bookmark-child/asset-child/thumbnail"
          })
        ]
      }
    });
    expect(
      await zip.file("assets/bookmarks/bookmark-child/asset-child/content")!.async("string")
    ).toBe("nested-content");
    expect(
      await zip.file("assets/bookmarks/bookmark-child/asset-child/thumbnail")!.async("string")
    ).toBe("nested-thumbnail");

    const createFolderAction = vi.fn(async (input) =>
      createFolder({
        id: input.name === "Parent" ? "new-folder-parent" : "new-folder-child",
        name: input.name,
        parentFolderId: input.parentFolderId,
        color: input.color,
        icon: input.icon,
        isHidden: input.isHidden
      })
    );
    const createTagAction = vi.fn(async () => createTag({ id: "new-tag-1" }));
    const createBookmarkAction = vi.fn(async (input) =>
      createBookmark({
        id: "new-bookmark-child",
        folderId: input.folderId,
        tagIds: input.tagIds
      })
    );
    const uploadBookmarkAssetAction = vi.fn(async () =>
      createAsset({
        id: "new-asset-child",
        bookmarkId: "new-bookmark-child"
      })
    );

    const result = await importBookmarkBackupZipBlob(zipBlob, {
      createFolder: createFolderAction,
      createTag: createTagAction,
      createBookmark: createBookmarkAction,
      uploadBookmarkAsset: uploadBookmarkAssetAction
    });

    expect(createFolderAction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: "Parent",
        parentFolderId: null
      })
    );
    expect(createFolderAction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: "Child",
        parentFolderId: "new-folder-parent"
      })
    );
    expect(createBookmarkAction).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://example.com/nested",
        folderId: "new-folder-child",
        tagIds: ["new-tag-1"]
      })
    );
    const uploadedFile = uploadBookmarkAssetAction.mock.calls[0]?.[1] as File;
    expect(uploadedFile.name).toBe("asset-child.png");
    await expect(uploadedFile.text()).resolves.toBe("nested-content");
    expect(result).toEqual({
      folders: 2,
      tags: 1,
      bookmarks: 1,
      assets: 1,
      skippedAssets: 0
    });
  });
});
