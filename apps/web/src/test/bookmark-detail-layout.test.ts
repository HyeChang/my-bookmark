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

describe("bookmark detail layout css", () => {
  it("keeps the desktop detail rail wide and compacts list rows while the rail is open", () => {
    expect(appCss).toMatch(
      /\.dashboard-main-with-rail\s*\{[^}]*grid-template-columns:\s*minmax\(300px,\s*0\.6fr\)\s+minmax\(560px,\s*1fr\)/s
    );
    expect(appCss).toMatch(
      /@media\s*\(min-width:\s*1121px\)\s+and\s+\(max-width:\s*1240px\)\s*\{[^}]*\.dashboard-main-with-rail\s*\{[^}]*grid-template-columns:\s*minmax\(260px,\s*0\.5fr\)\s+minmax\(520px,\s*1fr\)/s
    );
    expect(bookmarkResultsCss).toMatch(
      /\.dashboard-main-with-rail\s+\.bookmark-list-table-view-list\s+\.bookmark-list-row\s*\{[^}]*grid-template-areas:\s*"main"[^}]*"meta"[^}]*"actions"/s
    );
    expect(bookmarkResultsCss).toMatch(
      /\.dashboard-main-with-rail\s+\.bookmark-list-table-view-list\s+\.bookmark-list-row-has-cover\s*\{[^}]*grid-template-areas:\s*"cover main"[^}]*"meta meta"[^}]*"actions actions"/s
    );
    expect(bookmarkResultsCss).toMatch(
      /\.dashboard-main-with-rail\s+\.bookmark-list-table-view-list\s+\.bookmark-row-main\s*\{[^}]*grid-area:\s*main/s
    );
  });
});
