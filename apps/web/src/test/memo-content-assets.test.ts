import type { Memo, MemoAsset, MemoRichContent } from "@bookmark/shared";
import { describe, expect, it } from "vitest";

import {
  applyMemoContentAssetPreview,
  collectMemoImageSources,
  getReferencedMemoImageUploads
} from "../lib/memo-content-assets";

function createMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: "memo-1",
    folderId: null,
    tagIds: [],
    title: "Memo",
    contentJson: { type: "doc" },
    contentText: "",
    isFavorite: false,
    isHidden: false,
    isLocked: false,
    memoColor: null,
    assetCount: 0,
    coverAsset: null,
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

describe("memo content asset helpers", () => {
  it("keeps only pending image uploads still referenced by the memo document", () => {
    const contentJson: MemoRichContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Only text remains" }]
        }
      ]
    };

    expect(
      getReferencedMemoImageUploads(
        [
          {
            id: "pending-1",
            contentUrl: "blob:deleted-image"
          }
        ],
        contentJson
      )
    ).toEqual([]);
  });

  it("collects image sources from nested memo rich content", () => {
    const contentJson: MemoRichContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                src: "/api/memos/memo-1/assets/asset-1/content"
              }
            }
          ]
        }
      ]
    };

    expect(Array.from(collectMemoImageSources(contentJson))).toEqual([
      "/api/memos/memo-1/assets/asset-1/content"
    ]);
  });

  it("removes stale preview assets when the memo body no longer references images", () => {
    const staleAsset = createAsset();
    const memo = createMemo({
      assetCount: 1,
      coverAsset: staleAsset
    });

    expect(applyMemoContentAssetPreview(memo, [])).toMatchObject({
      assetCount: 0,
      coverAsset: null
    });
  });

  it("uses the latest referenced asset as the memo preview", () => {
    const olderAsset = createAsset({
      id: "asset-1",
      sortOrder: 0,
      contentUrl: "/api/memos/memo-1/assets/asset-1/content",
      thumbnailUrl: "/api/memos/memo-1/assets/asset-1/thumbnail",
      createdAt: "2026-04-13T08:00:00.000Z"
    });
    const newerAsset = createAsset({
      id: "asset-2",
      sortOrder: 1,
      contentUrl: "/api/memos/memo-1/assets/asset-2/content",
      thumbnailUrl: "/api/memos/memo-1/assets/asset-2/thumbnail",
      createdAt: "2026-04-13T08:01:00.000Z"
    });

    expect(
      applyMemoContentAssetPreview(createMemo(), [olderAsset, newerAsset])
    ).toMatchObject({
      assetCount: 2,
      coverAsset: newerAsset
    });
  });
});
