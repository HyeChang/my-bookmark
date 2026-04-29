import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CSS budget", () => {
  it("keeps the initial app shell stylesheet small", () => {
    const css = readFileSync(join(process.cwd(), "src", "App.css"));

    expect(css.byteLength).toBeLessThanOrEqual(16_000);
    expect(css.toString("utf8")).not.toContain(".bookmark-list-table");
  });

  it("keeps the dashboard stylesheet below the source size budget", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.css")
    );

    expect(css.byteLength).toBeLessThanOrEqual(152_000);
  });

  it("keeps lazy dialog styles out of the dashboard stylesheet", () => {
    const dashboardCss = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.css"),
      "utf8"
    );
    const lazyCssFiles = [
      "BookmarkComposerDialog.css",
      "BookmarkDetailPanel.css",
      "ExtensionDialogs.css",
      "FolderManagerDialog.css",
      "ManagerDialog.css",
      "RecommendationPanel.css",
      "TagManagerDialog.css",
    ];

    expect(Buffer.byteLength(dashboardCss)).toBeLessThanOrEqual(138_000);
    expect(dashboardCss).not.toContain(".bookmark-composer-dialog-shell");
    expect(dashboardCss).not.toContain(".bookmark-detail-card");
    expect(dashboardCss).not.toContain(".extension-token-panel-readable");
    expect(dashboardCss).not.toContain(".folder-tree");
    expect(dashboardCss).not.toContain(".inline-folder-create");
    expect(dashboardCss).not.toContain(".manager-");
    expect(dashboardCss).not.toContain(".recommendation-panel-card");
    expect(dashboardCss).not.toContain(".recommendation-loading-card");
    expect(dashboardCss).not.toContain(".tag-manager-dialog-shell");

    for (const fileName of lazyCssFiles) {
      const css = readFileSync(join(process.cwd(), "src", "components", fileName));
      expect(css.byteLength).toBeGreaterThan(0);
    }
  });
});
