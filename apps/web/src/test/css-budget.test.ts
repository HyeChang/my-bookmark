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
    const dashboardThemeCss = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardTheme.css"),
      "utf8"
    );
    const overlayDialogCss = readFileSync(
      join(process.cwd(), "src", "components", "OverlayDialog.css"),
      "utf8"
    );
    const bookmarkPreviewContentCss = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkPreviewContent.css"),
      "utf8"
    );
    const lazyCssFiles = [
      "BookmarkResultsPanel.css",
      "BookmarkResultsSearch.css",
      "BookmarkResultsControls.css",
      "BookmarkCard.css",
      "BookmarkAdvancedSearchFields.css",
      "DashboardFormControls.css",
      "BookmarkPreviewContent.css",
      "OverlayDialog.css",
      "BookmarkAssetGrid.css",
      "BookmarkComposerDialog.css",
      "BookmarkDetailPanel.css",
      "ExtensionDialogs.css",
      "FolderManagerDialog.css",
      "FolderOverviewTabs.css",
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
    expect(dashboardCss).not.toContain(".bookmark-card {");
    expect(dashboardCss).not.toContain(".bookmark-card-action-menu");
    expect(dashboardCss).not.toContain(".bookmark-url-copy-button");
    expect(dashboardCss).not.toContain(".stack-form {");
    expect(dashboardCss).not.toContain(".checkbox-field {");
    expect(dashboardCss).not.toContain(".tag-fieldset {");
    expect(dashboardCss).not.toContain(".inline-file-list {");
    expect(dashboardCss).not.toContain(".bookmark-tag-selected-chip {");
    expect(dashboardCss).not.toContain(".bookmark-preview-article");
    expect(dashboardCss).not.toContain(".bookmark-preview-fallback-card");
    expect(dashboardCss).not.toContain(".tag-manager-dialog-shell");
    expect(dashboardCss).not.toContain(".tag-list-item");
    expect(dashboardCss).not.toContain(".tag-list-name");
    expect(dashboardCss).not.toContain(".color-select-trigger");
    expect(dashboardCss).not.toContain(".picker-chip");
    expect(dashboardCss).not.toContain(".pill-option");
    expect(dashboardCss).not.toContain(".chip-button-group");
    const initialDashboardCss = `${dashboardCss}\n${dashboardThemeCss}`;
    expect(initialDashboardCss).not.toContain(".overlay-backdrop");
    expect(initialDashboardCss).not.toContain(".overlay-dialog-shell");
    expect(initialDashboardCss).not.toContain(".bookmark-detail-dialog-shell");
    expect(initialDashboardCss).not.toContain(".overlay-dialog-header");
    expect(initialDashboardCss).not.toContain(".overlay-dialog-title");
    expect(initialDashboardCss).not.toContain(".bookmark-composer-section-header");
    expect(initialDashboardCss).not.toContain(".asset-grid");
    expect(initialDashboardCss).not.toContain(".bookmark-preview-card");
    expect(initialDashboardCss).not.toContain(".bookmark-preview-image");
    expect(initialDashboardCss).not.toContain(".bookmark-preview-error");
    expect(initialDashboardCss).not.toContain(".bookmark-preview-note");
    expect(overlayDialogCss).toContain(".overlay-backdrop {");
    expect(overlayDialogCss).toContain(".overlay-dialog-shell {");
    expect(overlayDialogCss).toContain(".bookmark-detail-dialog-shell {");
    expect(overlayDialogCss).toContain(".overlay-dialog-header {");
    expect(overlayDialogCss).toContain(".overlay-dialog-title {");
    expect(overlayDialogCss).toContain(".bookmark-composer-section-header {");
    const assetGridCss = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkAssetGrid.css"),
      "utf8"
    );
    expect(assetGridCss).toContain(".asset-grid {");
    expect(assetGridCss).toContain(".asset-item {");
    expect(bookmarkPreviewContentCss).toContain(".bookmark-preview-card {");
    expect(bookmarkPreviewContentCss).toContain(".bookmark-preview-image {");
    expect(bookmarkPreviewContentCss).toContain(".bookmark-preview-error {");
    expect(bookmarkPreviewContentCss).toContain(".bookmark-preview-note {");
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
    const bookmarkResultsSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkResultsPanel.tsx"),
      "utf8"
    );
    const homePanelSource = readFileSync(
      join(process.cwd(), "src", "components", "HomePanel.tsx"),
      "utf8"
    );
    const folderOverviewSource = readFileSync(
      join(process.cwd(), "src", "components", "FolderOverviewPanel.tsx"),
      "utf8"
    );
    const folderManagerSource = readFileSync(
      join(process.cwd(), "src", "components", "FolderManagerDialog.tsx"),
      "utf8"
    );
    const tagManagerSource = readFileSync(
      join(process.cwd(), "src", "components", "TagManagerDialog.tsx"),
      "utf8"
    );
    const advancedSearchSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkAdvancedSearchFields.tsx"),
      "utf8"
    );
    expect(bookmarkDetailSource).toContain('import "./BookmarkPreviewContent.css";');
    expect(bookmarkDetailSource).toContain('import "./OverlayDialog.css";');
    expect(bookmarkDetailSource).toContain('import "./BookmarkAssetGrid.css";');
    expect(bookmarkComposerSource).toContain('import "./OverlayDialog.css";');
    expect(bookmarkComposerSource).toContain('import "./BookmarkAssetGrid.css";');
    expect(bookmarkComposerSource).toContain('import "./BookmarkPreviewContent.css";');
    expect(bookmarkComposerSource).toContain('import "./DashboardFormControls.css";');
    expect(bookmarkResultsSource).toContain('import "./BookmarkAssetGrid.css";');
    expect(bookmarkResultsSource).toContain('import "./BookmarkResultsSearch.css";');
    expect(bookmarkResultsSource).toContain('import "./BookmarkResultsControls.css";');
    expect(homePanelSource).toContain('import "./BookmarkAssetGrid.css";');
    expect(folderOverviewSource).toContain('import "./FolderOverviewTabs.css";');
    expect(folderManagerSource).toContain('import "./OverlayDialog.css";');
    expect(tagManagerSource).toContain('import "./OverlayDialog.css";');
    expect(folderManagerSource).toContain('import "./DashboardFormControls.css";');
    expect(tagManagerSource).toContain('import "./DashboardFormControls.css";');
    expect(advancedSearchSource).toContain('import "./DashboardFormControls.css";');

    for (const fileName of lazyCssFiles) {
      const css = readFileSync(join(process.cwd(), "src", "components", fileName));
      expect(css.byteLength).toBeGreaterThan(0);
    }
  });

  it("keeps modal overlays above the mobile dashboard header", () => {
    const dashboardCss = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.css"),
      "utf8"
    );
    const overlayCss = readFileSync(
      join(process.cwd(), "src", "components", "OverlayDialog.css"),
      "utf8"
    );
    const mobileHeaderZIndex = Number(
      dashboardCss.match(
        /@media\s*\(max-width:\s*720px\)[\s\S]*?\.app-hero\s*\{[\s\S]*?z-index:\s*(\d+)/s
      )?.[1]
    );
    const overlayZIndex = Number(
      overlayCss.match(/\.overlay-backdrop\s*\{[\s\S]*?z-index:\s*(\d+)/)?.[1]
    );

    expect(overlayZIndex).toBeGreaterThan(mobileHeaderZIndex);
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

  it("keeps the mobile bookmark composer dialog scrollable to its save action", () => {
    const css = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkComposerDialog.css"),
      "utf8"
    );

    expect(css).toContain(".bookmark-composer-dialog-shell {");
    expect(css).toContain("display: flex;");
    expect(css).toContain("flex-direction: column;");
    expect(css).toContain("max-height: calc(100dvh - max(1.2rem, env(safe-area-inset-bottom)));");
    expect(css).toContain(".bookmark-composer-dialog-shell > .overlay-dialog-panel {");
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("-webkit-overflow-scrolling: touch;");
    expect(css).toContain("overscroll-behavior: contain;");
    expect(css).toContain("padding-bottom: max(0.7rem, env(safe-area-inset-bottom));");
  });

  it("loads advanced bookmark search styles with the lazy advanced search fields", () => {
    const resultsCss = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkResultsPanel.css"),
      "utf8"
    );
    const resultsSearchCss = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkResultsSearch.css"),
      "utf8"
    );
    const resultsControlsCss = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkResultsControls.css"),
      "utf8"
    );
    const folderOverviewCss = readFileSync(
      join(process.cwd(), "src", "components", "FolderOverviewPanel.css"),
      "utf8"
    );
    const folderOverviewTabsCss = readFileSync(
      join(process.cwd(), "src", "components", "FolderOverviewTabs.css"),
      "utf8"
    );
    const advancedCss = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkAdvancedSearchFields.css"),
      "utf8"
    );
    const advancedSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkAdvancedSearchFields.tsx"),
      "utf8"
    );

    expect(resultsCss).not.toContain(".search-filter-group");
    expect(resultsCss).not.toContain(".search-grid-advanced");
    expect(resultsCss).not.toContain(".search-toolbar {");
    expect(resultsCss).not.toContain(".search-mode-segmented {");
    expect(resultsCss).not.toContain(".bookmark-pagination-bar");
    expect(resultsCss).not.toContain(".bookmark-page-size-control");
    expect(resultsCss).not.toContain(".bookmark-sort-menu");
    expect(resultsSearchCss).toContain(".search-toolbar {");
    expect(resultsSearchCss).toContain(".search-mode-segmented {");
    expect(resultsControlsCss).toContain(".bookmark-pagination-bar");
    expect(resultsControlsCss).toContain(".bookmark-page-size-control");
    expect(resultsControlsCss).toContain(".bookmark-sort-menu");
    expect(folderOverviewCss).not.toContain(".sidebar-segment-tab");
    expect(folderOverviewTabsCss).toContain(".sidebar-segment-tab");
    expect(advancedCss).toContain(".search-grid-advanced");
    expect(advancedCss).toContain(".search-filter-group");
    expect(advancedSource).toContain('import "./BookmarkAdvancedSearchFields.css";');
  });

  it("keeps theme overrides available after desktop light rules in component styles", () => {
    const themedCssFiles = [
      "AuthenticatedDashboardTheme.css",
      "DashboardFormControls.css",
      "OverlayDialog.css",
      "HomePanel.css",
      "BookmarkAdvancedSearchFields.css",
      "BookmarkResultsPanel.css",
      "BookmarkResultsSearch.css",
      "BookmarkResultsControls.css",
      "BookmarkComposerDialog.css",
      "BookmarkDetailPanel.css",
      "ExtensionDialogs.css",
      "FolderManagerDialog.css",
      "FolderOverviewPanel.css",
      "FolderOverviewTabs.css",
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
