type BookmarkAssetsModule = typeof import("../lib/bookmark-assets");
type BookmarkExtractModule = typeof import("../lib/bookmark-extract");
type BookmarksModule = typeof import("../lib/bookmarks");
type ExtensionPresenceModule = typeof import("../lib/extension-presence");
type ExtensionTokensModule = typeof import("../lib/extension-tokens");
type FoldersModule = typeof import("../lib/folders");
type MemoAssetsModule = typeof import("../lib/memo-assets");
type MemoImageCompressionModule = typeof import("../lib/memo-image-compression");
type MemosModule = typeof import("../lib/memos");
type RecommendationsModule = typeof import("../lib/recommendations");
type SessionModule = typeof import("../lib/session");
type TagsModule = typeof import("../lib/tags");

type DeferredModuleLoader<TModule> = {
  get: () => TModule | null;
  load: () => Promise<TModule>;
};

function createDeferredModuleLoader<TModule>(
  loadModule: () => Promise<TModule>
): DeferredModuleLoader<TModule> {
  let moduleCache: TModule | null = null;
  let modulePromise: Promise<TModule> | null = null;

  return {
    get: () => moduleCache,
    load: () => {
      if (moduleCache) {
        return Promise.resolve(moduleCache);
      }

      modulePromise ??= loadModule().then((loadedModule) => {
        moduleCache = loadedModule;
        return loadedModule;
      });
      return modulePromise;
    }
  };
}

function callDeferredModule<TModule, TArgs extends unknown[], TResult>(
  loader: DeferredModuleLoader<TModule>,
  selectAction: (module: TModule) => (...args: TArgs) => Promise<TResult>,
  args: TArgs
) {
  const cachedModule = loader.get();
  if (cachedModule) {
    return selectAction(cachedModule)(...args);
  }

  return loader.load().then((loadedModule) => selectAction(loadedModule)(...args));
}

const bookmarkAssetsModule = createDeferredModuleLoader<BookmarkAssetsModule>(
  () => import("../lib/bookmark-assets")
);
const bookmarkExtractModule = createDeferredModuleLoader<BookmarkExtractModule>(
  () => import("../lib/bookmark-extract")
);
const bookmarksModule = createDeferredModuleLoader<BookmarksModule>(
  () => import("../lib/bookmarks")
);
const extensionPresenceModule = createDeferredModuleLoader<ExtensionPresenceModule>(
  () => import("../lib/extension-presence")
);
const extensionTokensModule = createDeferredModuleLoader<ExtensionTokensModule>(
  () => import("../lib/extension-tokens")
);
const foldersModule = createDeferredModuleLoader<FoldersModule>(
  () => import("../lib/folders")
);
const memosModule = createDeferredModuleLoader<MemosModule>(
  () => import("../lib/memos")
);
const memoAssetsModule = createDeferredModuleLoader<MemoAssetsModule>(
  () => import("../lib/memo-assets")
);
const memoImageCompressionModule =
  createDeferredModuleLoader<MemoImageCompressionModule>(
    () => import("../lib/memo-image-compression")
  );
const recommendationsModule = createDeferredModuleLoader<RecommendationsModule>(
  () => import("../lib/recommendations")
);
const sessionModule = createDeferredModuleLoader<SessionModule>(
  () => import("../lib/session")
);
const tagsModule = createDeferredModuleLoader<TagsModule>(
  () => import("../lib/tags")
);

function preloadDashboardCoreServiceModules() {
  void Promise.allSettled([
    bookmarkAssetsModule.load(),
    bookmarksModule.load(),
    foldersModule.load(),
    recommendationsModule.load(),
    tagsModule.load()
  ]);
}

function deleteBookmarkAsset(
  ...args: Parameters<BookmarkAssetsModule["deleteBookmarkAsset"]>
) {
  return callDeferredModule(
    bookmarkAssetsModule,
    (module) => module.deleteBookmarkAsset,
    args
  );
}

function loadBookmarkAssets(
  ...args: Parameters<BookmarkAssetsModule["loadBookmarkAssets"]>
) {
  return callDeferredModule(
    bookmarkAssetsModule,
    (module) => module.loadBookmarkAssets,
    args
  );
}

function loadBookmarkAssetsByBookmarks(
  ...args: Parameters<BookmarkAssetsModule["loadBookmarkAssetsByBookmarks"]>
) {
  return callDeferredModule(
    bookmarkAssetsModule,
    (module) => module.loadBookmarkAssetsByBookmarks,
    args
  );
}

