import {
  Suspense,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import "./DashboardShell.css";
import "./AuthenticatedDashboardApp.css";
import "./AuthenticatedDashboardTheme.css";

import type {
  AuthenticatedUser,
  Bookmark,
  BookmarkAsset,
  BookmarkCounts,
  BookmarkExtractPreview,
  BookmarkSortMode,
  CreateBookmarkRequest,
  ExtensionToken,
  Folder,
  Memo,
  MemoAsset,
  MemoFolder,
  MemoListResponse,
  MemoLockStatusResponse,
  MemoRichContent,
  MemoTag,
  MemoViewMode,
  Tag
} from "@bookmark/shared";

import type { BookmarkPage } from "../lib/bookmarks";
import type { BookmarkExtensionPresenceStatus } from "../lib/extension-presence";
import {
  preloadFirebaseAuth,
  signInWithGoogle,
  signOutFromGoogle
} from "../lib/firebase-auth-actions";
import { measureAsyncPerformance, measureSyncPerformance } from "../lib/performance-marks";
import { DashboardHeader } from "./DashboardHeader";
import {
  LazyBookmarkDetailPanel,
  LazyBookmarkResultsPanel,
  LazyFolderOverviewPanel,
  LazyHomePanel,
  LazyMemoPanel,
  LazyMobileSidebarTabs,
  LazyRecommendationPanel,
  preloadDashboardPanelChunk
} from "./dashboard-panel-chunks";
import {
  LazyBookmarkComposerDialog,
  LazyExtensionDownloadDialog,
  LazyExtensionTokenDialog,
  LazyFolderManagerDialog,
  LazyInstallHelpDialog,
  LazyMemoComposerDialog,
  LazyMemoLockDialog,
  LazyTagManagerDialog,
  preloadDashboardDialogChunk
} from "./dashboard-dialog-chunks";
import {
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
  deleteMemoAsset,
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
  loadMemo,
  loadMemoAssets,
  loadMemoFolders,
  loadMemoLockStatus,
  loadMemoPage,
  loadMemoTags,
  loadRecommendations,
  loadSession,
  loadTags,
  logoutSession,
  moveFolder,
  moveMemoFolder,
  permanentlyDeleteBookmark,
  prepareMemoImageUploadFiles,
  preloadDashboardCoreServiceModules,
  recordBookmarkOpen,
  reextractBookmark,
  reorderFolders,
  reorderMemoFolders,
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
} from "./dashboard-service-modules";
import {
  applyMemoContentAssetPreview,
  getReferencedMemoAssets,
  getReferencedMemoImageUploads
} from "../lib/memo-content-assets";
import type { PreparedMemoImageUploadFile } from "../lib/memo-image-compression";
import {
  buildBookmarkListRows,
  buildHomeFavoriteCards,
  buildRecommendationCardsByKind,
  getBookmarkSummaryStateLabel,
  type BookmarkListRowCacheEntry,
  type HomeFavoriteCardCacheEntry,
  type RecommendationCardCacheEntry
} from "./dashboard-bookmark-view-models";
import {
  loadBookmarkAssetsForBookmarks,
  queueBookmarkAssetPreload as queueDashboardBookmarkAssetPreload
} from "./dashboard-bookmark-asset-preload";
import {
  loadBookmarkCollections as loadDashboardBookmarkCollections,
  loadDashboardBookmarkData as loadDashboardBookmarkDataFromSources
} from "./dashboard-data-loaders";
import {
  DEFAULT_BOOKMARK_PAGE_SIZE,
  DEFAULT_BOOKMARK_VIEW_MODE,
  BOOKMARK_VIEW_SETTINGS_STORAGE_KEY,
  bookmarkPageSizeOptions,
  bookmarkSearchModeOptions,
  bookmarkSortOptions,
  bookmarkViewModeOptions,
  canResolveFolderOverviewSearchLocally,
  clampBookmarkCoverSize,
  countUnfiledBookmarksFromCounts,
  countVisibleActiveBookmarksFromCounts,
  defaultBookmarkCardDisplaySettings,
  defaultBookmarkListDisplaySettings,
  emptyBookmarkRecommendations,
  emptyBookmarkSearchDraft,
  filterBookmarksByHiddenBookmarks,
  filterBookmarksByHiddenFolders,
  filterBookmarksForFolderOverviewSearch,
  filterBookmarksForFolderOverviewSpecialFilter,
  filterRecommendationsByHiddenBookmarks,
  filterRecommendationsByHiddenFolders,
  getBookmarkCountBucketValue,
  getBookmarkSearchSummaryItems,
  getExtensionFolderIds,
  getFolderAncestorIds,
  getFolderDescendantIds,
  getFolderVisibleIdsForQuery,
  getFoldersByParentId,
  getHiddenFolderIds,
  getHierarchicalFolderOptions,
  getSiblingFolders,
  hasActiveBookmarkAdvancedFilters,
  hasActiveBookmarkSearch,
  isBookmarkUnfiled,
  isBookmarkVisibleUnderHiddenRules,
  loadStoredBookmarkViewSettings,
  moveFolderToSiblingPosition,
  normalizeBookmarkSearchDraft,
  reorderSiblingFolders,
  upsertBookmarkById,
  type BookmarkRecommendationsState,
  type FolderReorderPosition,
  type RecommendationKind
} from "./dashboard-bookmark-utils";
import {
  getBookmarkVirtualWindow,
  getBookmarkVirtualWindowStartForScroll
} from "./dashboard-bookmark-virtualization";
import {
  getBookmarkPreviewStoredSourceFields,
  getBookmarkPreviewWorkerFallbackMessage,
  isJsRequiredBookmarkPreview
} from "./bookmark-preview-utils";
import {
  createBookmarkDetailPreviewCaches,
  getBookmarkDetailFieldRows,
  invalidateBookmarkDetailPreviewCache,
  resolveBookmarkDetailPreview,
  type BookmarkExtensionRenderedPreviewAttempt
} from "./dashboard-bookmark-detail";
import type {
  BookmarkDisplaySettings as BookmarkCardDisplaySettings,
  BookmarkListRowActionResult,
  BookmarkListRowActions,
  BookmarkListRowViewModel,
  BookmarkPageSize,
  BookmarkSearchDraft,
  BookmarkSearchSummaryItem,
  BookmarkViewMode
} from "./BookmarkResultsPanel";
import type {
  RecommendationCardViewModel,
  RecommendationPanelActions
} from "./RecommendationPanel";
import type {
  FolderOverviewDropMode,
  FolderOverviewNodeActions,
  FolderOverviewNodeViewModel,
  FolderOverviewSpecialFilter,
  MobileSidebarPanelId
} from "./FolderOverviewPanel";
import type {
  HomeFavoriteCardViewModel,
  HomePanelActions
} from "./HomePanel";

type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthenticatedUser };

type AuthenticatedDashboardAppProps = {
  initialUser?: AuthenticatedUser;
  onSessionEnd?: () => void;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type BookmarkDraft = {
  url: string;
  folderId: string;
  tagIds: string[];
  bookmarkColor: string;
  urlColor: string;
  userTitle: string;
  userContent: string;
  userSummary: string;
  isFavorite: boolean;
  isHidden: boolean;
};

type FolderDraft = {
  name: string;
  color: string;
  icon: string;
  isHidden: boolean;
  parentFolderId: string;
};

type TagDraft = {
  name: string;
  color: string;
};

type MemoComposerDraft = {
  title: string;
  folderId: string;
  tagIds: string[];
  memoColor: string;
  isFavorite: boolean;
  isHidden: boolean;
  isLocked: boolean;
  lockPassword: string;
  contentJson: MemoRichContent;
  contentText: string;
};

type PendingMemoImageUpload = {
  id: string;
  preparedFile: PreparedMemoImageUploadFile;
  contentUrl: string;
};

type DashboardView = "home" | "bookmarks" | "memos";
type BookmarkDetailDisplayMode = "rail" | "dialog";
type BookmarkDetailTab = "detail" | "preview" | "extract";
type AppThemeMode = "light" | "dark";
type ManagerScope = "bookmarks" | "memos";
type MemoLockPromptMode = "setup" | "unlock";
type MemoPageLoadOptions = NonNullable<Parameters<typeof loadMemoPage>[0]>;
type MemoPage = {
  memos: Memo[];
  pagination: NonNullable<MemoListResponse["pagination"]> | null;
};
type MemoPageCacheEntry = {
  key: string;
  page: MemoPage;
};
type MemoWorkspaceMetadata = {
  lockStatus: MemoLockStatusResponse;
  folders: MemoFolder[];
  tags: MemoTag[];
};

const EXTENSION_DOWNLOAD_PATH = "/downloads/bookmark-saver-extension.zip";
const USERSCRIPT_DOWNLOAD_PATH = "/downloads/bookmark-saver.user.js?v=0.1.11";
const APP_THEME_STORAGE_KEY = "bookmark-theme";
const MEMO_VIEW_MODE_STORAGE_KEY = "memo-view-mode:v1";
const MEMO_PAGE_SIZE = 20;
const MEMO_EXPORT_PAGE_SIZE = 100;
const MEMO_PAGE_CACHE_LIMIT = 12;
const DEFAULT_MEMO_FOLDER_FILTER_ID = "unfiled";
const MEMO_SEARCH_DEBOUNCE_MS = 300;
const STATUS_MESSAGE_DISMISS_MS = 3200;

const emptyBookmarkDraft: BookmarkDraft = {
  url: "",
  folderId: "",
  tagIds: [],
  bookmarkColor: "",
  urlColor: "",
  userTitle: "",
  userContent: "",
  userSummary: "",
  isFavorite: false,
  isHidden: false
};

function createEmptyMemoDocument(): MemoRichContent {
  return {
    type: "doc",
    content: []
  };
}

function createEmptyMemoDraft(): MemoComposerDraft {
  return {
    title: "",
    folderId: "",
    tagIds: [],
    memoColor: "",
    isFavorite: false,
    isHidden: false,
    isLocked: false,
    lockPassword: "",
    contentJson: createEmptyMemoDocument(),
    contentText: ""
  };
}

function createMemoDraftFromMemo(memo: Memo): MemoComposerDraft {
  return {
    title: memo.title,
    folderId: memo.folderId ?? "",
    tagIds: memo.tagIds,
    memoColor: memo.memoColor ?? "",
    isFavorite: memo.isFavorite,
    isHidden: memo.isHidden,
    isLocked: memo.isLocked === true,
    lockPassword: "",
    contentJson: memo.contentJson,
    contentText: memo.contentText
  };
}

function areMemoDraftsEqual(left: MemoComposerDraft, right: MemoComposerDraft) {
  return (
    left.title === right.title &&
    left.folderId === right.folderId &&
    left.memoColor === right.memoColor &&
    left.isFavorite === right.isFavorite &&
    left.isHidden === right.isHidden &&
    left.isLocked === right.isLocked &&
    left.lockPassword === right.lockPassword &&
    left.contentText === right.contentText &&
    left.tagIds.length === right.tagIds.length &&
    left.tagIds.every((tagId, index) => tagId === right.tagIds[index]) &&
    JSON.stringify(left.contentJson) === JSON.stringify(right.contentJson)
  );
}

function createLockedMemoPreview(memo: Memo): Memo {
  if (!memo.isLocked) {
    return memo;
  }

  return {
    ...memo,
    contentJson: createEmptyMemoDocument(),
    contentText: "",
    assetCount: 0,
    coverAsset: null
  };
}

function filterMemosByHiddenFolders(
  nextMemos: Memo[],
  hiddenFolderIds: Set<string>,
  showHiddenFolders: boolean
) {
  if (showHiddenFolders || hiddenFolderIds.size === 0) {
    return nextMemos;
  }

  return nextMemos.filter((memo) => !memo.folderId || !hiddenFolderIds.has(memo.folderId));
}

function createMemoPageCacheKey(options: MemoPageLoadOptions) {
  const folderId =
    "folderId" in options
      ? options.folderId === null
        ? "__unfiled__"
        : options.folderId ?? "__all__"
      : "__all__";

  return JSON.stringify({
    query: options.query ?? "",
    folderId,
    includeDescendantFolders: options.includeDescendantFolders === true,
    tagId: options.tagId ?? "",
    favorite: options.favorite === true,
    includeHidden: options.includeHidden === true,
    includeLocked: options.includeLocked === true,
    sort: options.sort ?? "",
    limit: options.limit ?? MEMO_PAGE_SIZE,
    offset: options.offset ?? 0
  });
}

function createPendingMemoImageId() {
  return `memo-pending-image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createPendingMemoImageUrl(file: File, id: string) {
  const urlApi = globalThis.URL;
  if (typeof urlApi?.createObjectURL === "function") {
    return urlApi.createObjectURL(file);
  }

  return `memo-pending-image://${id}`;
}

function revokePendingMemoImageUrl(contentUrl: string) {
  if (!contentUrl.startsWith("blob:")) {
    return;
  }

  const urlApi = globalThis.URL;
  if (typeof urlApi?.revokeObjectURL === "function") {
    urlApi.revokeObjectURL(contentUrl);
  }
}

function createPendingMemoAsset(pendingUpload: PendingMemoImageUpload): MemoAsset {
  const timestamp = new Date().toISOString();
  const file = pendingUpload.preparedFile.file;
  return {
    id: pendingUpload.id,
    memoId: "pending",
    mimeType: file.type || "application/octet-stream",
    width: null,
    height: null,
    sortOrder: 0,
    contentUrl: pendingUpload.contentUrl,
    thumbnailUrl: pendingUpload.contentUrl,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const omittedMemoNode = Symbol("omittedMemoNode");

function removePendingMemoImagesFromValue(
  value: unknown,
  pendingSources: Set<string>
): unknown | typeof omittedMemoNode {
  if (Array.isArray(value)) {
    return value
      .map((item) => removePendingMemoImagesFromValue(item, pendingSources))
      .filter((item) => item !== omittedMemoNode);
  }

  if (!isRecord(value)) {
    return value;
  }

  const attrs = isRecord(value.attrs) ? value.attrs : null;
  const source = typeof attrs?.src === "string" ? attrs.src : null;
  if (value.type === "image" && source && pendingSources.has(source)) {
    return omittedMemoNode;
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, removePendingMemoImagesFromValue(item, pendingSources)] as const)
      .filter(([, item]) => item !== omittedMemoNode)
  );
}

function removePendingMemoImages(
  contentJson: MemoRichContent,
  pendingUploads: PendingMemoImageUpload[]
): MemoRichContent {
  if (pendingUploads.length === 0) {
    return contentJson;
  }

  const pendingSources = new Set(pendingUploads.map((upload) => upload.contentUrl));
  const nextContent = removePendingMemoImagesFromValue(
    contentJson.content ?? [],
    pendingSources
  );

  return {
    ...contentJson,
    content: Array.isArray(nextContent) ? nextContent : []
  };
}

function replacePendingMemoImagesInValue(
  value: unknown,
  replacements: Map<string, string>
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => replacePendingMemoImagesInValue(item, replacements));
  }

  if (!isRecord(value)) {
    return value;
  }

  const entries = Object.entries(value).map(([key, item]) => [
    key,
    replacePendingMemoImagesInValue(item, replacements)
  ]);
  const nextValue = Object.fromEntries(entries);
  const attrs = isRecord(nextValue.attrs) ? nextValue.attrs : null;
  const source = typeof attrs?.src === "string" ? attrs.src : null;

  if (nextValue.type === "image" && attrs && source && replacements.has(source)) {
    return {
      ...nextValue,
      attrs: {
        ...attrs,
        src: replacements.get(source)
      }
    };
  }

  return nextValue;
}

function replacePendingMemoImages(
  contentJson: MemoRichContent,
  replacements: Map<string, string>
): MemoRichContent {
  if (replacements.size === 0) {
    return contentJson;
  }

  const nextContent = replacePendingMemoImagesInValue(contentJson.content ?? [], replacements);

  return {
    ...contentJson,
    content: Array.isArray(nextContent) ? nextContent : []
  };
}

function loadStoredMemoViewMode(): MemoViewMode {
  try {
    const storedValue = globalThis.localStorage?.getItem(MEMO_VIEW_MODE_STORAGE_KEY);
    return storedValue === "card" ? "card" : "list";
  } catch {
    return "list";
  }
}

const emptyFolderDraft: FolderDraft = {
  name: "",
  color: "",
  icon: "",
  isHidden: false,
  parentFolderId: ""
};

const emptyTagDraft: TagDraft = {
  name: "",
  color: ""
};

function areFolderDraftsEqual(left: FolderDraft, right: FolderDraft) {
  return (
    left.name === right.name &&
    left.color === right.color &&
    left.icon === right.icon &&
    left.isHidden === right.isHidden &&
    left.parentFolderId === right.parentFolderId
  );
}

function areTagDraftsEqual(left: TagDraft, right: TagDraft) {
  return left.name === right.name && left.color === right.color;
}

function areBookmarkDraftsEqual(left: BookmarkDraft, right: BookmarkDraft) {
  return (
    left.url === right.url &&
    left.folderId === right.folderId &&
    left.bookmarkColor === right.bookmarkColor &&
    left.urlColor === right.urlColor &&
    left.userTitle === right.userTitle &&
    left.userContent === right.userContent &&
    left.userSummary === right.userSummary &&
    left.isFavorite === right.isFavorite &&
    left.isHidden === right.isHidden &&
    left.tagIds.length === right.tagIds.length &&
    left.tagIds.every((tagId, index) => tagId === right.tagIds[index])
  );
}

