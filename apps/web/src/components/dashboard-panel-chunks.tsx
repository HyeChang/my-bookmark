import { lazy } from "react";

import { measureAsyncPerformance } from "../lib/performance-marks";

function createDashboardPanelChunkLoader<TModule>(loadModule: () => Promise<TModule>) {
  let modulePromise: Promise<TModule> | null = null;

  return () => {
    modulePromise ??= loadModule().catch((error) => {
      modulePromise = null;
      throw error;
    });
    return modulePromise;
  };
}

const loadBookmarkDetailPanel = createDashboardPanelChunkLoader(() =>
  import("./BookmarkDetailPanel")
);
const loadFolderOverviewPanel = createDashboardPanelChunkLoader(() =>
  import("./FolderOverviewPanel")
);
const loadHomePanel = createDashboardPanelChunkLoader(() => import("./HomePanel"));
const loadBookmarkResultsPanel = createDashboardPanelChunkLoader(() =>
  import("./BookmarkResultsPanel")
);

export const LazyBookmarkDetailPanel = lazy(loadBookmarkDetailPanel);
export const LazyRecommendationPanel = lazy(() => import("./RecommendationPanel"));
export const LazyHomePanel = lazy(loadHomePanel);
export const LazyBookmarkResultsPanel = lazy(loadBookmarkResultsPanel);
export const LazyFolderOverviewPanel = lazy(() =>
  loadFolderOverviewPanel().then((module) => ({
    default: module.FolderOverviewPanel
  }))
);
export const LazyMobileSidebarTabs = lazy(() =>
  loadFolderOverviewPanel().then((module) => ({
    default: module.MobileSidebarTabs
  }))
);

export type DashboardPanelChunk = "home" | "bookmarks" | "folder" | "detail";

const dashboardPanelChunkLoaders: Record<DashboardPanelChunk, () => Promise<unknown>> = {
  home: loadHomePanel,
  bookmarks: loadBookmarkResultsPanel,
  folder: loadFolderOverviewPanel,
  detail: loadBookmarkDetailPanel
};

const preloadedDashboardPanelChunks = new Set<DashboardPanelChunk>();

export function preloadDashboardPanelChunk(chunk: DashboardPanelChunk) {
  if (preloadedDashboardPanelChunks.has(chunk)) {
    return;
  }

  preloadedDashboardPanelChunks.add(chunk);
  void measureAsyncPerformance(`dashboard:panel-preload:${chunk}`, () =>
    dashboardPanelChunkLoaders[chunk]()
  ).catch(() => {
    preloadedDashboardPanelChunks.delete(chunk);
  });
}
