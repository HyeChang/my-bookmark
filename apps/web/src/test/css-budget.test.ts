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

    expect(css.byteLength).toBeLessThanOrEqual(80_000);
  });

  it("keeps lazy dialog styles out of the dashboard stylesheet", () => {
    const dashboardCss = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.css"),
      "utf8"
    );
    const dashboardShellCss = readFileSync(
      join(process.cwd(), "src", "components", "DashboardShell.css"),
      "utf8"
    );
    const authGateCss = readFileSync(
      join(process.cwd(), "src", "components", "AuthGate.css"),
      "utf8"
    );
    const lazyCssFiles = [
      "BookmarkResultsPanel.css",
      "BookmarkPreviewContent.css",
      "BookmarkComposerDialog.css",
      "BookmarkDetailPanel.css",
      "ExtensionDialogs.css",
      "FolderManagerDialog.css",
      "ManagerDialog.css",
      "RecommendationPanel.css",
      "TagManagerDialog.css",
    ];

    expect(Buffer.byteLength(dashboardCss)).toBeLessThanOrEqual(80_000);
    expect(dashboardCss).not.toContain(".bookmark-composer-dialog-shell");
    expect(dashboardCss).not.toContain(".bookmark-detail-card");
    expect(dashboardCss).not.toContain(".extension-token-panel-readable");
    expect(dashboardCss).not.toContain(".folder-tree");
    expect(dashboardCss).not.toContain(".inline-folder-create");
    expect(dashboardCss).not.toContain(".manager-");
    expect(dashboardCss).not.toContain(".recommendation-panel-card");
    expect(dashboardCss).not.toContain(".recommendation-loading-card");
    expect(dashboardCss).not.toContain(".search-panel-card");
    expect(dashboardCss).not.toContain(".search-toolbar-shell");
    expect(dashboardCss).not.toContain(".filter-summary-card");
    expect(dashboardCss).not.toContain(".bookmark-list-table");
    expect(dashboardCss).not.toContain(".bookmark-pagination-bar");
    expect(dashboardCss).not.toContain(".bookmark-row-actions-mobile-compact");
    expect(dashboardCss).not.toContain(".bookmark-preview-article");
    expect(dashboardCss).not.toContain(".bookmark-preview-fallback-card");
    expect(dashboardCss).not.toContain(".tag-manager-dialog-shell");
    expect(dashboardCss).not.toContain(".tag-list-item");
    expect(dashboardCss).not.toContain(".tag-list-name");
    expect(dashboardCss).not.toContain(".color-select-trigger");
    expect(dashboardCss).not.toContain(".picker-chip");
    expect(dashboardCss).not.toContain(".pill-option");
    expect(dashboardCss).not.toContain(".chip-button-group");
    expect(dashboardCss).not.toMatch(/^\.dashboard-layout\s*\{/m);
    expect(dashboardShellCss).toContain(".dashboard-layout {");
    expect(dashboardShellCss).toContain(".dashboard-workspace {");
    expect(dashboardShellCss).toContain(".session-card {");
    expect(authGateCss).toContain(".auth-landing");

    const bookmarkDetailSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkDetailPanel.tsx"),
      "utf8"
    );
    const bookmarkComposerSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkComposerDialog.tsx"),
      "utf8"
    );
    expect(bookmarkDetailSource).toContain('import "./BookmarkPreviewContent.css";');
    expect(bookmarkComposerSource).toContain('import "./BookmarkPreviewContent.css";');

    for (const fileName of lazyCssFiles) {
      const css = readFileSync(join(process.cwd(), "src", "components", fileName));
      expect(css.byteLength).toBeGreaterThan(0);
    }
  });

  it("gives long lazy lists browser-level render containment", () => {
    const folderManagerCss = readFileSync(
      join(process.cwd(), "src", "components", "FolderManagerDialog.css"),
      "utf8"
    );
    const recommendationCss = readFileSync(
      join(process.cwd(), "src", "components", "RecommendationPanel.css"),
      "utf8"
    );
    const tagManagerCss = readFileSync(
      join(process.cwd(), "src", "components", "TagManagerDialog.css"),
      "utf8"
    );

    expect(folderManagerCss).toContain("content-visibility: auto;");
    expect(folderManagerCss).toContain("contain-intrinsic-size: 0 3.9rem;");
    expect(recommendationCss).toContain("content-visibility: auto;");
    expect(recommendationCss).toContain("contain-intrinsic-size: 0 3.4rem;");
    expect(tagManagerCss).toContain("content-visibility: auto;");
    expect(tagManagerCss).toContain("contain-intrinsic-size: 0 4.5rem;");
  });

  it("keeps theme overrides available after desktop light rules in component styles", () => {
    const themedCssFiles = [
      "AuthenticatedDashboardTheme.css",
      "HomePanel.css",
      "BookmarkResultsPanel.css",
      "BookmarkComposerDialog.css",
      "BookmarkDetailPanel.css",
      "ExtensionDialogs.css",
      "FolderManagerDialog.css",
      "FolderOverviewPanel.css",
      "ManagerDialog.css",
      "RecommendationPanel.css",
      "TagManagerDialog.css",
    ];

    for (const fileName of themedCssFiles) {
      const css = readFileSync(
        join(process.cwd(), "src", "components", fileName),
        "utf8"
      );
      const lastDesktopLightRule = css.lastIndexOf("@media (min-width: 1121px)");
      const lastDarkThemeRule = css.lastIndexOf(".app-theme-dark");

      expect(css, `${fileName} should include light theme overrides`).toContain(
        ".app-theme-light"
      );
      expect(css, `${fileName} should include dark theme overrides`).toContain(
        ".app-theme-dark"
      );
      expect(
        lastDarkThemeRule,
        `${fileName} should keep dark theme overrides after desktop rules`
      ).toBeGreaterThan(lastDesktopLightRule);
    }
  });

  it("resets desktop light variables on the dark app shell", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardTheme.css"),
      "utf8"
    );
    const finalDarkShellBlock = css.slice(css.lastIndexOf(".app-theme-dark.app-shell"));

    expect(finalDarkShellBlock).toContain("--text-primary: #d9e2f0");
    expect(finalDarkShellBlock).toContain("--surface-sidebar:");
    expect(finalDarkShellBlock).toContain("--desktop-panel:");
  });
});
