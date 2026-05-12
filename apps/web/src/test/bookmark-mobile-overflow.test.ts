import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appCss = readFileSync(
  resolve(__dirname, "../components/AuthenticatedDashboardApp.css"),
  "utf8"
);
const bookmarkResultsCss = readFileSync(
  resolve(__dirname, "../components/BookmarkResultsPanel.css"),
  "utf8"
);
const bookmarkDetailCss = readFileSync(
  resolve(__dirname, "../components/BookmarkDetailPanel.css"),
  "utf8"
);
const bookmarkResultsSource = readFileSync(
  resolve(__dirname, "../components/BookmarkResultsPanel.tsx"),
  "utf8"
);
const bookmarkDetailSource = readFileSync(
  resolve(__dirname, "../components/BookmarkDetailPanel.tsx"),
  "utf8"
);

describe("bookmark mobile overflow css", () => {
  it("keeps long bookmark text from widening mobile bookmark rows", () => {
    expect(bookmarkResultsCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-list-table,\s*\.bookmark-list-row\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/s
    );
    expect(appCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-row-main,\s*\.bookmark-row-meta,\s*\.bookmark-row-summary,\s*\.bookmark-card-summary\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/s
    );
    expect(appCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-row-summary,\s*\.bookmark-card-summary,\s*\.bookmark-row-meta-item\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*word-break:\s*break-word/s
    );
  });

  it("lets the mobile bookmark action menu choose a visible side", () => {
    expect(appCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-card-menu-shell\s+\.bookmark-card-action-menu\s*\{[^}]*position:\s*absolute[^}]*right:\s*0[^}]*top:\s*calc\(100%\s*\+\s*0\.45rem\)[^}]*bottom:\s*auto/s
    );
    expect(appCss).toMatch(
      /\.bookmark-card-menu-shell\s+\.bookmark-card-action-menu\[data-menu-placement="above"\]\s*\{[^}]*top:\s*auto[^}]*bottom:\s*calc\(100%\s*\+\s*0\.45rem\)/s
    );
    expect(appCss).toMatch(
      /\.bookmark-card-menu-shell\s+\.bookmark-card-action-menu\[data-menu-placement="below"\]\s*\{[^}]*top:\s*calc\(100%\s*\+\s*0\.45rem\)[^}]*bottom:\s*auto/s
    );
    expect(bookmarkResultsSource).toContain("data-open-action-menu");
    expect(bookmarkResultsSource).toContain("data-menu-placement={actionMenuPlacement}");
  });

  it("prevents an open mobile bookmark row menu from being paint-clipped by its row", () => {
    expect(bookmarkResultsCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-list-row\[data-open-action-menu="true"\]\s*\{[^}]*position:\s*relative[^}]*z-index:\s*\d+[^}]*overflow:\s*visible[^}]*content-visibility:\s*visible/s
    );
  });

  it("keeps mobile bookmark detail action menus out of the layout flow and scrollable", () => {
    expect(bookmarkDetailCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-detail-menu-shell\s+\.bookmark-detail-action-menu\s*\{[^}]*position:\s*absolute[^}]*max-height:\s*min\(calc\(100svh\s*-\s*7rem\),\s*17rem\)[^}]*overflow-y:\s*auto/s
    );
    expect(bookmarkDetailCss).toMatch(
      /\.bookmark-detail-action-menu\[data-menu-placement="above"\]\s*\{[^}]*top:\s*auto[^}]*bottom:\s*calc\(100%\s*\+\s*0\.45rem\)/s
    );
    expect(bookmarkDetailCss).toMatch(
      /\.bookmark-detail-action-menu\[data-menu-placement="below"\]\s*\{[^}]*top:\s*calc\(100%\s*\+\s*0\.45rem\)[^}]*bottom:\s*auto/s
    );
    expect(bookmarkDetailSource).toContain("data-menu-placement={actionMenuPlacement}");
  });

  it("keeps compact mobile icon actions aligned with text actions", () => {
    expect(bookmarkResultsCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-row-actions-mobile-compact\s*\{[^}]*--bookmark-mobile-action-height:\s*1\.95rem[^}]*align-items:\s*center/s
    );
    expect(bookmarkResultsCss).toMatch(
      /\.bookmark-row-actions-mobile-compact\s*>\s*\.bookmark-row-primary-action\s*\{[^}]*height:\s*var\(--bookmark-mobile-action-height\)[^}]*min-height:\s*var\(--bookmark-mobile-action-height\)/s
    );
    expect(bookmarkResultsCss).toMatch(
      /\.bookmark-row-actions-mobile-compact\s+\.bookmark-url-copy-button,\s*\.bookmark-row-actions-mobile-compact\s+\.overflow-trigger\s*\{[^}]*width:\s*var\(--bookmark-mobile-action-height\)[^}]*height:\s*var\(--bookmark-mobile-action-height\)[^}]*min-height:\s*var\(--bookmark-mobile-action-height\)/s
    );
  });
});
