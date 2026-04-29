import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("bundle splitting", () => {
  it("loads the auth gate first and keeps the authenticated dashboard behind it", () => {
    const appSource = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
    const authGateSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthGate.tsx"),
      "utf8"
    );

    expect(appSource).toContain(
      'lazy(() => import("./components/AuthGate"))'
    );
    expect(appSource).not.toContain(
      'from "./components/AuthenticatedDashboardApp"'
    );
    expect(appSource).not.toContain(
      'import("./components/AuthenticatedDashboardApp")'
    );
    expect(authGateSource).toContain(
      'lazy(() => import("./AuthenticatedDashboardApp"))'
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
    const bookmarkResultsSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkResultsPanel.tsx"),
      "utf8"
    );

    expect(dashboardSource).toMatch(
      /const bookmarkListRows = useMemo(?:<BookmarkListRowViewModel\[\]>)?\(/
    );
    expect(dashboardSource).toContain("renderedPagedBookmarks.map((bookmark) => {");
    expect(bookmarkResultsSource).toContain("{bookmarkListRows.map((bookmarkRow) => {");
    expect(dashboardSource).not.toContain("{renderedPagedBookmarks.map((bookmark) => {");
  });

  it("renders bookmark list rows through a memoized row component", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const bookmarkResultsSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkResultsPanel.tsx"),
      "utf8"
    );
    const bookmarkListSource = bookmarkResultsSource.slice(
      bookmarkResultsSource.indexOf("bookmark-list-table"),
      bookmarkResultsSource.indexOf("bookmark-pagination-bar")
    );

    expect(dashboardSource).toContain('lazy(() => import("./BookmarkResultsPanel"))');
    expect(dashboardSource).toContain("<LazyBookmarkResultsPanel");
    expect(dashboardSource).toContain("BookmarkListRowActions");
    expect(dashboardSource).not.toContain("const MemoizedBookmarkListRow = memo(BookmarkListRow);");
    expect(bookmarkResultsSource).toContain("export type BookmarkListRowActions =");
    expect(bookmarkResultsSource).toContain("const MemoizedBookmarkListRow = memo(BookmarkListRow);");
    expect(dashboardSource).toContain(
      "const bookmarkListRowActionsRef = useRef<BookmarkListRowActions | null>(null);"
    );
    expect(dashboardSource).toContain("const bookmarkListRowActions = useMemo<BookmarkListRowActions>(");
    expect(bookmarkResultsSource).toContain('import "./BookmarkResultsPanel.css";');
    expect(bookmarkResultsSource).toContain("<MemoizedBookmarkListRow");
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

  it("renders home favorite cards through memoized card view models", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const homeSectionSource = dashboardSource.slice(
      dashboardSource.indexOf("const homeSection = ("),
      dashboardSource.indexOf("const homeSection = (") + 9000
    );

    expect(dashboardSource).toContain("type HomeFavoriteCardViewModel =");
    expect(dashboardSource).toContain("const MemoizedHomeFavoriteCard = memo(HomeFavoriteCard);");
    expect(dashboardSource).toContain("const homeFavoriteCards = useMemo<HomeFavoriteCardViewModel[]>(");
    expect(dashboardSource).toContain("<MemoizedHomeFavoriteCard");
    expect(homeSectionSource).not.toContain("visibleHomeFavoriteBookmarks.map((bookmark) => {");
    expect(homeSectionSource).not.toContain("onClick={() => void handleBookmarkOpen(bookmark)}");
  });

  it("loads recommendations through a lazy panel chunk with memoized cards", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const recommendationSource = readFileSync(
      join(process.cwd(), "src", "components", "RecommendationPanel.tsx"),
      "utf8"
    );

    expect(dashboardSource).toContain("RecommendationCardViewModel");
    expect(dashboardSource).toContain('lazy(() => import("./RecommendationPanel"))');
    expect(dashboardSource).toContain("const recommendationCardsByKind = useMemo<Record<RecommendationKind, RecommendationCardViewModel[]>>(");
    expect(dashboardSource).toContain("<LazyRecommendationPanel");
    expect(dashboardSource).not.toContain("function renderRecommendationColumn(");
    expect(dashboardSource).not.toContain("const MemoizedRecommendationCard = memo(RecommendationCard);");
    expect(recommendationSource).toContain('import "./RecommendationPanel.css";');
    expect(recommendationSource).toContain("export type RecommendationCardViewModel =");
    expect(recommendationSource).toContain("const MemoizedRecommendationCard = memo(RecommendationCard);");
    expect(recommendationSource).not.toContain("recommendationBookmarks.map((bookmark) => (");
  });

  it("memoizes search panel derived values", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const bookmarkResultsSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkResultsPanel.tsx"),
      "utf8"
    );
    const derivedSearchSource = dashboardSource.slice(
      dashboardSource.indexOf("const hasActiveAppliedBookmarkSearch"),
      dashboardSource.indexOf("const visibleFolders = useMemo(")
    );

    expect(derivedSearchSource).toContain("const hasActiveAppliedBookmarkSearch = useMemo(");
    expect(derivedSearchSource).toContain("const activeBookmarkSearchSummaryItems = useMemo(");
    expect(derivedSearchSource).toContain("getBookmarkSearchSummaryItems(appliedBookmarkSearch");
    expect(derivedSearchSource).toContain(
      "[appliedBookmarkSearch, extensionFolderIds, foldersById, tagsById]"
    );
    expect(bookmarkResultsSource).toContain('aria-label="search-panel"');
    expect(bookmarkResultsSource).not.toContain("hasActiveBookmarkSearch(appliedBookmarkSearch)");
  });

  it("renders folder overview nodes through memoized node view models", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const folderOverviewSource = dashboardSource.slice(
      dashboardSource.indexOf("const folderOverviewSection = ("),
      dashboardSource.indexOf("function renderLazyRecommendationPanel(")
    );

    expect(dashboardSource).toContain("type FolderOverviewNodeViewModel =");
    expect(dashboardSource).toContain("type FolderOverviewNodeActions =");
    expect(dashboardSource).toContain("const MemoizedFolderOverviewNode = memo(FolderOverviewNode);");
    expect(dashboardSource).toContain("const expandedFolderOverviewIdSet = useMemo(");
    expect(dashboardSource).toContain("const folderOverviewNodes = useMemo<FolderOverviewNodeViewModel[]>(");
    expect(dashboardSource).toContain("<MemoizedFolderOverviewNode");
    expect(dashboardSource).not.toContain("function renderFolderOverviewNodes(");
    expect(folderOverviewSource).not.toContain("{renderFolderOverviewNodes(null)}");
  });
});