function uploadBookmarkAsset(
  ...args: Parameters<BookmarkAssetsModule["uploadBookmarkAsset"]>
) {
  return callDeferredModule(
    bookmarkAssetsModule,
    (module) => module.uploadBookmarkAsset,
    args
  );
}

function extractBookmarkPreview(
  ...args: Parameters<BookmarkExtractModule["extractBookmarkPreview"]>
) {
  return callDeferredModule(
    bookmarkExtractModule,
    (module) => module.extractBookmarkPreview,
    args
  );
}

function createBookmark(...args: Parameters<BookmarksModule["createBookmark"]>) {
  return callDeferredModule(bookmarksModule, (module) => module.createBookmark, args);
}

function deleteBookmark(...args: Parameters<BookmarksModule["deleteBookmark"]>) {
  return callDeferredModule(bookmarksModule, (module) => module.deleteBookmark, args);
}

function emptyBookmarkTrash(
  ...args: Parameters<BookmarksModule["emptyBookmarkTrash"]>
) {
  return callDeferredModule(bookmarksModule, (module) => module.emptyBookmarkTrash, args);
}

function loadBookmark(...args: Parameters<BookmarksModule["loadBookmark"]>) {
  return callDeferredModule(bookmarksModule, (module) => module.loadBookmark, args);
}

function loadBookmarkCounts(
  ...args: Parameters<BookmarksModule["loadBookmarkCounts"]>
) {
  return callDeferredModule(bookmarksModule, (module) => module.loadBookmarkCounts, args);
}

function loadBookmarkPage(...args: Parameters<BookmarksModule["loadBookmarkPage"]>) {
  return callDeferredModule(bookmarksModule, (module) => module.loadBookmarkPage, args);
}

function loadBookmarkPreview(
  ...args: Parameters<BookmarksModule["loadBookmarkPreview"]>
) {
  return callDeferredModule(bookmarksModule, (module) => module.loadBookmarkPreview, args);
}

function loadBookmarks(...args: Parameters<BookmarksModule["loadBookmarks"]>) {
  return callDeferredModule(bookmarksModule, (module) => module.loadBookmarks, args);
}

function permanentlyDeleteBookmark(
  ...args: Parameters<BookmarksModule["permanentlyDeleteBookmark"]>
) {
  return callDeferredModule(
    bookmarksModule,
    (module) => module.permanentlyDeleteBookmark,
    args
  );
}

function reextractBookmark(
  ...args: Parameters<BookmarksModule["reextractBookmark"]>
) {
  return callDeferredModule(bookmarksModule, (module) => module.reextractBookmark, args);
}

function restoreBookmark(...args: Parameters<BookmarksModule["restoreBookmark"]>) {
  return callDeferredModule(bookmarksModule, (module) => module.restoreBookmark, args);
}

function updateBookmark(...args: Parameters<BookmarksModule["updateBookmark"]>) {
  return callDeferredModule(bookmarksModule, (module) => module.updateBookmark, args);
}

function configureBookmarkExtensionSettings(
  ...args: Parameters<ExtensionPresenceModule["configureBookmarkExtensionSettings"]>
) {
  return callDeferredModule(
    extensionPresenceModule,
    (module) => module.configureBookmarkExtensionSettings,
    args
  );
}

function detectBookmarkExtensionPresence(
  ...args: Parameters<ExtensionPresenceModule["detectBookmarkExtensionPresence"]>
) {
  return callDeferredModule(
    extensionPresenceModule,
    (module) => module.detectBookmarkExtensionPresence,
    args
  );
}

function detectBookmarkExtensionPresenceDetails(
  ...args: Parameters<ExtensionPresenceModule["detectBookmarkExtensionPresenceDetails"]>
) {
  return callDeferredModule(
    extensionPresenceModule,
    (module) => module.detectBookmarkExtensionPresenceDetails,
    args
  );
}

function requestBookmarkExtensionPreview(
  ...args: Parameters<ExtensionPresenceModule["requestBookmarkExtensionPreview"]>
) {
  return callDeferredModule(
    extensionPresenceModule,
    (module) => module.requestBookmarkExtensionPreview,
    args
  );
}

function createExtensionToken(
  ...args: Parameters<ExtensionTokensModule["createExtensionToken"]>
) {
  return callDeferredModule(
    extensionTokensModule,
    (module) => module.createExtensionToken,
    args
  );
}

function loadExtensionTokens(
  ...args: Parameters<ExtensionTokensModule["loadExtensionTokens"]>
) {
  return callDeferredModule(
    extensionTokensModule,
    (module) => module.loadExtensionTokens,
    args
  );
}

