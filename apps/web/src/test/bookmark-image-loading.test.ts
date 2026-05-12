import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getBookmarkListImageLoadingPriority,
  getHomeFavoriteImageLoadingPriority
} from "../lib/bookmark-image-loading";

const lazyImageComponentFiles = [
  "BookmarkComposerDialog.tsx",
  "BookmarkDetailPanel.tsx",
  "bookmark-preview-utils.tsx"
];

describe("bookmark image loading priority", () => {
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
    expect(bookmarkResultsSource).toContain("loading={imageLoadingPriority.loading}");
    expect(bookmarkResultsSource).toContain("fetchPriority={imageLoadingPriority.fetchPriority}");
    expect(bookmarkResultsSource).toContain('sizes="(max-width: 720px) 100vw, var(--bookmark-cover-size)"');
    expect(homePanelSource).toContain("getHomeFavoriteImageLoadingPriority(index)");
    expect(homePanelSource).toContain("loading={imageLoadingPriority.loading}");
    expect(homePanelSource).toContain("fetchPriority={imageLoadingPriority.fetchPriority}");
    expect(homePanelSource).toContain('sizes="(max-width: 720px) 100vw, 180px"');
  });

  it("uses a stable placeholder background for bookmark asset thumbnails", () => {
    const dashboardCss = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.css"),
      "utf8"
    );
    const assetImageRule = dashboardCss.slice(
      dashboardCss.indexOf(".asset-grid img"),
      dashboardCss.indexOf(".asset-item")
    );

    expect(assetImageRule).toContain("background:");
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
