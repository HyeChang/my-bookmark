import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BookmarkAsset } from "@bookmark/shared";

import {
  getBookmarkAssetCardImageUrl,
  getBookmarkAssetPreviewImageUrl,
  getBookmarkListImageLoadingPriority,
  getHomeFavoriteImageLoadingPriority
} from "../lib/bookmark-image-loading";

const lazyImageComponentFiles = [
  "BookmarkComposerDialog.tsx",
  "BookmarkDetailPanel.tsx",
  "bookmark-preview-utils.tsx"
];

describe("bookmark image loading priority", () => {
  it("uses thumbnail URLs for bookmark card and favorite covers when available", () => {
    const asset = {
      contentUrl: "/api/bookmarks/bookmark-1/assets/asset-1/content",
      thumbnailUrl: "/api/bookmarks/bookmark-1/assets/asset-1/thumbnail"
    } as BookmarkAsset;

    expect(getBookmarkAssetCardImageUrl(asset)).toBe(
      "/api/bookmarks/bookmark-1/assets/asset-1/thumbnail"
    );
    expect(
      getBookmarkAssetCardImageUrl({
        ...asset,
        thumbnailUrl: undefined
      })
    ).toBe("/api/bookmarks/bookmark-1/assets/asset-1/content");
  });

  it("uses thumbnail URLs for uploaded asset preview grids when available", () => {
    const asset = {
      contentUrl: "/api/bookmarks/bookmark-1/assets/asset-1/content",
      thumbnailUrl: "/api/bookmarks/bookmark-1/assets/asset-1/thumbnail"
    } as BookmarkAsset;

    expect(getBookmarkAssetPreviewImageUrl(asset)).toBe(
      "/api/bookmarks/bookmark-1/assets/asset-1/thumbnail"
    );
    expect(
      getBookmarkAssetPreviewImageUrl({
        ...asset,
        thumbnailUrl: undefined
      })
    ).toBe("/api/bookmarks/bookmark-1/assets/asset-1/content");
  });

  it("keeps non-list preview images lazy decoded low-priority resources", () => {
    for (const fileName of lazyImageComponentFiles) {
      const source = readFileSync(
        join(process.cwd(), "src", "components", fileName),
        "utf8"
      );
      const imageTags = source.match(/<img[\s\S]*?\/>/g) ?? [];

      expect(imageTags.length, `${fileName} should contain image tags`).toBeGreaterThan(0);
      for (const imageTag of imageTags) {
        expect(imageTag, `${fileName} image should lazy load`).toContain('loading="lazy"');
        expect(imageTag, `${fileName} image should decode async`).toContain('decoding="async"');
        expect(imageTag, `${fileName} image should stay low priority`).toContain(
          'fetchPriority="low"'
        );
      }
    }
  });

  it("keeps only the first real bookmark list covers eager", () => {
    expect(getBookmarkListImageLoadingPriority(0)).toEqual({
      loading: "eager",
      fetchPriority: "high"
    });
    expect(getBookmarkListImageLoadingPriority(3)).toEqual({
      loading: "eager",
      fetchPriority: "high"
    });
    expect(getBookmarkListImageLoadingPriority(4)).toEqual({
      loading: "lazy",
      fetchPriority: "low"
    });
  });

  it("does not promote virtualized mid-list covers to high priority", () => {
    expect(
      getBookmarkListImageLoadingPriority(0, {
        virtualWindowStart: 80
      })
    ).toEqual({
      loading: "lazy",
      fetchPriority: "low"
    });
  });

  it("wires dynamic image priority into bookmark result and home covers", () => {
    const bookmarkResultsSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkResultsPanel.tsx"),
      "utf8"
    );
    const homePanelSource = readFileSync(
      join(process.cwd(), "src", "components", "HomePanel.tsx"),
      "utf8"
    );

    expect(bookmarkResultsSource).toContain("getBookmarkListImageLoadingPriority(index, {");
    expect(bookmarkResultsSource).toContain("virtualWindowStart: bookmarkImageStartIndex");
    expect(bookmarkResultsSource).toContain("getBookmarkAssetCardImageUrl(coverAsset)");
    expect(bookmarkResultsSource).toContain("loading={imageLoadingPriority.loading}");
    expect(bookmarkResultsSource).toContain("fetchPriority={imageLoadingPriority.fetchPriority}");
    expect(bookmarkResultsSource).toContain('sizes="(max-width: 720px) 100vw, var(--bookmark-cover-size)"');
    expect(homePanelSource).toContain("getHomeFavoriteImageLoadingPriority(index)");
    expect(homePanelSource).toContain("getBookmarkAssetCardImageUrl(coverAsset)");
    expect(homePanelSource).toContain("loading={imageLoadingPriority.loading}");
    expect(homePanelSource).toContain("fetchPriority={imageLoadingPriority.fetchPriority}");
    expect(homePanelSource).toContain('sizes="(max-width: 720px) 100vw, 180px"');
  });

  it("uses a stable placeholder background for bookmark asset thumbnails", () => {
    const assetGridCss = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkAssetGrid.css"),
      "utf8"
    );
    const assetImageRule = assetGridCss.slice(
      assetGridCss.indexOf(".asset-grid img"),
      assetGridCss.indexOf(".asset-item")
    );

    expect(assetImageRule).toContain("background:");
    expect(assetImageRule).toContain("content-visibility: auto;");
    expect(assetImageRule).toContain("contain-intrinsic-size:");
  });

  it("wires uploaded asset preview thumbnails into detail and composer asset grids", () => {
    const detailSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkDetailPanel.tsx"),
      "utf8"
    );
    const composerSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkComposerDialog.tsx"),
      "utf8"
    );

    expect(detailSource).toContain("getBookmarkAssetPreviewImageUrl(asset)");
    expect(composerSource).toContain("getBookmarkAssetPreviewImageUrl(asset)");
    expect(composerSource).toContain('sizes="(max-width: 720px) 100vw, 160px"');
  });

  it("declares responsive sizes for lazy preview and favorite images", () => {
    const expectedSizes = [
      {
        fileName: "HomePanel.tsx",
        size: 'sizes="(max-width: 720px) 100vw, 180px"'
      },
      {
        fileName: "BookmarkDetailPanel.tsx",
        size: 'sizes="(max-width: 720px) 100vw, 640px"'
      },
      {
        fileName: "BookmarkComposerDialog.tsx",
        size: 'sizes="(max-width: 720px) 100vw, 640px"'
      },
      {
        fileName: "bookmark-preview-utils.tsx",
        size: 'sizes="(max-width: 720px) 100vw, 640px"'
      }
    ];

    for (const { fileName, size } of expectedSizes) {
      const source = readFileSync(
        join(process.cwd(), "src", "components", fileName),
        "utf8"
      );

      expect(source).toContain(size);
    }
  });

  it("prioritizes only above-the-fold home favorite covers", () => {
    expect(getHomeFavoriteImageLoadingPriority(0)).toEqual({
      loading: "eager",
      fetchPriority: "high"
    });
    expect(getHomeFavoriteImageLoadingPriority(1)).toEqual({
      loading: "eager",
      fetchPriority: "high"
    });
    expect(getHomeFavoriteImageLoadingPriority(2)).toEqual({
      loading: "lazy",
      fetchPriority: "low"
    });
  });
});
