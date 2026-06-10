import JSZip from "jszip";
import type { Memo, MemoAsset, MemoFolder, MemoTag } from "@bookmark/shared";
import { describe, expect, it, vi } from "vitest";

import {
  createMemoBackupZipBlob,
  importMemoBackupZipBlob,
  type MemoExportPayload
} from "../lib/memo-export";

function createMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: "memo-1",
    folderId: "memo-folder-1",
    tagIds: ["memo-tag-1"],
    title: "Memo",
    contentJson: {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "/api/memos/memo-1/assets/asset-1/content"
          }
        }
      ]
    },
    contentText: "Memo text",
    isFavorite: true,
    isHidden: false,
    isLocked: false,
    memoColor: "#f97316",
    assetCount: 1,
    coverAsset: null,
    createdAt: "2026-04-13T08:00:00.000Z",
    updatedAt: "2026-04-13T08:00:00.000Z",
    ...overrides
  };
}

function createFolder(overrides: Partial<MemoFolder> = {}): MemoFolder {
  return {
    id: "memo-folder-1",
    parentFolderId: null,
    name: "Memo folder",
    color: "#2563eb",
    icon: "folder",
    isHidden: false,
    sortOrder: 0,
    createdAt: "2026-04-13T08:00:00.000Z",
    updatedAt: "2026-04-13T08:00:00.000Z",
    ...overrides
  };
}

function createTag(overrides: Partial<MemoTag> = {}): MemoTag {
  return {
    id: "memo-tag-1",
    name: "memo-tag",
    color: "#16a34a",
    createdAt: "2026-04-13T08:00:00.000Z",
    updatedAt: "2026-04-13T08:00:00.000Z",
    ...overrides
  };
}

function createAsset(overrides: Partial<MemoAsset> = {}): MemoAsset {
  return {
    id: "asset-1",
    memoId: "memo-1",
    mimeType: "image/webp",
    width: 640,
    height: 360,
    sortOrder: 0,
    contentUrl: "/api/memos/memo-1/assets/asset-1/content",
    thumbnailUrl: "/api/memos/memo-1/assets/asset-1/thumbnail",
    createdAt: "2026-04-13T08:00:00.000Z",
    updatedAt: "2026-04-13T08:00:00.000Z",
    ...overrides
  };
}

