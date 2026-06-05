import { lazy } from "react";

import { measureAsyncPerformance } from "../lib/performance-marks";

function createDashboardDialogChunkLoader<TModule>(loadModule: () => Promise<TModule>) {
  let modulePromise: Promise<TModule> | null = null;

  return () => {
    modulePromise ??= loadModule().catch((error) => {
      modulePromise = null;
      throw error;
    });
    return modulePromise;
  };
}

const loadInstallHelpDialog = createDashboardDialogChunkLoader(() =>
  import("./InstallHelpDialog")
);
const loadExtensionDownloadDialog = createDashboardDialogChunkLoader(() =>
  import("./ExtensionDownloadDialog")
);
const loadExtensionTokenDialog = createDashboardDialogChunkLoader(() =>
  import("./ExtensionTokenDialog")
);
const loadBookmarkComposerDialog = createDashboardDialogChunkLoader(() =>
  import("./BookmarkComposerDialog")
);
const loadMemoComposerDialog = createDashboardDialogChunkLoader(() =>
  import("./MemoComposerDialog").then((module) => {
    module.preloadMemoComposerEditorChunk();
    return module;
  })
);
const loadMemoLockDialog = createDashboardDialogChunkLoader(() =>
  import("./MemoLockDialog")
);
const loadFolderManagerDialog = createDashboardDialogChunkLoader(() =>
  import("./FolderManagerDialog")
);
const loadTagManagerDialog = createDashboardDialogChunkLoader(() =>
  import("./TagManagerDialog")
);

export const LazyInstallHelpDialog = lazy(loadInstallHelpDialog);
export const LazyExtensionDownloadDialog = lazy(loadExtensionDownloadDialog);
export const LazyExtensionTokenDialog = lazy(loadExtensionTokenDialog);
export const LazyBookmarkComposerDialog = lazy(loadBookmarkComposerDialog);
export const LazyMemoComposerDialog = lazy(loadMemoComposerDialog);
export const LazyMemoLockDialog = lazy(loadMemoLockDialog);
export const LazyFolderManagerDialog = lazy(loadFolderManagerDialog);
export const LazyTagManagerDialog = lazy(loadTagManagerDialog);

export type DashboardDialogChunk =
  | "installHelp"
  | "extensionDownload"
  | "extensionToken"
  | "bookmarkComposer"
  | "memoComposer"
  | "memoLock"
  | "folderManager"
  | "tagManager";

const dashboardDialogChunkLoaders: Record<DashboardDialogChunk, () => Promise<unknown>> = {
  installHelp: loadInstallHelpDialog,
  extensionDownload: loadExtensionDownloadDialog,
  extensionToken: loadExtensionTokenDialog,
  bookmarkComposer: loadBookmarkComposerDialog,
  memoComposer: loadMemoComposerDialog,
  memoLock: loadMemoLockDialog,
  folderManager: loadFolderManagerDialog,
  tagManager: loadTagManagerDialog
};

const preloadedDashboardDialogChunks = new Set<DashboardDialogChunk>();

export function preloadDashboardDialogChunk(chunk: DashboardDialogChunk) {
  if (preloadedDashboardDialogChunks.has(chunk)) {
    return;
  }

  preloadedDashboardDialogChunks.add(chunk);
  void measureAsyncPerformance(`dashboard:dialog-preload:${chunk}`, () =>
    dashboardDialogChunkLoaders[chunk]()
  ).catch(() => {
    preloadedDashboardDialogChunks.delete(chunk);
  });
}
