import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const imageComponentFiles = [
  "AuthenticatedDashboardApp.tsx",
  "BookmarkComposerDialog.tsx",
  "BookmarkDetailPanel.tsx",
  "BookmarkResultsPanel.tsx",
  "HomePanel.tsx",
  "bookmark-preview-utils.tsx"
];

describe("bookmark image loading", () => {
  it("marks bookmark images as lazy decoded low-priority resources", () => {
    for (const fileName of imageComponentFiles) {
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
});
