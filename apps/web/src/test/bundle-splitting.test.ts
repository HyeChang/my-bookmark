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
      "const loadAuthenticatedDashboardApp = createAuthGateChunkLoader("
    );
    expect(authGateSource).toContain(
      '() => import("./AuthenticatedDashboardApp")'
    );
    expect(authGateSource).toContain(
      "const LazyAuthenticatedDashboardApp = lazy(loadAuthenticatedDashboardApp);"
    );
    expect(authGateSource).toContain("function preloadAuthenticatedDashboardApp");
    expect(authGateSource).toContain("preloadAuthenticatedDashboardApp();");
  });

  it("keeps PWA registration outside the initial entry module", () => {
    const mainSource = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");
    const registerSource = readFileSync(
      join(process.cwd(), "src", "pwa", "register.ts"),
      "utf8"
    );

    expect(mainSource).not.toContain(
      'import { registerPwaServiceWorker } from "./pwa/register";'
    );
    expect(mainSource).toContain("function schedulePwaServiceWorkerRegistration");
    expect(mainSource).toContain('import("./pwa/register")');
    expect(registerSource).toContain("function registerServiceWorker");
    expect(registerSource).toContain('document.readyState === "complete"');
  });

  it("splits React and Firebase vendor code into cacheable manual chunks", () => {
    const viteConfigSource = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");

    expect(viteConfigSource).toContain("function getManualChunk");
    expect(viteConfigSource).toContain('return "react-vendor";');
    expect(viteConfigSource).toContain('return "firebase-auth";');
    expect(viteConfigSource).toContain('return "firebase-app";');
    expect(viteConfigSource).toContain("manualChunks: getManualChunk");
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

  it("keeps detail preview rendering inside the lazy detail panel chunk", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const dashboardPanelChunksSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-panel-chunks.tsx"),
      "utf8"
    );
    const detailPanelSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkDetailPanel.tsx"),
      "utf8"
    );

    expect(dashboardPanelChunksSource).toContain(
      "const loadBookmarkDetailPanel = createDashboardPanelChunkLoader(() =>"
    );
    expect(dashboardPanelChunksSource).toContain('import("./BookmarkDetailPanel")');
    expect(dashboardPanelChunksSource).toContain("const LazyBookmarkDetailPanel = lazy(loadBookmarkDetailPanel);");
    expect(dashboardSource).toContain('} from "./dashboard-panel-chunks";');
    expect(dashboardSource).not.toContain("function renderVisibleSelectedBookmarkDetail");
    expect(dashboardSource).not.toContain("getBookmarkPreviewArticleBlocks");
    expect(dashboardSource).not.toContain("getBookmarkPreviewFieldRows");
    expect(dashboardSource).not.toContain("renderBookmarkPreviewArticle");
    expect(dashboardSource).not.toContain("hasBookmarkPreviewCoverImage");
    expect(detailPanelSource).toContain("getBookmarkPreviewArticleBlocks");
    expect(detailPanelSource).toContain("getBookmarkPreviewFieldRows");
    expect(detailPanelSource).toContain("renderBookmarkPreviewArticle");
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
    const viewModelSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-bookmark-view-models.ts"),
      "utf8"
    );

    expect(dashboardSource).toMatch(
      /const bookmarkListRows = useMemo(?:<BookmarkListRowViewModel\[\]>)?\(/
    );
    expect(dashboardSource).toContain("buildBookmarkListRows({");
    expect(viewModelSource).toContain("bookmarks.map((bookmark) => {");
    expect(bookmarkResultsSource).toContain("{bookmarkListRows.map((bookmarkRow, index) => {");
    expect(bookmarkResultsSource).toContain(
      "const imageLoadingPriority = getBookmarkListImageLoadingPriority(index, {"
    );
    expect(bookmarkResultsSource).toContain("virtualWindowStart: bookmarkImageStartIndex");
    expect(dashboardSource).not.toContain("{renderedPagedBookmarks.map((bookmark) => {");
  });

  it("renders bookmark list rows through a memoized row component", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const dashboardPanelChunksSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-panel-chunks.tsx"),
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

    expect(dashboardPanelChunksSource).toContain(
      "const loadBookmarkResultsPanel = createDashboardPanelChunkLoader(() =>"
    );
    expect(dashboardPanelChunksSource).toContain('import("./BookmarkResultsPanel")');
    expect(dashboardPanelChunksSource).toContain("const LazyBookmarkResultsPanel = lazy(loadBookmarkResultsPanel);");
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

  it("warms dashboard data modules before the first dashboard refresh", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );

    expect(dashboardSource).toContain("function preloadDashboardCoreServiceModules");
    expect(dashboardSource).toContain("Promise.allSettled([");
    expect(dashboardSource).toContain("bookmarkAssetsModule.load()");
    expect(dashboardSource).toContain("bookmarksModule.load()");
    expect(dashboardSource).toContain("foldersModule.load()");
    expect(dashboardSource).toContain("recommendationsModule.load()");
    expect(dashboardSource).toContain("tagsModule.load()");
    expect(dashboardSource).toContain("preloadDashboardCoreServiceModules();");
    expect(dashboardSource).toContain("void refreshDashboardData().finally");
  });

  it("keeps picker-heavy composer/search UI out of the dashboard chunk", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const composerSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkComposerDialog.tsx"),
      "utf8"
    );
    const resultsSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkResultsPanel.tsx"),
      "utf8"
    );

    expect(dashboardSource).not.toContain("function ColorSelectField");
    expect(dashboardSource).not.toContain("folderIconPresets");
    expect(dashboardSource).not.toContain("function renderSearchColorSelect");
    expect(dashboardSource).not.toContain("const quickFolderCreateSection = (");
    expect(dashboardSource).not.toContain("quickFolderCreateSection=");
    expect(composerSource).toContain('import { ColorSelectField } from "./ColorSelectField";');
    expect(composerSource).toContain('import { FolderIconPicker } from "./FolderIconPicker";');
    expect(composerSource).toContain("function QuickFolderCreateSection");
    expect(composerSource).toContain("function QuickTagCreateSection");
    expect(resultsSource).toContain('import("./BookmarkAdvancedSearchFields")');
    expect(resultsSource).not.toContain("renderSearchColorSelect:");
  });

  it("loads bookmark export generation only when export is requested", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const exportSource = readFileSync(
      join(process.cwd(), "src", "lib", "bookmark-export.ts"),
      "utf8"
    );

    expect(dashboardSource).toContain('import("../lib/bookmark-export")');
    expect(dashboardSource).not.toContain("new Blob([JSON.stringify");
    expect(dashboardSource).not.toContain("globalThis.URL.createObjectURL");
    expect(exportSource).toContain("export function downloadBookmarkExport");
    expect(exportSource).toContain("new Blob([JSON.stringify");
  });

  it("loads advanced bookmark search fields only when advanced filters open", () => {
    const bookmarkResultsSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkResultsPanel.tsx"),
      "utf8"
    );
    const advancedSearchSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkAdvancedSearchFields.tsx"),
      "utf8"
    );

    expect(bookmarkResultsSource).toContain(
      'const LazyBookmarkAdvancedSearchFields = lazy(() => import("./BookmarkAdvancedSearchFields"));'
    );
    expect(bookmarkResultsSource).toContain("<LazyBookmarkAdvancedSearchFields");
    expect(bookmarkResultsSource).not.toContain("<ColorSelectField");
    expect(bookmarkResultsSource).not.toContain('name="bookmarkSearchCreatedWithin"');
    expect(bookmarkResultsSource).not.toContain("tags.map((tag)");
    expect(advancedSearchSource).toContain('import { ColorSelectField } from "./ColorSelectField";');
    expect(advancedSearchSource).toContain('name="bookmarkSearchCreatedWithin"');
    expect(advancedSearchSource).toContain("tags.map((tag)");
  });

  it("keeps bookmark sort and view controls inside the lazy results panel", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const bookmarkResultsSource = readFileSync(
      join(process.cwd(), "src", "components", "BookmarkResultsPanel.tsx"),
      "utf8"
    );

    expect(dashboardSource).not.toContain("function renderBookmarkSortControl");
    expect(dashboardSource).not.toContain("function renderBookmarkViewControl");
    expect(dashboardSource).not.toContain("renderBookmarkSortControl=");
    expect(dashboardSource).not.toContain("renderBookmarkViewControl=");
    expect(bookmarkResultsSource).toContain("function BookmarkSortControl");
    expect(bookmarkResultsSource).toContain("function BookmarkViewControl");
    expect(bookmarkResultsSource).toContain("bookmarkSortOptions.map");
    expect(bookmarkResultsSource).toContain("bookmarkViewModeOptions.map");
  });

  it("reuses bookmark list row view models when unrelated asset cache entries change", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const viewModelSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-bookmark-view-models.ts"),
      "utf8"
    );

    expect(viewModelSource).toContain("export type BookmarkListRowCacheEntry =");
    expect(viewModelSource).toContain("const EMPTY_BOOKMARK_ASSETS: BookmarkAsset[] = [];");
    expect(dashboardSource).toContain("const bookmarkListRowCacheRef = useRef");
    expect(dashboardSource).toContain("previousCache: bookmarkListRowCacheRef.current");
    expect(viewModelSource).toContain("const previousRowEntry = previousCache.get(bookmark.id);");
    expect(viewModelSource).toContain("return previousRowEntry.row;");
    expect(dashboardSource).not.toContain("const assets = bookmarkAssetsByBookmarkId[bookmark.id] ?? [];");
  });

  it("renders home favorite cards through memoized card view models", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const dashboardPanelChunksSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-panel-chunks.tsx"),
      "utf8"
    );
    const homePanelSource = readFileSync(
      join(process.cwd(), "src", "components", "HomePanel.tsx"),
      "utf8"
    );

    expect(dashboardPanelChunksSource).toContain(
      "const loadHomePanel = createDashboardPanelChunkLoader(() => import(\"./HomePanel\"));"
    );
    expect(dashboardPanelChunksSource).toContain("const LazyHomePanel = lazy(loadHomePanel);");
    expect(dashboardSource).toContain("<LazyHomePanel");
    expect(dashboardSource).toContain("HomeFavoriteCardViewModel");
    expect(dashboardSource).not.toContain("type HomeFavoriteCardViewModel =");
    expect(dashboardSource).toContain("const homeFavoriteCards = useMemo<HomeFavoriteCardViewModel[]>(");
    expect(dashboardSource).not.toContain("function HomeFavoriteCard(");
    expect(dashboardSource).not.toContain("const MemoizedHomeFavoriteCard = memo(HomeFavoriteCard);");
    expect(dashboardSource).not.toContain("const homeSection = (");
    expect(dashboardSource).not.toContain("<MemoizedHomeFavoriteCard");
    expect(homePanelSource).toContain('import "./HomePanel.css";');
    expect(homePanelSource).toContain("export type HomeFavoriteCardViewModel =");
    expect(homePanelSource).toContain("export type HomePanelActions =");
    expect(homePanelSource).toContain("const MemoizedHomeFavoriteCard = memo(HomeFavoriteCard);");
    expect(homePanelSource).toContain("<MemoizedHomeFavoriteCard");
    expect(homePanelSource).not.toContain("visibleHomeFavoriteBookmarks.map((bookmark) => {");
    expect(homePanelSource).not.toContain("onClick={() => void handleBookmarkOpen(bookmark)}");
  });

  it("loads recommendations through a lazy panel chunk with memoized cards", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const dashboardPanelChunksSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-panel-chunks.tsx"),
      "utf8"
    );
    const recommendationSource = readFileSync(
      join(process.cwd(), "src", "components", "RecommendationPanel.tsx"),
      "utf8"
    );

    expect(dashboardSource).toContain("RecommendationCardViewModel");
    expect(dashboardPanelChunksSource).toContain('lazy(() => import("./RecommendationPanel"))');
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
    const dashboardPanelChunksSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-panel-chunks.tsx"),
      "utf8"
    );
    const folderOverviewSource = readFileSync(
      join(process.cwd(), "src", "components", "FolderOverviewPanel.tsx"),
      "utf8"
    );

    expect(dashboardPanelChunksSource).toContain('import("./FolderOverviewPanel")');
    expect(dashboardSource).not.toContain("function FolderOverviewNode(");
    expect(dashboardSource).not.toContain("const MemoizedFolderOverviewNode = memo(FolderOverviewNode);");
    expect(dashboardSource).not.toContain("function renderFolderOverviewSystemItem");
    expect(dashboardSource).not.toContain("const folderOverviewSection = (");
    expect(dashboardSource).not.toContain("function renderMobileSidebarTabButton");
    expect(dashboardSource).not.toContain("function renderMobileVisibilityIconButton");
    expect(folderOverviewSource).toContain("export type FolderOverviewNodeViewModel =");
    expect(folderOverviewSource).toContain("export type FolderOverviewNodeActions =");
    expect(folderOverviewSource).toContain("const MemoizedFolderOverviewNode = memo(FolderOverviewNode);");
    expect(folderOverviewSource).toContain("function renderFolderOverviewSystemItem");
    expect(folderOverviewSource).toContain("export function MobileSidebarTabs");
    expect(dashboardSource).toContain("const expandedFolderOverviewIdSet = useMemo(");
    expect(dashboardSource).toContain("const folderOverviewNodes = useMemo<FolderOverviewNodeViewModel[]>(");
    expect(folderOverviewSource).toContain("<MemoizedFolderOverviewNode");
    expect(dashboardSource).not.toContain("function renderFolderOverviewNodes(");
    expect(folderOverviewSource).not.toContain("{renderFolderOverviewNodes(null)}");
  });

  it("loads folder overview styles with the lazy folder overview panel", () => {
    const dashboardCss = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.css"),
      "utf8"
    );
    const folderOverviewSource = readFileSync(
      join(process.cwd(), "src", "components", "FolderOverviewPanel.tsx"),
      "utf8"
    );
    const folderOverviewCss = readFileSync(
      join(process.cwd(), "src", "components", "FolderOverviewPanel.css"),
      "utf8"
    );

    expect(folderOverviewSource).toContain('import "./FolderOverviewPanel.css";');
    expect(folderOverviewCss).toContain(".folder-overview-card");
    expect(folderOverviewCss).toContain(".folder-overview-trigger");
    expect(folderOverviewCss).toContain(".sidebar-segment-tab");
    expect(dashboardCss).not.toContain(".folder-overview-card");
    expect(dashboardCss).not.toContain(".folder-overview-trigger");
    expect(dashboardCss).not.toContain(".sidebar-segment-tab");
  });

  it("preloads lazy dashboard panel chunks from navigation intent", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const dashboardPanelChunksSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-panel-chunks.tsx"),
      "utf8"
    );
    const folderOverviewSource = readFileSync(
      join(process.cwd(), "src", "components", "FolderOverviewPanel.tsx"),
      "utf8"
    );

    expect(dashboardPanelChunksSource).toContain(
      "const loadHomePanel = createDashboardPanelChunkLoader(() => import(\"./HomePanel\"));"
    );
    expect(dashboardPanelChunksSource).toContain(
      "const loadBookmarkResultsPanel = createDashboardPanelChunkLoader(() =>"
    );
    expect(dashboardPanelChunksSource).toContain('import("./BookmarkResultsPanel")');
    expect(dashboardPanelChunksSource).toContain(
      "const loadFolderOverviewPanel = createDashboardPanelChunkLoader(() =>"
    );
    expect(dashboardPanelChunksSource).toContain('import("./FolderOverviewPanel")');
    expect(dashboardPanelChunksSource).toContain(
      "const loadBookmarkDetailPanel = createDashboardPanelChunkLoader(() =>"
    );
    expect(dashboardPanelChunksSource).toContain('import("./BookmarkDetailPanel")');
    expect(dashboardPanelChunksSource).toContain("function preloadDashboardPanelChunk");
    expect(dashboardSource).not.toContain("function createDashboardPanelChunkLoader");
    expect(dashboardSource).toContain('preloadDashboardPanelChunk("home");');
    expect(dashboardSource).toContain('preloadDashboardPanelChunk("bookmarks");');
    expect(dashboardSource).toContain('preloadDashboardPanelChunk("folder");');
    expect(dashboardSource).toContain('preloadDashboardPanelChunk("detail");');
    expect(folderOverviewSource).toContain(
      "onPreloadPanel?: (panelId: MobileSidebarPanelId) => void;"
    );
    expect(folderOverviewSource).toContain(
      "onMouseEnter={() => onPreloadPanel?.(item.panelId)}"
    );
    expect(folderOverviewSource).toContain(
      "onFocus={() => onPreloadPanel?.(item.panelId)}"
    );
  });

  it("keeps dashboard header rendering outside the dashboard state owner", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const dashboardHeaderSource = readFileSync(
      join(process.cwd(), "src", "components", "DashboardHeader.tsx"),
      "utf8"
    );

    expect(dashboardSource).toContain('import { DashboardHeader } from "./DashboardHeader";');
    expect(dashboardSource).toContain("<DashboardHeader");
    expect(dashboardSource).not.toContain('<header className="app-hero">');
    expect(dashboardHeaderSource).toContain('<header className="app-hero">');
    expect(dashboardHeaderSource).toContain('aria-label="quick-actions-toolbar"');
  });

  it("keeps bookmark dashboard view model builders outside the dashboard component shell", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const viewModelSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-bookmark-view-models.ts"),
      "utf8"
    );

    expect(dashboardSource).toContain('from "./dashboard-bookmark-view-models"');
    expect(dashboardSource).not.toContain(
      "const previousBookmarkListRowCache = bookmarkListRowCacheRef.current"
    );
    expect(dashboardSource).not.toContain(
      "const previousHomeFavoriteCardCache = homeFavoriteCardCacheRef.current"
    );
    expect(viewModelSource).toContain("export function buildBookmarkListRows");
    expect(viewModelSource).toContain("export function buildHomeFavoriteCards");
    expect(viewModelSource).toContain("export function buildRecommendationCardsByKind");
  });

  it("keeps bookmark search and virtualization helpers outside the dashboard state owner", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const utilsSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-bookmark-utils.ts"),
      "utf8"
    );
    const virtualizationSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-bookmark-virtualization.ts"),
      "utf8"
    );

    expect(dashboardSource).toContain('from "./dashboard-bookmark-utils"');
    expect(dashboardSource).toContain('from "./dashboard-bookmark-virtualization"');
    expect(dashboardSource).not.toContain("function normalizeBookmarkSearchDraft");
    expect(dashboardSource).not.toContain("function getFolderDescendantIds");
    expect(dashboardSource).not.toContain("const BOOKMARK_VIRTUALIZATION_THRESHOLD");
    expect(dashboardSource).toContain("useDeferredValue(");
    expect(utilsSource).toContain("export function normalizeBookmarkSearchDraft");
    expect(utilsSource).toContain("export function getFolderDescendantIds");
    expect(virtualizationSource).toContain("export function getBookmarkVirtualWindow");
    expect(virtualizationSource).toContain("export function getBookmarkVirtualWindowStartForScroll");
  });

  it("keeps bookmark asset preload queue state outside the dashboard component shell", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const preloadSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-bookmark-asset-preload.ts"),
      "utf8"
    );

    expect(dashboardSource).toContain('from "./dashboard-bookmark-asset-preload"');
    expect(dashboardSource).not.toContain("async function loadBookmarkAssetsByBookmark");
    expect(dashboardSource).not.toContain("async function preloadBookmarkAssets(");
    expect(dashboardSource).not.toContain("function getBookmarkAssetPreloadCandidates");
    expect(dashboardSource).not.toContain("function queueBookmarkAssetPreload(");
    expect(preloadSource).toContain("export async function loadBookmarkAssetsForBookmarks");
    expect(preloadSource).toContain("export async function preloadMissingBookmarkAssets");
    expect(preloadSource).toContain("export function queueBookmarkAssetPreload");
  });

  it("keeps bookmark detail preview cache helpers outside the dashboard component shell", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src", "components", "AuthenticatedDashboardApp.tsx"),
      "utf8"
    );
    const detailSource = readFileSync(
      join(process.cwd(), "src", "components", "dashboard-bookmark-detail.ts"),
      "utf8"
    );

    expect(dashboardSource).toContain('from "./dashboard-bookmark-detail"');
    expect(dashboardSource).not.toContain("type BookmarkDetailPreviewResult =");
    expect(dashboardSource).not.toContain("function getBookmarkDetailFieldRows");
    expect(dashboardSource).not.toContain("async function resolveSelectedBookmarkPreview");
    expect(detailSource).toContain("export function createBookmarkDetailPreviewCaches");
    expect(detailSource).toContain("export function getBookmarkDetailFieldRows");
    expect(detailSource).toContain("export async function resolveBookmarkDetailPreview");
  });
});