function loadStoredAppTheme(): AppThemeMode {
  try {
    return globalThis.localStorage?.getItem(APP_THEME_STORAGE_KEY) === "dark"
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

function storeAppTheme(theme: AppThemeMode) {
  try {
    globalThis.localStorage?.setItem(APP_THEME_STORAGE_KEY, theme);
  } catch {
    // Theme preference is non-critical; keep the in-memory toggle working.
  }
}

function getInitialDashboardView(): DashboardView {
  try {
    return globalThis.location?.search
      ? new URLSearchParams(globalThis.location.search).get("view") === "memos"
        ? "memos"
        : "home"
      : "home";
  } catch {
    return "home";
  }
}

function writeDashboardViewToUrl(view: DashboardView) {
  try {
    const currentUrl = new URL(globalThis.location.href);
    if (view === "memos") {
      currentUrl.searchParams.set("view", "memos");
    } else {
      currentUrl.searchParams.delete("view");
    }
    const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    const currentPath = `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`;
    if (nextUrl !== currentPath) {
      globalThis.history.replaceState(globalThis.history.state, "", nextUrl);
    }
  } catch {
    // URL state is a convenience; keep the dashboard usable if history is unavailable.
  }
}

const MOBILE_SEARCH_BREAKPOINT = 720;
const MOBILE_SEARCH_MEDIA_QUERY = `(max-width: ${MOBILE_SEARCH_BREAKPOINT}px)`;

function getIsMobileSearchViewport() {
  if (typeof globalThis.matchMedia === "function") {
    return globalThis.matchMedia(MOBILE_SEARCH_MEDIA_QUERY).matches;
  }

  return (
    globalThis.document?.documentElement?.clientWidth ?? globalThis.innerWidth ?? 1024
  ) <= MOBILE_SEARCH_BREAKPOINT;
}

export default function AuthenticatedDashboardApp({
  initialUser,
  onSessionEnd
}: AuthenticatedDashboardAppProps = {}) {
  const [appTheme, setAppTheme] = useState<AppThemeMode>(() => loadStoredAppTheme());
  const [sessionState, setSessionState] = useState<SessionState>({
    status: "loading"
  });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bookmarkInventory, setBookmarkInventory] = useState<Bookmark[]>([]);
  const [hasLoadedFullBookmarkInventory, setHasLoadedFullBookmarkInventory] = useState(false);
  const [bookmarkCounts, setBookmarkCounts] = useState<BookmarkCounts | null>(null);
  const [homeFavoriteBookmarks, setHomeFavoriteBookmarks] = useState<Bookmark[] | null>(null);
  const [trashedBookmarks, setTrashedBookmarks] = useState<Bookmark[]>([]);
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null);
  const [bookmarkAssetsByBookmarkId, setBookmarkAssetsByBookmarkId] = useState<
    Record<string, BookmarkAsset[]>
  >({});
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [hasLoadedTags, setHasLoadedTags] = useState(false);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [memoFolders, setMemoFolders] = useState<MemoFolder[]>([]);
  const [memoTags, setMemoTags] = useState<MemoTag[]>([]);
  const [memoTotalCount, setMemoTotalCount] = useState<number | null>(null);
  const [memoSearchQuery, setMemoSearchQuery] = useState("");
  const [debouncedMemoSearchQuery, setDebouncedMemoSearchQuery] = useState("");
  const [memoFolderFilterId, setMemoFolderFilterId] = useState<string | null>(
    DEFAULT_MEMO_FOLDER_FILTER_ID
  );
  const memoFolderFilterIdRef = useRef<string | null>(DEFAULT_MEMO_FOLDER_FILTER_ID);
  const [memoTagFilterId, setMemoTagFilterId] = useState<string | null>(null);
  const [memoFavoriteOnly, setMemoFavoriteOnly] = useState(false);
  const [memoViewMode, setMemoViewMode] = useState<MemoViewMode>(() => loadStoredMemoViewMode());
  const [memoLockStatus, setMemoLockStatus] = useState<MemoLockStatusResponse | null>(null);
  const [memoLockPromptMode, setMemoLockPromptMode] = useState<MemoLockPromptMode | null>(null);
  const [isMemoLockBusy, setIsMemoLockBusy] = useState(false);
  const [memoLockError, setMemoLockError] = useState<string | null>(null);
  const [isLoadingMemos, setIsLoadingMemos] = useState(false);
  const [memoDraft, setMemoDraft] = useState<MemoComposerDraft>(() => createEmptyMemoDraft());
  const memoDraftRef = useRef(memoDraft);
  const [initialMemoDraft, setInitialMemoDraft] = useState<MemoComposerDraft>(() =>
    createEmptyMemoDraft()
  );
  const [editingMemo, setEditingMemo] = useState<Memo | null>(null);
  const [isMemoComposerOpen, setIsMemoComposerOpen] = useState(false);
  const [, setPendingMemoImageUploads] = useState<
    PendingMemoImageUpload[]
  >([]);
  const pendingMemoImageUploadsRef = useRef<PendingMemoImageUpload[]>([]);
  const latestMemoCoverAssetByMemoIdRef = useRef<Record<string, MemoAsset>>({});
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  const [recommendations, setRecommendations] = useState<BookmarkRecommendationsState>(
    emptyBookmarkRecommendations
  );
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [hasLoadedRecommendations, setHasLoadedRecommendations] = useState(false);
  const [bookmarkDraft, setBookmarkDraft] = useState<BookmarkDraft>(emptyBookmarkDraft);
  const [initialBookmarkDraft, setInitialBookmarkDraft] = useState<BookmarkDraft>(emptyBookmarkDraft);
  const [isBookmarkComposerOpen, setIsBookmarkComposerOpen] = useState(false);
  const [isBookmarkComposerClassificationOpen, setIsBookmarkComposerClassificationOpen] = useState(false);
  const [isBookmarkComposerDisplayOpen, setIsBookmarkComposerDisplayOpen] = useState(false);
  const [folderManagerScope, setFolderManagerScope] = useState<ManagerScope>("bookmarks");
  const [tagManagerScope, setTagManagerScope] = useState<ManagerScope>("bookmarks");
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [pendingAssetFiles, setPendingAssetFiles] = useState<File[]>([]);
  const [extensionTokens, setExtensionTokens] = useState<ExtensionToken[]>([]);
  const [isExtensionTokenDialogOpen, setIsExtensionTokenDialogOpen] = useState(false);
  const [isExtensionDownloadDialogOpen, setIsExtensionDownloadDialogOpen] = useState(false);
  const [isConnectingExtension, setIsConnectingExtension] = useState(false);
  const [extensionConnectionMessage, setExtensionConnectionMessage] = useState<string | null>(null);
  const [userscriptCopyStatus, setUserscriptCopyStatus] = useState<string | null>(null);
  const [extensionTokenLabelDraft, setExtensionTokenLabelDraft] = useState("");
  const [latestIssuedExtensionToken, setLatestIssuedExtensionToken] = useState<string | null>(null);
  const [bookmarkPreview, setBookmarkPreview] = useState<BookmarkExtractPreview | null>(null);
  const [bookmarkPreviewFailure, setBookmarkPreviewFailure] = useState<string | null>(null);
  const [bookmarkExtensionPresence, setBookmarkExtensionPresence] = useState<
    BookmarkExtensionPresenceStatus | "checking"
  >("missing");
  const [bookmarkSearchDraft, setBookmarkSearchDraft] = useState<BookmarkSearchDraft>(
    emptyBookmarkSearchDraft
  );
  const [appliedBookmarkSearch, setAppliedBookmarkSearch] = useState<BookmarkSearchDraft>(
    emptyBookmarkSearchDraft
  );
  const [isAdvancedBookmarkSearchOpen, setIsAdvancedBookmarkSearchOpen] = useState(false);
  const [isMobileSearchViewport, setIsMobileSearchViewport] = useState(getIsMobileSearchViewport);
  const [isMobileSearchPanelOpen, setIsMobileSearchPanelOpen] = useState(
    () => !getIsMobileSearchViewport()
  );
  const [mobileSidebarPanel, setMobileSidebarPanel] = useState<MobileSidebarPanelId>("folder");
  const [isMobileHeaderMenuOpen, setIsMobileHeaderMenuOpen] = useState(false);
  const [bookmarkTagSearchQuery, setBookmarkTagSearchQuery] = useState("");
  const [activeDashboardView, setActiveDashboardView] =
    useState<DashboardView>(getInitialDashboardView);
  const [isHomeRecommendationOpen, setIsHomeRecommendationOpen] = useState(false);
  const [isInstallHelpDialogOpen, setIsInstallHelpDialogOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [folderDraft, setFolderDraft] = useState<FolderDraft>(emptyFolderDraft);
  const [initialFolderDraft, setInitialFolderDraft] = useState<FolderDraft>(emptyFolderDraft);
  const [quickFolderDraft, setQuickFolderDraft] = useState<FolderDraft>(emptyFolderDraft);
  const [tagDraft, setTagDraft] = useState<TagDraft>(emptyTagDraft);
  const [initialTagDraft, setInitialTagDraft] = useState<TagDraft>(emptyTagDraft);
  const [quickTagDraft, setQuickTagDraft] = useState<TagDraft>(emptyTagDraft);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [folderOverviewDropTarget, setFolderOverviewDropTarget] = useState<{
    folderId: string;
    mode: FolderOverviewDropMode;
  } | null>(null);
  const [openBookmarkActionMenuId, setOpenBookmarkActionMenuId] = useState<string | null>(null);
  const [isBookmarkDetailActionMenuOpen, setIsBookmarkDetailActionMenuOpen] = useState(false);
  const [isBookmarkSortMenuOpen, setIsBookmarkSortMenuOpen] = useState(false);
  const [isBookmarkViewMenuOpen, setIsBookmarkViewMenuOpen] = useState(false);
  const [bookmarkViewMode, setBookmarkViewMode] = useState<BookmarkViewMode>(
    () => loadStoredBookmarkViewSettings().mode
  );
  const [bookmarkListPageSize, setBookmarkListPageSize] =
    useState<BookmarkPageSize>(DEFAULT_BOOKMARK_PAGE_SIZE);
  const [bookmarkListVisibleCount, setBookmarkListVisibleCount] =
    useState<number>(DEFAULT_BOOKMARK_PAGE_SIZE);
  const [bookmarkListTotalCount, setBookmarkListTotalCount] = useState<number | null>(null);
  const [bookmarkListNextOffset, setBookmarkListNextOffset] = useState<number | null>(null);
  const [bookmarkVirtualWindowStart, setBookmarkVirtualWindowStart] = useState(0);
  const [bookmarkListDisplaySettings, setBookmarkListDisplaySettings] =
    useState<BookmarkCardDisplaySettings>(() => loadStoredBookmarkViewSettings().list);
  const [bookmarkCardDisplaySettings, setBookmarkCardDisplaySettings] =
    useState<BookmarkCardDisplaySettings>(() => loadStoredBookmarkViewSettings().card);
  const [openFolderActionMenuId, setOpenFolderActionMenuId] = useState<string | null>(null);
  const [openTagActionMenuId, setOpenTagActionMenuId] = useState<string | null>(null);
  const [expandedFolderOverviewIds, setExpandedFolderOverviewIds] = useState<string[]>([]);
  const [expandedMemoFolderOverviewIds, setExpandedMemoFolderOverviewIds] = useState<string[]>([]);
  const [expandedFolderManagerIds, setExpandedFolderManagerIds] = useState<string[]>([]);
  const [folderOverviewSpecialFilter, setFolderOverviewSpecialFilter] =
    useState<FolderOverviewSpecialFilter | null>(null);
  const [folderOverviewQuery, setFolderOverviewQuery] = useState("");
  const [memoFolderOverviewQuery, setMemoFolderOverviewQuery] = useState("");
  const [showHiddenFolders, setShowHiddenFolders] = useState(false);
  const [showHiddenBookmarks, setShowHiddenBookmarks] = useState(false);
  const [showHiddenMemoFolders, setShowHiddenMemoFolders] = useState(false);
  const [showHiddenMemos, setShowHiddenMemos] = useState(false);
  const [isQuickActionsMenuOpen, setIsQuickActionsMenuOpen] = useState(false);
  const [isQuickFolderOpen, setIsQuickFolderOpen] = useState(false);
  const [isQuickTagOpen, setIsQuickTagOpen] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingMoreBookmarks, setIsLoadingMoreBookmarks] = useState(false);
  const [bookmarkDetailDisplayMode, setBookmarkDetailDisplayMode] =
    useState<BookmarkDetailDisplayMode>("rail");
  const [isLoadingSelectedBookmark, setIsLoadingSelectedBookmark] = useState(false);
  const [isLoadingSelectedBookmarkAssets, setIsLoadingSelectedBookmarkAssets] = useState(false);
  const [bookmarkDetailActiveTab, setBookmarkDetailActiveTab] =
    useState<BookmarkDetailTab>("detail");
  const [isBookmarkPreviewFullscreen, setIsBookmarkPreviewFullscreen] = useState(false);
  const [selectedBookmarkLivePreview, setSelectedBookmarkLivePreview] =
    useState<BookmarkExtractPreview | null>(null);
  const [selectedBookmarkPreviewError, setSelectedBookmarkPreviewError] =
    useState<string | null>(null);
  const [selectedBookmarkPreviewNotice, setSelectedBookmarkPreviewNotice] =
    useState<string | null>(null);
  const [isLoadingSelectedBookmarkPreview, setIsLoadingSelectedBookmarkPreview] =
    useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);
  const [isEmptyingBookmarkTrash, setIsEmptyingBookmarkTrash] = useState(false);
  const [isLoadingBookmarkPreview, setIsLoadingBookmarkPreview] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isSavingQuickFolder, setIsSavingQuickFolder] = useState(false);
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [isReorderingFolders, setIsReorderingFolders] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const bookmarkDetailRequestIdRef = useRef(0);
  const bookmarkPreviewRequestIdRef = useRef(0);
  const selectedBookmarkPreviewCachesRef = useRef(createBookmarkDetailPreviewCaches());
  const recommendationRequestIdRef = useRef(0);
  const memoWorkspaceRequestIdRef = useRef(0);
  const memoPageCacheRef = useRef<Map<string, MemoPage>>(new Map());
  const hiddenMemoPageCacheRef = useRef<MemoPageCacheEntry | null>(null);
  const memoWorkspaceMetadataRef = useRef<MemoWorkspaceMetadata | null>(null);
  const memoWorkspaceMetadataPromiseRef = useRef<Promise<MemoWorkspaceMetadata> | null>(null);
  const pendingLockedMemoIdRef = useRef<string | null>(null);
  const bookmarkListElementRef = useRef<HTMLUListElement | null>(null);
  const preloadingBookmarkAssetIdsRef = useRef<Set<string>>(new Set());
  const deferredBookmarkAssetPreloadTimerRef =
    useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const tagsLoadPromiseRef = useRef<Promise<Tag[]> | null>(null);

  useEffect(() => {
    const rootElement = globalThis.document?.documentElement;

    if (rootElement) {
      rootElement.dataset.appTheme = appTheme;
    }
    storeAppTheme(appTheme);

    return () => {
      if (rootElement?.dataset.appTheme === appTheme) {
        delete rootElement.dataset.appTheme;
      }
    };
  }, [appTheme]);

  function closeOpenMenus() {
    setOpenBookmarkActionMenuId(null);
    setIsBookmarkDetailActionMenuOpen(false);
    setIsBookmarkSortMenuOpen(false);
    setIsBookmarkViewMenuOpen(false);
    setOpenFolderActionMenuId(null);
    setOpenTagActionMenuId(null);
    setIsQuickActionsMenuOpen(false);
    setIsMobileHeaderMenuOpen(false);
  }

  function replaceMemoFolderFilterId(nextFolderId: string | null) {
    memoFolderFilterIdRef.current = nextFolderId;
    setMemoFolderFilterId(nextFolderId);
  }

  function updateMemoFolderFilterId(
    getNextFolderId: (currentFolderId: string | null) => string | null
  ) {
    setMemoFolderFilterId((currentFolderId) => {
      const nextFolderId = getNextFolderId(currentFolderId);
      memoFolderFilterIdRef.current = nextFolderId;
      return nextFolderId;
    });
  }

  function toggleAppTheme() {
    setAppTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  function openHomePage() {
    preloadDashboardPanelChunk("home");
    setActiveDashboardView("home");
    setSelectedBookmark(null);
    setBookmarkDetailDisplayMode("rail");
    setIsBookmarkPreviewFullscreen(false);
    closeOpenMenus();
  }

  function openBookmarkWorkspace() {
    preloadDashboardPanelChunk("bookmarks");
    setActiveDashboardView("bookmarks");
    requestDesktopRecommendationsIfNeeded();
    requestTagsIfNeeded();
    if (!hasLoadedFullBookmarkInventory) {
      void refreshDashboardData(appliedBookmarkSearch, "bookmarks");
    }
    closeOpenMenus();
  }

  function openMemoWorkspace() {
    preloadDashboardPanelChunk("memos");
    setActiveDashboardView("memos");
    setSelectedBookmark(null);
    setBookmarkDetailDisplayMode("rail");
    setIsBookmarkPreviewFullscreen(false);
    closeOpenMenus();
  }

  function beginMemoCreate() {
    preloadDashboardDialogChunk("memoComposer");
    preloadDashboardPanelChunk("memos");
    const nextDraft = createEmptyMemoDraft();
    const currentMemoFolderFilterId = memoFolderFilterIdRef.current;
    if (currentMemoFolderFilterId && currentMemoFolderFilterId !== "unfiled") {
      nextDraft.folderId = currentMemoFolderFilterId;
    }

    setActiveDashboardView("memos");
    setEditingMemo(null);
    replaceMemoDraft(nextDraft);
    setInitialMemoDraft(nextDraft);
    clearPendingMemoImageUploads();
    setIsMemoComposerOpen(true);
    setErrorMessage(null);
    setStatusMessage(null);
    closeOpenMenus();
  }

  function openMemoEditor(memo: Memo) {
    preloadDashboardDialogChunk("memoComposer");
    preloadDashboardPanelChunk("memos");
    const nextDraft = createMemoDraftFromMemo(memo);
    setActiveDashboardView("memos");
    setEditingMemo(memo);
    replaceMemoDraft(nextDraft);
    setInitialMemoDraft(nextDraft);
    clearPendingMemoImageUploads();
    setIsMemoComposerOpen(true);
    setErrorMessage(null);
    setStatusMessage(null);
  }

  async function openLockedMemoEditor(memoId: string) {
    try {
      setErrorMessage(null);
      const loadedMemo = await loadMemo(memoId);
      pendingLockedMemoIdRef.current = null;
      openMemoEditor(loadedMemo);
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "잠금 메모를 불러오지 못했습니다."
        );
      });
    }
  }

  async function beginMemoEdit(memo: Memo) {
    if (memo.isLocked) {
      pendingLockedMemoIdRef.current = memo.id;
      openMemoLockPrompt("unlock");
      return;
    }

    try {
      setErrorMessage(null);
      const loadedMemo = await loadMemo(memo.id);
      openMemoEditor(loadedMemo);
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "메모 상세 정보를 불러오지 못했습니다."
        );
      });
    }
  }

  function invalidateMemoWorkspaceRequests() {
    memoWorkspaceRequestIdRef.current += 1;
  }

  const queueBookmarkAssetPreload = (
    bookmarksToLoad: Bookmark[],
    currentAssetsByBookmarkId: Record<string, BookmarkAsset[]>,
    dashboardView: "home" | "bookmarks" =
      activeDashboardView === "memos" ? "bookmarks" : activeDashboardView
  ) => {
    queueDashboardBookmarkAssetPreload({
      bookmarksToLoad,
      currentAssetsByBookmarkId,
      dashboardView,
      bookmarkViewMode,
      shouldUseCompactMobileCards,
      preloadingBookmarkAssetIds: preloadingBookmarkAssetIdsRef.current,
      deferredBookmarkAssetPreloadTimerRef,
      loadBookmarkAssetsByBookmarks,
      loadBookmarkAssets,
      setBookmarkAssetsByBookmarkId
    });
  };

  function resetBookmarkListPagination(nextPageSize = bookmarkListPageSize) {
    setBookmarkListVisibleCount(nextPageSize);
    setBookmarkListTotalCount(null);
    setBookmarkListNextOffset(null);
  }

  function getBookmarkPageNextOffset(page: BookmarkPage) {
    if (!page.pagination?.hasMore) {
      return null;
    }

    return page.pagination.offset + page.pagination.limit;
  }

  function applyBookmarkListPaginationPage(page: BookmarkPage, loadedBookmarkCount = page.bookmarks.length) {
    setBookmarkListVisibleCount(loadedBookmarkCount);
    setBookmarkListTotalCount(page.pagination?.total ?? loadedBookmarkCount);
    setBookmarkListNextOffset(getBookmarkPageNextOffset(page));
  }

  async function loadBookmarkListPage(
    search: BookmarkSearchDraft,
    pageSize: BookmarkPageSize,
    offset: number,
    options: { trashMode?: "trashed" } = {}
  ) {
    const normalizedSearch = normalizeBookmarkSearchDraft(search);
    const page = await loadBookmarkPage({
      ...normalizedSearch,
      trashMode: options.trashMode,
      limit: pageSize,
      offset
    });

    return {
      normalizedSearch,
      page
    };
  }

  async function handleBookmarkPageSizeChange(value: string) {
    const nextPageSize = Number(value) as BookmarkPageSize;
    if (!bookmarkPageSizeOptions.includes(nextPageSize)) {
      return;
    }

    setBookmarkListPageSize(nextPageSize);

    if (activeDashboardView !== "bookmarks" || folderOverviewSpecialFilter === "unfiled") {
      resetBookmarkListPagination(nextPageSize);
      return;
    }

    try {
      setErrorMessage(null);
      setIsLoadingDashboard(true);
      const { normalizedSearch, page } =
        folderOverviewSpecialFilter === "trash"
          ? await loadBookmarkListPage(
              {
                ...emptyBookmarkSearchDraft,
                sort: appliedBookmarkSearch.sort
              },
              nextPageSize,
              0,
              { trashMode: "trashed" }
            )
          : await loadBookmarkListPage(appliedBookmarkSearch, nextPageSize, 0);

      startTransition(() => {
        setBookmarks(page.bookmarks);
        if (folderOverviewSpecialFilter === "trash") {
          setTrashedBookmarks(page.bookmarks);
        }
        setSelectedBookmark(null);
        setBookmarkSearchDraft(normalizedSearch);
        setAppliedBookmarkSearch(normalizedSearch);
        applyBookmarkListPaginationPage(page);
      });

      queueBookmarkAssetPreload(page.bookmarks, bookmarkAssetsByBookmarkId, "bookmarks");
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "북마크 보기 개수를 바꾸지 못했습니다."
        );
      });
      resetBookmarkListPagination(nextPageSize);
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function handleBookmarkListLoadMore() {
    if (bookmarkListNextOffset !== null) {
      try {
        setErrorMessage(null);
        setIsLoadingMoreBookmarks(true);
        const { page } =
          folderOverviewSpecialFilter === "trash"
            ? await loadBookmarkListPage(
                {
                  ...emptyBookmarkSearchDraft,
                  sort: appliedBookmarkSearch.sort
                },
                bookmarkListPageSize,
                bookmarkListNextOffset,
                { trashMode: "trashed" }
              )
            : await loadBookmarkListPage(
                appliedBookmarkSearch,
                bookmarkListPageSize,
                bookmarkListNextOffset
              );
        const existingBookmarkIds = new Set(bookmarks.map((bookmark) => bookmark.id));
        const appendedBookmarks = page.bookmarks.filter(
          (bookmark) => !existingBookmarkIds.has(bookmark.id)
        );
        const nextBookmarks = [...bookmarks, ...appendedBookmarks];

        startTransition(() => {
          setBookmarks(nextBookmarks);
          if (folderOverviewSpecialFilter === "trash") {
            setTrashedBookmarks(nextBookmarks);
          }
          applyBookmarkListPaginationPage(page, nextBookmarks.length);
        });

        queueBookmarkAssetPreload(nextBookmarks, bookmarkAssetsByBookmarkId, "bookmarks");
      } catch (error) {
        startTransition(() => {
          setErrorMessage(
            error instanceof Error ? error.message : "추가 북마크를 불러오지 못했습니다."
          );
        });
      } finally {
        setIsLoadingMoreBookmarks(false);
      }
      return;
    }

    const nextVisibleCount = Math.min(
      visibleBookmarks.length,
      bookmarkListVisibleCount + bookmarkListPageSize
    );
    setBookmarkListVisibleCount(nextVisibleCount);
    queueBookmarkAssetPreload(
      visibleBookmarks.slice(0, nextVisibleCount),
      bookmarkAssetsByBookmarkId,
      "bookmarks"
    );
  }

  function loadBookmarkCollections(search: BookmarkSearchDraft) {
    return loadDashboardBookmarkCollections({
      search,
      loadBookmarks
    });
  }

  function loadDashboardBookmarkData(
    search: BookmarkSearchDraft,
    dashboardView: DashboardView = activeDashboardView
  ) {
    return loadDashboardBookmarkDataFromSources({
      activeDashboardView: dashboardView,
      search,
      loadBookmarks,
      loadBookmarkPage,
      loadBookmarkCounts,
      onHomeFallback: () => {
        setActiveDashboardView("bookmarks");
        requestDesktopRecommendationsIfNeeded();
      }
    });
  }

  async function refreshBookmarkCounts() {
    try {
      const nextBookmarkCounts = await loadBookmarkCounts();
      startTransition(() => {
        setBookmarkCounts(nextBookmarkCounts);
      });
    } catch {
      startTransition(() => {
        setBookmarkCounts(null);
      });
    }
  }

  async function fetchTagsOnce() {
    if (hasLoadedTags) {
      return tags;
    }

    if (!tagsLoadPromiseRef.current) {
      tagsLoadPromiseRef.current = loadTags().finally(() => {
        tagsLoadPromiseRef.current = null;
      });
    }

    return tagsLoadPromiseRef.current;
  }

  function requestTagsIfNeeded() {
    if (hasLoadedTags) {
      return;
    }

    void fetchTagsOnce()
      .then((nextTags) => {
        startTransition(() => {
          setTags(nextTags);
          setHasLoadedTags(true);
        });
      })
      .catch(() => {
        startTransition(() => {
          setErrorMessage("태그를 불러오지 못했습니다.");
        });
      });
  }

  async function refreshDashboardData(
    search = appliedBookmarkSearch,
    dashboardView: DashboardView = activeDashboardView
  ) {
    return measureAsyncPerformance("dashboard:data-refresh", async () => {
      setIsLoadingDashboard(true);
      const normalizedSearch = normalizeBookmarkSearchDraft(search);
      const shouldLoadTagsWithDashboard =
        dashboardView !== "home" || hasActiveBookmarkSearch(normalizedSearch);

      try {
        const [
          {
            visibleBookmarks: nextBookmarks,
            inventoryBookmarks: nextBookmarkInventory,
            bookmarkCounts: nextBookmarkCounts,
            homeFavoriteBookmarks: nextHomeFavoriteBookmarks,
            hasFullInventory,
            usesFullInventoryFallback
          },
          nextFolders,
          nextTags
        ] = await Promise.all([
          loadDashboardBookmarkData(search, dashboardView),
          loadFolders(),
          shouldLoadTagsWithDashboard ? fetchTagsOnce() : Promise.resolve(null)
        ]);

        startTransition(() => {
          setBookmarks(nextBookmarks);
          setBookmarkInventory(nextBookmarkInventory);
          setHasLoadedFullBookmarkInventory(hasFullInventory);
          setBookmarkCounts(nextBookmarkCounts);
          setHomeFavoriteBookmarks(nextHomeFavoriteBookmarks);
          if (usesFullInventoryFallback) {
            setActiveDashboardView("bookmarks");
          }
          setSelectedBookmark((currentSelectedBookmark) => {
            if (!currentSelectedBookmark) {
              return null;
            }

            return (
              nextBookmarks.find((bookmark) => bookmark.id === currentSelectedBookmark.id) ??
              currentSelectedBookmark
            );
          });
          setFolders(nextFolders);
          if (nextTags) {
            setTags(nextTags);
            setHasLoadedTags(true);
          }
        });

        if (usesFullInventoryFallback && !shouldLoadTagsWithDashboard) {
          requestTagsIfNeeded();
        }

        queueBookmarkAssetPreload(
          dashboardView === "home"
            ? (nextHomeFavoriteBookmarks ?? nextBookmarkInventory)
            : nextBookmarks.slice(0, bookmarkListPageSize),
          bookmarkAssetsByBookmarkId,
          dashboardView
        );
      } catch {
        startTransition(() => {
          setBookmarks([]);
          setBookmarkInventory([]);
          setHasLoadedFullBookmarkInventory(false);
          setBookmarkCounts(null);
          setHomeFavoriteBookmarks(null);
          setTrashedBookmarks([]);
          setBookmarkAssetsByBookmarkId({});
          setSelectedBookmark(null);
          setFolders([]);
          setTags([]);
          setHasLoadedTags(false);
          setRecommendations(emptyBookmarkRecommendations);
          setHasLoadedRecommendations(false);
          setExtensionTokens([]);
          setErrorMessage("대시보드 데이터를 불러오지 못했습니다.");
        });
      } finally {
        setIsLoadingDashboard(false);
      }
    });
  }

  async function refreshRecommendations() {
    const requestId = recommendationRequestIdRef.current + 1;
    recommendationRequestIdRef.current = requestId;
    setIsLoadingRecommendations(true);

    try {
      const nextRecommendations = await loadRecommendations();
      if (recommendationRequestIdRef.current !== requestId) {
        return;
      }

      startTransition(() => {
        setRecommendations(nextRecommendations);
        setHasLoadedRecommendations(true);
      });
    } catch {
      if (recommendationRequestIdRef.current !== requestId) {
        return;
      }

      startTransition(() => {
        setRecommendations(emptyBookmarkRecommendations);
        setHasLoadedRecommendations(true);
        setErrorMessage("추천을 불러오지 못했습니다.");
      });
    } finally {
      if (recommendationRequestIdRef.current === requestId) {
        setIsLoadingRecommendations(false);
      }
    }
  }

  function requestRecommendationsIfNeeded() {
    if (hasLoadedRecommendations || isLoadingRecommendations) {
      return;
    }

    void refreshRecommendations();
  }

  function requestDesktopRecommendationsIfNeeded() {
    if (isMobileSearchViewport) {
      return;
    }

    requestRecommendationsIfNeeded();
  }

  function createCurrentMemoPageOptions(options: {
    folderFilterId?: string | null;
    includeHidden?: boolean;
    tagFilterId?: string | null;
  } = {}): MemoPageLoadOptions {
    const nextMemoFolderFilterId =
      "folderFilterId" in options ? options.folderFilterId ?? null : memoFolderFilterId;
    const nextMemoTagFilterId =
      "tagFilterId" in options ? options.tagFilterId ?? null : memoTagFilterId;
    return {
      query: debouncedMemoSearchQuery,
      folderId:
        nextMemoFolderFilterId === null
          ? undefined
          : nextMemoFolderFilterId === "unfiled"
            ? null
            : nextMemoFolderFilterId,
      tagId: nextMemoTagFilterId ?? undefined,
      favorite: memoFavoriteOnly ? true : undefined,
      includeHidden: options.includeHidden ? true : undefined,
      includeDescendantFolders:
        typeof nextMemoFolderFilterId === "string" && nextMemoFolderFilterId !== "unfiled"
          ? true
          : undefined,
      limit: MEMO_PAGE_SIZE,
      offset: 0
    };
  }

  function getMemoPageTotalCount(memoPage: MemoPage) {
    return memoPage.pagination?.total ?? memoPage.memos.length;
  }

  function applyMemoPage(memoPage: MemoPage) {
    setMemos(memoPage.memos);
    setMemoTotalCount(getMemoPageTotalCount(memoPage));
  }

  function cacheMemoPage(cacheKey: string, memoPage: MemoPage) {
    const cache = memoPageCacheRef.current;
    if (cache.has(cacheKey)) {
      cache.delete(cacheKey);
    }
    cache.set(cacheKey, memoPage);

    while (cache.size > MEMO_PAGE_CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      cache.delete(oldestKey);
    }
  }

  function clearMemoPageCaches() {
    memoPageCacheRef.current.clear();
    hiddenMemoPageCacheRef.current = null;
  }

  function applyCachedMemoPageOrLoading(options: MemoPageLoadOptions) {
    const cachedMemoPage = memoPageCacheRef.current.get(createMemoPageCacheKey(options));

    if (cachedMemoPage) {
      applyMemoPage(cachedMemoPage);
    } else {
      setMemos([]);
      setMemoTotalCount(null);
    }

    setIsLoadingMemos(true);
  }

  function clearMemoWorkspaceMetadataCache() {
    memoWorkspaceMetadataRef.current = null;
    memoWorkspaceMetadataPromiseRef.current = null;
  }

  function replaceMemoWorkspaceFolders(nextFolders: MemoFolder[]) {
    if (memoWorkspaceMetadataRef.current) {
      memoWorkspaceMetadataRef.current = {
        ...memoWorkspaceMetadataRef.current,
        folders: nextFolders
      };
    }
    setMemoFolders(nextFolders);
  }

  function updateMemoWorkspaceFolders(
    updater: (currentFolders: MemoFolder[]) => MemoFolder[]
  ) {
    if (memoWorkspaceMetadataRef.current) {
      memoWorkspaceMetadataRef.current = {
        ...memoWorkspaceMetadataRef.current,
        folders: updater(memoWorkspaceMetadataRef.current.folders)
      };
    }
    setMemoFolders(updater);
  }

  function replaceMemoWorkspaceTags(nextTags: MemoTag[]) {
    if (memoWorkspaceMetadataRef.current) {
      memoWorkspaceMetadataRef.current = {
        ...memoWorkspaceMetadataRef.current,
        tags: nextTags
      };
    }
    setMemoTags(nextTags);
  }

  function updateMemoWorkspaceTags(updater: (currentTags: MemoTag[]) => MemoTag[]) {
    if (memoWorkspaceMetadataRef.current) {
      memoWorkspaceMetadataRef.current = {
        ...memoWorkspaceMetadataRef.current,
        tags: updater(memoWorkspaceMetadataRef.current.tags)
      };
    }
    setMemoTags(updater);
  }

  function loadMemoWorkspaceMetadata() {
    if (memoWorkspaceMetadataRef.current) {
      return Promise.resolve(memoWorkspaceMetadataRef.current);
    }

    if (memoWorkspaceMetadataPromiseRef.current) {
      return memoWorkspaceMetadataPromiseRef.current;
    }

    const metadataPromise = Promise.all([
      loadMemoLockStatus(),
      loadMemoFolders(),
      loadMemoTags()
    ])
      .then(([lockStatus, folders, tags]) => {
        const metadata = {
          lockStatus,
          folders,
          tags
        };
        memoWorkspaceMetadataRef.current = metadata;
        return metadata;
      })
      .finally(() => {
        memoWorkspaceMetadataPromiseRef.current = null;
      });

    memoWorkspaceMetadataPromiseRef.current = metadataPromise;
    return metadataPromise;
  }

  async function refreshMemoWorkspace(options: {
    folderFilterId?: string | null;
    tagFilterId?: string | null;
  } = {}) {
    const requestId = memoWorkspaceRequestIdRef.current + 1;
    memoWorkspaceRequestIdRef.current = requestId;
    const shouldLoadMemoMetadata = memoWorkspaceMetadataRef.current === null;
    const memoPageOptions = createCurrentMemoPageOptions({
      ...options,
      includeHidden: showHiddenMemos
    });
    const memoPageCacheKey = createMemoPageCacheKey(memoPageOptions);
    applyCachedMemoPageOrLoading(memoPageOptions);

    try {
      const memoMetadataPromise = shouldLoadMemoMetadata
        ? loadMemoWorkspaceMetadata()
        : Promise.resolve(null);
      const hiddenMemoPageOptions = showHiddenMemos
        ? null
        : createCurrentMemoPageOptions({
            ...options,
            includeHidden: true
          });
      const hiddenMemoPageCacheKey = hiddenMemoPageOptions
        ? createMemoPageCacheKey(hiddenMemoPageOptions)
        : null;
      if (hiddenMemoPageOptions && hiddenMemoPageCacheRef.current?.key !== hiddenMemoPageCacheKey) {
        void loadMemoPage(hiddenMemoPageOptions)
          .then((hiddenMemoPage) => {
            if (memoWorkspaceRequestIdRef.current !== requestId || !hiddenMemoPageCacheKey) {
              return;
            }

            hiddenMemoPageCacheRef.current = {
              key: hiddenMemoPageCacheKey,
              page: hiddenMemoPage
            };
            cacheMemoPage(hiddenMemoPageCacheKey, hiddenMemoPage);
          })
          .catch(() => {
            if (memoWorkspaceRequestIdRef.current === requestId) {
              hiddenMemoPageCacheRef.current = null;
            }
          });
      }
      const [memoPage, nextMemoMetadata] = await Promise.all([
        loadMemoPage(memoPageOptions),
        memoMetadataPromise
      ]);

      if (memoWorkspaceRequestIdRef.current !== requestId) {
        return;
      }

      cacheMemoPage(memoPageCacheKey, memoPage);
      applyMemoPage(memoPage);
      if (nextMemoMetadata) {
        setMemoFolders(nextMemoMetadata.folders);
        setMemoTags(nextMemoMetadata.tags);
        setMemoLockStatus(nextMemoMetadata.lockStatus);
      }
      if (showHiddenMemos) {
        hiddenMemoPageCacheRef.current = {
          key: memoPageCacheKey,
          page: memoPage
        };
      }
    } catch (error) {
      if (memoWorkspaceRequestIdRef.current !== requestId) {
        return;
      }

      startTransition(() => {
        setMemos([]);
        setMemoTotalCount(null);
        if (shouldLoadMemoMetadata) {
          clearMemoWorkspaceMetadataCache();
          setMemoFolders([]);
          setMemoTags([]);
          setMemoLockStatus(null);
        }
        setErrorMessage(
          error instanceof Error ? error.message : "메모를 불러오지 못했습니다."
        );
      });
    } finally {
      if (memoWorkspaceRequestIdRef.current === requestId) {
        setIsLoadingMemos(false);
      }
    }
  }

  function openMemoLockPrompt(mode: MemoLockPromptMode) {
    preloadDashboardDialogChunk("memoLock");
    setMemoLockError(null);
    setMemoLockPromptMode(mode);
  }

  function handleToggleHiddenMemos() {
    const nextValue = !showHiddenMemos;

    if (nextValue) {
      const hiddenMemoPageOptions = createCurrentMemoPageOptions({ includeHidden: true });
      const cachedHiddenMemoPage = hiddenMemoPageCacheRef.current;
      if (cachedHiddenMemoPage?.key === createMemoPageCacheKey(hiddenMemoPageOptions)) {
        setMemos(cachedHiddenMemoPage.page.memos);
        setMemoTotalCount(
          cachedHiddenMemoPage.page.pagination?.total ?? cachedHiddenMemoPage.page.memos.length
        );
      }
    } else {
      const visibleMemos = memos.filter((memo) => memo.isHidden !== true);
      setMemos(visibleMemos);
      setMemoTotalCount(visibleMemos.length);
    }

    if (!nextValue && editingMemo?.isHidden) {
      setEditingMemo(null);
      setIsMemoComposerOpen(false);
      replaceMemoDraft(createEmptyMemoDraft());
    }

    setShowHiddenMemos(nextValue);
  }

  function handleToggleHiddenMemoFolders() {
    const nextValue = !showHiddenMemoFolders;

    if (
      !nextValue &&
      memoFolderFilterId &&
      memoFolderFilterId !== "unfiled" &&
      hiddenMemoFolderIds.has(memoFolderFilterId)
    ) {
      replaceMemoFolderFilterId(DEFAULT_MEMO_FOLDER_FILTER_ID);
    }

    if (!nextValue && editingMemo?.folderId && hiddenMemoFolderIds.has(editingMemo.folderId)) {
      setEditingMemo(null);
      setIsMemoComposerOpen(false);
      replaceMemoDraft(createEmptyMemoDraft());
    }

    setShowHiddenMemoFolders(nextValue);
  }

  async function handleMemoLockSubmit(password: string) {
    if (!memoLockPromptMode) {
      return;
    }
    const pendingLockedMemoId = pendingLockedMemoIdRef.current;

    try {
      setIsMemoLockBusy(true);
      setMemoLockError(null);
      if (pendingLockedMemoId) {
        await unlockLockedMemo(pendingLockedMemoId, password);
        startTransition(() => {
          setMemoLockPromptMode(null);
        });
        await openLockedMemoEditor(pendingLockedMemoId);
        return;
      }

      const response =
        memoLockPromptMode === "setup"
          ? await setupMemoLock(password)
          : await unlockMemoLock(password);

      startTransition(() => {
        setMemoLockStatus(response.status);
        setMemoLockPromptMode(null);
      });
      clearMemoPageCaches();
      await refreshMemoWorkspace();
    } catch (error) {
      startTransition(() => {
        setMemoLockError(
          error instanceof Error ? error.message : "메모 잠금 요청을 처리하지 못했습니다."
        );
      });
    } finally {
      setIsMemoLockBusy(false);
    }
  }

  async function handleMemoDelete(memo: Memo) {
    const shouldDelete = globalThis.confirm?.(`"${memo.title}" 메모를 삭제할까요?`) ?? false;
    if (!shouldDelete) {
      return false;
    }

    try {
      setErrorMessage(null);
      await deleteMemo(memo.id);
      clearMemoPageCaches();
      startTransition(() => {
        setMemos((currentMemos) => currentMemos.filter((item) => item.id !== memo.id));
        setMemoTotalCount((currentCount) =>
          typeof currentCount === "number" ? Math.max(0, currentCount - 1) : currentCount
        );
        setStatusMessage("메모를 삭제했습니다.");
      });
      return true;
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "메모를 삭제하지 못했습니다."
        );
      });
      return false;
    }
  }

  async function handleMemoComposerDelete() {
    if (!editingMemo) {
      return;
    }

    const didDelete = await handleMemoDelete(editingMemo);
    if (didDelete) {
      closeMemoComposer();
    }
  }

  function replaceMemoDraft(nextDraft: MemoComposerDraft) {
    memoDraftRef.current = nextDraft;
    setMemoDraft(nextDraft);
  }

  function updateMemoDraft(nextValues: Partial<MemoComposerDraft>) {
    const nextDraft = {
      ...memoDraftRef.current,
      ...nextValues
    };
    memoDraftRef.current = nextDraft;
    setMemoDraft(nextDraft);
  }

  function updateMemoDraftContent(
    nextValues: Pick<MemoComposerDraft, "contentJson" | "contentText">
  ) {
    memoDraftRef.current = {
      ...memoDraftRef.current,
      ...nextValues
    };
  }

  function clearPendingMemoImageUploads() {
    pendingMemoImageUploadsRef.current.forEach((upload) =>
      revokePendingMemoImageUrl(upload.contentUrl)
    );
    pendingMemoImageUploadsRef.current = [];
    setPendingMemoImageUploads([]);
  }

  function hasMemoComposerChanges() {
    const currentMemoDraft = memoDraftRef.current;
    const referencedPendingUploads = getReferencedMemoImageUploads(
      pendingMemoImageUploadsRef.current,
      currentMemoDraft.contentJson
    );

    return (
      !areMemoDraftsEqual(currentMemoDraft, initialMemoDraft) ||
      referencedPendingUploads.length > 0
    );
  }

  function closeMemoComposer() {
    setIsMemoComposerOpen(false);
    setEditingMemo(null);
    const emptyMemoDraft = createEmptyMemoDraft();
    replaceMemoDraft(emptyMemoDraft);
    setInitialMemoDraft(emptyMemoDraft);
    clearPendingMemoImageUploads();
    setIsSavingMemo(false);
  }

  function requestCloseMemoComposer() {
    if (
      hasMemoComposerChanges() &&
      globalThis.confirm &&
      !globalThis.confirm("저장하지 않은 메모 변경 사항이 있습니다. 닫을까요?")
    ) {
      return false;
    }

    closeMemoComposer();
    return true;
  }

  async function handleMemoImageUpload(file: File): Promise<MemoAsset> {
    if (!editingMemo) {
      const [preparedFile] = await prepareMemoImageUploadFiles([file]);
      if (!preparedFile) {
        throw new Error("지원하지 않는 이미지 형식입니다.");
      }

      const id = createPendingMemoImageId();
      const pendingUpload = {
        id,
        preparedFile,
        contentUrl: createPendingMemoImageUrl(preparedFile.file, id)
      };
      pendingMemoImageUploadsRef.current = [
        ...pendingMemoImageUploadsRef.current,
        pendingUpload
      ];
      setPendingMemoImageUploads(pendingMemoImageUploadsRef.current);
      return createPendingMemoAsset(pendingUpload);
    }

    const memoId = editingMemo.id;
    const asset = await uploadMemoAsset(memoId, file);
    latestMemoCoverAssetByMemoIdRef.current[memoId] = asset;
    clearMemoPageCaches();

    startTransition(() => {
      const applyAssetCount = (memo: Memo): Memo =>
        memo.id === memoId
          ? {
              ...memo,
              assetCount: memo.assetCount + 1,
              coverAsset: asset
            }
          : memo;

      setMemos((currentMemos) => currentMemos.map(applyAssetCount));
      setEditingMemo((currentMemo) => (currentMemo ? applyAssetCount(currentMemo) : currentMemo));
    });

    return asset;
  }

  async function handleMemoTagCreate(input: { name: string; color?: string | null }) {
    const createdTag = await createMemoTag({
      name: input.name.trim(),
      color: input.color ?? null
    });

    startTransition(() => {
      updateMemoWorkspaceTags((currentTags) =>
        currentTags.some((tag) => tag.id === createdTag.id)
          ? currentTags.map((tag) => (tag.id === createdTag.id ? createdTag : tag))
          : [...currentTags, createdTag]
      );
    });

    return createdTag;
  }

  async function reconcileMemoAssetsWithContent(
    memo: Memo,
    contentJson: MemoRichContent,
    shouldLoadAssets: boolean
  ) {
    if (!shouldLoadAssets) {
      return applyMemoContentAssetPreview(memo, []);
    }

    const memoAssets = await loadMemoAssets(memo.id);
    const referencedAssets = getReferencedMemoAssets(memoAssets, contentJson);
    const referencedAssetIds = new Set(referencedAssets.map((asset) => asset.id));
    const unreferencedAssets = memoAssets.filter((asset) => !referencedAssetIds.has(asset.id));

    await Promise.all(
      unreferencedAssets.map((asset) => deleteMemoAsset(memo.id, asset.id))
    );

    return applyMemoContentAssetPreview(memo, referencedAssets);
  }

  async function handleMemoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingMemo(true);
    setErrorMessage(null);

    const currentMemoDraft = memoDraftRef.current;
    const pendingUploads = pendingMemoImageUploadsRef.current;
    const referencedPendingUploads = getReferencedMemoImageUploads(
      pendingUploads,
      currentMemoDraft.contentJson
    );
    const lockPassword = currentMemoDraft.lockPassword.trim();
    const input = {
      title: currentMemoDraft.title.trim() || "Untitled",
      folderId: currentMemoDraft.folderId || null,
      tagIds: currentMemoDraft.tagIds,
      contentJson: editingMemo
        ? currentMemoDraft.contentJson
        : removePendingMemoImages(currentMemoDraft.contentJson, referencedPendingUploads),
      contentText: currentMemoDraft.contentText,
      isFavorite: currentMemoDraft.isFavorite,
      isHidden: currentMemoDraft.isHidden,
      isLocked: currentMemoDraft.isLocked,
      ...(currentMemoDraft.isLocked && lockPassword ? { lockPassword } : {}),
      memoColor: currentMemoDraft.memoColor || null
    };

    try {
      let savedMemo = editingMemo
        ? await updateMemo(editingMemo.id, input)
        : await createMemo(input);
      const uploadedMemoAssets: MemoAsset[] = [];

      if (!editingMemo && referencedPendingUploads.length > 0) {
        const imageReplacements = new Map<string, string>();

        for (const pendingUpload of referencedPendingUploads) {
          const asset = await uploadPreparedMemoAsset(
            savedMemo.id,
            pendingUpload.preparedFile
          );
          imageReplacements.set(pendingUpload.contentUrl, asset.contentUrl);
          uploadedMemoAssets.push(asset);
        }

        savedMemo = await updateMemo(savedMemo.id, {
          ...input,
          contentJson: replacePendingMemoImages(currentMemoDraft.contentJson, imageReplacements),
          contentText: currentMemoDraft.contentText
        });
      }

      if (editingMemo) {
        savedMemo = await reconcileMemoAssetsWithContent(
          savedMemo,
          currentMemoDraft.contentJson,
          savedMemo.assetCount > 0 ||
            editingMemo.assetCount > 0 ||
            Boolean(latestMemoCoverAssetByMemoIdRef.current[editingMemo.id])
        );
        delete latestMemoCoverAssetByMemoIdRef.current[editingMemo.id];
      } else {
        savedMemo = applyMemoContentAssetPreview(savedMemo, uploadedMemoAssets);
      }

      const shouldCloseLockedMemo = savedMemo.isLocked;
      const visibleSavedMemo = shouldCloseLockedMemo
        ? createLockedMemoPreview(savedMemo)
        : savedMemo;
      const nextMemoDraft = shouldCloseLockedMemo
        ? createEmptyMemoDraft()
        : createMemoDraftFromMemo(savedMemo);
      clearMemoPageCaches();

      startTransition(() => {
        setMemos((currentMemos) => {
          const memoIndex = currentMemos.findIndex((memo) => memo.id === visibleSavedMemo.id);
          if (memoIndex < 0) {
            return [visibleSavedMemo, ...currentMemos];
          }

          return currentMemos.map((memo) =>
            memo.id === visibleSavedMemo.id ? visibleSavedMemo : memo
          );
        });
        setEditingMemo(shouldCloseLockedMemo ? null : savedMemo);
        replaceMemoDraft(nextMemoDraft);
        setInitialMemoDraft(nextMemoDraft);
        setIsMemoComposerOpen(!shouldCloseLockedMemo);
        setMemoTotalCount((currentCount) => {
          if (editingMemo || typeof currentCount !== "number") {
            return currentCount;
          }

          return currentCount + 1;
        });
        setStatusMessage(editingMemo ? "메모를 수정했습니다." : "메모를 저장했습니다.");
      });
      clearPendingMemoImageUploads();
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "메모를 저장하지 못했습니다."
        );
      });
    } finally {
      setIsSavingMemo(false);
    }
  }

  useEffect(() => {
    writeDashboardViewToUrl(activeDashboardView);
  }, [activeDashboardView]);

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timer = globalThis.setTimeout(() => {
      setStatusMessage(null);
    }, STATUS_MESSAGE_DISMISS_MS);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [statusMessage]);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(MEMO_VIEW_MODE_STORAGE_KEY, memoViewMode);
    } catch {
      // Memo view mode is a convenience preference; storage failures should not block use.
    }
  }, [memoViewMode]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setDebouncedMemoSearchQuery(memoSearchQuery);
    }, MEMO_SEARCH_DEBOUNCE_MS);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [memoSearchQuery]);

  useEffect(() => {
    if (sessionState.status !== "authenticated" || activeDashboardView !== "memos") {
      invalidateMemoWorkspaceRequests();
      setIsLoadingMemos(false);
      return;
    }

    void refreshMemoWorkspace();

    return () => {
      invalidateMemoWorkspaceRequests();
    };
  }, [
    activeDashboardView,
    debouncedMemoSearchQuery,
    memoFavoriteOnly,
    memoFolderFilterId,
    memoTagFilterId,
    showHiddenMemos,
    sessionState.status
  ]);

  useEffect(() => {
    const ownerDocument = globalThis.document;
    if (!ownerDocument) {
      return;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-open-menu-shell="true"]')) {
        return;
      }

      closeOpenMenus();
    }

    ownerDocument.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      ownerDocument.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (deferredBookmarkAssetPreloadTimerRef.current) {
        globalThis.clearTimeout(deferredBookmarkAssetPreloadTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (initialUser) {
      preloadDashboardCoreServiceModules();
      if (activeDashboardView === "memos") {
        startTransition(() => {
          setSessionState({
            status: "authenticated",
            user: initialUser
          });
        });

        return () => {
          cancelled = true;
        };
      }

      void refreshDashboardData().finally(() => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSessionState({
            status: "authenticated",
            user: initialUser
          });
        });
      });

      return () => {
        cancelled = true;
      };
    }

    void loadSession()
      .then(async (user) => {
        if (cancelled) {
          return;
        }

        if (!user) {
          startTransition(() => {
            setSessionState({ status: "anonymous" });
          });
          return;
        }

        startTransition(() => {
          setSessionState({
            status: "authenticated",
            user
          });
        });

        preloadDashboardCoreServiceModules();
        if (activeDashboardView !== "memos") {
          await refreshDashboardData();
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSessionState({ status: "anonymous" });
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleResize() {
      const nextIsMobileSearchViewport = getIsMobileSearchViewport();
      setIsMobileSearchViewport(nextIsMobileSearchViewport);
      if (!nextIsMobileSearchViewport) {
        setIsMobileSearchPanelOpen(true);
      }
    }

    handleResize();
    globalThis.addEventListener("resize", handleResize);

    return () => {
      globalThis.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isBookmarkComposerOpen) {
      return;
    }

    let isCancelled = false;
    setBookmarkExtensionPresence("checking");

    void detectBookmarkExtensionPresence(450).then((status) => {
      if (!isCancelled) {
        setBookmarkExtensionPresence(status);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [isBookmarkComposerOpen]);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(
        BOOKMARK_VIEW_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          mode: bookmarkViewMode,
          list: bookmarkListDisplaySettings,
          card: bookmarkCardDisplaySettings
        })
      );
    } catch {
      // The setting is a convenience preference; keep the UI usable if storage is unavailable.
    }
  }, [bookmarkViewMode, bookmarkListDisplaySettings, bookmarkCardDisplaySettings]);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setDeferredInstallPrompt(null);
    }

    globalThis.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    globalThis.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      globalThis.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      globalThis.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    setExpandedFolderOverviewIds((currentIds) => {
      const visibleFolderIds = new Set(folders.map((folder) => folder.id));
      const nextIds = currentIds.filter((folderId) => visibleFolderIds.has(folderId));
      const nextIdSet = new Set(nextIds);

      if (appliedBookmarkSearch.folderId) {
        nextIdSet.add(appliedBookmarkSearch.folderId);
        for (const ancestorId of getFolderAncestorIds(folders, appliedBookmarkSearch.folderId)) {
          nextIdSet.add(ancestorId);
        }
      }

      const normalizedNextIds = Array.from(nextIdSet);
      return normalizedNextIds.length === currentIds.length &&
        normalizedNextIds.every((folderId) => currentIds.includes(folderId))
        ? currentIds
        : normalizedNextIds;
    });
  }, [folders, appliedBookmarkSearch.folderId]);

  useEffect(() => {
    const activeMemoFolderId = isMemoComposerOpen
      ? memoDraft.folderId || null
      : memoFolderFilterId && memoFolderFilterId !== "unfiled"
        ? memoFolderFilterId
        : null;
    const memoFolderChildrenByParentId = getFoldersByParentId(memoFolders);
    const memoFolderIdsWithChildren = Array.from(memoFolderChildrenByParentId.entries())
      .filter(([folderId, childFolders]) => Boolean(folderId) && childFolders.length > 0)
      .map(([folderId]) => folderId as string);

    setExpandedMemoFolderOverviewIds((currentIds) => {
      const visibleFolderIds = new Set(memoFolders.map((folder) => folder.id));
      const nextIds = currentIds.filter((folderId) => visibleFolderIds.has(folderId));
      const nextIdSet = new Set(nextIds);

      if (nextIdSet.size === 0) {
        for (const folderId of memoFolderIdsWithChildren) {
          nextIdSet.add(folderId);
        }
      }

      if (activeMemoFolderId) {
        nextIdSet.add(activeMemoFolderId);
        for (const ancestorId of getFolderAncestorIds(memoFolders, activeMemoFolderId)) {
          nextIdSet.add(ancestorId);
        }
      }

      const normalizedNextIds = Array.from(nextIdSet);
      return normalizedNextIds.length === currentIds.length &&
        normalizedNextIds.every((folderId) => currentIds.includes(folderId))
        ? currentIds
        : normalizedNextIds;
    });
  }, [isMemoComposerOpen, memoDraft.folderId, memoFolderFilterId, memoFolders]);

  useEffect(() => {
    const managerFolders = folderManagerScope === "memos" ? memoFolders : folders;
    const folderChildrenByParentId = getFoldersByParentId(managerFolders);
    const folderIdsWithChildren = Array.from(folderChildrenByParentId.entries())
      .filter(([folderId, childFolders]) => Boolean(folderId) && childFolders.length > 0)
      .map(([folderId]) => folderId as string);

    setExpandedFolderManagerIds((currentIds) => {
      const validFolderIds = new Set(managerFolders.map((folder) => folder.id));
      const nextIdSet = new Set(currentIds.filter((folderId) => validFolderIds.has(folderId)));

      if (nextIdSet.size === 0) {
        for (const folderId of folderIdsWithChildren) {
          nextIdSet.add(folderId);
        }
      }

      if (folderDraft.parentFolderId) {
        nextIdSet.add(folderDraft.parentFolderId);
        for (const ancestorId of getFolderAncestorIds(managerFolders, folderDraft.parentFolderId)) {
          nextIdSet.add(ancestorId);
        }
      }

      if (editingFolderId) {
        nextIdSet.add(editingFolderId);
        for (const ancestorId of getFolderAncestorIds(managerFolders, editingFolderId)) {
          nextIdSet.add(ancestorId);
        }
      }

      const normalizedNextIds = Array.from(nextIdSet);
      return normalizedNextIds.length === currentIds.length &&
        normalizedNextIds.every((folderId) => currentIds.includes(folderId))
        ? currentIds
        : normalizedNextIds;
    });
  }, [folders, folderDraft.parentFolderId, editingFolderId, folderManagerScope, memoFolders]);

  async function handleGoogleLogin() {
    try {
      setErrorMessage(null);
      const idToken = await signInWithGoogle();
      const user = await exchangeIdTokenForSession(idToken);
      const shouldLoadTagsAfterLogin =
        activeDashboardView !== "home" || hasActiveBookmarkSearch(appliedBookmarkSearch);
      const [
        { visibleBookmarks: nextBookmarks, inventoryBookmarks: nextBookmarkInventory },
        nextFolders,
        nextTags
      ] = await Promise.all([
        loadBookmarkCollections(appliedBookmarkSearch).catch(() => ({
          normalizedSearch: normalizeBookmarkSearchDraft(appliedBookmarkSearch),
          visibleBookmarks: [] as Bookmark[],
          inventoryBookmarks: [] as Bookmark[]
        })),
        loadFolders().catch(() => []),
        shouldLoadTagsAfterLogin ? fetchTagsOnce().catch(() => []) : Promise.resolve(null)
      ]);

      startTransition(() => {
        setSessionState({
          status: "authenticated",
          user
        });
        setBookmarks(nextBookmarks);
        setBookmarkInventory(nextBookmarkInventory);
        setHasLoadedFullBookmarkInventory(true);
        setBookmarkCounts(null);
        setHomeFavoriteBookmarks(null);
        setTrashedBookmarks([]);
        setSelectedBookmark(null);
        setFolders(nextFolders);
        if (nextTags) {
          setTags(nextTags);
          setHasLoadedTags(true);
        } else {
          setTags([]);
          setHasLoadedTags(false);
        }
        setRecommendations(emptyBookmarkRecommendations);
        setHasLoadedRecommendations(false);
        setIsLoadingRecommendations(false);
        setExtensionTokens([]);
        setExtensionTokenLabelDraft("");
        setLatestIssuedExtensionToken(null);
        setIsExtensionTokenDialogOpen(false);
      });

      queueBookmarkAssetPreload(
        activeDashboardView === "home"
          ? nextBookmarkInventory
          : nextBookmarks.slice(0, bookmarkListPageSize),
        bookmarkAssetsByBookmarkId
      );
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Google 로그인을 완료하지 못했습니다."
        );
      });
    }
  }

  async function handleLogout() {
    await logoutSession();
    await signOutFromGoogle().catch(() => undefined);
    recommendationRequestIdRef.current += 1;
    invalidateMemoWorkspaceRequests();
    tagsLoadPromiseRef.current = null;
    invalidateSelectedBookmarkPreviewCache();

    startTransition(() => {
      setSessionState({ status: "anonymous" });
      setBookmarks([]);
      setBookmarkInventory([]);
      setHasLoadedFullBookmarkInventory(false);
      setBookmarkCounts(null);
      setHomeFavoriteBookmarks(null);
      setTrashedBookmarks([]);
      setSelectedBookmark(null);
      setBookmarkAssetsByBookmarkId({});
      setFolders([]);
      setTags([]);
      setHasLoadedTags(false);
      setRecommendations(emptyBookmarkRecommendations);
      setHasLoadedRecommendations(false);
      setIsLoadingRecommendations(false);
      setExtensionTokens([]);
      setExtensionTokenLabelDraft("");
      setLatestIssuedExtensionToken(null);
      setIsExtensionTokenDialogOpen(false);
      setIsInstallHelpDialogOpen(false);
      setBookmarkDraft(emptyBookmarkDraft);
      setInitialBookmarkDraft(emptyBookmarkDraft);
      setBookmarkPreview(null);
      setBookmarkPreviewFailure(null);
      setPendingAssetFiles([]);
      setBookmarkSearchDraft(emptyBookmarkSearchDraft);
      setAppliedBookmarkSearch(emptyBookmarkSearchDraft);
      setFolderDraft(emptyFolderDraft);
      setQuickFolderDraft(emptyFolderDraft);
      setTagDraft(emptyTagDraft);
      setShowHiddenFolders(false);
      setIsQuickFolderOpen(false);
      setIsQuickTagOpen(false);
      setQuickTagDraft(emptyTagDraft);
      setMemos([]);
      setMemoFolders([]);
      setMemoTags([]);
      clearMemoWorkspaceMetadataCache();
      clearMemoPageCaches();
      setMemoTotalCount(null);
      setMemoSearchQuery("");
      replaceMemoFolderFilterId(DEFAULT_MEMO_FOLDER_FILTER_ID);
      setMemoFolderOverviewQuery("");
      setExpandedMemoFolderOverviewIds([]);
      setMemoTagFilterId(null);
      setMemoFavoriteOnly(false);
      setMemoViewMode("list");
      setMemoLockStatus(null);
      setMemoLockPromptMode(null);
      setIsMemoLockBusy(false);
      setMemoLockError(null);
      setIsLoadingMemos(false);
      replaceMemoDraft(createEmptyMemoDraft());
      setEditingMemo(null);
      setIsMemoComposerOpen(false);
      pendingMemoImageUploadsRef.current = [];
      setPendingMemoImageUploads([]);
      setIsSavingMemo(false);
    });
    onSessionEnd?.();
  }

  async function handlePwaInstall() {
    if (!deferredInstallPrompt || typeof deferredInstallPrompt.prompt !== "function") {
      preloadDashboardDialogChunk("installHelp");
      setIsInstallHelpDialogOpen(true);
      return;
    }

    try {
      await deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => undefined);
    } finally {
      startTransition(() => {
        setDeferredInstallPrompt(null);
      });
    }
  }

  async function handleBookmarkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setErrorMessage(null);
      setIsSavingBookmark(true);
      const bookmarkPreviewSourceFields = getBookmarkPreviewStoredSourceFields(bookmarkPreview);

      if (editingBookmarkId) {
        const updatedBookmark = await updateBookmark(editingBookmarkId, {
          url: bookmarkDraft.url,
          folderId: bookmarkDraft.folderId || null,
          tagIds: bookmarkDraft.tagIds,
          userTitle: bookmarkDraft.userTitle || null,
          userContent: bookmarkDraft.userContent || null,
          userSummary: bookmarkDraft.userSummary || null,
          ...bookmarkPreviewSourceFields,
          isFavorite: bookmarkDraft.isFavorite,
          isHidden: bookmarkDraft.isHidden,
          bookmarkColor: bookmarkDraft.bookmarkColor || null,
          urlColor: bookmarkDraft.urlColor || null
        });
        invalidateSelectedBookmarkPreviewCache(updatedBookmark.id);
        const uploadedAssets = await uploadPendingAssets(editingBookmarkId);
        const isUpdatedBookmarkVisible = isBookmarkVisibleUnderHiddenRules(
          updatedBookmark,
          hiddenFolderIds,
          showHiddenFolders,
          showHiddenBookmarks
        );

        if (hasActiveBookmarkSearch(appliedBookmarkSearch)) {
          const {
            visibleBookmarks: nextBookmarks,
            inventoryBookmarks: nextBookmarkInventory
          } = await loadBookmarkCollections(appliedBookmarkSearch);

          startTransition(() => {
            setBookmarks(nextBookmarks);
            setBookmarkInventory(nextBookmarkInventory);
            setHasLoadedFullBookmarkInventory(true);
            setHomeFavoriteBookmarks(null);
            setSelectedBookmark((currentSelectedBookmark) =>
              currentSelectedBookmark?.id === updatedBookmark.id
                ? isUpdatedBookmarkVisible
                  ? updatedBookmark
                  : null
                : currentSelectedBookmark
            );
            if (!isUpdatedBookmarkVisible) {
              setOpenBookmarkActionMenuId(null);
              setIsBookmarkDetailActionMenuOpen(false);
            }
            setBookmarkDraft(emptyBookmarkDraft);
            setInitialBookmarkDraft(emptyBookmarkDraft);
            setBookmarkPreview(null);
            setBookmarkPreviewFailure(null);
            if (uploadedAssets.length > 0) {
              setBookmarkAssetsByBookmarkId((currentAssetsByBookmarkId) => ({
                ...currentAssetsByBookmarkId,
                [editingBookmarkId]: [
                  ...(currentAssetsByBookmarkId[editingBookmarkId] ?? []),
                  ...uploadedAssets
                ]
              }));
            }
            setPendingAssetFiles([]);
            setEditingBookmarkId(null);
            setIsQuickFolderOpen(false);
            setQuickFolderDraft(emptyFolderDraft);
            setIsQuickTagOpen(false);
            setQuickTagDraft(emptyTagDraft);
            setIsBookmarkComposerOpen(false);
          });
        } else {
          startTransition(() => {
            setBookmarks((currentBookmarks) =>
              currentBookmarks.map((bookmark) =>
                bookmark.id === updatedBookmark.id ? updatedBookmark : bookmark
              )
            );
            setBookmarkInventory((currentBookmarks) =>
              currentBookmarks.map((bookmark) =>
                bookmark.id === updatedBookmark.id ? updatedBookmark : bookmark
              )
            );
            setHomeFavoriteBookmarks((currentBookmarks) => {
              if (!currentBookmarks) {
                return currentBookmarks;
              }

              if (!updatedBookmark.isFavorite || updatedBookmark.isTrashed) {
                return currentBookmarks.filter(
                  (bookmark) => bookmark.id !== updatedBookmark.id
                );
              }

              return upsertBookmarkById(currentBookmarks, updatedBookmark);
            });
            setSelectedBookmark((currentSelectedBookmark) =>
              currentSelectedBookmark?.id === updatedBookmark.id
                ? isUpdatedBookmarkVisible
                  ? updatedBookmark
                  : null
                : currentSelectedBookmark
            );
            if (!isUpdatedBookmarkVisible) {
              setOpenBookmarkActionMenuId(null);
              setIsBookmarkDetailActionMenuOpen(false);
            }
            setBookmarkDraft(emptyBookmarkDraft);
            setInitialBookmarkDraft(emptyBookmarkDraft);
            setBookmarkPreview(null);
            setBookmarkPreviewFailure(null);
            if (uploadedAssets.length > 0) {
              setBookmarkAssetsByBookmarkId((currentAssetsByBookmarkId) => ({
                ...currentAssetsByBookmarkId,
                [editingBookmarkId]: [
                  ...(currentAssetsByBookmarkId[editingBookmarkId] ?? []),
                  ...uploadedAssets
                ]
              }));
            }
            setPendingAssetFiles([]);
            setEditingBookmarkId(null);
            setIsQuickFolderOpen(false);
            setQuickFolderDraft(emptyFolderDraft);
            setIsQuickTagOpen(false);
            setQuickTagDraft(emptyTagDraft);
            setIsBookmarkComposerOpen(false);
          });
        }
      } else {
        const payload: CreateBookmarkRequest = {
          url: bookmarkDraft.url,
          folderId: bookmarkDraft.folderId || null,
          tagIds: bookmarkDraft.tagIds,
          userTitle: bookmarkDraft.userTitle || null,
          userContent: bookmarkDraft.userContent || null,
          userSummary: bookmarkDraft.userSummary || null,
          ...bookmarkPreviewSourceFields,
          isFavorite: bookmarkDraft.isFavorite,
          isHidden: bookmarkDraft.isHidden,
          bookmarkColor: bookmarkDraft.bookmarkColor || null,
          urlColor: bookmarkDraft.urlColor || null
        };
        const createdBookmark = await createBookmark(payload);
        const uploadedAssets = await uploadPendingAssets(createdBookmark.id);

        if (hasActiveBookmarkSearch(appliedBookmarkSearch)) {
          const {
            visibleBookmarks: nextBookmarks,
            inventoryBookmarks: nextBookmarkInventory
          } = await loadBookmarkCollections(appliedBookmarkSearch);

          startTransition(() => {
            setBookmarks(nextBookmarks);
            setBookmarkInventory(nextBookmarkInventory);
            setHasLoadedFullBookmarkInventory(true);
            setHomeFavoriteBookmarks(null);
            setBookmarkDraft(emptyBookmarkDraft);
            setInitialBookmarkDraft(emptyBookmarkDraft);
            setBookmarkPreview(null);
            setBookmarkPreviewFailure(null);
            if (uploadedAssets.length > 0) {
              setBookmarkAssetsByBookmarkId((currentAssetsByBookmarkId) => ({
                ...currentAssetsByBookmarkId,
                [createdBookmark.id]: uploadedAssets
              }));
            }
            setPendingAssetFiles([]);
            setIsQuickFolderOpen(false);
            setQuickFolderDraft(emptyFolderDraft);
            setIsQuickTagOpen(false);
            setQuickTagDraft(emptyTagDraft);
            setIsBookmarkComposerOpen(false);
          });
        } else {
          startTransition(() => {
            setBookmarks((currentBookmarks) => [createdBookmark, ...currentBookmarks]);
            setBookmarkInventory((currentBookmarks) => [createdBookmark, ...currentBookmarks]);
            setHomeFavoriteBookmarks((currentBookmarks) =>
              currentBookmarks && createdBookmark.isFavorite
                ? upsertBookmarkById(currentBookmarks, createdBookmark)
                : currentBookmarks
            );
            setBookmarkDraft(emptyBookmarkDraft);
            setInitialBookmarkDraft(emptyBookmarkDraft);
            setBookmarkPreview(null);
            setBookmarkPreviewFailure(null);
            if (uploadedAssets.length > 0) {
              setBookmarkAssetsByBookmarkId((currentAssetsByBookmarkId) => ({
                ...currentAssetsByBookmarkId,
                [createdBookmark.id]: uploadedAssets
              }));
            }
            setPendingAssetFiles([]);
            setIsQuickFolderOpen(false);
            setQuickFolderDraft(emptyFolderDraft);
            setIsQuickTagOpen(false);
            setQuickTagDraft(emptyTagDraft);
            setIsBookmarkComposerOpen(false);
          });
        }
      }
      void refreshBookmarkCounts();
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "북마크를 저장하지 못했습니다."
        );
      });
    } finally {
      setIsSavingBookmark(false);
    }
  }

  async function handleFolderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setErrorMessage(null);
      setIsSavingFolder(true);

      if (folderManagerScope === "memos") {
        if (editingFolderId) {
          const nextFolder = await updateMemoFolder(editingFolderId, {
            name: folderDraft.name,
            color: folderDraft.color || null,
            icon: folderDraft.icon || null,
            isHidden: folderDraft.isHidden,
            parentFolderId: folderDraft.parentFolderId || null
          });

          startTransition(() => {
            replaceMemoFolderState(nextFolder);
            setEditingFolderId(null);
            setFolderDraft(emptyFolderDraft);
            setInitialFolderDraft(emptyFolderDraft);
          });
        } else {
          const createdFolder = await createMemoFolder({
            name: folderDraft.name,
            color: folderDraft.color || null,
            icon: folderDraft.icon || null,
            isHidden: folderDraft.isHidden,
            parentFolderId: folderDraft.parentFolderId || null
          });

          clearMemoPageCaches();
          updateMemoWorkspaceFolders((currentFolders) => [...currentFolders, createdFolder]);
          applyCachedMemoPageOrLoading(
            createCurrentMemoPageOptions({
              folderFilterId: createdFolder.id,
              includeHidden: showHiddenMemos
            })
          );
          replaceMemoFolderFilterId(createdFolder.id);
          if (isMemoComposerOpen) {
            updateMemoDraft({ folderId: createdFolder.id });
          }
          setFolderDraft(emptyFolderDraft);
          setInitialFolderDraft(emptyFolderDraft);
        }
        return;
      }

      if (editingFolderId) {
        const nextFolder = await updateFolder(editingFolderId, {
          name: folderDraft.name,
          color: folderDraft.color || null,
          icon: folderDraft.icon || null,
          isHidden: folderDraft.isHidden,
          parentFolderId: folderDraft.parentFolderId || null
        });

        startTransition(() => {
          replaceFolderState(nextFolder);
          setEditingFolderId(null);
          setFolderDraft(emptyFolderDraft);
          setInitialFolderDraft(emptyFolderDraft);
        });
      } else {
        const createdFolder = await createFolder({
          name: folderDraft.name,
          color: folderDraft.color || null,
          icon: folderDraft.icon || null,
          isHidden: folderDraft.isHidden,
          parentFolderId: folderDraft.parentFolderId || null
        });

        startTransition(() => {
          setFolders((currentFolders) => [...currentFolders, createdFolder]);
          setFolderDraft(emptyFolderDraft);
          setInitialFolderDraft(emptyFolderDraft);
        });
      }
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : editingFolderId
              ? "폴더를 수정하지 못했습니다."
              : "폴더를 저장하지 못했습니다."
        );
      });
    } finally {
      setIsSavingFolder(false);
    }
  }

  async function handleTagSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setErrorMessage(null);
      setIsSavingTag(true);

      if (tagManagerScope === "memos") {
        if (editingTagId) {
          const nextTag = await updateMemoTag(editingTagId, {
            name: tagDraft.name,
            color: tagDraft.color || null
          });

          startTransition(() => {
            replaceMemoTagState(nextTag);
            setEditingTagId(null);
            setTagDraft(emptyTagDraft);
            setInitialTagDraft(emptyTagDraft);
          });
        } else {
          const createdTag = await createMemoTag({
            name: tagDraft.name,
            color: tagDraft.color || null
          });

          startTransition(() => {
            updateMemoWorkspaceTags((currentTags) => [...currentTags, createdTag]);
            setTagDraft(emptyTagDraft);
            setInitialTagDraft(emptyTagDraft);
          });
        }
        return;
      }

      if (editingTagId) {
        const nextTag = await updateTag(editingTagId, {
          name: tagDraft.name,
          color: tagDraft.color || null
        });

        startTransition(() => {
          replaceTagState(nextTag);
          setEditingTagId(null);
          setTagDraft(emptyTagDraft);
          setInitialTagDraft(emptyTagDraft);
        });
      } else {
        const createdTag = await createTag({
          name: tagDraft.name,
          color: tagDraft.color || null
        });

        startTransition(() => {
          setHasLoadedTags(true);
          setTags((currentTags) => [...currentTags, createdTag]);
          setTagDraft(emptyTagDraft);
          setInitialTagDraft(emptyTagDraft);
        });
      }
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : editingTagId
              ? "태그를 수정하지 못했습니다."
              : "태그를 저장하지 못했습니다."
        );
      });
    } finally {
      setIsSavingTag(false);
    }
  }

  function updateBookmarkDraft(nextValues: Partial<BookmarkDraft>) {
    setBookmarkDraft((currentDraft) => ({
      ...currentDraft,
      ...nextValues
    }));
  }

  function handleBookmarkUrlChange(url: string) {
    setBookmarkDraft((currentDraft) => ({
      ...currentDraft,
      url
    }));
    setBookmarkPreview(null);
    setBookmarkPreviewFailure(null);
  }

  function updateBookmarkSearchDraft(nextValues: Partial<BookmarkSearchDraft>) {
    setBookmarkSearchDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        ...nextValues
      };

      if (!nextDraft.folderId.trim()) {
        nextDraft.includeDescendantFolders = false;
      }

      return nextDraft;
    });
  }

  function toggleBookmarkTag(tagId: string, checked: boolean) {
    setBookmarkDraft((currentDraft) => {
      const nextTagIds = checked
        ? Array.from(new Set([...currentDraft.tagIds, tagId]))
        : currentDraft.tagIds.filter((currentTagId) => currentTagId !== tagId);

      return {
        ...currentDraft,
        tagIds: nextTagIds
      };
    });
  }

  function toggleBookmarkSearchTag(tagId: string, checked: boolean) {
    setBookmarkSearchDraft((currentDraft) => {
      const nextTagIds = checked
        ? Array.from(new Set([...currentDraft.tagIds, tagId]))
        : currentDraft.tagIds.filter((currentTagId) => currentTagId !== tagId);

      return {
        ...currentDraft,
        tagIds: nextTagIds,
        tagMode: nextTagIds.length === 0 ? "and" : currentDraft.tagMode
      };
    });
  }

  function updateFolderDraft(nextValues: Partial<FolderDraft>) {
    setFolderDraft((currentDraft) => ({
      ...currentDraft,
      ...nextValues
    }));
  }

  function updateQuickFolderDraft(nextValues: Partial<FolderDraft>) {
    setQuickFolderDraft((currentDraft) => ({
      ...currentDraft,
      ...nextValues
    }));
  }

  function updateQuickTagDraft(nextValues: Partial<TagDraft>) {
    setQuickTagDraft((currentDraft) => ({
      ...currentDraft,
      ...nextValues
    }));
  }

  function updateTagDraft(nextValues: Partial<TagDraft>) {
    setTagDraft((currentDraft) => ({
      ...currentDraft,
      ...nextValues
    }));
  }

  function getManagerFoldersForScope(scope: ManagerScope) {
    return scope === "memos" ? memoFolders : folders;
  }

  function openFolderManager(scope: ManagerScope = "bookmarks") {
    preloadDashboardDialogChunk("folderManager");
    const nextDraft = emptyFolderDraft;
    setErrorMessage(null);
    setFolderManagerScope(scope);
    if (scope === "memos") {
      setActiveDashboardView("memos");
    }
    setIsMobileHeaderMenuOpen(false);
    if (scope === "bookmarks") {
      setMobileSidebarPanel("folder");
    }
    setEditingFolderId(null);
    setFolderDraft(nextDraft);
    setInitialFolderDraft(nextDraft);
    setDraggingFolderId(null);
    setOpenFolderActionMenuId(null);
    setIsFolderManagerOpen(true);
  }

  function beginFolderEdit(folder: Folder, scope: ManagerScope = folderManagerScope) {
    preloadDashboardDialogChunk("folderManager");
    const managerFolders = getManagerFoldersForScope(scope);
    const nextDraft = {
      name: folder.name,
      color: folder.color ?? "",
      icon: folder.icon ?? "",
      isHidden: folder.isHidden === true,
      parentFolderId: folder.parentFolderId ?? ""
    };
    setFolderManagerScope(scope);
    if (scope === "memos") {
      setActiveDashboardView("memos");
    }
    setIsMobileHeaderMenuOpen(false);
    if (scope === "bookmarks") {
      setMobileSidebarPanel("folder");
    }
    setIsFolderManagerOpen(true);
    setOpenFolderActionMenuId(null);
    setExpandedFolderManagerIds((currentIds) =>
      Array.from(
        new Set([...currentIds, folder.id, ...getFolderAncestorIds(managerFolders, folder.id)])
      )
    );
    setEditingFolderId(folder.id);
    setFolderDraft(nextDraft);
    setInitialFolderDraft(nextDraft);
  }

  function cancelFolderEdit() {
    const nextDraft = emptyFolderDraft;
    setEditingFolderId(null);
    setFolderDraft(nextDraft);
    setInitialFolderDraft(nextDraft);
  }

  function beginChildFolderCreate(parentFolder: Folder, scope: ManagerScope = folderManagerScope) {
    preloadDashboardDialogChunk("folderManager");
    const nextDraft = {
      ...emptyFolderDraft,
      isHidden: parentFolder.isHidden === true,
      parentFolderId: parentFolder.id
    };
    setFolderManagerScope(scope);
    if (scope === "memos") {
      setActiveDashboardView("memos");
    }
    setIsFolderManagerOpen(true);
    setOpenFolderActionMenuId(null);
    setExpandedFolderManagerIds((currentIds) =>
      Array.from(new Set([...currentIds, parentFolder.id]))
    );
    setEditingFolderId(null);
    setFolderDraft(nextDraft);
    setInitialFolderDraft(nextDraft);
  }

  function closeFolderManager() {
    cancelFolderEdit();
    setDraggingFolderId(null);
    setOpenFolderActionMenuId(null);
    setIsFolderManagerOpen(false);
  }

  function requestCloseFolderManager() {
    if (
      !areFolderDraftsEqual(folderDraft, initialFolderDraft) &&
      globalThis.confirm &&
      !globalThis.confirm("저장하지 않은 폴더 변경 사항이 있습니다. 닫을까요?")
    ) {
      return;
    }

    closeFolderManager();
  }

  async function handleQuickFolderCreate() {
    if (!quickFolderDraft.name.trim()) {
      setErrorMessage("폴더 이름을 입력해주세요.");
      return;
    }

    try {
      setErrorMessage(null);
      setIsSavingQuickFolder(true);
      const createdFolder = await createFolder({
        name: quickFolderDraft.name,
        color: quickFolderDraft.color || null,
        icon: quickFolderDraft.icon || null,
        isHidden: quickFolderDraft.isHidden,
        parentFolderId:
          visibleFolderOptions.length > 0
            ? quickFolderDraft.parentFolderId || null
            : null
      });

      startTransition(() => {
        setFolders((currentFolders) => [...currentFolders, createdFolder]);
        setBookmarkDraft((currentDraft) => ({
          ...currentDraft,
          folderId: createdFolder.id
        }));
        setQuickFolderDraft(emptyFolderDraft);
        setIsQuickFolderOpen(false);
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "빠른 폴더 생성을 완료하지 못했습니다."
        );
      });
    } finally {
      setIsSavingQuickFolder(false);
    }
  }

  async function handleQuickTagCreate() {
    if (!quickTagDraft.name.trim()) {
      setErrorMessage("태그 이름을 입력해주세요.");
      return;
    }

    try {
      setErrorMessage(null);
      setIsSavingTag(true);
      const createdTag = await createTag({
        name: quickTagDraft.name,
        color: quickTagDraft.color || null
      });

      startTransition(() => {
        setHasLoadedTags(true);
        setTags((currentTags) => [...currentTags, createdTag]);
        setBookmarkDraft((currentDraft) => ({
          ...currentDraft,
          tagIds: Array.from(new Set([...currentDraft.tagIds, createdTag.id]))
        }));
        setQuickTagDraft(emptyTagDraft);
        setIsQuickTagOpen(false);
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "빠른 태그 생성을 완료하지 못했습니다."
        );
      });
    } finally {
      setIsSavingTag(false);
    }
  }

  function replaceFolderState(nextFolder: Folder) {
    setFolders((currentFolders) =>
      currentFolders.map((folder) => (folder.id === nextFolder.id ? nextFolder : folder))
    );
  }

  function removeFolderState(folderId: string) {
    setFolders((currentFolders) =>
      currentFolders
        .filter((folder) => folder.id !== folderId)
        .map((folder) =>
          folder.parentFolderId === folderId ? { ...folder, parentFolderId: null } : folder
        )
    );
    setBookmarks((currentBookmarks) =>
      currentBookmarks.map((bookmark) =>
        bookmark.folderId === folderId ? { ...bookmark, folderId: null } : bookmark
      )
    );
    setBookmarkInventory((currentBookmarks) =>
      currentBookmarks.map((bookmark) =>
        bookmark.folderId === folderId ? { ...bookmark, folderId: null } : bookmark
      )
    );
    setSelectedBookmark((currentSelectedBookmark) =>
      currentSelectedBookmark?.folderId === folderId
        ? { ...currentSelectedBookmark, folderId: null }
        : currentSelectedBookmark
    );
    setBookmarkDraft((currentDraft) =>
      currentDraft.folderId === folderId ? { ...currentDraft, folderId: "" } : currentDraft
    );
    setFolderDraft((currentDraft) =>
      currentDraft.parentFolderId === folderId
        ? { ...currentDraft, parentFolderId: "" }
        : currentDraft
    );
    setBookmarkSearchDraft((currentDraft) =>
      currentDraft.folderId === folderId
        ? { ...currentDraft, folderId: "", includeDescendantFolders: false }
        : currentDraft
    );
    setAppliedBookmarkSearch((currentSearch) =>
      currentSearch.folderId === folderId
        ? { ...currentSearch, folderId: "", includeDescendantFolders: false }
        : currentSearch
    );

    if (editingFolderId === folderId) {
      cancelFolderEdit();
    }

    if (draggingFolderId === folderId) {
      setDraggingFolderId(null);
    }
  }

  function replaceMemoFolderState(nextFolder: MemoFolder) {
    clearMemoPageCaches();
    updateMemoWorkspaceFolders((currentFolders) =>
      currentFolders.map((folder) => (folder.id === nextFolder.id ? nextFolder : folder))
    );
  }

  function removeMemoFolderState(folderId: string) {
    clearMemoPageCaches();
    updateMemoWorkspaceFolders((currentFolders) =>
      currentFolders
        .filter((folder) => folder.id !== folderId)
        .map((folder) =>
          folder.parentFolderId === folderId ? { ...folder, parentFolderId: null } : folder
        )
    );
    setMemos((currentMemos) =>
      currentMemos.map((memo) =>
        memo.folderId === folderId ? { ...memo, folderId: null } : memo
      )
    );
    setEditingMemo((currentMemo) =>
      currentMemo?.folderId === folderId ? { ...currentMemo, folderId: null } : currentMemo
    );
    if (memoDraftRef.current.folderId === folderId) {
      replaceMemoDraft({ ...memoDraftRef.current, folderId: "" });
    }
    setFolderDraft((currentDraft) =>
      currentDraft.parentFolderId === folderId
        ? { ...currentDraft, parentFolderId: "" }
        : currentDraft
    );
    updateMemoFolderFilterId((currentFolderId) =>
      currentFolderId === folderId ? null : currentFolderId
    );

    if (editingFolderId === folderId) {
      cancelFolderEdit();
    }

    if (draggingFolderId === folderId) {
      setDraggingFolderId(null);
    }
  }

  function resetDraggingFolder() {
    setDraggingFolderId(null);
    setFolderOverviewDropTarget(null);
  }

  function getFolderOverviewDropMode(
    targetFolder: Folder,
    scope: ManagerScope = "bookmarks"
  ): FolderOverviewDropMode | null {
    if (!draggingFolderId || draggingFolderId === targetFolder.id) {
      return null;
    }

    const managerFolders = getManagerFoldersForScope(scope);
    const draggedFolder = managerFolders.find((folder) => folder.id === draggingFolderId);
    if (!draggedFolder) {
      return null;
    }

    if (draggedFolder.parentFolderId === targetFolder.parentFolderId) {
      return "reorder";
    }

    const descendantFolderIds = getFolderDescendantIds(managerFolders, draggingFolderId);
    if (descendantFolderIds.has(targetFolder.id) || draggedFolder.parentFolderId === targetFolder.id) {
      return null;
    }

    return "move";
  }

  function toggleFolderActionMenu(folderId: string) {
    setOpenFolderActionMenuId((currentFolderId) =>
      currentFolderId === folderId ? null : folderId
    );
  }

  async function handleFolderReorderDrop(
    targetFolder: Folder,
    scope: ManagerScope = "bookmarks"
  ) {
    const managerFolders = getManagerFoldersForScope(scope);
    if (!draggingFolderId || draggingFolderId === targetFolder.id) {
      resetDraggingFolder();
      return;
    }

    const draggedFolder = managerFolders.find((folder) => folder.id === draggingFolderId);
    if (!draggedFolder || draggedFolder.parentFolderId !== targetFolder.parentFolderId) {
      resetDraggingFolder();
      return;
    }

    const siblingFolders = getSiblingFolders(managerFolders, targetFolder.parentFolderId);
    const reorderedSiblingFolders = reorderSiblingFolders(
      siblingFolders,
      draggingFolderId,
      targetFolder.id
    );

    if (
      reorderedSiblingFolders.map((folder) => folder.id).join(",") ===
      siblingFolders.map((folder) => folder.id).join(",")
    ) {
      resetDraggingFolder();
      return;
    }

    try {
      setErrorMessage(null);
      setIsReorderingFolders(true);
      const reorderFolderAction = scope === "memos" ? reorderMemoFolders : reorderFolders;
      const nextFolders = await reorderFolderAction({
        parentFolderId: targetFolder.parentFolderId,
        folderIds: reorderedSiblingFolders.map((folder) => folder.id)
      });

      startTransition(() => {
        if (scope === "memos") {
          clearMemoPageCaches();
          replaceMemoWorkspaceFolders(nextFolders);
          return;
        }

        setFolders(nextFolders);
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "폴더 순서를 저장하지 못했습니다."
        );
      });
    } finally {
      resetDraggingFolder();
      setIsReorderingFolders(false);
    }
  }

  async function handleFolderReorderToPosition(
    folder: Folder,
    position: FolderReorderPosition,
    scope: ManagerScope = "bookmarks"
  ) {
    const managerFolders = getManagerFoldersForScope(scope);
    const siblingFolders = getSiblingFolders(managerFolders, folder.parentFolderId);
    const reorderedSiblingFolders = moveFolderToSiblingPosition(
      siblingFolders,
      folder.id,
      position
    );

    if (
      reorderedSiblingFolders.map((currentFolder) => currentFolder.id).join(",") ===
      siblingFolders.map((currentFolder) => currentFolder.id).join(",")
    ) {
      return;
    }

    try {
      setErrorMessage(null);
      setIsReorderingFolders(true);
      const reorderFolderAction = scope === "memos" ? reorderMemoFolders : reorderFolders;
      const nextFolders = await reorderFolderAction({
        parentFolderId: folder.parentFolderId,
        folderIds: reorderedSiblingFolders.map((currentFolder) => currentFolder.id)
      });

      startTransition(() => {
        if (scope === "memos") {
          clearMemoPageCaches();
          replaceMemoWorkspaceFolders(nextFolders);
          return;
        }

        setFolders(nextFolders);
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "폴더 순서를 저장하지 못했습니다."
        );
      });
    } finally {
      setIsReorderingFolders(false);
    }
  }

  async function handleFolderMoveDrop(targetFolder: Folder, scope: ManagerScope = "bookmarks") {
    const managerFolders = getManagerFoldersForScope(scope);
    if (!draggingFolderId || draggingFolderId === targetFolder.id) {
      resetDraggingFolder();
      return;
    }

    const draggedFolder = managerFolders.find((folder) => folder.id === draggingFolderId);
    if (!draggedFolder) {
      resetDraggingFolder();
      return;
    }

    const descendantFolderIds = getFolderDescendantIds(managerFolders, draggingFolderId);
    if (descendantFolderIds.has(targetFolder.id)) {
      resetDraggingFolder();
      return;
    }

    if (draggedFolder.parentFolderId === targetFolder.id) {
      resetDraggingFolder();
      return;
    }

    try {
      setErrorMessage(null);
      setIsReorderingFolders(true);
      const moveFolderAction = scope === "memos" ? moveMemoFolder : moveFolder;
      const nextFolders = await moveFolderAction(draggingFolderId, {
        parentFolderId: targetFolder.id
      });

      startTransition(() => {
        if (scope === "memos") {
          clearMemoPageCaches();
          replaceMemoWorkspaceFolders(nextFolders);
          return;
        }

        setFolders(nextFolders);
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "폴더 부모를 변경하지 못했습니다."
        );
      });
    } finally {
      resetDraggingFolder();
      setIsReorderingFolders(false);
    }
  }

  async function handleFolderMoveToParent(
    folder: Folder,
    parentFolderId: string | null,
    scope: ManagerScope = "bookmarks"
  ) {
    if (folder.parentFolderId === parentFolderId) {
      return;
    }

    const managerFolders = getManagerFoldersForScope(scope);
    const descendantFolderIds = getFolderDescendantIds(managerFolders, folder.id);
    if (parentFolderId && (parentFolderId === folder.id || descendantFolderIds.has(parentFolderId))) {
      return;
    }

    try {
      setErrorMessage(null);
      setIsReorderingFolders(true);
      const moveFolderAction = scope === "memos" ? moveMemoFolder : moveFolder;
      const nextFolders = await moveFolderAction(folder.id, {
        parentFolderId
      });

      startTransition(() => {
        if (scope === "memos") {
          clearMemoPageCaches();
          replaceMemoWorkspaceFolders(nextFolders);
        } else {
          setFolders(nextFolders);
        }
        if (parentFolderId) {
          const expandedParentIds = [
            parentFolderId,
            ...getFolderAncestorIds(managerFolders, parentFolderId)
          ];
          setExpandedFolderManagerIds((currentIds) =>
            Array.from(new Set([...currentIds, ...expandedParentIds]))
          );
          if (scope === "bookmarks") {
            setExpandedFolderOverviewIds((currentIds) =>
              Array.from(new Set([...currentIds, ...expandedParentIds]))
            );
          }
        }
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "폴더 부모를 변경하지 못했습니다."
        );
      });
    } finally {
      setIsReorderingFolders(false);
    }
  }

  async function handleFolderMoveToRootDrop(scope: ManagerScope = "bookmarks") {
    const managerFolders = getManagerFoldersForScope(scope);
    if (!draggingFolderId) {
      resetDraggingFolder();
      return;
    }

    const draggedFolder = managerFolders.find((folder) => folder.id === draggingFolderId);
    if (!draggedFolder || draggedFolder.parentFolderId === null) {
      resetDraggingFolder();
      return;
    }

    try {
      setErrorMessage(null);
      setIsReorderingFolders(true);
      const moveFolderAction = scope === "memos" ? moveMemoFolder : moveFolder;
      const nextFolders = await moveFolderAction(draggingFolderId, {
        parentFolderId: null
      });

      startTransition(() => {
        if (scope === "memos") {
          clearMemoPageCaches();
          replaceMemoWorkspaceFolders(nextFolders);
          return;
        }

        setFolders(nextFolders);
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "폴더를 최상위로 이동하지 못했습니다."
        );
      });
    } finally {
      resetDraggingFolder();
      setIsReorderingFolders(false);
    }
  }

  function openTagManager(scope: ManagerScope = "bookmarks") {
    preloadDashboardDialogChunk("tagManager");
    const nextDraft = emptyTagDraft;
    setErrorMessage(null);
    setTagManagerScope(scope);
    if (scope === "memos") {
      setActiveDashboardView("memos");
    }
    setIsMobileHeaderMenuOpen(false);
    if (scope === "bookmarks") {
      requestTagsIfNeeded();
    }
    setEditingTagId(null);
    setOpenTagActionMenuId(null);
    setTagDraft(nextDraft);
    setInitialTagDraft(nextDraft);
    setIsTagManagerOpen(true);
  }

  function beginTagEdit(tag: Tag, scope: ManagerScope = tagManagerScope) {
    preloadDashboardDialogChunk("tagManager");
    const nextDraft = {
      name: tag.name,
      color: tag.color ?? ""
    };
    setTagManagerScope(scope);
    if (scope === "memos") {
      setActiveDashboardView("memos");
    }
    setIsTagManagerOpen(true);
    setOpenTagActionMenuId(null);
    setEditingTagId(tag.id);
    setTagDraft(nextDraft);
    setInitialTagDraft(nextDraft);
  }

  function cancelTagEdit() {
    const nextDraft = emptyTagDraft;
    setEditingTagId(null);
    setOpenTagActionMenuId(null);
    setTagDraft(nextDraft);
    setInitialTagDraft(nextDraft);
  }

  function closeTagManager() {
    cancelTagEdit();
    setIsTagManagerOpen(false);
  }

  function requestCloseTagManager() {
    if (
      !areTagDraftsEqual(tagDraft, initialTagDraft) &&
      globalThis.confirm &&
      !globalThis.confirm("저장하지 않은 태그 변경 사항이 있습니다. 닫을까요?")
    ) {
      return;
    }

    closeTagManager();
  }

  function toggleTagActionMenu(tagId: string) {
    setOpenTagActionMenuId((currentTagId) => (currentTagId === tagId ? null : tagId));
  }

  function replaceTagState(nextTag: Tag) {
    setTags((currentTags) =>
      currentTags.map((tag) => (tag.id === nextTag.id ? nextTag : tag))
    );
  }

  function removeTagState(tagId: string) {
    setTags((currentTags) => currentTags.filter((tag) => tag.id !== tagId));
    setOpenTagActionMenuId((currentTagId) => (currentTagId === tagId ? null : currentTagId));
    setBookmarks((currentBookmarks) =>
      currentBookmarks.map((bookmark) =>
        bookmark.tagIds.includes(tagId)
          ? {
              ...bookmark,
              tagIds: bookmark.tagIds.filter((currentTagId) => currentTagId !== tagId)
            }
          : bookmark
      )
    );
    setBookmarkInventory((currentBookmarks) =>
      currentBookmarks.map((bookmark) =>
        bookmark.tagIds.includes(tagId)
          ? {
              ...bookmark,
              tagIds: bookmark.tagIds.filter((currentTagId) => currentTagId !== tagId)
            }
          : bookmark
      )
    );
    setSelectedBookmark((currentSelectedBookmark) =>
      currentSelectedBookmark?.tagIds.includes(tagId)
        ? {
            ...currentSelectedBookmark,
            tagIds: currentSelectedBookmark.tagIds.filter(
              (currentTagId) => currentTagId !== tagId
            )
          }
        : currentSelectedBookmark
    );
    setBookmarkDraft((currentDraft) => ({
      ...currentDraft,
      tagIds: currentDraft.tagIds.filter((currentTagId) => currentTagId !== tagId)
    }));
    setBookmarkSearchDraft((currentDraft) =>
      currentDraft.tagIds.includes(tagId)
        ? {
            ...currentDraft,
            tagIds: currentDraft.tagIds.filter((currentTagId) => currentTagId !== tagId),
            tagMode:
              currentDraft.tagIds.filter((currentTagId) => currentTagId !== tagId).length === 0
                ? "and"
                : currentDraft.tagMode
          }
        : currentDraft
    );
    setAppliedBookmarkSearch((currentSearch) =>
      currentSearch.tagIds.includes(tagId)
        ? {
            ...currentSearch,
            tagIds: currentSearch.tagIds.filter((currentTagId) => currentTagId !== tagId),
            tagMode:
              currentSearch.tagIds.filter((currentTagId) => currentTagId !== tagId).length === 0
                ? "and"
                : currentSearch.tagMode
          }
        : currentSearch
    );

    if (editingTagId === tagId) {
      cancelTagEdit();
    }
  }

  function replaceMemoTagState(nextTag: MemoTag) {
    clearMemoPageCaches();
    updateMemoWorkspaceTags((currentTags) =>
      currentTags.map((tag) => (tag.id === nextTag.id ? nextTag : tag))
    );
  }

  function removeMemoTagState(tagId: string) {
    clearMemoPageCaches();
    updateMemoWorkspaceTags((currentTags) => currentTags.filter((tag) => tag.id !== tagId));
    setOpenTagActionMenuId((currentTagId) => (currentTagId === tagId ? null : currentTagId));
    setMemos((currentMemos) =>
      currentMemos.map((memo) =>
        memo.tagIds.includes(tagId)
          ? {
              ...memo,
              tagIds: memo.tagIds.filter((currentTagId) => currentTagId !== tagId)
            }
          : memo
      )
    );
    setEditingMemo((currentMemo) =>
      currentMemo?.tagIds.includes(tagId)
        ? {
            ...currentMemo,
            tagIds: currentMemo.tagIds.filter((currentTagId) => currentTagId !== tagId)
          }
        : currentMemo
    );
    replaceMemoDraft({
      ...memoDraftRef.current,
      tagIds: memoDraftRef.current.tagIds.filter((currentTagId) => currentTagId !== tagId)
    });
    setMemoTagFilterId((currentTagId) => (currentTagId === tagId ? null : currentTagId));

    if (editingTagId === tagId) {
      cancelTagEdit();
    }
  }

  async function handleBookmarkSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await applyBookmarkSearch(bookmarkSearchDraft);
  }

  async function applyBookmarkSearch(nextSearchDraft: BookmarkSearchDraft) {
    try {
      setErrorMessage(null);
      setActiveDashboardView("bookmarks");
      requestDesktopRecommendationsIfNeeded();
      requestTagsIfNeeded();
      setIsLoadingDashboard(true);
      const normalizedNextSearch = normalizeBookmarkSearchDraft(nextSearchDraft);

      if (hasActiveBookmarkSearch(normalizedNextSearch)) {
        const [{ normalizedSearch, page }, nextBookmarkInventory] = await Promise.all([
          loadBookmarkListPage(normalizedNextSearch, bookmarkListPageSize, 0),
          loadBookmarks(emptyBookmarkSearchDraft)
        ]);

        startTransition(() => {
          setBookmarks(page.bookmarks);
          setBookmarkInventory(nextBookmarkInventory);
          setHasLoadedFullBookmarkInventory(true);
          setHomeFavoriteBookmarks(null);
          setSelectedBookmark(null);
          setBookmarkSearchDraft(normalizedSearch);
          setAppliedBookmarkSearch(normalizedSearch);
          setFolderOverviewSpecialFilter(null);
          applyBookmarkListPaginationPage(page);
        });

        queueBookmarkAssetPreload(page.bookmarks, bookmarkAssetsByBookmarkId, "bookmarks");
        return;
      }

      const {
        normalizedSearch,
        visibleBookmarks: nextBookmarks,
        inventoryBookmarks: nextBookmarkInventory
      } = await loadBookmarkCollections(normalizedNextSearch);

      startTransition(() => {
        setBookmarks(nextBookmarks);
        setBookmarkInventory(nextBookmarkInventory);
        setHasLoadedFullBookmarkInventory(true);
        setHomeFavoriteBookmarks(null);
        setSelectedBookmark(null);
        setBookmarkSearchDraft(normalizedSearch);
        setAppliedBookmarkSearch(normalizedSearch);
        setFolderOverviewSpecialFilter(null);
        resetBookmarkListPagination();
      });

      queueBookmarkAssetPreload(
        nextBookmarks.slice(0, bookmarkListPageSize),
        bookmarkAssetsByBookmarkId,
        "bookmarks"
      );
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "북마크 검색에 실패했습니다."
        );
      });
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function applyBookmarkSort(sort: BookmarkSortMode) {
    const nextSearch = normalizeBookmarkSearchDraft({
      ...appliedBookmarkSearch,
      sort
    });

    setActiveDashboardView("bookmarks");
    requestDesktopRecommendationsIfNeeded();
    requestTagsIfNeeded();
    setIsBookmarkSortMenuOpen(false);

    if (folderOverviewSpecialFilter) {
      try {
        setErrorMessage(null);
        setIsLoadingDashboard(true);

        if (folderOverviewSpecialFilter === "trash") {
          const nextBookmarks = await loadBookmarks({
            ...emptyBookmarkSearchDraft,
            sort,
            trashMode: "trashed"
          });

          startTransition(() => {
            setBookmarks(nextBookmarks);
            setTrashedBookmarks(nextBookmarks);
            setSelectedBookmark(null);
            setBookmarkSearchDraft(nextSearch);
            setAppliedBookmarkSearch(nextSearch);
            resetBookmarkListPagination();
          });
          queueBookmarkAssetPreload(
            nextBookmarks.slice(0, bookmarkListPageSize),
            bookmarkAssetsByBookmarkId,
            "bookmarks"
          );
          return;
        }

        if (folderOverviewSpecialFilter === "all") {
          const { page } = await loadBookmarkListPage(nextSearch, bookmarkListPageSize, 0);

          startTransition(() => {
            setBookmarks(page.bookmarks);
            setSelectedBookmark(null);
            setBookmarkSearchDraft(nextSearch);
            setAppliedBookmarkSearch(nextSearch);
            applyBookmarkListPaginationPage(page);
          });
          queueBookmarkAssetPreload(page.bookmarks, bookmarkAssetsByBookmarkId, "bookmarks");
          return;
        }

        const {
          visibleBookmarks: sortedBookmarks,
          inventoryBookmarks: nextBookmarkInventory
        } = await loadBookmarkCollections(nextSearch);
        const nextBookmarks = filterBookmarksForFolderOverviewSpecialFilter(
          sortedBookmarks,
          folderOverviewSpecialFilter,
          extensionFolderIds
        );

        startTransition(() => {
          setBookmarks(nextBookmarks);
          setBookmarkInventory(nextBookmarkInventory);
          setHasLoadedFullBookmarkInventory(true);
          setHomeFavoriteBookmarks(null);
          setSelectedBookmark(null);
          setBookmarkSearchDraft(nextSearch);
          setAppliedBookmarkSearch(nextSearch);
          resetBookmarkListPagination();
        });
        queueBookmarkAssetPreload(
          nextBookmarks.slice(0, bookmarkListPageSize),
          bookmarkAssetsByBookmarkId,
          "bookmarks"
        );
      } catch (error) {
        startTransition(() => {
          setErrorMessage(
            error instanceof Error ? error.message : "북마크 정렬을 적용하지 못했습니다."
          );
        });
      } finally {
        setIsLoadingDashboard(false);
      }
      return;
    }

    await applyBookmarkSearch(nextSearch);
  }

  async function handleBookmarkSearchReset() {
    await applyBookmarkSearch(emptyBookmarkSearchDraft);
  }

  async function handleFolderOverviewSelect(folder: Folder) {
    const nextSearch = normalizeBookmarkSearchDraft({
      ...appliedBookmarkSearch,
      folderId: folder.id,
      includeDescendantFolders: true
    });

    setActiveDashboardView("bookmarks");
    requestDesktopRecommendationsIfNeeded();
    if (shouldUseMobileSidebarPanels) {
      setMobileSidebarPanel("bookmark");
    }

    if (hasLoadedFullBookmarkInventory && canResolveFolderOverviewSearchLocally(nextSearch)) {
      const nextBookmarks = filterBookmarksForFolderOverviewSearch(
        bookmarkInventory,
        folders,
        nextSearch
      );

      startTransition(() => {
        setErrorMessage(null);
        setBookmarks(nextBookmarks);
        setSelectedBookmark(null);
        setBookmarkSearchDraft(nextSearch);
        setAppliedBookmarkSearch(nextSearch);
        setFolderOverviewSpecialFilter(null);
        resetBookmarkListPagination();
      });
      queueBookmarkAssetPreload(
        nextBookmarks.slice(0, bookmarkListPageSize),
        bookmarkAssetsByBookmarkId,
        "bookmarks"
      );
      return;
    }

    await applyBookmarkSearch(nextSearch);
  }

  async function handleFolderOverviewReset() {
    const nextSearch = normalizeBookmarkSearchDraft({
      ...appliedBookmarkSearch,
      folderId: "",
      includeDescendantFolders: false
    });

    setActiveDashboardView("bookmarks");
    requestDesktopRecommendationsIfNeeded();
    if (shouldUseMobileSidebarPanels) {
      setMobileSidebarPanel("bookmark");
    }

    if (hasLoadedFullBookmarkInventory && canResolveFolderOverviewSearchLocally(nextSearch)) {
      const nextBookmarks = filterBookmarksForFolderOverviewSearch(
        bookmarkInventory,
        folders,
        nextSearch
      );

      startTransition(() => {
        setErrorMessage(null);
        setBookmarks(nextBookmarks);
        setSelectedBookmark(null);
        setBookmarkSearchDraft(nextSearch);
        setAppliedBookmarkSearch(nextSearch);
        setFolderOverviewSpecialFilter(null);
        resetBookmarkListPagination();
      });
      queueBookmarkAssetPreload(
        nextBookmarks.slice(0, bookmarkListPageSize),
        bookmarkAssetsByBookmarkId,
        "bookmarks"
      );
      return;
    }

    await applyBookmarkSearch(nextSearch);
  }

  async function handleFolderOverviewSpecialSelect(filter: FolderOverviewSpecialFilter) {
    const nextSearch = normalizeBookmarkSearchDraft({
      ...emptyBookmarkSearchDraft,
      sort: appliedBookmarkSearch.sort
    });

    setActiveDashboardView("bookmarks");
    requestDesktopRecommendationsIfNeeded();
    requestTagsIfNeeded();
    if (shouldUseMobileSidebarPanels) {
      setMobileSidebarPanel("bookmark");
    }

    try {
      setErrorMessage(null);
      if (filter === "trash" || filter === "all") {
        setIsLoadingDashboard(true);
      }

      let nextBookmarks: Bookmark[];
      let nextBookmarkInventory: Bookmark[] | null = null;

      if (filter === "trash") {
        nextBookmarks = await loadBookmarks({ ...nextSearch, trashMode: "trashed" });
        setBookmarks(nextBookmarks);
        setTrashedBookmarks(nextBookmarks);
        setSelectedBookmark(null);
        setBookmarkSearchDraft(nextSearch);
        setAppliedBookmarkSearch(nextSearch);
        setFolderOverviewSpecialFilter(filter);
        resetBookmarkListPagination();

        queueBookmarkAssetPreload(
          nextBookmarks.slice(0, bookmarkListPageSize),
          bookmarkAssetsByBookmarkId,
          "bookmarks"
        );
        return;
      } else if (filter === "all") {
        const { page } = await loadBookmarkListPage(nextSearch, bookmarkListPageSize, 0);
        nextBookmarks = page.bookmarks;
        setBookmarks(nextBookmarks);
        setSelectedBookmark(null);
        setBookmarkSearchDraft(nextSearch);
        setAppliedBookmarkSearch(nextSearch);
        setFolderOverviewSpecialFilter(filter);
        applyBookmarkListPaginationPage(page);

        queueBookmarkAssetPreload(nextBookmarks, bookmarkAssetsByBookmarkId, "bookmarks");
        return;
      } else if (nextSearch.sort !== "created_desc" || !hasLoadedFullBookmarkInventory) {
        const loadedCollections = await loadBookmarkCollections(nextSearch);
        nextBookmarks = filterBookmarksForFolderOverviewSpecialFilter(
          loadedCollections.visibleBookmarks,
          filter,
          extensionFolderIds
        );
        nextBookmarkInventory = loadedCollections.inventoryBookmarks;
      } else {
        nextBookmarks = filterBookmarksForFolderOverviewSpecialFilter(
          bookmarkInventory,
          filter,
          extensionFolderIds
        );
      }

      startTransition(() => {
        setBookmarks(nextBookmarks);
        if (filter === "trash") {
          setTrashedBookmarks(nextBookmarks);
        }
        if (nextBookmarkInventory) {
          setBookmarkInventory(nextBookmarkInventory);
          setHasLoadedFullBookmarkInventory(true);
          setHomeFavoriteBookmarks(null);
        }
        setSelectedBookmark(null);
        setBookmarkSearchDraft(nextSearch);
        setAppliedBookmarkSearch(nextSearch);
        setFolderOverviewSpecialFilter(filter);
        resetBookmarkListPagination();
      });

      queueBookmarkAssetPreload(
        nextBookmarks.slice(0, bookmarkListPageSize),
        bookmarkAssetsByBookmarkId,
        "bookmarks"
      );
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "북마크 범위를 바꾸지 못했습니다."
        );
      });
    } finally {
      if (filter === "trash" || filter === "all") {
        setIsLoadingDashboard(false);
      }
    }
  }

  function toggleFolderOverviewExpansion(folderId: string) {
    setExpandedFolderOverviewIds((currentIds) =>
      currentIds.includes(folderId)
        ? currentIds.filter((currentId) => currentId !== folderId)
        : [...currentIds, folderId]
    );
  }

  function toggleFolderManagerExpansion(folderId: string) {
    setExpandedFolderManagerIds((currentIds) =>
      currentIds.includes(folderId)
        ? currentIds.filter((currentId) => currentId !== folderId)
        : [...currentIds, folderId]
    );
  }

  function collapseAllFolderOverviewGroups() {
    setExpandedFolderOverviewIds([]);
  }

  function expandAllFolderOverviewGroups() {
    setExpandedFolderOverviewIds(
      Array.from(folderOverviewChildrenByParentId.entries())
        .filter(([folderId, childFolders]) => Boolean(folderId) && childFolders.length > 0)
        .map(([folderId]) => folderId as string)
    );
  }

  async function handleToggleHiddenFolders() {
    const nextShowHiddenFolders = !showHiddenFolders;
    setShowHiddenFolders(nextShowHiddenFolders);

    if (
      nextShowHiddenFolders ||
      !appliedBookmarkSearch.folderId ||
      !hiddenFolderIds.has(appliedBookmarkSearch.folderId)
    ) {
      return;
    }

    await applyBookmarkSearch({
      ...appliedBookmarkSearch,
      folderId: "",
      includeDescendantFolders: false
    });
  }

  function handleToggleHiddenBookmarks() {
    setShowHiddenBookmarks((currentValue) => {
      const nextValue = !currentValue;

      if (!nextValue && selectedBookmark?.isHidden === true) {
        setSelectedBookmark(null);
        setOpenBookmarkActionMenuId(null);
        setIsBookmarkDetailActionMenuOpen(false);
      }

      return nextValue;
    });
  }

  async function beginBookmarkEdit(bookmark: Bookmark) {
    preloadDashboardDialogChunk("bookmarkComposer");
    requestTagsIfNeeded();
    let editableBookmark = bookmark;
    if (bookmark.contentTruncated) {
      try {
        editableBookmark = await loadBookmark(bookmark.id);
        replaceBookmarkState(editableBookmark);
      } catch (error) {
        startTransition(() => {
          setErrorMessage(
            error instanceof Error ? error.message : "북마크 상세 정보를 불러오지 못했습니다."
          );
        });
        return;
      }
    }

    const nextDraft = {
      url: editableBookmark.url,
      folderId:
        editableBookmark.folderId && !extensionFolderIds.has(editableBookmark.folderId)
          ? editableBookmark.folderId
          : "",
      tagIds: editableBookmark.tagIds,
      bookmarkColor: editableBookmark.bookmarkColor ?? "",
      urlColor: editableBookmark.urlColor ?? "",
      userTitle: editableBookmark.userTitle ?? "",
      userContent: editableBookmark.userContent ?? "",
      userSummary: editableBookmark.userSummary ?? "",
      isFavorite: editableBookmark.isFavorite,
      isHidden: editableBookmark.isHidden
    };

    setIsMobileHeaderMenuOpen(false);
    setOpenBookmarkActionMenuId(null);
    setIsBookmarkDetailActionMenuOpen(false);
    setIsBookmarkComposerOpen(true);
    setIsBookmarkComposerClassificationOpen(
      editableBookmark.tagIds.length > 0 ||
        editableBookmark.isFavorite ||
        editableBookmark.isHidden
    );
    setIsBookmarkComposerDisplayOpen(
      Boolean(
        editableBookmark.bookmarkColor ||
          editableBookmark.urlColor ||
          (bookmarkAssetsByBookmarkId[editableBookmark.id]?.length ?? 0) > 0
      )
    );
    setEditingBookmarkId(editableBookmark.id);
    setBookmarkDraft(nextDraft);
    setInitialBookmarkDraft(nextDraft);
    setBookmarkPreview(
      editableBookmark.sourceTitle ||
        editableBookmark.sourceContent ||
        editableBookmark.sourceSummary
        ? {
            url: editableBookmark.url,
            normalizedUrl: editableBookmark.url,
            sourceTitle: editableBookmark.sourceTitle,
            sourceContent: editableBookmark.sourceContent,
            sourceSummary: editableBookmark.sourceSummary
          }
        : null
    );
    setBookmarkPreviewFailure(null);
    setIsQuickFolderOpen(false);
    setQuickFolderDraft(emptyFolderDraft);
    setIsQuickTagOpen(false);
    setQuickTagDraft(emptyTagDraft);
    setBookmarkTagSearchQuery("");

    if (bookmarkAssetsByBookmarkId[editableBookmark.id]) {
      return;
    }

    try {
      const assets = await loadBookmarkAssets(editableBookmark.id);
      startTransition(() => {
        setBookmarkAssetsByBookmarkId((currentAssetsByBookmarkId) => ({
          ...currentAssetsByBookmarkId,
          [editableBookmark.id]: assets
        }));
      });
    } catch {
      startTransition(() => {
        setErrorMessage("북마크 이미지를 불러오지 못했습니다.");
      });
    }
  }

  function requestCloseBookmarkComposer() {
    const hasPendingQuickFolderDraftChanges = Boolean(
      quickFolderDraft.name.trim() ||
        quickFolderDraft.color.trim() ||
        quickFolderDraft.icon.trim() ||
        (quickFolderDraft.parentFolderId && quickFolderDraft.parentFolderId !== bookmarkDraft.folderId)
    );
    const hasPendingQuickTagDraftChanges = Boolean(
      quickTagDraft.name.trim() || quickTagDraft.color.trim()
    );
    const hasBookmarkDraftChanges =
      !areBookmarkDraftsEqual(bookmarkDraft, initialBookmarkDraft) ||
      pendingAssetFiles.length > 0 ||
      hasPendingQuickFolderDraftChanges ||
      hasPendingQuickTagDraftChanges;

    if (
      hasBookmarkDraftChanges &&
      globalThis.confirm &&
      !globalThis.confirm("저장하지 않은 북마크 변경 사항이 있습니다. 닫을까요?")
    ) {
      return;
    }

    cancelBookmarkEdit();
  }

  function cancelBookmarkEdit() {
    setEditingBookmarkId(null);
    setIsBookmarkComposerClassificationOpen(false);
    setIsBookmarkComposerDisplayOpen(false);
    setBookmarkTagSearchQuery("");
    setBookmarkDraft(emptyBookmarkDraft);
    setInitialBookmarkDraft(emptyBookmarkDraft);
    setBookmarkPreview(null);
    setBookmarkPreviewFailure(null);
    setPendingAssetFiles([]);
    setIsQuickFolderOpen(false);
    setQuickFolderDraft(emptyFolderDraft);
    setIsQuickTagOpen(false);
    setQuickTagDraft(emptyTagDraft);
    setIsBookmarkComposerOpen(false);
  }

  function beginBookmarkCreate() {
    preloadDashboardDialogChunk("bookmarkComposer");
    requestTagsIfNeeded();
    const nextDraft = {
      ...emptyBookmarkDraft,
      folderId: appliedBookmarkSearch.folderId
    };

    setErrorMessage(null);
    setIsMobileHeaderMenuOpen(false);
    setOpenBookmarkActionMenuId(null);
    setIsBookmarkDetailActionMenuOpen(false);
    setEditingBookmarkId(null);
    setIsBookmarkComposerClassificationOpen(false);
    setIsBookmarkComposerDisplayOpen(false);
    setBookmarkDraft(nextDraft);
    setInitialBookmarkDraft(nextDraft);
    setBookmarkPreview(null);
    setBookmarkPreviewFailure(null);
    setPendingAssetFiles([]);
    setIsQuickFolderOpen(false);
    setQuickFolderDraft(emptyFolderDraft);
    setIsQuickTagOpen(false);
    setQuickTagDraft(emptyTagDraft);
    setBookmarkTagSearchQuery("");
    setIsBookmarkComposerOpen(true);
  }

  async function handleBookmarkExport() {
    try {
      setErrorMessage(null);
      const [exportBookmarks, exportFolders, exportTags] = await Promise.all([
        loadBookmarks(emptyBookmarkSearchDraft),
        loadFolders(),
        loadTags()
      ]);
      const exportBookmarkAssetsByBookmarkId = await loadBookmarkAssetsForBookmarks(exportBookmarks, {
        loadBookmarkAssetsByBookmarks,
        loadBookmarkAssets
      });
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        bookmarks: exportBookmarks,
        folders: exportFolders,
        tags: exportTags,
        bookmarkAssetsByBookmarkId: exportBookmarkAssetsByBookmarkId
      };
      const { downloadBookmarkExport } = await import("../lib/bookmark-export");
      downloadBookmarkExport(exportPayload);
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "북마크 내보내기를 완료하지 못했습니다."
        );
      });
    }
  }

  async function loadAllMemosForExport() {
    const exportMemos: Memo[] = [];
    let offset = 0;

    while (true) {
      const memoPage = await loadMemoPage({
        includeHidden: true,
        includeLocked: true,
        limit: MEMO_EXPORT_PAGE_SIZE,
        offset
      });
      exportMemos.push(...memoPage.memos);

      if (!memoPage.pagination?.hasMore || memoPage.memos.length === 0) {
        break;
      }

      offset += memoPage.pagination.limit;
    }

    return Promise.all(
      exportMemos.map(async (memo) => {
        try {
          return await loadMemo(memo.id);
        } catch {
          return memo;
        }
      })
    );
  }

  async function handleMemoExport() {
    try {
      setErrorMessage(null);
      const [exportMemos, exportFolders, exportTags] = await Promise.all([
        loadAllMemosForExport(),
        loadMemoFolders(),
        loadMemoTags()
      ]);
      const memoAssetsByMemoIdEntries = await Promise.all(
        exportMemos.map(async (memo) => {
          if (memo.assetCount <= 0) {
            return [memo.id, []] as const;
          }

          return [memo.id, await loadMemoAssets(memo.id)] as const;
        })
      );
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        memos: exportMemos,
        folders: exportFolders,
        tags: exportTags,
        memoAssetsByMemoId: Object.fromEntries(memoAssetsByMemoIdEntries)
      };
      const { downloadMemoExport } = await import("../lib/memo-export");
      downloadMemoExport(exportPayload);
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "메모 내보내기를 완료하지 못했습니다."
        );
      });
    }
  }

  function resetBookmarkDetailPreviewState() {
    bookmarkPreviewRequestIdRef.current += 1;
    setBookmarkDetailActiveTab("detail");
    setSelectedBookmarkLivePreview(null);
    setSelectedBookmarkPreviewError(null);
    setSelectedBookmarkPreviewNotice(null);
    setIsLoadingSelectedBookmarkPreview(false);
  }

  function showBookmarkDetailTab(tab: BookmarkDetailTab) {
    bookmarkPreviewRequestIdRef.current += 1;
    setBookmarkDetailActiveTab(tab);
    setSelectedBookmarkLivePreview(null);
    setSelectedBookmarkPreviewError(null);
    setSelectedBookmarkPreviewNotice(null);
    setIsLoadingSelectedBookmarkPreview(false);
  }

  function invalidateSelectedBookmarkPreviewCache(bookmarkId?: string) {
    invalidateBookmarkDetailPreviewCache(selectedBookmarkPreviewCachesRef.current, bookmarkId);
  }

  async function loadSelectedBookmarkPreview(bookmarkId: string) {
    const requestId = bookmarkPreviewRequestIdRef.current + 1;
    bookmarkPreviewRequestIdRef.current = requestId;

    const cachedPreview = selectedBookmarkPreviewCachesRef.current.previewCache.get(bookmarkId);
    if (cachedPreview) {
      if (cachedPreview.extensionPresence) {
        setBookmarkExtensionPresence(cachedPreview.extensionPresence);
      }
      startTransition(() => {
        setSelectedBookmarkLivePreview(cachedPreview.preview);
        setSelectedBookmarkPreviewNotice(cachedPreview.notice);
        setSelectedBookmarkPreviewError(null);
      });
      setIsLoadingSelectedBookmarkPreview(false);
      return;
    }

    setIsLoadingSelectedBookmarkPreview(true);
    setSelectedBookmarkLivePreview(null);
    setSelectedBookmarkPreviewError(null);
    setSelectedBookmarkPreviewNotice(null);

    try {
      const previewResult = await resolveBookmarkDetailPreview(
        bookmarkId,
        selectedBookmarkPreviewCachesRef.current,
        {
          loadBookmarkPreview,
          requestRenderedBookmarkPreview,
          onJsRequiredPreview: () => {
            if (bookmarkPreviewRequestIdRef.current === requestId) {
              setBookmarkExtensionPresence("checking");
            }
          }
        }
      );
      if (bookmarkPreviewRequestIdRef.current !== requestId) {
        return;
      }

      if (previewResult.extensionPresence) {
        setBookmarkExtensionPresence(previewResult.extensionPresence);
      }

      startTransition(() => {
        setSelectedBookmarkLivePreview(previewResult.preview);
        setSelectedBookmarkPreviewNotice(previewResult.notice);
      });
    } catch (error) {
      if (bookmarkPreviewRequestIdRef.current !== requestId) {
        return;
      }

      startTransition(() => {
        setSelectedBookmarkPreviewError(
          error instanceof Error ? error.message : "미리보기를 불러오지 못했습니다."
        );
        setSelectedBookmarkPreviewNotice(null);
      });
    } finally {
      if (bookmarkPreviewRequestIdRef.current !== requestId) {
        return;
      }

      setIsLoadingSelectedBookmarkPreview(false);
    }
  }

  function selectBookmarkDetailTab(tab: BookmarkDetailTab, bookmarkId: string) {
    setBookmarkDetailActiveTab(tab);
    if (tab !== "preview") {
      setIsBookmarkPreviewFullscreen(false);
    }
    if (tab === "preview") {
      void loadSelectedBookmarkPreview(bookmarkId);
    }
  }

  function toggleBookmarkPreviewFullscreen() {
    setIsBookmarkPreviewFullscreen((currentState) => !currentState);
  }

  async function openBookmarkDetail(
    bookmarkId: string,
    bookmarkOverride?: Bookmark,
    displayMode: BookmarkDetailDisplayMode = "rail"
  ) {
    preloadDashboardPanelChunk("detail");
    const requestId = bookmarkDetailRequestIdRef.current + 1;
    bookmarkDetailRequestIdRef.current = requestId;
    const knownBookmark = findKnownBookmark(bookmarkId, bookmarkOverride);
    const shouldIncludeTrashedBookmark =
      knownBookmark?.isTrashed === true || folderOverviewSpecialFilter === "trash";
    const cachedAssets = bookmarkAssetsByBookmarkId[bookmarkId];

    try {
      setErrorMessage(null);
      requestTagsIfNeeded();
      setOpenBookmarkActionMenuId(null);
      setIsBookmarkDetailActionMenuOpen(false);
      setBookmarkDetailDisplayMode(displayMode);
      setIsBookmarkPreviewFullscreen(false);
      resetBookmarkDetailPreviewState();

      if (knownBookmark) {
        startTransition(() => {
          setSelectedBookmark(knownBookmark);
        });
      } else {
        startTransition(() => {
          setSelectedBookmark(null);
        });
      }

      setIsLoadingSelectedBookmark(true);
      setIsLoadingSelectedBookmarkAssets(cachedAssets === undefined);

      void loadBookmark(bookmarkId, { includeTrashed: shouldIncludeTrashedBookmark })
        .then((bookmark) => {
          if (bookmarkDetailRequestIdRef.current !== requestId) {
            return;
          }

          startTransition(() => {
            replaceBookmarkState(bookmark);
          });
        })
        .catch((error) => {
          if (bookmarkDetailRequestIdRef.current !== requestId) {
            return;
          }

          startTransition(() => {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "북마크 상세 정보를 불러오지 못했습니다."
            );
            if (!knownBookmark) {
              setSelectedBookmark(null);
            }
          });
        })
        .finally(() => {
          if (bookmarkDetailRequestIdRef.current !== requestId) {
            return;
          }

          setIsLoadingSelectedBookmark(false);
        });

      if (cachedAssets === undefined) {
        void loadBookmarkAssets(bookmarkId)
          .then((assets) => {
            if (bookmarkDetailRequestIdRef.current !== requestId) {
              return;
            }

            startTransition(() => {
              setBookmarkAssetsByBookmarkId((currentAssetsByBookmarkId) => ({
                ...currentAssetsByBookmarkId,
                [bookmarkId]: assets
              }));
            });
          })
          .catch(() => {
            if (bookmarkDetailRequestIdRef.current !== requestId) {
              return;
            }

            startTransition(() => {
              setErrorMessage("북마크 이미지를 불러오지 못했습니다.");
            });
          })
          .finally(() => {
            if (bookmarkDetailRequestIdRef.current !== requestId) {
              return;
            }

            setIsLoadingSelectedBookmarkAssets(false);
          });
      } else {
        setIsLoadingSelectedBookmarkAssets(false);
      }
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "북마크 상세 정보를 불러오지 못했습니다."
        );
      });
      setIsLoadingSelectedBookmark(false);
      setIsLoadingSelectedBookmarkAssets(false);
    }
  }

  function closeBookmarkDetail() {
    bookmarkDetailRequestIdRef.current += 1;
    bookmarkPreviewRequestIdRef.current += 1;
    setIsBookmarkDetailActionMenuOpen(false);
    setBookmarkDetailDisplayMode("rail");
    setBookmarkDetailActiveTab("detail");
    setIsBookmarkPreviewFullscreen(false);
    setIsLoadingSelectedBookmark(false);
    setIsLoadingSelectedBookmarkAssets(false);
    setIsLoadingSelectedBookmarkPreview(false);
    setSelectedBookmarkLivePreview(null);
    setSelectedBookmarkPreviewError(null);
    setSelectedBookmarkPreviewNotice(null);
    setSelectedBookmark(null);
  }

  function toggleBookmarkDetailFromCard(bookmark: Bookmark) {
    if (
      bookmarkDetailDisplayMode === "rail" &&
      selectedBookmark?.id === bookmark.id
    ) {
      closeBookmarkDetail();
      return;
    }

    void openBookmarkDetail(bookmark.id, bookmark);
  }

  function removeBookmarkState(bookmarkId: string) {
    invalidateSelectedBookmarkPreviewCache(bookmarkId);
    setBookmarks((currentBookmarks) =>
      currentBookmarks.filter((bookmark) => bookmark.id !== bookmarkId)
    );
    setBookmarkInventory((currentBookmarks) =>
      currentBookmarks.filter((bookmark) => bookmark.id !== bookmarkId)
    );
    setHomeFavoriteBookmarks((currentBookmarks) =>
      currentBookmarks
        ? currentBookmarks.filter((bookmark) => bookmark.id !== bookmarkId)
        : currentBookmarks
    );
    setTrashedBookmarks((currentBookmarks) =>
      currentBookmarks.filter((bookmark) => bookmark.id !== bookmarkId)
    );
    setSelectedBookmark((currentSelectedBookmark) =>
      currentSelectedBookmark?.id === bookmarkId ? null : currentSelectedBookmark
    );
    setBookmarkAssetsByBookmarkId((currentAssetsByBookmarkId) => {
      const nextAssetsByBookmarkId = { ...currentAssetsByBookmarkId };
      delete nextAssetsByBookmarkId[bookmarkId];
      return nextAssetsByBookmarkId;
    });
    setRecommendations((currentRecommendations) => ({
      favorites: currentRecommendations.favorites.filter((bookmark) => bookmark.id !== bookmarkId),
      recent: currentRecommendations.recent.filter((bookmark) => bookmark.id !== bookmarkId),
      frequent: currentRecommendations.frequent.filter((bookmark) => bookmark.id !== bookmarkId)
    }));

    if (editingBookmarkId === bookmarkId) {
      cancelBookmarkEdit();
    }
  }

  function replaceBookmarkState(nextBookmark: Bookmark) {
    setBookmarks((currentBookmarks) =>
      currentBookmarks.map((bookmark) =>
        bookmark.id === nextBookmark.id ? nextBookmark : bookmark
      )
    );
    setBookmarkInventory((currentBookmarks) =>
      currentBookmarks.map((bookmark) =>
        bookmark.id === nextBookmark.id ? nextBookmark : bookmark
      )
    );
    setHomeFavoriteBookmarks((currentBookmarks) => {
      if (!currentBookmarks) {
        return currentBookmarks;
      }

      if (!nextBookmark.isFavorite || nextBookmark.isTrashed) {
        return currentBookmarks.filter((bookmark) => bookmark.id !== nextBookmark.id);
      }

      return upsertBookmarkById(currentBookmarks, nextBookmark);
    });
    setSelectedBookmark((currentSelectedBookmark) =>
      currentSelectedBookmark?.id === nextBookmark.id ? nextBookmark : currentSelectedBookmark
    );
    setTrashedBookmarks((currentBookmarks) =>
      nextBookmark.isTrashed
        ? upsertBookmarkById(currentBookmarks, nextBookmark)
        : currentBookmarks.filter((bookmark) => bookmark.id !== nextBookmark.id)
    );
  }

  async function uploadPendingAssets(bookmarkId: string) {
    if (pendingAssetFiles.length === 0) {
      return [];
    }

    const uploadedAssets: BookmarkAsset[] = [];
    for (const file of pendingAssetFiles) {
      uploadedAssets.push(await uploadBookmarkAsset(bookmarkId, file));
    }

    return uploadedAssets;
  }

  function appendPendingAssetFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setPendingAssetFiles((currentFiles) => [...currentFiles, ...files]);
  }

  function removePendingAssetFile(fileName: string, fileSize: number) {
    setPendingAssetFiles((currentFiles) =>
      currentFiles.filter((file) => !(file.name === fileName && file.size === fileSize))
    );
  }

  function closeExtensionTokenDialog() {
    setIsExtensionTokenDialogOpen(false);
    setExtensionTokenLabelDraft("");
    setLatestIssuedExtensionToken(null);
    setExtensionConnectionMessage(null);
    setIsConnectingExtension(false);
  }

  function closeExtensionDownloadDialog() {
    setIsExtensionDownloadDialogOpen(false);
    setUserscriptCopyStatus(null);
  }

  function openExtensionDownloadDialog() {
    preloadDashboardDialogChunk("extensionDownload");
    setIsExtensionDownloadDialogOpen(true);
  }

  async function copyTextToClipboard(value: string) {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(value);
      return;
    }

    const ownerDocument = globalThis.document;
    if (!ownerDocument?.body) {
      throw new Error("클립보드에 복사할 수 없습니다.");
    }

    const textarea = ownerDocument.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    ownerDocument.body.append(textarea);
    textarea.select();

    const copied = ownerDocument.execCommand("copy");
    textarea.remove();

    if (!copied) {
      throw new Error("클립보드에 복사할 수 없습니다.");
    }
  }

  async function handleUserscriptCodeCopy() {
    try {
      setUserscriptCopyStatus("스크립트 코드를 불러오는 중입니다.");
      const response = await fetch(USERSCRIPT_DOWNLOAD_PATH, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("스크립트 파일을 불러오지 못했습니다.");
      }

      await copyTextToClipboard(await response.text());
      setUserscriptCopyStatus(
        "스크립트 코드를 복사했습니다. Tampermonkey 대시보드에서 +를 누른 뒤 붙여넣고 저장하세요."
      );
    } catch (error) {
      setUserscriptCopyStatus(
        error instanceof Error
          ? error.message
          : "스크립트 코드를 복사하지 못했습니다. 파일 다운로드를 사용해주세요."
      );
    }
  }

  function requestCloseExtensionTokenDialog() {
    const hasExtensionTokenDialogChanges = Boolean(
      extensionTokenLabelDraft.trim() || latestIssuedExtensionToken
    );

    if (
      hasExtensionTokenDialogChanges &&
      globalThis.confirm &&
      !globalThis.confirm("저장하지 않은 확장 토큰 변경 사항이 있습니다. 닫을까요?")
    ) {
      return;
    }

    closeExtensionTokenDialog();
  }

  async function openExtensionTokenDialog() {
    preloadDashboardDialogChunk("extensionToken");
    try {
      setErrorMessage(null);
      const nextTokens = await loadExtensionTokens();
      startTransition(() => {
        setExtensionTokens(nextTokens);
        setIsExtensionTokenDialogOpen(true);
        setExtensionConnectionMessage(null);
      });
    } catch (error) {
      startTransition(() => {
        setExtensionTokens([]);
        setIsExtensionTokenDialogOpen(true);
        setErrorMessage(
          error instanceof Error ? error.message : "확장 토큰 목록을 불러오지 못했습니다."
        );
      });
    }
  }

  async function handleBookmarkAssetDelete(bookmarkId: string, assetId: string) {
    try {
      setErrorMessage(null);
      await deleteBookmarkAsset(bookmarkId, assetId);
      startTransition(() => {
        setBookmarkAssetsByBookmarkId((currentAssetsByBookmarkId) => ({
          ...currentAssetsByBookmarkId,
          [bookmarkId]: (currentAssetsByBookmarkId[bookmarkId] ?? []).filter(
            (asset) => asset.id !== assetId
          )
        }));
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "북마크 이미지를 삭제하지 못했습니다."
        );
      });
    }
  }

  async function handleExtensionTokenCreate() {
    const label = extensionTokenLabelDraft.trim();
    if (!label) {
      setErrorMessage("확장 토큰 이름을 입력해주세요.");
      return;
    }

    try {
      setErrorMessage(null);
      const created = await createExtensionToken(label);
      startTransition(() => {
        setExtensionTokens((currentTokens) => [created.token, ...currentTokens]);
        setLatestIssuedExtensionToken(created.rawToken);
        setExtensionTokenLabelDraft("");
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "확장 토큰을 생성하지 못했습니다."
        );
      });
    }
  }

  function getExtensionConnectionApiBaseUrl() {
    return globalThis.location?.origin || "https://bookmark.keygenerator25.workers.dev";
  }

  function createExtensionConnectionTokenLabel() {
    return `자동 연결 ${new Date().toLocaleString("ko-KR")}`;
  }

  async function handleExtensionAutoConnect() {
    try {
      setErrorMessage(null);
      setIsConnectingExtension(true);
      setExtensionConnectionMessage("확장 설치 여부를 확인하고 있습니다.");

      const presenceDetails = await detectBookmarkExtensionPresenceDetails(700);
      if (presenceDetails.status !== "installed") {
        setExtensionConnectionMessage(
          "확장 프로그램 또는 Tampermonkey 스크립트를 감지하지 못했습니다. 설치와 실행 권한을 확인한 뒤 다시 시도해주세요."
        );
        return;
      }

      const created = await createExtensionToken(createExtensionConnectionTokenLabel());
      const preferredClientType = presenceDetails.clientTypes.includes("userscript")
        ? "userscript"
        : undefined;
      const connectionStatus = await configureBookmarkExtensionSettings(
        {
          apiBaseUrl: getExtensionConnectionApiBaseUrl(),
          token: created.rawToken
        },
        1200,
        globalThis.window,
        {
          preferredClientType
        }
      );

      startTransition(() => {
        setExtensionTokens((currentTokens) => [created.token, ...currentTokens]);
        setLatestIssuedExtensionToken(created.rawToken);
        setExtensionTokenLabelDraft("");
        setExtensionConnectionMessage(
          connectionStatus === "configured"
            ? "확장 설정을 저장했습니다. 이제 확장 팝업 또는 Tampermonkey 메뉴에서 바로 저장할 수 있습니다."
            : preferredClientType === "userscript"
              ? "토큰은 발급됐지만 Tampermonkey 저장소에 자동 저장하지 못했습니다. 표시된 토큰을 Tampermonkey 저장 패널에 수동으로 입력해주세요."
              : "토큰은 발급됐지만 확장 자동 설정을 완료하지 못했습니다. 표시된 토큰을 수동으로 입력해주세요."
        );
      });
    } catch (error) {
      startTransition(() => {
        setExtensionConnectionMessage(null);
        setErrorMessage(
          error instanceof Error ? error.message : "확장 자동 연결을 완료하지 못했습니다."
        );
      });
    } finally {
      setIsConnectingExtension(false);
    }
  }

  async function handleExtensionTokenRevoke(tokenId: string) {
    try {
      setErrorMessage(null);
      await revokeExtensionToken(tokenId);
      startTransition(() => {
        setExtensionTokens((currentTokens) =>
          currentTokens.filter((token) => token.id !== tokenId)
        );
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "확장 토큰을 삭제하지 못했습니다."
        );
      });
    }
  }

  async function requestRenderedBookmarkPreview(
    url: string
  ): Promise<BookmarkExtensionRenderedPreviewAttempt> {
    try {
      const presence = await detectBookmarkExtensionPresence(450);
      if (presence !== "installed") {
        return {
          status: "missing",
          presence
        };
      }

      const previewResult = await requestBookmarkExtensionPreview(url, 2_000);
      if (previewResult.status === "success") {
        return {
          status: "success",
          presence,
          preview: previewResult.preview
        };
      }

      return {
        status: previewResult.status,
        presence
      };
    } catch {
      return {
        status: "failed",
        presence: "missing"
      };
    }
  }

  async function handleBookmarkPreviewLoad() {
    if (!bookmarkDraft.url.trim()) {
      setErrorMessage("미리보기를 불러올 URL을 입력해주세요.");
      return;
    }

    try {
      setErrorMessage(null);
      setBookmarkPreviewFailure(null);
      setIsLoadingBookmarkPreview(true);
      const preview = await extractBookmarkPreview(bookmarkDraft.url.trim());
      let resolvedPreview = preview;
      let previewFailureMessage: string | null = null;

      if (isJsRequiredBookmarkPreview(preview)) {
        setBookmarkExtensionPresence("checking");
        const renderedPreview = await requestRenderedBookmarkPreview(
          preview.normalizedUrl || preview.url
        );
        setBookmarkExtensionPresence(renderedPreview.presence);

        if (renderedPreview.status === "success") {
          resolvedPreview = renderedPreview.preview;
        } else {
          previewFailureMessage = getBookmarkPreviewWorkerFallbackMessage(
            renderedPreview.status
          );
        }
      }

      startTransition(() => {
        setBookmarkPreview(resolvedPreview);
        setBookmarkPreviewFailure(previewFailureMessage);
      });
    } catch (error) {
      const fallbackMessage =
        error instanceof Error
          ? error.message
          : "URL 메타 미리보기를 불러오지 못했습니다.";

      startTransition(() => {
        setBookmarkPreview(null);
        setBookmarkPreviewFailure(fallbackMessage);
        setErrorMessage(fallbackMessage);
      });
      setBookmarkExtensionPresence("checking");
      void detectBookmarkExtensionPresence(450).then((status) => {
        setBookmarkExtensionPresence(status);
      });
    } finally {
      setIsLoadingBookmarkPreview(false);
    }
  }

  async function handleBookmarkOpen(bookmark: Bookmark) {
    try {
      setErrorMessage(null);
      setOpenBookmarkActionMenuId(null);
      setIsBookmarkDetailActionMenuOpen(false);
      await recordBookmarkOpen(bookmark.id);
      startTransition(() => {
        setRecommendations((currentRecommendations) => ({
          ...currentRecommendations,
          recent: [
            bookmark,
            ...currentRecommendations.recent.filter(
              (currentBookmark) => currentBookmark.id !== bookmark.id
            )
          ].slice(0, 5)
        }));
      });
      window.open(bookmark.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "북마크 열기 기록을 저장하지 못했습니다."
        );
      });
    }
  }

  async function handleBookmarkReextract(bookmarkId: string) {
    try {
      setErrorMessage(null);
      setIsBookmarkDetailActionMenuOpen(false);
      const nextBookmark = await reextractBookmark(bookmarkId);
      invalidateSelectedBookmarkPreviewCache(bookmarkId);
      startTransition(() => {
        replaceBookmarkState(nextBookmark);
        showBookmarkDetailTab("extract");
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "자동 추출을 다시 수행하지 못했습니다."
        );
      });
    }
  }

  async function handleBookmarkDelete(bookmark: Bookmark) {
    setOpenBookmarkActionMenuId(null);
    setIsBookmarkDetailActionMenuOpen(false);
    if (!globalThis.confirm?.(`'${bookmark.displayTitle || bookmark.url}' 북마크를 삭제할까요?`)) {
      return;
    }

    try {
      setErrorMessage(null);
      await deleteBookmark(bookmark.id);
      invalidateSelectedBookmarkPreviewCache(bookmark.id);
      const trashedBookmark: Bookmark = {
        ...bookmark,
        isTrashed: true,
        trashedAt: new Date().toISOString()
      };
      startTransition(() => {
        setBookmarks((currentBookmarks) =>
          currentBookmarks.filter((currentBookmark) => currentBookmark.id !== bookmark.id)
        );
        setBookmarkInventory((currentBookmarks) =>
          currentBookmarks.filter((currentBookmark) => currentBookmark.id !== bookmark.id)
        );
        setHomeFavoriteBookmarks((currentBookmarks) =>
          currentBookmarks
            ? currentBookmarks.filter((currentBookmark) => currentBookmark.id !== bookmark.id)
            : currentBookmarks
        );
        setTrashedBookmarks((currentBookmarks) =>
          upsertBookmarkById(currentBookmarks, trashedBookmark)
        );
        setSelectedBookmark((currentSelectedBookmark) =>
          currentSelectedBookmark?.id === bookmark.id ? null : currentSelectedBookmark
        );
        setRecommendations((currentRecommendations) => ({
          favorites: currentRecommendations.favorites.filter(
            (currentBookmark) => currentBookmark.id !== bookmark.id
          ),
          recent: currentRecommendations.recent.filter(
            (currentBookmark) => currentBookmark.id !== bookmark.id
          ),
          frequent: currentRecommendations.frequent.filter(
            (currentBookmark) => currentBookmark.id !== bookmark.id
          )
        }));
        if (editingBookmarkId === bookmark.id) {
          cancelBookmarkEdit();
        }
      });
      void refreshBookmarkCounts();
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "북마크를 삭제하지 못했습니다."
        );
      });
    }
  }

  async function handleFolderDelete(folder: Folder, scope: ManagerScope = "bookmarks") {
    if (
      globalThis.confirm &&
      !globalThis.confirm(`'${folder.name}' 폴더를 삭제할까요?`)
    ) {
      return;
    }

    try {
      setErrorMessage(null);
      setOpenFolderActionMenuId(null);

      if (scope === "memos") {
        await deleteMemoFolder(folder.id);
        startTransition(() => {
          removeMemoFolderState(folder.id);
        });
        if (memoFolderFilterId === folder.id) {
          void refreshMemoWorkspace({
            folderFilterId: null
          });
        }
        return;
      }

      const shouldRefreshSearch = appliedBookmarkSearch.folderId === folder.id;
      const nextSearch = shouldRefreshSearch
        ? {
            ...appliedBookmarkSearch,
            folderId: ""
          }
        : appliedBookmarkSearch;
      await deleteFolder(folder.id);
      startTransition(() => {
        removeFolderState(folder.id);
      });
      void refreshBookmarkCounts();

      if (shouldRefreshSearch) {
        await refreshDashboardData(nextSearch);
      }
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "폴더를 삭제하지 못했습니다."
        );
      });
    }
  }

  function toggleBookmarkActionMenu(bookmarkId: string) {
    setOpenBookmarkActionMenuId((currentBookmarkId) =>
      currentBookmarkId === bookmarkId ? null : bookmarkId
    );
  }

  function toggleBookmarkDetailActionMenu() {
    setIsBookmarkDetailActionMenuOpen((currentValue) => !currentValue);
  }

  async function handleTagDelete(tag: Tag, scope: ManagerScope = "bookmarks") {
    if (globalThis.confirm && !globalThis.confirm(`'${tag.name}' 태그를 삭제할까요?`)) {
      return;
    }

    try {
      setErrorMessage(null);

      if (scope === "memos") {
        await deleteMemoTag(tag.id);
        startTransition(() => {
          removeMemoTagState(tag.id);
        });
        if (memoTagFilterId === tag.id) {
          void refreshMemoWorkspace({
            tagFilterId: null
          });
        }
        return;
      }

      const shouldRefreshSearch = appliedBookmarkSearch.tagIds.includes(tag.id);
      const nextSearch = shouldRefreshSearch
        ? {
            ...appliedBookmarkSearch,
            tagIds: appliedBookmarkSearch.tagIds.filter(
              (currentTagId) => currentTagId !== tag.id
            )
          }
        : appliedBookmarkSearch;
      await deleteTag(tag.id);
      startTransition(() => {
        removeTagState(tag.id);
      });

      if (shouldRefreshSearch) {
        await refreshDashboardData(nextSearch);
      }
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "태그를 삭제하지 못했습니다."
        );
      });
    }
  }

  async function handleResetUserContent(bookmarkId: string) {
    try {
      setErrorMessage(null);
      setIsBookmarkDetailActionMenuOpen(false);
      const nextBookmark = await updateBookmark(bookmarkId, {
        userTitle: null,
        userContent: null,
        userSummary: null
      });

      startTransition(() => {
        replaceBookmarkState(nextBookmark);
        showBookmarkDetailTab("detail");
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "사용자 입력값을 초기화하지 못했습니다."
        );
      });
    }
  }

  async function handleBookmarkUrlCopy(bookmark: Bookmark) {
    try {
      setErrorMessage(null);
      setStatusMessage(null);
      setOpenBookmarkActionMenuId(null);
      await copyTextToClipboard(bookmark.url);
      setStatusMessage("URL을 복사했습니다.");
    } catch (error) {
      setStatusMessage(null);
      setErrorMessage(error instanceof Error ? error.message : "URL을 복사하지 못했습니다.");
    }
  }

  async function handleBookmarkRestore(bookmark: Bookmark) {
    setOpenBookmarkActionMenuId(null);
    setIsBookmarkDetailActionMenuOpen(false);

    try {
      setErrorMessage(null);
      const restoredBookmark = await restoreBookmark(bookmark.id);
      startTransition(() => {
        setTrashedBookmarks((currentBookmarks) =>
          currentBookmarks.filter((currentBookmark) => currentBookmark.id !== restoredBookmark.id)
        );
        setBookmarkInventory((currentBookmarks) =>
          upsertBookmarkById(currentBookmarks, restoredBookmark)
        );
        setHomeFavoriteBookmarks((currentBookmarks) =>
          currentBookmarks && restoredBookmark.isFavorite
            ? upsertBookmarkById(currentBookmarks, restoredBookmark)
            : currentBookmarks
        );
        setBookmarks((currentBookmarks) =>
          folderOverviewSpecialFilter === "trash"
            ? currentBookmarks.filter(
                (currentBookmark) => currentBookmark.id !== restoredBookmark.id
              )
            : upsertBookmarkById(currentBookmarks, restoredBookmark)
        );
        setSelectedBookmark((currentSelectedBookmark) =>
          currentSelectedBookmark?.id === restoredBookmark.id ? null : currentSelectedBookmark
        );
      });
      void refreshBookmarkCounts();
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "휴지통에서 북마크를 복구하지 못했습니다."
        );
      });
    }
  }

  async function handleBookmarkPermanentDelete(bookmark: Bookmark) {
    setOpenBookmarkActionMenuId(null);
    setIsBookmarkDetailActionMenuOpen(false);
    if (
      globalThis.confirm &&
      !globalThis.confirm(`'${bookmark.displayTitle || bookmark.url}' 북마크를 영구 삭제할까요?`)
    ) {
      return;
    }

    try {
      setErrorMessage(null);
      await permanentlyDeleteBookmark(bookmark.id);
      startTransition(() => {
        removeBookmarkState(bookmark.id);
      });
      void refreshBookmarkCounts();
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "북마크를 영구 삭제하지 못했습니다."
        );
      });
    }
  }

  async function handleEmptyBookmarkTrash() {
    if (isEmptyingBookmarkTrash || totalTrashBookmarkCount <= 0) {
      return;
    }

    setOpenBookmarkActionMenuId(null);
    setIsBookmarkDetailActionMenuOpen(false);

    if (
      globalThis.confirm &&
      !globalThis.confirm(
        `휴지통의 북마크 ${totalTrashBookmarkCount}개를 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }

    const deletedBookmarkIds = new Set(trashedBookmarks.map((bookmark) => bookmark.id));

    try {
      setIsEmptyingBookmarkTrash(true);
      setErrorMessage(null);
      const { deletedCount } = await emptyBookmarkTrash();
      startTransition(() => {
        setTrashedBookmarks([]);
        setBookmarks((currentBookmarks) =>
          isTrashBookmarkView
            ? []
            : currentBookmarks.filter((bookmark) => !deletedBookmarkIds.has(bookmark.id))
        );
        setBookmarkInventory((currentBookmarks) =>
          currentBookmarks.filter(
            (bookmark) => !bookmark.isTrashed && !deletedBookmarkIds.has(bookmark.id)
          )
        );
        setHomeFavoriteBookmarks((currentBookmarks) =>
          currentBookmarks
            ? currentBookmarks.filter((bookmark) => !deletedBookmarkIds.has(bookmark.id))
            : currentBookmarks
        );
        setSelectedBookmark((currentSelectedBookmark) =>
          currentSelectedBookmark?.isTrashed ||
          (currentSelectedBookmark && deletedBookmarkIds.has(currentSelectedBookmark.id))
            ? null
            : currentSelectedBookmark
        );
        setBookmarkAssetsByBookmarkId((currentAssetsByBookmarkId) => {
          const nextAssetsByBookmarkId = { ...currentAssetsByBookmarkId };
          for (const bookmarkId of deletedBookmarkIds) {
            delete nextAssetsByBookmarkId[bookmarkId];
          }
          return nextAssetsByBookmarkId;
        });
        setRecommendations((currentRecommendations) => ({
          favorites: currentRecommendations.favorites.filter(
            (bookmark) => !deletedBookmarkIds.has(bookmark.id)
          ),
          recent: currentRecommendations.recent.filter(
            (bookmark) => !deletedBookmarkIds.has(bookmark.id)
          ),
          frequent: currentRecommendations.frequent.filter(
            (bookmark) => !deletedBookmarkIds.has(bookmark.id)
          )
        }));
        setStatusMessage(`휴지통의 북마크 ${deletedCount}개를 영구 삭제했습니다.`);
      });
      void refreshBookmarkCounts();
    } catch (error) {
      startTransition(() => {
        setErrorMessage(error instanceof Error ? error.message : "휴지통을 비우지 못했습니다.");
      });
    } finally {
      setIsEmptyingBookmarkTrash(false);
    }
  }

  async function handleResetSourceContent(bookmarkId: string) {
    try {
      setErrorMessage(null);
      setIsBookmarkDetailActionMenuOpen(false);
      const nextBookmark = await updateBookmark(bookmarkId, {
        sourceTitle: null,
        sourceContent: null,
        sourceSummary: null
      });
      invalidateSelectedBookmarkPreviewCache(bookmarkId);

      startTransition(() => {
        replaceBookmarkState(nextBookmark);
        showBookmarkDetailTab("extract");
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "자동 추출값을 초기화하지 못했습니다."
        );
      });
    }
  }

  function findKnownBookmark(bookmarkId: string, bookmarkOverride?: Bookmark) {
    if (bookmarkOverride?.id === bookmarkId) {
      return bookmarkOverride;
    }

    if (selectedBookmark?.id === bookmarkId) {
      return selectedBookmark;
    }

    const visibleBookmarkMatch = bookmarks.find((bookmark) => bookmark.id === bookmarkId);
    if (visibleBookmarkMatch) {
      return visibleBookmarkMatch;
    }

    const inventoryBookmarkMatch = bookmarkInventory.find((bookmark) => bookmark.id === bookmarkId);
    if (inventoryBookmarkMatch) {
      return inventoryBookmarkMatch;
    }

    const trashedBookmarkMatch = trashedBookmarks.find((bookmark) => bookmark.id === bookmarkId);
    if (trashedBookmarkMatch) {
      return trashedBookmarkMatch;
    }

    return (
      recommendations.favorites.find((bookmark) => bookmark.id === bookmarkId) ??
      recommendations.recent.find((bookmark) => bookmark.id === bookmarkId) ??
      recommendations.frequent.find((bookmark) => bookmark.id === bookmarkId) ??
      null
    );
  }

  function handleClearBookmarkPreview() {
    setBookmarkPreview(null);
    setBookmarkPreviewFailure(null);
  }

  function handleDismissBookmarkPreviewFallback() {
    setBookmarkPreviewFailure(null);
    setErrorMessage(null);
  }

  function handleUseUrlOnlyBookmarkDraft() {
    setBookmarkPreview(null);
    setBookmarkPreviewFailure(null);
    setErrorMessage(null);
  }

  function handleOpenBookmarkPreviewSourceUrl() {
    const url = bookmarkDraft.url.trim();
    if (!url) {
      return;
    }

    globalThis.open(url, "_blank", "noopener,noreferrer");
  }

  const foldersById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder] as const)),
    [folders]
  );
  const tagsById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag] as const)),
    [tags]
  );

  function getFolder(folderId: string | null) {
    if (!folderId) {
      return null;
    }

    return foldersById.get(folderId) ?? null;
  }

  function getFolderName(folderId: string | null) {
    if (!folderId || extensionFolderIds.has(folderId)) {
      return "미분류";
    }

    return getFolder(folderId)?.name ?? folderId;
  }

  function getTag(tagId: string) {
    return tagsById.get(tagId) ?? null;
  }

  function getTagNames(tagIds: string[]) {
    return tagIds.map((tagId) => getTag(tagId)?.name ?? tagId);
  }

  function getTagDisplayItems(tagIds: string[]) {
    return tagIds.map((tagId) => {
      const tag = getTag(tagId);
      return {
        id: tagId,
        name: tag?.name ?? tagId,
        color: tag?.color ?? null
      };
    });
  }

  const shouldUseCompactMobileCards = isMobileSearchViewport;
  const shouldUseMobileSidebarPanels = isMobileSearchViewport;
  const isHomeDashboardView = activeDashboardView === "home";
  const isMemoDashboardView = activeDashboardView === "memos";
  const shouldUseMemoSidebar = isMemoDashboardView && !shouldUseMobileSidebarPanels;
  const shouldUseBookmarkSidebarPanels = shouldUseMobileSidebarPanels && !isMemoDashboardView;
  const shouldRenderDashboardSidebar = !isMemoDashboardView || shouldUseMemoSidebar;
  const shouldRenderMobileFolderTab =
    shouldUseBookmarkSidebarPanels && mobileSidebarPanel === "folder";
  const shouldRenderMobileBookmarkTab =
    shouldUseBookmarkSidebarPanels && mobileSidebarPanel === "bookmark";
  const shouldRenderMobileRecommendationTab =
    shouldUseBookmarkSidebarPanels && mobileSidebarPanel === "recommendation";
  const shouldRenderBookmarkResultsPanel =
    activeDashboardView === "bookmarks" &&
    (!shouldUseMobileSidebarPanels || shouldRenderMobileBookmarkTab);
  const isInitialDashboardBootstrapping =
    sessionState.status === "loading" && Boolean(initialUser);
  const shouldRenderBookmarkComposerOverlay = isBookmarkComposerOpen;
  const shouldRenderFolderManagerOverlay = isFolderManagerOpen;
  const shouldRenderTagManagerOverlay = isTagManagerOpen;
  const extensionFolderIds = useMemo(() => getExtensionFolderIds(folders), [folders]);
  const rawHiddenFolderIds = useMemo(() => getHiddenFolderIds(folders), [folders]);
  const hiddenFolderIds = useMemo(
    () => new Set(
      Array.from(rawHiddenFolderIds).filter((folderId) => !extensionFolderIds.has(folderId))
    ),
    [extensionFolderIds, rawHiddenFolderIds]
  );
  const hiddenMemoFolderIds = useMemo(() => getHiddenFolderIds(memoFolders), [memoFolders]);
  const hasActiveAppliedBookmarkSearch = useMemo(
    () => hasActiveBookmarkSearch(appliedBookmarkSearch),
    [appliedBookmarkSearch]
  );
  const shouldShowMobileSearchSummary =
    isMobileSearchViewport && hasActiveAppliedBookmarkSearch;
  const activeBookmarkSearchSummaryItems = useMemo(
    () =>
      getBookmarkSearchSummaryItems(appliedBookmarkSearch, {
        getFolderName: (folderId) => {
          if (!folderId || extensionFolderIds.has(folderId)) {
            return "미분류";
          }

          return foldersById.get(folderId)?.name ?? folderId;
        },
        getTagNames: (tagIds) =>
          tagIds.map((tagId) => tagsById.get(tagId)?.name ?? tagId)
      }),
    [appliedBookmarkSearch, extensionFolderIds, foldersById, tagsById]
  );
  const visibleFolders = useMemo(
    () =>
      showHiddenFolders
        ? folders.filter((folder) => !extensionFolderIds.has(folder.id))
        : folders.filter(
            (folder) => !hiddenFolderIds.has(folder.id) && !extensionFolderIds.has(folder.id)
          ),
    [extensionFolderIds, folders, hiddenFolderIds, showHiddenFolders]
  );
  const visibleMemoFolders = useMemo(
    () =>
      showHiddenMemoFolders
        ? memoFolders
        : memoFolders.filter((folder) => !hiddenMemoFolderIds.has(folder.id)),
    [hiddenMemoFolderIds, memoFolders, showHiddenMemoFolders]
  );
  const visibleMemoPanelMemos = useMemo(
    () => filterMemosByHiddenFolders(memos, hiddenMemoFolderIds, showHiddenMemoFolders),
    [hiddenMemoFolderIds, memos, showHiddenMemoFolders]
  );
  const visibleMemoPanelTotalCount = showHiddenMemoFolders
    ? memoTotalCount
    : visibleMemoPanelMemos.length;
  const memoComposerFolders = useMemo(() => {
    if (
      !memoDraft.folderId ||
      visibleMemoFolders.some((folder) => folder.id === memoDraft.folderId)
    ) {
      return visibleMemoFolders;
    }

    const selectedFolderIds = new Set([
      memoDraft.folderId,
      ...getFolderAncestorIds(memoFolders, memoDraft.folderId)
    ]);
    const visibleMemoFolderIds = new Set(visibleMemoFolders.map((folder) => folder.id));

    return memoFolders.filter(
      (folder) => visibleMemoFolderIds.has(folder.id) || selectedFolderIds.has(folder.id)
    );
  }, [memoDraft.folderId, memoFolders, visibleMemoFolders]);
  const visibleBookmarks = useMemo(
    () =>
      filterBookmarksByHiddenBookmarks(
        filterBookmarksByHiddenFolders(bookmarks, hiddenFolderIds, showHiddenFolders),
        showHiddenBookmarks
      ),
    [bookmarks, hiddenFolderIds, showHiddenBookmarks, showHiddenFolders]
  );
  const hasServerBookmarkPagination = bookmarkListTotalCount !== null;
  const visiblePagedBookmarks = useMemo(
    () =>
      hasServerBookmarkPagination
        ? visibleBookmarks
        : visibleBookmarks.slice(0, bookmarkListVisibleCount),
    [bookmarkListVisibleCount, hasServerBookmarkPagination, visibleBookmarks]
  );
  const visibleBookmarkTotalCount = bookmarkListTotalCount ?? visibleBookmarks.length;
  const hasMoreVisibleBookmarks =
    bookmarkListNextOffset !== null || visiblePagedBookmarks.length < visibleBookmarks.length;
  const bookmarkVirtualWindow = useMemo(
    () =>
      getBookmarkVirtualWindow({
        bookmarkViewMode,
        itemCount: visiblePagedBookmarks.length,
        requestedStart: bookmarkVirtualWindowStart,
        shouldUseCompactMobileCards
      }),
    [
      bookmarkViewMode,
      bookmarkVirtualWindowStart,
      shouldUseCompactMobileCards,
      visiblePagedBookmarks.length
    ]
  );
  const {
    canVirtualize: canVirtualizeBookmarkList,
    rowHeight: bookmarkVirtualRowHeight,
    windowStartMax: bookmarkVirtualWindowStartMax,
    windowStart: normalizedBookmarkVirtualWindowStart,
    windowEnd: bookmarkVirtualWindowEnd,
    topSpacerHeight: bookmarkVirtualTopSpacerHeight,
    bottomSpacerHeight: bookmarkVirtualBottomSpacerHeight
  } = bookmarkVirtualWindow;
  const renderedPagedBookmarks = useMemo(
    () =>
      canVirtualizeBookmarkList
        ? visiblePagedBookmarks.slice(normalizedBookmarkVirtualWindowStart, bookmarkVirtualWindowEnd)
        : visiblePagedBookmarks,
    [
      bookmarkVirtualWindowEnd,
      canVirtualizeBookmarkList,
      normalizedBookmarkVirtualWindowStart,
      visiblePagedBookmarks
    ]
  );
  const renderedPagedBookmarkAssetPreloadKey = useMemo(
    () => renderedPagedBookmarks.map((bookmark) => bookmark.id).join("|"),
    [renderedPagedBookmarks]
  );
  const visibleBookmarkInventory = useMemo(
    () =>
      filterBookmarksByHiddenBookmarks(
        filterBookmarksByHiddenFolders(bookmarkInventory, hiddenFolderIds, showHiddenFolders),
        showHiddenBookmarks
      ),
    [bookmarkInventory, hiddenFolderIds, showHiddenBookmarks, showHiddenFolders]
  );
  const rawHomeFavoriteBookmarks = useMemo(
    () =>
      homeFavoriteBookmarks ??
      bookmarkInventory.filter((bookmark) => bookmark.isFavorite && bookmark.isTrashed !== true),
    [bookmarkInventory, homeFavoriteBookmarks]
  );
  const visibleHomeFavoriteBookmarks = useMemo(
    () =>
      filterBookmarksByHiddenBookmarks(
        filterBookmarksByHiddenFolders(rawHomeFavoriteBookmarks, hiddenFolderIds, showHiddenFolders),
        showHiddenBookmarks
      ),
    [hiddenFolderIds, rawHomeFavoriteBookmarks, showHiddenBookmarks, showHiddenFolders]
  );
  const homeFavoriteCardCacheRef = useRef(new Map<string, HomeFavoriteCardCacheEntry>());
  const homeFavoriteCards = useMemo<HomeFavoriteCardViewModel[]>(
    () => {
      const { cards, cache } = buildHomeFavoriteCards({
        bookmarks: visibleHomeFavoriteBookmarks,
        bookmarkAssetsByBookmarkId,
        extensionFolderIds,
        foldersById,
        hasLoadedTags,
        previousCache: homeFavoriteCardCacheRef.current,
        tagsById
      });

      homeFavoriteCardCacheRef.current = cache;
      return cards;
    },
    [
      bookmarkAssetsByBookmarkId,
      extensionFolderIds,
      foldersById,
      hasLoadedTags,
      tagsById,
      visibleHomeFavoriteBookmarks
    ]
  );
  const selectedBookmarkTagIdSet = useMemo(
    () => new Set(bookmarkDraft.tagIds),
    [bookmarkDraft.tagIds]
  );
  const deferredBookmarkTagSearchQuery = useDeferredValue(bookmarkTagSearchQuery);
  const normalizedBookmarkTagSearchQuery = deferredBookmarkTagSearchQuery
    .trim()
    .toLocaleLowerCase();
  const composerSelectedTagItems = useMemo(
    () => getTagDisplayItems(bookmarkDraft.tagIds),
    [bookmarkDraft.tagIds, tagsById]
  );
  const filteredBookmarkComposerTags = useMemo(
    () =>
      [...tags]
        .filter((tag) =>
          normalizedBookmarkTagSearchQuery
            ? tag.name.toLocaleLowerCase().includes(normalizedBookmarkTagSearchQuery)
            : true
        )
        .sort((left, right) => {
          const selectionWeightDifference =
            Number(selectedBookmarkTagIdSet.has(right.id)) -
            Number(selectedBookmarkTagIdSet.has(left.id));

          if (selectionWeightDifference !== 0) {
            return selectionWeightDifference;
          }

          return left.name.localeCompare(right.name, "ko");
        }),
    [normalizedBookmarkTagSearchQuery, selectedBookmarkTagIdSet, tags]
  );
  const folderOverviewAllBookmarkCount = useMemo(
    () =>
      hasLoadedFullBookmarkInventory || !bookmarkCounts
        ? visibleBookmarkInventory.length
        : countVisibleActiveBookmarksFromCounts(
            bookmarkCounts,
            hiddenFolderIds,
            showHiddenFolders,
            showHiddenBookmarks
          ),
    [
      bookmarkCounts,
      hasLoadedFullBookmarkInventory,
      hiddenFolderIds,
      showHiddenBookmarks,
      showHiddenFolders,
      visibleBookmarkInventory
    ]
  );
  const folderOverviewUnfiledBookmarkCount = useMemo(
    () =>
      hasLoadedFullBookmarkInventory || !bookmarkCounts
        ? visibleBookmarkInventory.filter(
            (bookmark) => isBookmarkUnfiled(bookmark, extensionFolderIds)
          ).length
        : countUnfiledBookmarksFromCounts(
            bookmarkCounts,
            extensionFolderIds,
            showHiddenBookmarks
          ),
    [
      bookmarkCounts,
      extensionFolderIds,
      hasLoadedFullBookmarkInventory,
      showHiddenBookmarks,
      visibleBookmarkInventory
    ]
  );
  const folderOverviewTrashBookmarkCount = useMemo(
    () =>
      trashedBookmarks.length > 0 || !bookmarkCounts
        ? filterBookmarksByHiddenBookmarks(
            trashedBookmarks,
            showHiddenBookmarks
          ).length
        : getBookmarkCountBucketValue(bookmarkCounts.trashed, showHiddenBookmarks),
    [bookmarkCounts, showHiddenBookmarks, trashedBookmarks]
  );
  const totalTrashBookmarkCount = useMemo(
    () =>
      bookmarkCounts
        ? Math.max(bookmarkCounts.trashed.total, trashedBookmarks.length)
        : trashedBookmarks.length,
    [bookmarkCounts, trashedBookmarks]
  );
  const homeFavoriteBookmarkCount = bookmarkCounts
    ? getBookmarkCountBucketValue(bookmarkCounts.favorite, showHiddenBookmarks)
    : visibleHomeFavoriteBookmarks.length;
  const activeFolderOverviewSpecialFilter =
    folderOverviewSpecialFilter ??
    (!hasActiveAppliedBookmarkSearch ? "all" : null);
  const isTrashBookmarkView = activeFolderOverviewSpecialFilter === "trash";
  const bookmarkListRowCacheRef = useRef(new Map<string, BookmarkListRowCacheEntry>());
  const bookmarkListRowActionsRef = useRef<BookmarkListRowActions | null>(null);
  bookmarkListRowActionsRef.current = {
    onToggleDetail: toggleBookmarkDetailFromCard,
    onOpen: handleBookmarkOpen,
    onOpenDetailDialog: (bookmark) => openBookmarkDetail(bookmark.id, bookmark, "dialog"),
    onCopyUrl: handleBookmarkUrlCopy,
    onToggleActionMenu: toggleBookmarkActionMenu,
    onEdit: beginBookmarkEdit,
    onDelete: handleBookmarkDelete,
    onRestore: handleBookmarkRestore,
    onPermanentDelete: handleBookmarkPermanentDelete
  };
  const bookmarkListRowActions = useMemo<BookmarkListRowActions>(
    () => ({
      onToggleDetail: (bookmark) =>
        bookmarkListRowActionsRef.current?.onToggleDetail(bookmark),
      onOpen: (bookmark) =>
        bookmarkListRowActionsRef.current?.onOpen(bookmark),
      onOpenDetailDialog: (bookmark) =>
        bookmarkListRowActionsRef.current?.onOpenDetailDialog(bookmark),
      onCopyUrl: (bookmark) =>
        bookmarkListRowActionsRef.current?.onCopyUrl(bookmark),
      onToggleActionMenu: (bookmarkId) =>
        bookmarkListRowActionsRef.current?.onToggleActionMenu(bookmarkId),
      onEdit: (bookmark) =>
        bookmarkListRowActionsRef.current?.onEdit(bookmark),
      onDelete: (bookmark) =>
        bookmarkListRowActionsRef.current?.onDelete(bookmark),
      onRestore: (bookmark) =>
        bookmarkListRowActionsRef.current?.onRestore(bookmark),
      onPermanentDelete: (bookmark) =>
        bookmarkListRowActionsRef.current?.onPermanentDelete(bookmark)
    }),
    []
  );
  const recommendationPanelActions = useMemo<RecommendationPanelActions>(
    () => ({
      onOpen: (bookmark) => bookmarkListRowActions.onOpen(bookmark)
    }),
    [bookmarkListRowActions]
  );
  const homePanelActions = useMemo<HomePanelActions>(
    () => ({
      onOpen: (bookmark) => bookmarkListRowActions.onOpen(bookmark),
      onOpenDetailDialog: (bookmark) => bookmarkListRowActions.onOpenDetailDialog(bookmark),
      onCopyUrl: (bookmark) => bookmarkListRowActions.onCopyUrl(bookmark),
      onToggleActionMenu: (bookmarkId) => bookmarkListRowActions.onToggleActionMenu(bookmarkId),
      onEdit: (bookmark) => bookmarkListRowActions.onEdit(bookmark),
      onDelete: (bookmark) => bookmarkListRowActions.onDelete(bookmark)
    }),
    [bookmarkListRowActions]
  );
  const bookmarkListRows = useMemo<BookmarkListRowViewModel[]>(
    () => {
      const { rows, cache } = measureSyncPerformance("dashboard:bookmark-list-view-models", () =>
        buildBookmarkListRows({
          bookmarkAssetsByBookmarkId,
          bookmarkCardDisplaySettings,
          bookmarkListDisplaySettings,
          bookmarks: renderedPagedBookmarks,
          bookmarkViewMode,
          extensionFolderIds,
          foldersById,
          isTrashBookmarkView,
          previousCache: bookmarkListRowCacheRef.current,
          shouldUseCompactMobileCards,
          tagsById
        })
      );

      bookmarkListRowCacheRef.current = cache;
      return rows;
    },
    [
      bookmarkAssetsByBookmarkId,
      bookmarkCardDisplaySettings,
      bookmarkListDisplaySettings,
      bookmarkViewMode,
      extensionFolderIds,
      foldersById,
      isTrashBookmarkView,
      renderedPagedBookmarks,
      shouldUseCompactMobileCards,
      tagsById
    ]
  );
  const visibleRecommendations = useMemo(
    () =>
      filterRecommendationsByHiddenBookmarks(
        filterRecommendationsByHiddenFolders(recommendations, hiddenFolderIds, showHiddenFolders),
        showHiddenBookmarks
      ),
    [hiddenFolderIds, recommendations, showHiddenBookmarks, showHiddenFolders]
  );
  const recommendationCardCacheRef = useRef(new Map<string, RecommendationCardCacheEntry>());
  const recommendationCardsByKind = useMemo<Record<RecommendationKind, RecommendationCardViewModel[]>>(
    () => {
      const { cardsByKind, cache } = buildRecommendationCardsByKind({
        extensionFolderIds,
        foldersById,
        previousCache: recommendationCardCacheRef.current,
        recommendations: visibleRecommendations
      });

      recommendationCardCacheRef.current = cache;
      return cardsByKind;
    },
    [extensionFolderIds, foldersById, visibleRecommendations]
  );
  const visibleSelectedBookmark =
    selectedBookmark &&
    isBookmarkVisibleUnderHiddenRules(
      selectedBookmark,
      hiddenFolderIds,
      showHiddenFolders,
      showHiddenBookmarks
    )
      ? selectedBookmark
      : null;
  useEffect(() => {
    if (!selectedBookmark) {
      return;
    }

    if (
      isBookmarkVisibleUnderHiddenRules(
        selectedBookmark,
        hiddenFolderIds,
        showHiddenFolders,
        showHiddenBookmarks
      )
    ) {
      return;
    }

    setSelectedBookmark(null);
    setIsBookmarkDetailActionMenuOpen(false);
    setOpenBookmarkActionMenuId(null);
  }, [hiddenFolderIds, selectedBookmark, showHiddenBookmarks, showHiddenFolders]);

  useEffect(() => {
    setBookmarkVirtualWindowStart(0);
  }, [activeDashboardView, appliedBookmarkSearch, bookmarkListPageSize, bookmarkViewMode]);

  useEffect(() => {
    if (
      activeDashboardView !== "bookmarks" ||
      isLoadingDashboard ||
      renderedPagedBookmarks.length === 0
    ) {
      return;
    }

    queueBookmarkAssetPreload(
      renderedPagedBookmarks,
      bookmarkAssetsByBookmarkId,
      "bookmarks"
    );
  }, [
    activeDashboardView,
    bookmarkViewMode,
    isLoadingDashboard,
    renderedPagedBookmarkAssetPreloadKey
  ]);

  useEffect(() => {
    if (!canVirtualizeBookmarkList) {
      setBookmarkVirtualWindowStart(0);
      return;
    }

    const listElement = bookmarkListElementRef.current;
    if (!listElement) {
      return;
    }

    const requestFrame =
      typeof globalThis.requestAnimationFrame === "function"
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : (callback: FrameRequestCallback) =>
            globalThis.setTimeout(
              () => callback(globalThis.performance?.now?.() ?? Date.now()),
              16
            ) as unknown as number;
    const cancelFrame =
      typeof globalThis.cancelAnimationFrame === "function"
        ? globalThis.cancelAnimationFrame.bind(globalThis)
        : (frameId: number) => globalThis.clearTimeout(frameId);
    const scrollTargets: EventTarget[] = [globalThis];
    const primaryColumn = listElement.closest(".result-primary-column");
    if (primaryColumn) {
      scrollTargets.push(primaryColumn);
    }
    let frameId: number | null = null;

    function updateVirtualWindow() {
      if (frameId !== null) {
        return;
      }

      frameId = requestFrame(() => {
        frameId = null;
        const nextWindowStart = getBookmarkVirtualWindowStartForScroll({
          listTop: listElement.getBoundingClientRect().top,
          rowHeight: bookmarkVirtualRowHeight,
          startMax: bookmarkVirtualWindowStartMax
        });

        setBookmarkVirtualWindowStart((currentStart) =>
          currentStart === nextWindowStart ? currentStart : nextWindowStart
        );
      });
    }

    updateVirtualWindow();
    for (const target of scrollTargets) {
      target.addEventListener("scroll", updateVirtualWindow, { passive: true });
    }
    globalThis.addEventListener("resize", updateVirtualWindow);

    return () => {
      for (const target of scrollTargets) {
        target.removeEventListener("scroll", updateVirtualWindow);
      }
      globalThis.removeEventListener("resize", updateVirtualWindow);
      if (frameId !== null) {
        cancelFrame(frameId);
      }
    };
  }, [
    bookmarkVirtualRowHeight,
    bookmarkVirtualWindowStartMax,
    canVirtualizeBookmarkList,
    visiblePagedBookmarks.length
  ]);

  const disallowedParentFolderIds = useMemo(
    () =>
      editingFolderId
        ? new Set([
            editingFolderId,
            ...getFolderDescendantIds(
              folderManagerScope === "memos" ? memoFolders : folders,
              editingFolderId
            )
          ])
        : new Set<string>(),
    [editingFolderId, folderManagerScope, folders, memoFolders]
  );
  const manageableFolders = useMemo(
    () =>
      folderManagerScope === "memos"
        ? memoFolders
        : folders.filter((folder) => !extensionFolderIds.has(folder.id)),
    [extensionFolderIds, folderManagerScope, folders, memoFolders]
  );
  const parentFolderOptions = useMemo(
    () => getHierarchicalFolderOptions(
      manageableFolders,
      disallowedParentFolderIds
    ),
    [disallowedParentFolderIds, manageableFolders]
  );
  const visibleFolderOptions = useMemo(
    () => getHierarchicalFolderOptions(visibleFolders),
    [visibleFolders]
  );
  const quickFolderParentOptions = visibleFolderOptions;
  const deferredFolderOverviewQuery = useDeferredValue(folderOverviewQuery);
  const isFolderOverviewSearchActive = Boolean(deferredFolderOverviewQuery.trim());
  const folderOverviewVisibleFolderIds = useMemo(
    () => getFolderVisibleIdsForQuery(
      visibleFolders,
      deferredFolderOverviewQuery
    ),
    [deferredFolderOverviewQuery, visibleFolders]
  );
  const folderOverviewChildrenByParentId = useMemo(
    () => getFoldersByParentId(
      visibleFolders.filter((folder) => folderOverviewVisibleFolderIds.has(folder.id))
    ),
    [folderOverviewVisibleFolderIds, visibleFolders]
  );
  const expandedFolderOverviewIdSet = useMemo(
    () => new Set(expandedFolderOverviewIds),
    [expandedFolderOverviewIds]
  );
  const folderOverviewNodes = useMemo<FolderOverviewNodeViewModel[]>(
    () => {
      const visibleFolderChildrenByParentId = getFoldersByParentId(visibleFolders);
      const directBookmarkCountsByFolderId = new Map<string, number>();

      if (hasLoadedFullBookmarkInventory || !bookmarkCounts) {
        for (const bookmark of visibleBookmarkInventory) {
          if (!bookmark.folderId) {
            continue;
          }

          directBookmarkCountsByFolderId.set(
            bookmark.folderId,
            (directBookmarkCountsByFolderId.get(bookmark.folderId) ?? 0) + 1
          );
        }
      } else {
        for (const folder of visibleFolders) {
          directBookmarkCountsByFolderId.set(
            folder.id,
            getBookmarkCountBucketValue(
              bookmarkCounts.byFolderId[folder.id],
              showHiddenBookmarks
            )
          );
        }
      }

      const bookmarkCountCache = new Map<string, number>();

      function getFolderBookmarkCount(folderId: string): number {
        const cachedCount = bookmarkCountCache.get(folderId);
        if (cachedCount !== undefined) {
          return cachedCount;
        }

        const total =
          (directBookmarkCountsByFolderId.get(folderId) ?? 0) +
          (visibleFolderChildrenByParentId.get(folderId) ?? []).reduce(
            (sum, childFolder) => sum + getFolderBookmarkCount(childFolder.id),
            0
          );

        bookmarkCountCache.set(folderId, total);
        return total;
      }

      function buildFolderOverviewNodes(
        parentFolderId: string | null,
        depth: number
      ): FolderOverviewNodeViewModel[] {
        return (folderOverviewChildrenByParentId.get(parentFolderId) ?? []).map((folder) => {
          const childFolders = folderOverviewChildrenByParentId.get(folder.id) ?? [];
          const hasChildren = childFolders.length > 0;
          const isExpanded =
            hasChildren &&
            (isFolderOverviewSearchActive || expandedFolderOverviewIdSet.has(folder.id));

          return {
            folder,
            childNodes: isExpanded ? buildFolderOverviewNodes(folder.id, depth + 1) : [],
            depth,
            bookmarkCount: getFolderBookmarkCount(folder.id),
            hasChildren,
            isExpanded,
            isActive:
              activeDashboardView === "bookmarks" &&
              appliedBookmarkSearch.folderId === folder.id,
            dropMode:
              !shouldUseMobileSidebarPanels && folderOverviewDropTarget?.folderId === folder.id
                ? folderOverviewDropTarget.mode
                : null
          };
        });
      }

      return buildFolderOverviewNodes(null, 0);
    },
    [
      activeDashboardView,
      appliedBookmarkSearch.folderId,
      bookmarkCounts,
      expandedFolderOverviewIdSet,
      folderOverviewChildrenByParentId,
      folderOverviewDropTarget,
      hasLoadedFullBookmarkInventory,
      isFolderOverviewSearchActive,
      shouldUseMobileSidebarPanels,
      showHiddenBookmarks,
      visibleBookmarkInventory,
      visibleFolders
    ]
  );
  const activeMemoFolderOverviewFolderId = isMemoComposerOpen
    ? memoDraft.folderId || null
    : memoFolderFilterId && memoFolderFilterId !== "unfiled"
      ? memoFolderFilterId
      : null;
  const activeMemoFolderOverviewSpecialFilter: FolderOverviewSpecialFilter | null =
    activeMemoFolderOverviewFolderId
      ? null
      : isMemoComposerOpen
        ? "unfiled"
        : memoFolderFilterId === "unfiled"
          ? "unfiled"
          : "all";
  const deferredMemoFolderOverviewQuery = useDeferredValue(memoFolderOverviewQuery);
  const isMemoFolderOverviewSearchActive = Boolean(deferredMemoFolderOverviewQuery.trim());
  const memoFolderOverviewVisibleFolderIds = useMemo(
    () => getFolderVisibleIdsForQuery(visibleMemoFolders, deferredMemoFolderOverviewQuery),
    [deferredMemoFolderOverviewQuery, visibleMemoFolders]
  );
  const memoFolderOverviewChildrenByParentId = useMemo(
    () =>
      getFoldersByParentId(
        visibleMemoFolders.filter((folder) => memoFolderOverviewVisibleFolderIds.has(folder.id))
      ),
    [memoFolderOverviewVisibleFolderIds, visibleMemoFolders]
  );
  const expandedMemoFolderOverviewIdSet = useMemo(
    () => new Set(expandedMemoFolderOverviewIds),
    [expandedMemoFolderOverviewIds]
  );
  const memoFolderOverviewNodes = useMemo<FolderOverviewNodeViewModel[]>(
    () => {
      const allMemoFolderChildrenByParentId = getFoldersByParentId(visibleMemoFolders);
      const directMemoCountsByFolderId = new Map<string, number>();

      for (const memo of visibleMemoPanelMemos) {
        if (!memo.folderId) {
          continue;
        }

        directMemoCountsByFolderId.set(
          memo.folderId,
          (directMemoCountsByFolderId.get(memo.folderId) ?? 0) + 1
        );
      }

      const memoCountCache = new Map<string, number>();

      function getFolderMemoCount(folderId: string): number {
        const cachedCount = memoCountCache.get(folderId);
        if (cachedCount !== undefined) {
          return cachedCount;
        }

        const total =
          (directMemoCountsByFolderId.get(folderId) ?? 0) +
          (allMemoFolderChildrenByParentId.get(folderId) ?? []).reduce(
            (sum, childFolder) => sum + getFolderMemoCount(childFolder.id),
            0
          );

        memoCountCache.set(folderId, total);
        return total;
      }

      function buildMemoFolderOverviewNodes(
        parentFolderId: string | null,
        depth: number
      ): FolderOverviewNodeViewModel[] {
        return (memoFolderOverviewChildrenByParentId.get(parentFolderId) ?? []).map((folder) => {
          const childFolders = memoFolderOverviewChildrenByParentId.get(folder.id) ?? [];
          const hasChildren = childFolders.length > 0;
          const isExpanded =
            hasChildren &&
            (isMemoFolderOverviewSearchActive || expandedMemoFolderOverviewIdSet.has(folder.id));

          return {
            folder,
            childNodes: isExpanded
              ? buildMemoFolderOverviewNodes(folder.id, depth + 1)
              : [],
            depth,
            bookmarkCount: getFolderMemoCount(folder.id),
            hasChildren,
            isExpanded,
            isActive: activeMemoFolderOverviewFolderId === folder.id,
            dropMode:
              !shouldUseMobileSidebarPanels && folderOverviewDropTarget?.folderId === folder.id
                ? folderOverviewDropTarget.mode
                : null
          };
        });
      }

      return buildMemoFolderOverviewNodes(null, 0);
    },
    [
      activeMemoFolderOverviewFolderId,
      expandedMemoFolderOverviewIdSet,
      folderOverviewDropTarget,
      isMemoFolderOverviewSearchActive,
      memoFolderOverviewChildrenByParentId,
      shouldUseMobileSidebarPanels,
      visibleMemoFolders,
      visibleMemoPanelMemos
    ]
  );
  function selectMemoFolderForCurrentWorkspace(folderId: string | null) {
    if (isMemoComposerOpen) {
      const didCloseMemoComposer = requestCloseMemoComposer();
      if (!didCloseMemoComposer) {
        return;
      }
    }

    applyCachedMemoPageOrLoading(
      createCurrentMemoPageOptions({
        folderFilterId: folderId,
        includeHidden: showHiddenMemos
      })
    );
    replaceMemoFolderFilterId(folderId);
  }

  function handleMemoFolderOverviewSelect(folder: Folder) {
    selectMemoFolderForCurrentWorkspace(folder.id);
  }

  function handleMemoFolderOverviewReset() {
    selectMemoFolderForCurrentWorkspace(null);
  }

  function handleMemoFolderOverviewSpecialSelect(filter: FolderOverviewSpecialFilter) {
    if (filter === "trash") {
      return;
    }

    if (filter === "unfiled") {
      selectMemoFolderForCurrentWorkspace("unfiled");
      return;
    }

    selectMemoFolderForCurrentWorkspace(null);
  }

  function handleMemoTagFilterChange(tagId: string | null) {
    applyCachedMemoPageOrLoading(
      createCurrentMemoPageOptions({
        tagFilterId: tagId,
        includeHidden: showHiddenMemos
      })
    );
    setMemoTagFilterId(tagId);
  }

  function toggleMemoFolderOverviewExpansion(folderId: string) {
    setExpandedMemoFolderOverviewIds((currentIds) =>
      currentIds.includes(folderId)
        ? currentIds.filter((currentId) => currentId !== folderId)
        : [...currentIds, folderId]
    );
  }

  function collapseAllMemoFolderOverviewGroups() {
    setExpandedMemoFolderOverviewIds([]);
  }

  function expandAllMemoFolderOverviewGroups() {
    setExpandedMemoFolderOverviewIds(
      visibleMemoFolders
        .filter((folder) =>
          visibleMemoFolders.some((childFolder) => childFolder.parentFolderId === folder.id)
        )
        .map((folder) => folder.id)
    );
  }

  const folderOverviewNodeActionsRef = useRef<FolderOverviewNodeActions | null>(null);
  folderOverviewNodeActionsRef.current = {
    onToggleExpansion: toggleFolderOverviewExpansion,
    onSelect: handleFolderOverviewSelect,
    onDragStart: (folderId, event) => {
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
      }
      setDraggingFolderId(folderId);
      setFolderOverviewDropTarget(null);
    },
    onDragEnd: resetDraggingFolder,
    onDragOver: (folder, event) => {
      const nextDropMode = getFolderOverviewDropMode(folder);
      if (!nextDropMode) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      setFolderOverviewDropTarget({ folderId: folder.id, mode: nextDropMode });
    },
    onDragLeave: (folderId) => {
      setFolderOverviewDropTarget((currentTarget) =>
        currentTarget?.folderId === folderId ? null : currentTarget
      );
    },
    onDrop: (folder, event) => {
      const dropMode = getFolderOverviewDropMode(folder);
      event.preventDefault();

      if (!dropMode) {
        resetDraggingFolder();
        return;
      }

      setFolderOverviewDropTarget(null);
      if (dropMode === "reorder") {
        void handleFolderReorderDrop(folder);
        return;
      }

      void handleFolderMoveDrop(folder);
    },
    onBeginEdit: (folder) => beginFolderEdit(folder, "bookmarks"),
    onBeginChildCreate: (folder) => beginChildFolderCreate(folder, "bookmarks"),
    onToggleActionMenu: toggleFolderActionMenu,
    onDelete: (folder) => void handleFolderDelete(folder, "bookmarks")
  };
  const folderOverviewNodeActions = useMemo<FolderOverviewNodeActions>(
    () => ({
      onToggleExpansion: (folderId) =>
        folderOverviewNodeActionsRef.current?.onToggleExpansion(folderId),
      onSelect: (folder) =>
        folderOverviewNodeActionsRef.current?.onSelect(folder),
      onDragStart: (folderId, event) =>
        folderOverviewNodeActionsRef.current?.onDragStart(folderId, event),
      onDragEnd: () =>
        folderOverviewNodeActionsRef.current?.onDragEnd(),
      onDragOver: (folder, event) =>
        folderOverviewNodeActionsRef.current?.onDragOver(folder, event),
      onDragLeave: (folderId) =>
        folderOverviewNodeActionsRef.current?.onDragLeave(folderId),
      onDrop: (folder, event) =>
        folderOverviewNodeActionsRef.current?.onDrop(folder, event),
      onBeginEdit: (folder) =>
        folderOverviewNodeActionsRef.current?.onBeginEdit(folder),
      onBeginChildCreate: (folder) =>
        folderOverviewNodeActionsRef.current?.onBeginChildCreate(folder),
      onToggleActionMenu: (folderId) =>
        folderOverviewNodeActionsRef.current?.onToggleActionMenu(folderId),
      onDelete: (folder) =>
        folderOverviewNodeActionsRef.current?.onDelete(folder)
    }),
    []
  );
  const memoFolderOverviewNodeActionsRef = useRef<FolderOverviewNodeActions | null>(null);
  memoFolderOverviewNodeActionsRef.current = {
    onToggleExpansion: toggleMemoFolderOverviewExpansion,
    onSelect: handleMemoFolderOverviewSelect,
    onDragStart: (folderId, event) => {
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
      }
      setDraggingFolderId(folderId);
      setFolderOverviewDropTarget(null);
    },
    onDragEnd: resetDraggingFolder,
    onDragOver: (folder, event) => {
      const nextDropMode = getFolderOverviewDropMode(folder, "memos");
      if (!nextDropMode) {
        return;
      }

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      setFolderOverviewDropTarget({ folderId: folder.id, mode: nextDropMode });
    },
    onDragLeave: (folderId) => {
      setFolderOverviewDropTarget((currentTarget) =>
        currentTarget?.folderId === folderId ? null : currentTarget
      );
    },
    onDrop: (folder, event) => {
      const dropMode = getFolderOverviewDropMode(folder, "memos");
      event.preventDefault();

      if (!dropMode) {
        resetDraggingFolder();
        return;
      }

      setFolderOverviewDropTarget(null);
      if (dropMode === "reorder") {
        void handleFolderReorderDrop(folder, "memos");
        return;
      }

      void handleFolderMoveDrop(folder, "memos");
    },
    onBeginEdit: (folder) => beginFolderEdit(folder, "memos"),
    onBeginChildCreate: (folder) => beginChildFolderCreate(folder, "memos"),
    onToggleActionMenu: toggleFolderActionMenu,
    onDelete: (folder) => void handleFolderDelete(folder, "memos")
  };
  const memoFolderOverviewNodeActions = useMemo<FolderOverviewNodeActions>(
    () => ({
      onToggleExpansion: (folderId) =>
        memoFolderOverviewNodeActionsRef.current?.onToggleExpansion(folderId),
      onSelect: (folder) =>
        memoFolderOverviewNodeActionsRef.current?.onSelect(folder),
      onDragStart: (folderId, event) =>
        memoFolderOverviewNodeActionsRef.current?.onDragStart(folderId, event),
      onDragEnd: () =>
        memoFolderOverviewNodeActionsRef.current?.onDragEnd(),
      onDragOver: (folder, event) =>
        memoFolderOverviewNodeActionsRef.current?.onDragOver(folder, event),
      onDragLeave: (folderId) =>
        memoFolderOverviewNodeActionsRef.current?.onDragLeave(folderId),
      onDrop: (folder, event) =>
        memoFolderOverviewNodeActionsRef.current?.onDrop(folder, event),
      onBeginEdit: (folder) =>
        memoFolderOverviewNodeActionsRef.current?.onBeginEdit(folder),
      onBeginChildCreate: (folder) =>
        memoFolderOverviewNodeActionsRef.current?.onBeginChildCreate(folder),
      onToggleActionMenu: (folderId) =>
        memoFolderOverviewNodeActionsRef.current?.onToggleActionMenu(folderId),
      onDelete: (folder) =>
        memoFolderOverviewNodeActionsRef.current?.onDelete(folder)
    }),
    []
  );
  const selectedBookmarkUserDetailRows = useMemo(
    () =>
      visibleSelectedBookmark
        ? getBookmarkDetailFieldRows(visibleSelectedBookmark, "user")
        : [],
    [visibleSelectedBookmark]
  );
  const selectedBookmarkSourceDetailRows = useMemo(
    () =>
      visibleSelectedBookmark
        ? getBookmarkDetailFieldRows(visibleSelectedBookmark, "source")
        : [],
    [visibleSelectedBookmark]
  );
  const selectedBookmarkAssetCount = visibleSelectedBookmark
    ? bookmarkAssetsByBookmarkId[visibleSelectedBookmark.id]?.length ?? 0
    : 0;
  const selectedBookmarkTagItems = useMemo(
    () =>
      visibleSelectedBookmark
        ? getTagDisplayItems(visibleSelectedBookmark.tagIds)
        : [],
    [tagsById, visibleSelectedBookmark]
  );
  const selectedBookmarkVisibleTagItems = useMemo(
    () => selectedBookmarkTagItems.slice(0, 4),
    [selectedBookmarkTagItems]
  );
  const selectedBookmarkRemainingTagCount = Math.max(
    0,
    selectedBookmarkTagItems.length - selectedBookmarkVisibleTagItems.length
  );
  const selectedBookmarkStatusMessage = isLoadingSelectedBookmark
    ? "상세 내용을 불러오는 중..."
    : isLoadingSelectedBookmarkAssets
      ? "이미지를 불러오는 중..."
      : null;
  const shouldShowDesktopReadingRail =
    !shouldUseMobileSidebarPanels &&
    bookmarkDetailDisplayMode === "rail" &&
    (Boolean(visibleSelectedBookmark) || isLoadingSelectedBookmark);
  const shouldShowDesktopRecommendationBoard =
    activeDashboardView === "bookmarks" &&
    !shouldUseMobileSidebarPanels &&
    !shouldShowDesktopReadingRail;
  const shouldLoadRecommendations =
    sessionState.status === "authenticated" &&
    ((isHomeDashboardView && isHomeRecommendationOpen) ||
      (shouldUseMobileSidebarPanels && mobileSidebarPanel === "recommendation") ||
      (!shouldUseMobileSidebarPanels &&
        activeDashboardView === "bookmarks" &&
        shouldShowDesktopRecommendationBoard));
  const isRecommendationSectionLoading =
    isLoadingDashboard || (shouldLoadRecommendations && isLoadingRecommendations);
  const isBookmarkDetailPreviewFullscreenActive =
    Boolean(visibleSelectedBookmark) &&
    bookmarkDetailActiveTab === "preview" &&
    isBookmarkPreviewFullscreen;
  const heroTagSummary = hasLoadedTags ? `태그 ${tags.length}개` : "태그";
  const memoFolderOverviewUnfiledMemoCount = visibleMemoPanelMemos.filter(
    (memo) => !memo.folderId
  ).length;
  const memoQuickActionSummary = `메모 ${
    visibleMemoPanelTotalCount ?? visibleMemoPanelMemos.length
  }개 · 폴더 ${visibleMemoFolders.length}개 · 태그 ${memoTags.length}개`;
  const bookmarkQuickActionSummary = `북마크 ${folderOverviewAllBookmarkCount}개 · 폴더 ${visibleFolders.length}개 · ${heroTagSummary}`;

  function renderBookmarkDetailPlaceholder() {
    return (
      <section className="surface-card panel-card bookmark-detail-placeholder">
        <p className="bookmark-detail-kicker">읽기 중심</p>
        <h2>북마크를 불러오는 중입니다</h2>
        <p className="muted-text">상세 내용을 준비하고 있습니다.</p>
      </section>
    );
  }

  function renderLazyBookmarkDetailPanel(closeLabel: string) {
    const selectedBookmarkAssets = visibleSelectedBookmark
      ? bookmarkAssetsByBookmarkId[visibleSelectedBookmark.id] ?? []
      : [];

    return (
      <Suspense fallback={renderBookmarkDetailPlaceholder()}>
        <LazyBookmarkDetailPanel
          bookmark={visibleSelectedBookmark}
          closeLabel={closeLabel}
          activeTab={bookmarkDetailActiveTab}
          isPreviewFullscreen={isBookmarkDetailPreviewFullscreenActive}
          isLoadingBookmark={isLoadingSelectedBookmark}
          isLoadingAssets={isLoadingSelectedBookmarkAssets}
          isLoadingPreview={isLoadingSelectedBookmarkPreview}
          statusMessage={selectedBookmarkStatusMessage}
          folderName={
            visibleSelectedBookmark ? getFolderName(visibleSelectedBookmark.folderId) : "미분류"
          }
          summaryStateLabel={
            visibleSelectedBookmark ? getBookmarkSummaryStateLabel(visibleSelectedBookmark) : ""
          }
          visibleTagItems={selectedBookmarkVisibleTagItems}
          remainingTagCount={selectedBookmarkRemainingTagCount}
          assets={selectedBookmarkAssets}
          userRows={selectedBookmarkUserDetailRows}
          sourceRows={selectedBookmarkSourceDetailRows}
          livePreview={selectedBookmarkLivePreview}
          previewError={selectedBookmarkPreviewError}
          previewNotice={selectedBookmarkPreviewNotice}
          isActionMenuOpen={isBookmarkDetailActionMenuOpen}
          onClose={closeBookmarkDetail}
          onSelectTab={(tab) => {
            if (!visibleSelectedBookmark) {
              return;
            }

            selectBookmarkDetailTab(tab, visibleSelectedBookmark.id);
          }}
          onTogglePreviewFullscreen={toggleBookmarkPreviewFullscreen}
          onToggleActionMenu={toggleBookmarkDetailActionMenu}
          onBookmarkOpen={handleBookmarkOpen}
          onBookmarkRestore={handleBookmarkRestore}
          onBookmarkPermanentDelete={handleBookmarkPermanentDelete}
          onBookmarkEdit={beginBookmarkEdit}
          onBookmarkReextract={handleBookmarkReextract}
          onResetSourceContent={handleResetSourceContent}
          onResetUserContent={handleResetUserContent}
          onBookmarkDelete={handleBookmarkDelete}
        />
      </Suspense>
    );
  }

  function updateBookmarkDisplaySetting(
    key: keyof Omit<BookmarkCardDisplaySettings, "coverSize">,
    value: boolean
  ) {
    if (bookmarkViewMode === "list") {
      setBookmarkListDisplaySettings((currentSettings) => ({
        ...currentSettings,
        [key]: value
      }));
      return;
    }

    setBookmarkCardDisplaySettings((currentSettings) => ({
      ...currentSettings,
      [key]: value
    }));
  }

  function updateBookmarkCoverSize(value: number) {
    const nextCoverSize = clampBookmarkCoverSize(value);
    setBookmarkCardDisplaySettings((currentSettings) => ({
      ...currentSettings,
      coverSize: nextCoverSize
    }));
  }

  const bookmarkPanelTitle = editingBookmarkId ? "북마크 수정" : "북마크 저장";
  const hasActiveBookmarkDraft =
    Boolean(
      bookmarkDraft.url.trim() ||
        bookmarkDraft.userTitle.trim() ||
        bookmarkDraft.userContent.trim() ||
        bookmarkDraft.userSummary.trim() ||
        bookmarkDraft.bookmarkColor.trim() ||
        bookmarkDraft.urlColor.trim()
    ) ||
    bookmarkDraft.tagIds.length > 0 ||
    bookmarkDraft.isFavorite ||
    bookmarkDraft.isHidden ||
    pendingAssetFiles.length > 0;
  const bookmarkPanelSummary = editingBookmarkId
    ? "수정 중"
    : hasActiveBookmarkDraft
      ? "작성 중"
      : "새 북마크";
  const bookmarkBrowsePanelSummary = `북마크 ${visibleBookmarks.length}개`;
  const recommendationPanelSummary = `추천 ${
    visibleRecommendations.favorites.length +
    visibleRecommendations.recent.length +
    visibleRecommendations.frequent.length
  }건`;
  const folderManagerCount = folderManagerScope === "memos" ? memoFolders.length : folders.length;
  const tagManagerCount = tagManagerScope === "memos" ? memoTags.length : tags.length;
  const folderPanelSummary = editingFolderId
    ? `수정 중 · 폴더 ${folderManagerCount}개`
    : `폴더 ${folderManagerCount}개`;
  const tagPanelSummary = editingTagId
    ? `수정 중 · 태그 ${tagManagerCount}개`
    : `태그 ${tagManagerCount}개`;
  const bookmarkPanelKicker = "작성";
  const bookmarkBrowsePanelKicker = "보관";
  const recommendationPanelKicker = "추천";
  const folderPanelKicker = folderManagerScope === "memos" ? "메모 구조" : "구조";
  const tagPanelKicker = tagManagerScope === "memos" ? "메모 분류" : "분류";

  function handleMobileSidebarPanelSelect(panelId: MobileSidebarPanelId) {
    openBookmarkWorkspace();
    setMobileSidebarPanel(panelId);
    if (panelId === "recommendation") {
      requestRecommendationsIfNeeded();
    }
  }

  function preloadMobileSidebarPanel(panelId: MobileSidebarPanelId) {
    if (panelId === "folder") {
      preloadDashboardPanelChunk("folder");
      return;
    }

    if (panelId === "bookmark") {
      preloadDashboardPanelChunk("bookmarks");
    }
  }

  function renderLazyFolderOverviewPanel(options?: { isHidden?: boolean }) {
    return (
      <Suspense fallback={null}>
        <LazyFolderOverviewPanel
          activeSpecialFilter={activeFolderOverviewSpecialFilter}
          allBookmarkCount={folderOverviewAllBookmarkCount}
          isAllFolderViewActive={
            activeDashboardView === "bookmarks" && !appliedBookmarkSearch.folderId
          }
          isHidden={options?.isHidden}
          isReorderingFolders={isReorderingFolders}
          nodes={folderOverviewNodes}
          openFolderActionMenuId={openFolderActionMenuId}
          query={folderOverviewQuery}
          shouldUseMobileSidebarPanels={shouldUseMobileSidebarPanels}
          showHiddenFolders={showHiddenFolders}
          trashBookmarkCount={folderOverviewTrashBookmarkCount}
          unfiledBookmarkCount={folderOverviewUnfiledBookmarkCount}
          actions={folderOverviewNodeActions}
          onCollapseAll={collapseAllFolderOverviewGroups}
          onExpandAll={expandAllFolderOverviewGroups}
          onQueryChange={setFolderOverviewQuery}
          onReset={handleFolderOverviewReset}
          onSelectSpecialFilter={handleFolderOverviewSpecialSelect}
          onToggleHiddenFolders={handleToggleHiddenFolders}
        />
      </Suspense>
    );
  }

  function renderLazyMemoFolderOverviewPanel(options?: { isHidden?: boolean }) {
    return (
      <Suspense fallback={null}>
        <LazyFolderOverviewPanel
          activeSpecialFilter={activeMemoFolderOverviewSpecialFilter}
          allBookmarkCount={visibleMemoPanelTotalCount ?? visibleMemoPanelMemos.length}
          allSystemItemLabel="모든 메모"
          allSystemItemAriaLabel="모든 메모 보기"
          allSystemItemIcon="≣"
          contentLabel="메모"
          isAllFolderViewActive={!isMemoComposerOpen && memoFolderFilterId === null}
          isHidden={options?.isHidden}
          isReorderingFolders={isReorderingFolders}
          nodes={memoFolderOverviewNodes}
          openFolderActionMenuId={openFolderActionMenuId}
          query={memoFolderOverviewQuery}
          shouldUseMobileSidebarPanels={shouldUseMobileSidebarPanels}
          showAllSystemItem={!isMemoComposerOpen}
          showHiddenFolderToggle
          showHiddenFolders={showHiddenMemoFolders}
          showNodeCounts={false}
          showTrashSystemItem={false}
          trashBookmarkCount={0}
          unfiledBookmarkCount={memoFolderOverviewUnfiledMemoCount}
          actions={memoFolderOverviewNodeActions}
          onCollapseAll={collapseAllMemoFolderOverviewGroups}
          onExpandAll={expandAllMemoFolderOverviewGroups}
          onQueryChange={setMemoFolderOverviewQuery}
          onReset={handleMemoFolderOverviewReset}
          onSelectSpecialFilter={handleMemoFolderOverviewSpecialSelect}
          onToggleHiddenFolders={handleToggleHiddenMemoFolders}
        />
      </Suspense>
    );
  }

  function renderLazyMobileSidebarTabs() {
    return (
      <Suspense fallback={null}>
        <LazyMobileSidebarTabs
          activePanel={mobileSidebarPanel}
          items={[
            {
              panelId: "folder",
              heading: "폴더",
              summary: folderPanelSummary,
              kicker: folderPanelKicker
            },
            {
              panelId: "bookmark",
              heading: "북마크",
              summary: bookmarkBrowsePanelSummary,
              kicker: bookmarkBrowsePanelKicker
            },
            {
              panelId: "recommendation",
              heading: "추천",
              summary: recommendationPanelSummary,
              kicker: recommendationPanelKicker
            }
          ]}
          onSelectPanel={handleMobileSidebarPanelSelect}
          onPreloadPanel={preloadMobileSidebarPanel}
        />
      </Suspense>
    );
  }

  function renderLazyBookmarkResultsPanel(options?: { isHidden?: boolean }) {
    return (
      <Suspense fallback={null}>
        <LazyBookmarkResultsPanel
          activeBookmarkSearchSummaryItems={activeBookmarkSearchSummaryItems}
          activeBookmarkSort={appliedBookmarkSearch.sort}
          bookmarkCardCoverSize={bookmarkCardDisplaySettings.coverSize}
          bookmarkCardDisplaySettings={bookmarkCardDisplaySettings}
          bookmarkListDisplaySettings={bookmarkListDisplaySettings}
          bookmarkListElementRef={bookmarkListElementRef}
          bookmarkImageStartIndex={normalizedBookmarkVirtualWindowStart}
          bookmarkListPageSize={bookmarkListPageSize}
          bookmarkListRows={bookmarkListRows}
          bookmarkPageSizeOptions={bookmarkPageSizeOptions}
          bookmarkSearchDraft={bookmarkSearchDraft}
          bookmarkSearchModeOptions={bookmarkSearchModeOptions}
          bookmarkSortOptions={bookmarkSortOptions}
          bookmarkViewMode={bookmarkViewMode}
          bookmarkViewModeOptions={bookmarkViewModeOptions}
          canVirtualizeBookmarkList={canVirtualizeBookmarkList}
          hasActiveAppliedBookmarkSearch={hasActiveAppliedBookmarkSearch}
          hasMoreVisibleBookmarks={hasMoreVisibleBookmarks}
          isAdvancedBookmarkSearchOpen={isAdvancedBookmarkSearchOpen}
          isBookmarkSortMenuOpen={isBookmarkSortMenuOpen}
          isBookmarkTrashView={isTrashBookmarkView}
          isBookmarkViewMenuOpen={isBookmarkViewMenuOpen}
          isEmptyingBookmarkTrash={isEmptyingBookmarkTrash}
          isHidden={options?.isHidden}
          isLoadingDashboard={isLoadingDashboard}
          isLoadingMoreBookmarks={isLoadingMoreBookmarks}
          isMobileSearchPanelOpen={isMobileSearchPanelOpen}
          isMobileSearchViewport={isMobileSearchViewport}
          isRailDetailMode={bookmarkDetailDisplayMode === "rail"}
          openBookmarkActionMenuId={openBookmarkActionMenuId}
          selectedBookmarkId={visibleSelectedBookmark?.id ?? null}
          shouldShowMobileSearchSummary={shouldShowMobileSearchSummary}
          shouldUseCompactMobileCards={shouldUseCompactMobileCards}
          showHiddenBookmarks={showHiddenBookmarks}
          tags={tags}
          totalTrashBookmarkCount={totalTrashBookmarkCount}
          visibleBookmarkCount={visibleBookmarks.length}
          visibleBookmarkTotalCount={visibleBookmarkTotalCount}
          visibleFolderOptions={visibleFolderOptions}
          visiblePagedBookmarkCount={visiblePagedBookmarks.length}
          bookmarkVirtualBottomSpacerHeight={bookmarkVirtualBottomSpacerHeight}
          bookmarkVirtualTopSpacerHeight={bookmarkVirtualTopSpacerHeight}
          actions={bookmarkListRowActions}
          applyBookmarkSearch={applyBookmarkSearch}
          handleBookmarkExport={handleBookmarkExport}
          handleBookmarkListLoadMore={handleBookmarkListLoadMore}
          handleBookmarkPageSizeChange={handleBookmarkPageSizeChange}
          handleBookmarkSearchReset={handleBookmarkSearchReset}
          handleBookmarkSearchSubmit={handleBookmarkSearchSubmit}
          handleEmptyBookmarkTrash={handleEmptyBookmarkTrash}
          handleToggleHiddenBookmarks={handleToggleHiddenBookmarks}
          onBookmarkCoverSizeChange={updateBookmarkCoverSize}
          onBookmarkDisplaySettingChange={updateBookmarkDisplaySetting}
          onBookmarkSortMenuOpenChange={setIsBookmarkSortMenuOpen}
          onBookmarkSortSelect={applyBookmarkSort}
          onBookmarkViewMenuOpenChange={setIsBookmarkViewMenuOpen}
          onBookmarkViewModeChange={setBookmarkViewMode}
          setIsAdvancedBookmarkSearchOpen={setIsAdvancedBookmarkSearchOpen}
          setIsMobileSearchPanelOpen={setIsMobileSearchPanelOpen}
          toggleBookmarkSearchTag={toggleBookmarkSearchTag}
          updateBookmarkSearchDraft={updateBookmarkSearchDraft}
        />
      </Suspense>
    );
  }

  function renderLazyMemoPanel() {
    if (isMemoComposerOpen) {
      return (
        <Suspense fallback={null}>
          <LazyMemoComposerDialog
            isEditing={Boolean(editingMemo)}
            isSaving={isSavingMemo}
            draft={memoDraftRef.current}
            folders={memoComposerFolders}
            lockPasswordRequired={
              memoDraftRef.current.isLocked && (!editingMemo || !editingMemo.isLocked)
            }
            tags={memoTags}
            onClose={requestCloseMemoComposer}
            onCreateTag={handleMemoTagCreate}
            onDraftContentChange={updateMemoDraftContent}
            onDraftChange={updateMemoDraft}
            onDelete={editingMemo ? handleMemoComposerDelete : undefined}
            onImageUpload={handleMemoImageUpload}
            onSubmit={handleMemoSubmit}
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={null}>
        <LazyMemoPanel
          activeTagId={memoTagFilterId}
          folders={visibleMemoFolders}
          isFavoriteOnly={memoFavoriteOnly}
          isLoading={isLoadingMemos}
          showHiddenMemos={showHiddenMemos}
          memos={visibleMemoPanelMemos}
          query={memoSearchQuery}
          tags={memoTags}
          totalCount={visibleMemoPanelTotalCount}
          viewMode={memoViewMode}
          onCreateMemo={beginMemoCreate}
          onDeleteMemo={handleMemoDelete}
          onEditMemo={beginMemoEdit}
          onExportMemos={handleMemoExport}
          onFavoriteOnlyChange={setMemoFavoriteOnly}
          onMemoComposerPreload={() => preloadDashboardDialogChunk("memoComposer")}
          onHiddenMemosToggle={handleToggleHiddenMemos}
          onQueryChange={setMemoSearchQuery}
          onTagFilterChange={handleMemoTagFilterChange}
          onViewModeChange={setMemoViewMode}
        />
      </Suspense>
    );
  }

  function renderLazyRecommendationPanel(options?: {
    ariaLabel?: string;
    className?: string;
    isEmbedded?: boolean;
    isHidden?: boolean;
  }) {
    return (
      <Suspense fallback={null}>
        <LazyRecommendationPanel
          ariaLabel={options?.ariaLabel}
          className={options?.className}
          isEmbedded={options?.isEmbedded}
          isHidden={options?.isHidden}
          isLoading={isRecommendationSectionLoading}
          cardsByKind={recommendationCardsByKind}
          actions={recommendationPanelActions}
        />
      </Suspense>
    );
  }

  const recommendationSection = renderLazyRecommendationPanel({
    isHidden: isHomeDashboardView
  });

  function renderLazyHomePanel() {
    return (
      <Suspense fallback={null}>
        <LazyHomePanel
          isLoadingDashboard={isLoadingDashboard}
          homeFavoriteBookmarkCount={homeFavoriteBookmarkCount}
          homeFavoriteCards={homeFavoriteCards}
          isHomeRecommendationOpen={isHomeRecommendationOpen}
          openBookmarkActionMenuId={openBookmarkActionMenuId}
          actions={homePanelActions}
          onToggleRecommendations={() => {
            const nextIsOpen = !isHomeRecommendationOpen;
            setIsHomeRecommendationOpen(nextIsOpen);
            if (nextIsOpen) {
              requestRecommendationsIfNeeded();
            }
          }}
          recommendationPanel={
            isHomeRecommendationOpen
              ? renderLazyRecommendationPanel({
                  ariaLabel: "home-recommendation-list",
                  className: "home-recommendation-panel",
                  isEmbedded: true
                })
              : null
          }
        />
      </Suspense>
    );
  }

  const isDarkAppTheme = appTheme === "dark";
  const appThemeToggleLabel = isDarkAppTheme ? "라이트 모드로 변경" : "다크 모드로 변경";

  return (
    <main
      className={`app-shell app-theme-${appTheme}${
        isBookmarkDetailPreviewFullscreenActive ? " app-shell-preview-fullscreen" : ""
      }`}
      data-app-theme={appTheme}
    >
      <DashboardHeader
        appThemeToggleLabel={appThemeToggleLabel}
        isDarkAppTheme={isDarkAppTheme}
        isMobileHeaderMenuOpen={isMobileHeaderMenuOpen}
        isMemoView={isMemoDashboardView}
        isQuickActionsMenuOpen={isQuickActionsMenuOpen}
        quickActionSummary={isMemoDashboardView ? memoQuickActionSummary : bookmarkQuickActionSummary}
        sessionState={sessionState}
        shouldUseMobileSidebarPanels={shouldUseMobileSidebarPanels}
        onBookmarkWorkspaceOpen={openBookmarkWorkspace}
        onBookmarkWorkspacePreload={() => preloadDashboardPanelChunk("bookmarks")}
        onCreateBookmark={beginBookmarkCreate}
        onCreateBookmarkPreload={() => preloadDashboardDialogChunk("bookmarkComposer")}
        onExtensionDownloadPreload={() => preloadDashboardDialogChunk("extensionDownload")}
        onExtensionTokenPreload={() => preloadDashboardDialogChunk("extensionToken")}
        onFirebaseAuthPreload={preloadFirebaseAuth}
        onFolderManagerPreload={() => preloadDashboardDialogChunk("folderManager")}
        onGoogleLogin={handleGoogleLogin}
        onHomeOpen={openHomePage}
        onHomePreload={() => preloadDashboardPanelChunk("home")}
        onInstallHelpPreload={() => preloadDashboardDialogChunk("installHelp")}
        onLogout={handleLogout}
        onMobileHeaderMenuOpenChange={setIsMobileHeaderMenuOpen}
        onMemoCreate={beginMemoCreate}
        onMemoOpen={openMemoWorkspace}
        onMemoPreload={() => {
          preloadDashboardPanelChunk("memos");
          preloadDashboardDialogChunk("memoComposer");
        }}
        onOpenExtensionDownloadDialog={openExtensionDownloadDialog}
        onOpenExtensionTokenDialog={openExtensionTokenDialog}
        onOpenFolderManager={() =>
          openFolderManager(isMemoDashboardView ? "memos" : "bookmarks")
        }
        onOpenTagManager={() =>
          openTagManager(isMemoDashboardView ? "memos" : "bookmarks")
        }
        onPwaInstall={handlePwaInstall}
        onQuickActionsMenuOpenChange={setIsQuickActionsMenuOpen}
        onTagManagerPreload={() => preloadDashboardDialogChunk("tagManager")}
        onToggleAppTheme={toggleAppTheme}
      />
      {isInitialDashboardBootstrapping ? (
        <section aria-label="dashboard-loading" className="dashboard-workspace">
          <div className="bookmark-loading-state" role="status" aria-live="polite">
            <span className="bookmark-loading-spinner" aria-hidden="true" />
            <span>대시보드를 불러오는 중입니다.</span>
          </div>
        </section>
      ) : null}
      {sessionState.status === "authenticated" ? (
        <section aria-label="dashboard-workspace" className="dashboard-workspace">
          <div
            className={`dashboard-layout${
              isMemoDashboardView && !shouldUseMemoSidebar ? " dashboard-layout-full" : ""
            }`}
          >
            {shouldRenderDashboardSidebar ? (
              <aside
                aria-label="dashboard-sidebar"
                className="dashboard-sidebar"
              >
                {shouldUseMemoSidebar ? (
                  renderLazyMemoFolderOverviewPanel()
                ) : !shouldUseMobileSidebarPanels ? (
                  renderLazyFolderOverviewPanel()
                ) : null}
                {shouldUseBookmarkSidebarPanels ? (
                  renderLazyMobileSidebarTabs()
                ) : null}
              </aside>
            ) : null}

          <section
            id={shouldUseBookmarkSidebarPanels ? `sidebar-panel-${mobileSidebarPanel}` : undefined}
            aria-label={shouldUseBookmarkSidebarPanels ? mobileSidebarPanel : "dashboard-main"}
            aria-labelledby={
              shouldUseBookmarkSidebarPanels ? `sidebar-tab-${mobileSidebarPanel}` : undefined
            }
            role={shouldUseBookmarkSidebarPanels ? "tabpanel" : undefined}
            className={`dashboard-main${
              shouldShowDesktopReadingRail
                ? " dashboard-main-with-rail"
                : " dashboard-main-board-only"
            }`}
          >
            <div
              role="region"
              aria-label="result-primary-column"
              className="result-primary-column"
            >
            {isHomeDashboardView ? renderLazyHomePanel() : null}
            {isMemoDashboardView ? renderLazyMemoPanel() : null}
            {shouldRenderMobileFolderTab
              ? renderLazyFolderOverviewPanel({ isHidden: isHomeDashboardView })
              : null}
            {shouldRenderMobileRecommendationTab ? recommendationSection : null}
            {shouldRenderBookmarkResultsPanel ? renderLazyBookmarkResultsPanel() : null}
            {shouldShowDesktopRecommendationBoard ? recommendationSection : null}
          </div>
          {shouldShowDesktopReadingRail ? (
          <aside
            role="region"
            aria-label="bookmark-reading-rail"
            className={`bookmark-reading-rail${
              isBookmarkDetailPreviewFullscreenActive
                ? " bookmark-reading-rail-preview-fullscreen"
                : ""
            }`}
          >
            <section aria-label="bookmark-detail-shell" className="bookmark-detail-region">
            {(visibleSelectedBookmark || isLoadingSelectedBookmark) &&
            bookmarkDetailDisplayMode === "rail" ? (
              renderLazyBookmarkDetailPanel("목록")
            ) : null}
            </section>
          </aside>
          ) : null}
          </section>
          {bookmarkDetailDisplayMode === "dialog" &&
          (visibleSelectedBookmark || isLoadingSelectedBookmark) ? (
            <div
              className="overlay-backdrop bookmark-detail-dialog-backdrop"
              onClick={() => closeBookmarkDetail()}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-label="bookmark-detail-dialog"
                className="bookmark-detail-dialog-shell"
                onClick={(event) => event.stopPropagation()}
              >
                {renderLazyBookmarkDetailPanel("닫기")}
              </section>
            </div>
          ) : null}
          {shouldRenderBookmarkComposerOverlay ? (
            <Suspense fallback={null}>
              <LazyBookmarkComposerDialog
                isEditing={Boolean(editingBookmarkId)}
                isSaving={isSavingBookmark}
                draft={bookmarkDraft}
                folderOptions={visibleFolderOptions}
                tags={tags}
                selectedTagItems={composerSelectedTagItems}
                filteredTags={filteredBookmarkComposerTags}
                tagSearchQuery={bookmarkTagSearchQuery}
                preview={bookmarkPreview}
                previewFailure={bookmarkPreviewFailure}
                extensionPresence={bookmarkExtensionPresence}
                isLoadingPreview={isLoadingBookmarkPreview}
                isClassificationOpen={isBookmarkComposerClassificationOpen}
                isDisplayOpen={isBookmarkComposerDisplayOpen}
                panelHeading={bookmarkPanelTitle}
                panelSummary={bookmarkPanelSummary}
                panelKicker={bookmarkPanelKicker}
                showPanelHeader={!shouldUseMobileSidebarPanels}
                isQuickFolderOpen={isQuickFolderOpen}
                isQuickTagOpen={isQuickTagOpen}
                isSavingQuickFolder={isSavingQuickFolder}
                isSavingQuickTag={isSavingTag}
                quickFolderDraft={quickFolderDraft}
                quickFolderParentOptions={quickFolderParentOptions}
                quickTagDraft={quickTagDraft}
                pendingAssetFiles={pendingAssetFiles}
                existingAssets={
                  editingBookmarkId ? bookmarkAssetsByBookmarkId[editingBookmarkId] ?? [] : []
                }
                onPendingAssetFilesAdd={appendPendingAssetFiles}
                onPendingAssetFileRemove={removePendingAssetFile}
                onExistingAssetDelete={(assetId) =>
                  editingBookmarkId
                    ? handleBookmarkAssetDelete(editingBookmarkId, assetId)
                    : undefined
                }
                onClose={requestCloseBookmarkComposer}
                onSubmit={handleBookmarkSubmit}
                onDraftChange={updateBookmarkDraft}
                onUrlChange={handleBookmarkUrlChange}
                onPreviewLoad={handleBookmarkPreviewLoad}
                onOpenPreviewSourceUrl={handleOpenBookmarkPreviewSourceUrl}
                onOpenExtensionDownload={openExtensionDownloadDialog}
                onDismissPreviewFallback={handleDismissBookmarkPreviewFallback}
                onUseUrlOnly={handleUseUrlOnlyBookmarkDraft}
                onClearPreview={handleClearBookmarkPreview}
                onClassificationOpenChange={setIsBookmarkComposerClassificationOpen}
                onDisplayOpenChange={setIsBookmarkComposerDisplayOpen}
                onTagSearchQueryChange={setBookmarkTagSearchQuery}
                onTagToggle={toggleBookmarkTag}
                onQuickFolderToggle={() =>
                  setIsQuickFolderOpen((currentValue) => {
                    const nextValue = !currentValue;

                    if (nextValue) {
                      setQuickFolderDraft((currentDraft) => ({
                        ...currentDraft,
                        parentFolderId: currentDraft.parentFolderId || bookmarkDraft.folderId
                      }));
                    }

                    return nextValue;
                  })
                }
                onQuickFolderDraftChange={updateQuickFolderDraft}
                onQuickFolderCreate={handleQuickFolderCreate}
                onQuickTagToggle={() => setIsQuickTagOpen((currentValue) => !currentValue)}
                onQuickTagDraftChange={updateQuickTagDraft}
                onQuickTagCreate={handleQuickTagCreate}
                onCancelEdit={cancelBookmarkEdit}
              />
            </Suspense>
          ) : null}
          {shouldRenderFolderManagerOverlay ? (
            <Suspense fallback={null}>
              <LazyFolderManagerDialog
                isEditing={Boolean(editingFolderId)}
                draft={folderDraft}
                allFolders={folderManagerScope === "memos" ? memoFolders : folders}
                managerFolders={manageableFolders}
                parentFolderOptions={parentFolderOptions}
                expandedFolderIds={expandedFolderManagerIds}
                draggingFolderId={draggingFolderId}
                openFolderActionMenuId={openFolderActionMenuId}
                isSaving={isSavingFolder}
                isReordering={isReorderingFolders}
                panelSummary={folderPanelSummary}
                panelKicker={folderPanelKicker}
                showPanelHeader={!shouldUseMobileSidebarPanels}
                onClose={requestCloseFolderManager}
                onSubmit={handleFolderSubmit}
                onDraftChange={updateFolderDraft}
                onCancelEdit={cancelFolderEdit}
                onBeginFolderEdit={(folder) => beginFolderEdit(folder, folderManagerScope)}
                onBeginChildFolderCreate={(folder) =>
                  beginChildFolderCreate(folder, folderManagerScope)
                }
                onFolderDelete={(folder) => void handleFolderDelete(folder, folderManagerScope)}
                onFolderReorderDrop={(folder) =>
                  handleFolderReorderDrop(folder, folderManagerScope)
                }
                onFolderReorderToPosition={(folder, position) =>
                  handleFolderReorderToPosition(folder, position, folderManagerScope)
                }
                onFolderMoveDrop={(folder) => handleFolderMoveDrop(folder, folderManagerScope)}
                onFolderMoveToParent={(folder, parentFolderId) =>
                  handleFolderMoveToParent(folder, parentFolderId, folderManagerScope)
                }
                onFolderMoveToRootDrop={() => handleFolderMoveToRootDrop(folderManagerScope)}
                onToggleFolderExpansion={toggleFolderManagerExpansion}
                onToggleFolderActionMenu={toggleFolderActionMenu}
                onFolderDragStart={(folderId) => {
                  setOpenFolderActionMenuId(null);
                  setDraggingFolderId(folderId);
                }}
                onFolderDragEnd={resetDraggingFolder}
              />
            </Suspense>
          ) : null}
          {shouldRenderTagManagerOverlay ? (
            <Suspense fallback={null}>
              <LazyTagManagerDialog
                isEditing={Boolean(editingTagId)}
                draft={tagDraft}
                tags={tagManagerScope === "memos" ? memoTags : tags}
                openTagActionMenuId={openTagActionMenuId}
                isSaving={isSavingTag}
                panelSummary={tagPanelSummary}
                panelKicker={tagPanelKicker}
                showPanelHeader={!shouldUseMobileSidebarPanels}
                onClose={requestCloseTagManager}
                onSubmit={handleTagSubmit}
                onDraftChange={updateTagDraft}
                onCancelEdit={cancelTagEdit}
                onToggleTagActionMenu={toggleTagActionMenu}
                onBeginTagEdit={(tag) => beginTagEdit(tag, tagManagerScope)}
                onTagDelete={(tag) => void handleTagDelete(tag, tagManagerScope)}
              />
            </Suspense>
          ) : null}
          {memoLockPromptMode ? (
            <Suspense fallback={null}>
              <LazyMemoLockDialog
                mode={memoLockPromptMode}
                isBusy={isMemoLockBusy}
                errorMessage={memoLockError}
                onClose={() => {
                  if (!isMemoLockBusy) {
                    pendingLockedMemoIdRef.current = null;
                    setMemoLockPromptMode(null);
                    setMemoLockError(null);
                  }
                }}
                onSubmit={handleMemoLockSubmit}
              />
            </Suspense>
          ) : null}
          {isExtensionTokenDialogOpen ? (
            <Suspense fallback={null}>
              <LazyExtensionTokenDialog
                tokens={extensionTokens}
                tokenLabelDraft={extensionTokenLabelDraft}
                latestIssuedToken={latestIssuedExtensionToken}
                connectionMessage={extensionConnectionMessage}
                isConnecting={isConnectingExtension}
                onClose={requestCloseExtensionTokenDialog}
                onTokenLabelDraftChange={setExtensionTokenLabelDraft}
                onTokenCreate={handleExtensionTokenCreate}
                onAutoConnect={handleExtensionAutoConnect}
                onTokenRevoke={handleExtensionTokenRevoke}
              />
            </Suspense>
          ) : null}
          {isExtensionDownloadDialogOpen ? (
            <Suspense fallback={null}>
              <LazyExtensionDownloadDialog
                extensionDownloadPath={EXTENSION_DOWNLOAD_PATH}
                userscriptDownloadPath={USERSCRIPT_DOWNLOAD_PATH}
                userscriptCopyStatus={userscriptCopyStatus}
                onClose={closeExtensionDownloadDialog}
                onUserscriptCodeCopy={() => void handleUserscriptCodeCopy()}
              />
            </Suspense>
          ) : null}
          </div>
        </section>
      ) : null}
      {isInstallHelpDialogOpen ? (
        <Suspense fallback={null}>
          <LazyInstallHelpDialog onClose={() => setIsInstallHelpDialogOpen(false)} />
        </Suspense>
      ) : null}
      {statusMessage ? (
        <p className="status-banner" role="status" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  );
}