describe("memo import/export", () => {
  it("exports memo data and image files into a backup zip", async () => {
    const payload: MemoExportPayload = {
      exportedAt: "2026-06-10T00:00:00.000Z",
      memos: [createMemo()],
      folders: [createFolder()],
      tags: [createTag()],
      memoAssetsByMemoId: {
        "memo-1": [createAsset()]
      }
    };
    const fetchAssetBlob = vi.fn(async (url: string) =>
      new Blob([url.includes("thumbnail") ? "memo-thumbnail" : "memo-content"], {
        type: "image/webp"
      })
    );

    const zipBlob = await createMemoBackupZipBlob(payload, { fetchAssetBlob });
    const zip = await JSZip.loadAsync(zipBlob);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));

    expect(manifest).toMatchObject({
      kind: "memos",
      version: 2,
      assetFilesByMemoId: {
        "memo-1": [
          {
            assetId: "asset-1",
            contentPath: "assets/memos/memo-1/asset-1/content",
            thumbnailPath: "assets/memos/memo-1/asset-1/thumbnail"
          }
        ]
      }
    });
    expect(await zip.file("assets/memos/memo-1/asset-1/content")!.async("string")).toBe(
      "memo-content"
    );
    expect(await zip.file("assets/memos/memo-1/asset-1/thumbnail")!.async("string")).toBe(
      "memo-thumbnail"
    );
  });

  it("imports memos and rewrites rich-content image urls to uploaded asset urls", async () => {
    const zipBlob = await createMemoBackupZipBlob(
      {
        exportedAt: "2026-06-10T00:00:00.000Z",
        memos: [createMemo()],
        folders: [createFolder()],
        tags: [createTag()],
        memoAssetsByMemoId: {
          "memo-1": [createAsset()]
        }
      },
      {
        fetchAssetBlob: async (url) =>
          new Blob([url.includes("thumbnail") ? "thumbnail" : "content"], {
            type: "image/webp"
          })
      }
    );
    const createMemoFolderAction = vi.fn(async () =>
      createFolder({ id: "new-memo-folder-1" })
    );
    const createMemoTagAction = vi.fn(async () => createTag({ id: "new-memo-tag-1" }));
    const createMemoAction = vi.fn(async () =>
      createMemo({
        id: "new-memo-1",
        folderId: "new-memo-folder-1",
        tagIds: ["new-memo-tag-1"]
      })
    );
    const updateMemoAction = vi.fn(async (_memoId: string, input) =>
      createMemo({ id: "new-memo-1", contentJson: input.contentJson })
    );
    const uploadPreparedMemoAssetAction = vi.fn(async () =>
      createAsset({
        id: "new-asset-1",
        memoId: "new-memo-1",
        contentUrl: "/api/memos/new-memo-1/assets/new-asset-1/content",
        thumbnailUrl: "/api/memos/new-memo-1/assets/new-asset-1/thumbnail"
      })
    );

    const result = await importMemoBackupZipBlob(zipBlob, {
      createMemoFolder: createMemoFolderAction,
      createMemoTag: createMemoTagAction,
      createMemo: createMemoAction,
      updateMemo: updateMemoAction,
      uploadPreparedMemoAsset: uploadPreparedMemoAssetAction
    });

    expect(createMemoAction).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: "new-memo-folder-1",
        tagIds: ["new-memo-tag-1"],
        isLocked: false
      })
    );
    expect(uploadPreparedMemoAssetAction).toHaveBeenCalledWith(
      "new-memo-1",
      expect.objectContaining({
        file: expect.objectContaining({ name: "asset-1.webp" }),
        thumbnail: expect.objectContaining({ name: "asset-1-thumbnail.webp" })
      })
    );
    expect(updateMemoAction).toHaveBeenCalledWith(
      "new-memo-1",
      expect.objectContaining({
        contentJson: {
          type: "doc",
          content: [
            {
              type: "image",
              attrs: {
                src: "/api/memos/new-memo-1/assets/new-asset-1/content"
              }
            }
          ]
        }
      })
    );
    expect(result).toEqual({
      folders: 1,
      tags: 1,
      memos: 1,
      assets: 1,
      skippedAssets: 0
    });
  });

  it("round-trips nested folders and image-backed memos with remapped ids", async () => {
    const parentFolder = createFolder({
      id: "memo-folder-parent",
      name: "Memo parent",
      sortOrder: 10
    });
    const childFolder = createFolder({
      id: "memo-folder-child",
      parentFolderId: "memo-folder-parent",
      name: "Memo child",
      sortOrder: 0
    });
    const nestedMemo = createMemo({
      id: "memo-child",
      folderId: "memo-folder-child",
      title: "Nested memo",
      contentJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Before image" }]
          },
          {
            type: "image",
            attrs: {
              src: "/api/memos/memo-child/assets/asset-child/content"
            }
          }
        ]
      }
    });
    const nestedAsset = createAsset({
      id: "asset-child",
      memoId: "memo-child",
      contentUrl: "/api/memos/memo-child/assets/asset-child/content",
      thumbnailUrl: "/api/memos/memo-child/assets/asset-child/thumbnail"
    });

    const zipBlob = await createMemoBackupZipBlob(
      {
        exportedAt: "2026-06-10T00:00:00.000Z",
        memos: [nestedMemo],
        folders: [childFolder, parentFolder],
        tags: [createTag()],
        memoAssetsByMemoId: {
          "memo-child": [nestedAsset]
        }
      },
      {
        fetchAssetBlob: async (url) =>
          new Blob([url.includes("thumbnail") ? "nested-memo-thumbnail" : "nested-memo-content"], {
            type: "image/webp"
          })
      }
    );
    const zip = await JSZip.loadAsync(zipBlob);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("text"));

    expect(manifest).toMatchObject({
      folders: [
        expect.objectContaining({
          id: "memo-folder-child",
          parentFolderId: "memo-folder-parent"
        }),
        expect.objectContaining({
          id: "memo-folder-parent",
          parentFolderId: null
        })
      ],
      memos: [
        expect.objectContaining({
          id: "memo-child",
          folderId: "memo-folder-child"
        })
      ],
      assetFilesByMemoId: {
        "memo-child": [
          expect.objectContaining({
            assetId: "asset-child",
            contentPath: "assets/memos/memo-child/asset-child/content",
            thumbnailPath: "assets/memos/memo-child/asset-child/thumbnail"
          })
        ]
      }
    });
    expect(await zip.file("assets/memos/memo-child/asset-child/content")!.async("string")).toBe(
      "nested-memo-content"
    );
    expect(await zip.file("assets/memos/memo-child/asset-child/thumbnail")!.async("string")).toBe(
      "nested-memo-thumbnail"
    );

    const createMemoFolderAction = vi.fn(async (input) =>
      createFolder({
        id: input.name === "Memo parent" ? "new-memo-folder-parent" : "new-memo-folder-child",
        name: input.name,
        parentFolderId: input.parentFolderId,
        color: input.color,
        icon: input.icon,
        isHidden: input.isHidden
      })
    );
    const createMemoTagAction = vi.fn(async () => createTag({ id: "new-memo-tag-1" }));
    const createMemoAction = vi.fn(async (input) =>
      createMemo({
        id: "new-memo-child",
        folderId: input.folderId,
        tagIds: input.tagIds,
        contentJson: input.contentJson
      })
    );
    const updateMemoAction = vi.fn(async (_memoId: string, input) =>
      createMemo({
        id: "new-memo-child",
        contentJson: input.contentJson
      })
    );
    const uploadPreparedMemoAssetAction = vi.fn(async () =>
      createAsset({
        id: "new-memo-asset-child",
        memoId: "new-memo-child",
        contentUrl: "/api/memos/new-memo-child/assets/new-memo-asset-child/content",
        thumbnailUrl: "/api/memos/new-memo-child/assets/new-memo-asset-child/thumbnail"
      })
    );

    const result = await importMemoBackupZipBlob(zipBlob, {
      createMemoFolder: createMemoFolderAction,
      createMemoTag: createMemoTagAction,
      createMemo: createMemoAction,
      updateMemo: updateMemoAction,
      uploadPreparedMemoAsset: uploadPreparedMemoAssetAction
    });

    expect(createMemoFolderAction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: "Memo parent",
        parentFolderId: null
      })
    );
    expect(createMemoFolderAction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: "Memo child",
        parentFolderId: "new-memo-folder-parent"
      })
    );
    expect(createMemoAction).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Nested memo",
        folderId: "new-memo-folder-child",
        tagIds: ["new-memo-tag-1"]
      })
    );
    const preparedFile = uploadPreparedMemoAssetAction.mock.calls[0]?.[1];
    expect(preparedFile.file.name).toBe("asset-child.webp");
    expect(preparedFile.thumbnail.name).toBe("asset-child-thumbnail.webp");
    await expect(preparedFile.file.text()).resolves.toBe("nested-memo-content");
    await expect(preparedFile.thumbnail.text()).resolves.toBe("nested-memo-thumbnail");
    expect(updateMemoAction).toHaveBeenCalledWith(
      "new-memo-child",
      expect.objectContaining({
        contentJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Before image" }]
            },
            {
              type: "image",
              attrs: {
                src: "/api/memos/new-memo-child/assets/new-memo-asset-child/content"
              }
            }
          ]
        }
      })
    );
    expect(result).toEqual({
      folders: 2,
      tags: 1,
      memos: 1,
      assets: 1,
      skippedAssets: 0
    });
  });
});
