import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appCss = readFileSync(
  resolve(__dirname, "../components/AuthenticatedDashboardApp.css"),
  "utf8"
);

describe("bookmark mobile overflow css", () => {
  it("keeps long bookmark text from widening mobile bookmark rows", () => {
    expect(appCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-list-table,\s*\.bookmark-list-row,\s*\.bookmark-row-main,\s*\.bookmark-row-meta,\s*\.bookmark-row-summary,\s*\.bookmark-card-summary\s*\{[^}]*min-width:\s*0[^}]*max-width:\s*100%/s
    );
    expect(appCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-row-summary,\s*\.bookmark-card-summary,\s*\.bookmark-row-meta-item\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*word-break:\s*break-word/s
    );
  });

  it("keeps the mobile bookmark action menu as an anchored popover", () => {
    expect(appCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-card-menu-shell\s+\.bookmark-card-action-menu\s*\{[^}]*position:\s*absolute[^}]*right:\s*0[^}]*top:\s*calc\(100%\s*\+\s*0\.45rem\)/s
    );
  });

  it("keeps compact mobile icon actions aligned with text actions", () => {
    expect(appCss).toMatch(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.bookmark-row-actions-mobile-compact\s*\{[^}]*--bookmark-mobile-action-height:\s*1\.95rem[^}]*align-items:\s*center/s
    );
    expect(appCss).toMatch(
      /\.bookmark-row-actions-mobile-compact\s*>\s*\.bookmark-row-primary-action\s*\{[^}]*height:\s*var\(--bookmark-mobile-action-height\)[^}]*min-height:\s*var\(--bookmark-mobile-action-height\)/s
    );
    expect(appCss).toMatch(
      /\.bookmark-row-actions-mobile-compact\s+\.bookmark-url-copy-button,\s*\.bookmark-row-actions-mobile-compact\s+\.overflow-trigger\s*\{[^}]*width:\s*var\(--bookmark-mobile-action-height\)[^}]*height:\s*var\(--bookmark-mobile-action-height\)[^}]*min-height:\s*var\(--bookmark-mobile-action-height\)/s
    );
  });
});
