import { describe, expect, it } from "vitest";

import {
  createBookmarkAssetThumbnailFileName,
  getBookmarkAssetThumbnailDimensions,
  shouldCreateBookmarkAssetThumbnail
} from "../lib/bookmark-asset-thumbnails";

describe("bookmark asset thumbnail helpers", () => {
  it("keeps thumbnail dimensions within the maximum edge while preserving aspect ratio", () => {
    expect(getBookmarkAssetThumbnailDimensions(1600, 900)).toEqual({
      width: 512,
      height: 288
    });
    expect(getBookmarkAssetThumbnailDimensions(900, 1600)).toEqual({
      width: 288,
      height: 512
    });
    expect(getBookmarkAssetThumbnailDimensions(300, 200)).toEqual({
      width: 300,
      height: 200
    });
  });

  it("creates stable webp thumbnail file names", () => {
    expect(createBookmarkAssetThumbnailFileName("cover.photo.png")).toBe(
      "cover.photo-thumb.webp"
    );
    expect(createBookmarkAssetThumbnailFileName("image")).toBe("image-thumb.webp");
  });

  it("skips unsupported and animated source formats", () => {
    expect(shouldCreateBookmarkAssetThumbnail(new File([""], "cover.png", { type: "image/png" }))).toBe(true);
    expect(shouldCreateBookmarkAssetThumbnail(new File([""], "cover.gif", { type: "image/gif" }))).toBe(false);
    expect(shouldCreateBookmarkAssetThumbnail(new File([""], "notes.txt", { type: "text/plain" }))).toBe(false);
  });
});
