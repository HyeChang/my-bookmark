import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("bundle splitting", () => {
  it("loads the authenticated dashboard through a lazy chunk", () => {
    const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");

    expect(appSource).toContain(
      'lazy(() => import("./components/AuthenticatedDashboardApp"))'
    );
    expect(appSource).not.toContain(
      'from "./components/AuthenticatedDashboardApp"'
    );
  });

  it("defers dashboard service modules behind dynamic imports", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const deferredModules = [
      "bookmark-assets",
      "bookmark-extract",
      "bookmarks",
      "extension-presence",
      "extension-tokens",
      "folders",
      "recommendations",
      "session",
      "tags"
    ];
    const importDeclarations = dashboardSource.match(/import[\s\S]*?;\r?\n/g) ?? [];

    for (const moduleName of deferredModules) {
      expect(
        importDeclarations.filter(
          (statement) =>
            statement.includes(`from "../lib/${moduleName}"`) &&
            !statement.startsWith("import type")
        )
      ).toEqual([]);
      expect(dashboardSource).toContain(
        `import("../lib/${moduleName}")`
      );
    }
  });

  it("shares bookmark preview rendering helpers instead of duplicating them", () => {
    const helperSource = readFileSync(
      join(process.cwd(), "src", "components", "bookmark-preview-utils.tsx"),
      "utf8"
    );
    const componentPaths = [
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      join(process.cwd(), "src", "components", "BookmarkComposerDialog.tsx"),
      join(process.cwd(), "src", "components", "BookmarkDetailPanel.tsx")
    ];

    expect(helperSource).toContain("export function renderBookmarkPreviewArticle");
    expect(helperSource).toContain("export function getBookmarkPreviewArticleBlocks");

    for (const componentPath of componentPaths) {
      const componentSource = readFileSync(componentPath, "utf8");

      expect(componentSource).not.toContain("function renderBookmarkPreviewArticle");
      expect(componentSource).not.toContain("function getBookmarkPreviewArticleBlocks");
      expect(componentSource).not.toContain("function sanitizeExtractedDisplayText");
    }
  });

  it("memoizes bookmark list row view models before rendering rows", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );

    expect(dashboardSource).toMatch(
      /const bookmarkListRows = useMemo(?:<BookmarkListRowViewModel\[\]>)?\(/
    );
    expect(dashboardSource).toContain("renderedPagedBookmarks.map((bookmark) => {");
    expect(dashboardSource).toContain("{bookmarkListRows.map((bookmarkRow) => {");
    expect(dashboardSource).not.toContain("{renderedPagedBookmarks.map((bookmark) => {");
  });

  it("renders bookmark list rows through a memoized row component", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const bookmarkListSource = dashboardSource.slice(
      dashboardSource.indexOf("bookmark-list-table"),
      dashboardSource.indexOf("bookmark-pagination-bar")
    );

    expect(dashboardSource).toContain("type BookmarkListRowActions =");
    expect(dashboardSource).toContain("const MemoizedBookmarkListRow = memo(BookmarkListRow);");
    expect(dashboardSource).toContain(
      "const bookmarkListRowActionsRef = useRef<BookmarkListRowActions | null>(null);"
    );
    expect(dashboardSource).toContain("const bookmarkListRowActions = useMemo<BookmarkListRowActions>(");
    expect(dashboardSource).toContain("<MemoizedBookmarkListRow");
    expect(bookmarkListSource).not.toContain("onClick={() => void handleBookmarkOpen(bookmark)}");
  });

  it("reuses bookmark list row view models when unrelated asset cache entries change", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );

    expect(dashboardSource).toContain("type BookmarkListRowCacheEntry =");
    expect(dashboardSource).toContain("const EMPTY_BOOKMARK_ASSETS: BookmarkAsset[] = [];");
    expect(dashboardSource).toContain("const bookmarkListRowCacheRef = useRef");
    expect(dashboardSource).toContain("const previousBookmarkListRowCache = bookmarkListRowCacheRef.current;");
    expect(dashboardSource).toContain("const previousRowEntry = previousBookmarkListRowCache.get(bookmark.id);");
    expect(dashboardSource).toContain("return previousRowEntry.row;");
    expect(dashboardSource).not.toContain("const assets = bookmarkAssetsByBookmarkId[bookmark.id] ?? [];");
  });
});