function revokeExtensionToken(
  ...args: Parameters<ExtensionTokensModule["revokeExtensionToken"]>
) {
  return callDeferredModule(
    extensionTokensModule,
    (module) => module.revokeExtensionToken,
    args
  );
}

function createFolder(...args: Parameters<FoldersModule["createFolder"]>) {
  return callDeferredModule(foldersModule, (module) => module.createFolder, args);
}

function deleteFolder(...args: Parameters<FoldersModule["deleteFolder"]>) {
  return callDeferredModule(foldersModule, (module) => module.deleteFolder, args);
}

function loadFolders(...args: Parameters<FoldersModule["loadFolders"]>) {
  return callDeferredModule(foldersModule, (module) => module.loadFolders, args);
}

function moveFolder(...args: Parameters<FoldersModule["moveFolder"]>) {
  return callDeferredModule(foldersModule, (module) => module.moveFolder, args);
}

function reorderFolders(...args: Parameters<FoldersModule["reorderFolders"]>) {
  return callDeferredModule(foldersModule, (module) => module.reorderFolders, args);
}

function updateFolder(...args: Parameters<FoldersModule["updateFolder"]>) {
  return callDeferredModule(foldersModule, (module) => module.updateFolder, args);
}

function deleteMemo(...args: Parameters<MemosModule["deleteMemo"]>) {
  return callDeferredModule(memosModule, (module) => module.deleteMemo, args);
}

function createMemo(...args: Parameters<MemosModule["createMemo"]>) {
  return callDeferredModule(memosModule, (module) => module.createMemo, args);
}

function createMemoFolder(...args: Parameters<MemosModule["createMemoFolder"]>) {
  return callDeferredModule(memosModule, (module) => module.createMemoFolder, args);
}

function deleteMemoFolder(...args: Parameters<MemosModule["deleteMemoFolder"]>) {
  return callDeferredModule(memosModule, (module) => module.deleteMemoFolder, args);
}

function loadMemoFolders(...args: Parameters<MemosModule["loadMemoFolders"]>) {
  return callDeferredModule(memosModule, (module) => module.loadMemoFolders, args);
}

function loadMemoLockStatus(...args: Parameters<MemosModule["loadMemoLockStatus"]>) {
  return callDeferredModule(memosModule, (module) => module.loadMemoLockStatus, args);
}

function loadMemoPage(...args: Parameters<MemosModule["loadMemoPage"]>) {
  return callDeferredModule(memosModule, (module) => module.loadMemoPage, args);
}

function loadMemo(...args: Parameters<MemosModule["loadMemo"]>) {
  return callDeferredModule(memosModule, (module) => module.loadMemo, args);
}

function loadMemoTags(...args: Parameters<MemosModule["loadMemoTags"]>) {
  return callDeferredModule(memosModule, (module) => module.loadMemoTags, args);
}

function createMemoTag(...args: Parameters<MemosModule["createMemoTag"]>) {
  return callDeferredModule(memosModule, (module) => module.createMemoTag, args);
}

function lockMemo(...args: Parameters<MemosModule["lockMemo"]>) {
  return callDeferredModule(memosModule, (module) => module.lockMemo, args);
}

function lockLockedMemo(...args: Parameters<MemosModule["lockLockedMemo"]>) {
  return callDeferredModule(memosModule, (module) => module.lockLockedMemo, args);
}

function deleteMemoTag(...args: Parameters<MemosModule["deleteMemoTag"]>) {
  return callDeferredModule(memosModule, (module) => module.deleteMemoTag, args);
}

function moveMemoFolder(...args: Parameters<MemosModule["moveMemoFolder"]>) {
  return callDeferredModule(memosModule, (module) => module.moveMemoFolder, args);
}

function reorderMemoFolders(...args: Parameters<MemosModule["reorderMemoFolders"]>) {
  return callDeferredModule(memosModule, (module) => module.reorderMemoFolders, args);
}

function updateMemo(...args: Parameters<MemosModule["updateMemo"]>) {
  return callDeferredModule(memosModule, (module) => module.updateMemo, args);
}

function updateMemoFolder(...args: Parameters<MemosModule["updateMemoFolder"]>) {
  return callDeferredModule(memosModule, (module) => module.updateMemoFolder, args);
}

function updateMemoTag(...args: Parameters<MemosModule["updateMemoTag"]>) {
  return callDeferredModule(memosModule, (module) => module.updateMemoTag, args);
}

function setupMemoLock(...args: Parameters<MemosModule["setupMemoLock"]>) {
  return callDeferredModule(memosModule, (module) => module.setupMemoLock, args);
}

function unlockMemoLock(...args: Parameters<MemosModule["unlockMemoLock"]>) {
  return callDeferredModule(memosModule, (module) => module.unlockMemoLock, args);
}

function unlockLockedMemo(...args: Parameters<MemosModule["unlockLockedMemo"]>) {
  return callDeferredModule(memosModule, (module) => module.unlockLockedMemo, args);
}

function uploadMemoAsset(...args: Parameters<MemoAssetsModule["uploadMemoAsset"]>) {
  return callDeferredModule(memoAssetsModule, (module) => module.uploadMemoAsset, args);
}

function uploadPreparedMemoAsset(
  ...args: Parameters<MemoAssetsModule["uploadPreparedMemoAsset"]>
) {
  return callDeferredModule(
    memoAssetsModule,
    (module) => module.uploadPreparedMemoAsset,
    args
  );
}

function prepareMemoImageUploadFiles(
  ...args: Parameters<MemoImageCompressionModule["prepareMemoImageUploadFiles"]>
) {
  return callDeferredModule(
    memoImageCompressionModule,
    (module) => module.prepareMemoImageUploadFiles,
    args
  );
}

function loadRecommendations(
  ...args: Parameters<RecommendationsModule["loadRecommendations"]>
) {
  return callDeferredModule(
    recommendationsModule,
    (module) => module.loadRecommendations,
    args
  );
}

function recordBookmarkOpen(
  ...args: Parameters<RecommendationsModule["recordBookmarkOpen"]>
) {
  return callDeferredModule(
    recommendationsModule,
    (module) => module.recordBookmarkOpen,
    args
  );
}

function exchangeIdTokenForSession(
  ...args: Parameters<SessionModule["exchangeIdTokenForSession"]>
) {
  return callDeferredModule(
    sessionModule,
    (module) => module.exchangeIdTokenForSession,
    args
  );
}

function loadSession(...args: Parameters<SessionModule["loadSession"]>) {
  return callDeferredModule(sessionModule, (module) => module.loadSession, args);
}

function logoutSession(...args: Parameters<SessionModule["logoutSession"]>) {
  return callDeferredModule(sessionModule, (module) => module.logoutSession, args);
}

function createTag(...args: Parameters<TagsModule["createTag"]>) {
  return callDeferredModule(tagsModule, (module) => module.createTag, args);
}

function deleteTag(...args: Parameters<TagsModule["deleteTag"]>) {
  return callDeferredModule(tagsModule, (module) => module.deleteTag, args);
}

function loadTags(...args: Parameters<TagsModule["loadTags"]>) {
  return callDeferredModule(tagsModule, (module) => module.loadTags, args);
}

function updateTag(...args: Parameters<TagsModule["updateTag"]>) {
  return callDeferredModule(tagsModule, (module) => module.updateTag, args);
}

export {
  configureBookmarkExtensionSettings,
  createBookmark,
  createExtensionToken,
  createFolder,
  createMemo,
  createMemoFolder,
  createMemoTag,
  createTag,
  deleteBookmark,
  deleteBookmarkAsset,
  emptyBookmarkTrash,
  deleteFolder,
  deleteMemo,
  deleteMemoFolder,
  deleteMemoTag,
  deleteTag,
  detectBookmarkExtensionPresence,
  detectBookmarkExtensionPresenceDetails,
  exchangeIdTokenForSession,
  extractBookmarkPreview,
  loadBookmark,
  loadBookmarkAssets,
  loadBookmarkAssetsByBookmarks,
  loadBookmarkCounts,
  loadBookmarkPage,
  loadBookmarkPreview,
  loadBookmarks,
  loadExtensionTokens,
  loadFolders,
  loadMemoFolders,
  loadMemoLockStatus,
  loadMemo,
  loadMemoPage,
  loadMemoTags,
  loadRecommendations,
  loadSession,
  loadTags,
  lockLockedMemo,
  lockMemo,
  logoutSession,
  moveMemoFolder,
  moveFolder,
  permanentlyDeleteBookmark,
  prepareMemoImageUploadFiles,
  preloadDashboardCoreServiceModules,
  recordBookmarkOpen,
  reextractBookmark,
  reorderMemoFolders,
  reorderFolders,
  requestBookmarkExtensionPreview,
  restoreBookmark,
  revokeExtensionToken,
  setupMemoLock,
  updateBookmark,
  updateFolder,
  updateMemo,
  updateMemoFolder,
  updateMemoTag,
  updateTag,
  unlockLockedMemo,
  unlockMemoLock,
  uploadBookmarkAsset,
  uploadMemoAsset,
  uploadPreparedMemoAsset
};
