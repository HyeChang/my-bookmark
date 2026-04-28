import {
  lazy,
  Suspense,
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode
} from "react";
import "../App.css";

import type {
  AuthenticatedUser,
  Bookmark,
  BookmarkAsset,
  BookmarkCounts,
  BookmarkExtractPreview,
  BookmarkExtractPreviewBlock,
  BookmarkRelativeDateRange,
  BookmarkSearchMode,
  BookmarkSortMode,
  BookmarkTagMode,
  CreateBookmarkRequest,
  ExtensionToken,
  Folder,
  Tag
} from "@bookmark/shared";

import {
  deleteBookmarkAsset,
  loadBookmarkAssets,
  loadBookmarkAssetsByBookmarks,
  uploadBookmarkAsset
} from "../lib/bookmark-assets";
import { getBookmarkAssetPreloadBatches } from "../lib/bookmark-asset-preload";
import { extractBookmarkPreview } from "../lib/bookmark-extract";
import {
  createBookmark,
  deleteBookmark,
  loadBookmark,
  loadBookmarkCounts,
  loadBookmarkPage,
  loadBookmarkPreview,
  loadBookmarks,
  permanentlyDeleteBookmark,
  reextractBookmark,
  restoreBookmark,
  updateBookmark
} from "../lib/bookmarks";
import type { BookmarkPage } from "../lib/bookmarks";
import {
  createFolder,
  deleteFolder,
  loadFolders,
  moveFolder,
  reorderFolders,
  updateFolder
} from "../lib/folders";
import { colorPresets, folderIconPresets } from "../lib/folder-presets";
import { loadRecommendations, recordBookmarkOpen } from "../lib/recommendations";
import { exchangeIdTokenForSession, loadSession, logoutSession } from "../lib/session";
import { createTag, deleteTag, loadTags, updateTag } from "../lib/tags";
import {
  createExtensionToken,
  loadExtensionTokens,
  revokeExtensionToken
} from "../lib/extension-tokens";
import {
  configureBookmarkExtensionSettings,
  detectBookmarkExtensionPresence,
  detectBookmarkExtensionPresenceDetails,
  requestBookmarkExtensionPreview,
  type BookmarkExtensionPresenceStatus
} from "../lib/extension-presence";
import { extractImageFilesFromDataTransfer } from "../lib/clipboard-images";

type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthenticatedUser };

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

type BookmarkExtensionRenderedPreviewAttempt =
  | {
      status: "success";
      presence: "installed";
      preview: BookmarkExtractPreview;
    }
  | {
      status: "missing" | "failed";
      presence: BookmarkExtensionPresenceStatus;
    };

type TagDraft = {
  name: string;
  color: string;
};

type BookmarkSearchDraft = {
  query: string;
  mode: BookmarkSearchMode;
  sort: BookmarkSortMode;
  createdWithin: BookmarkRelativeDateRange;
  openedWithin: BookmarkRelativeDateRange;
  favoriteOnly: boolean;
  folderId: string;
  includeDescendantFolders: boolean;
  tagIds: string[];
  tagMode: BookmarkTagMode;
  bookmarkColor: string;
  urlColor: string;
  summaryState: "all" | "with" | "without";
};

type BookmarkRecommendationsState = {
  favorites: Bookmark[];
  recent: Bookmark[];
  frequent: Bookmark[];
};

type RecommendationKind = keyof BookmarkRecommendationsState;
type DashboardView = "home" | "bookmarks";
type SidebarPanelId = "compose" | "folder" | "bookmark" | "tag";
type MobileSidebarPanelId = "folder" | "bookmark" | "recommendation";
type BookmarkDetailDisplayMode = "rail" | "dialog";
type BookmarkDetailTab = "detail" | "preview" | "extract";
type BookmarkViewMode = "list" | "card" | "title" | "moodboard";
type BookmarkPageSize = 20 | 50 | 100;
type FolderOverviewDropMode = "reorder" | "move";
type FolderOverviewSpecialFilter = "all" | "unfiled" | "trash";

type BookmarkSearchSummaryItem = {
  key: string;
  groupLabel: string;
  valueLabel: string;
  nextSearch: BookmarkSearchDraft;
};

type ColorSelectFieldProps = {
  label: string;
  selectedColor: string;
  onSelect: (value: string) => void;
  emptyLabel: string;
  compact?: boolean;
};

type BookmarkCardDisplaySettings = {
  coverImage: boolean;
  title: boolean;
  description: boolean;
  tags: boolean;
  bookmarkInfo: boolean;
  coverSize: number;
};

const EXTENSION_DOWNLOAD_PATH = "/downloads/bookmark-saver-extension.zip";
const USERSCRIPT_DOWNLOAD_PATH = "/downloads/bookmark-saver.user.js?v=0.1.11";
const BOOKMARK_VIEW_SETTINGS_STORAGE_KEY = "bookmark-view-settings:v2";
const DEFAULT_BOOKMARK_VIEW_MODE: BookmarkViewMode = "list";

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

const emptyBookmarkSearchDraft: BookmarkSearchDraft = {
  query: "",
  mode: "all",
  sort: "created_desc",
  createdWithin: "all",
  openedWithin: "all",
  favoriteOnly: false,
  folderId: "",
  includeDescendantFolders: false,
  tagIds: [],
  tagMode: "and",
  bookmarkColor: "",
  urlColor: "",
  summaryState: "all"
};

const emptyBookmarkRecommendations: BookmarkRecommendationsState = {
  favorites: [],
  recent: [],
  frequent: []
};

const bookmarkSearchModeOptions: Array<{ value: BookmarkSearchMode; label: string }> = [
  { value: "all", label: "전체" },
  { value: "title", label: "제목" },
  { value: "content", label: "내용" },
  { value: "folder", label: "폴더" }
];

const bookmarkSortOptions: Array<{ value: BookmarkSortMode; label: string; shortLabel: string }> = [
  { value: "created_desc", label: "날짜순으로 ↓", shortLabel: "날짜 ↓" },
  { value: "created_asc", label: "날짜순으로 ↑", shortLabel: "날짜 ↑" },
  { value: "opened_desc", label: "최근 열람순", shortLabel: "열람" },
  { value: "title_asc", label: "이름순으로 (A-Z)", shortLabel: "이름 A-Z" },
  { value: "title_desc", label: "이름순으로 (Z-A)", shortLabel: "이름 Z-A" },
  { value: "site_asc", label: "사이트 (A-Z)", shortLabel: "사이트 A-Z" },
  { value: "site_desc", label: "사이트 (Z-A)", shortLabel: "사이트 Z-A" }
];

const bookmarkViewModeOptions: Array<{ value: BookmarkViewMode; label: string; icon: string }> = [
  { value: "list", label: "리스트", icon: "☷" },
  { value: "card", label: "카드", icon: "▦" },
  { value: "title", label: "제목", icon: "☰" },
  { value: "moodboard", label: "무드보드", icon: "▧" }
];
const bookmarkPageSizeOptions: BookmarkPageSize[] = [20, 50, 100];
const DEFAULT_BOOKMARK_PAGE_SIZE: BookmarkPageSize = 20;
const BOOKMARK_VIRTUALIZATION_THRESHOLD = 60;
const BOOKMARK_VIRTUAL_WINDOW_SIZE = 40;
const BOOKMARK_VIRTUAL_OVERSCAN = 8;
const bookmarkVirtualRowHeightByMode: Record<BookmarkViewMode, number> = {
  list: 112,
  title: 76,
  card: 260,
  moodboard: 320
};

const defaultBookmarkCardDisplaySettings: BookmarkCardDisplaySettings = {
  coverImage: true,
  title: true,
  description: true,
  tags: true,
  bookmarkInfo: true,
  coverSize: 132
};

const defaultBookmarkListDisplaySettings: BookmarkCardDisplaySettings = {
  coverImage: true,
  title: true,
  description: false,
  tags: true,
  bookmarkInfo: true,
  coverSize: 132
};

const MOBILE_SEARCH_BREAKPOINT = 720;
const MOBILE_SEARCH_MEDIA_QUERY = `(max-width: ${MOBILE_SEARCH_BREAKPOINT}px)`;
const EXTENSION_FOLDER_NAME = "확장";

function getIsMobileSearchViewport() {
  if (typeof globalThis.matchMedia === "function") {
    return globalThis.matchMedia(MOBILE_SEARCH_MEDIA_QUERY).matches;
  }

  return (
    globalThis.document?.documentElement?.clientWidth ?? globalThis.innerWidth ?? 1024
  ) <= MOBILE_SEARCH_BREAKPOINT;
}

function normalizeBookmarkSearchDraft(search: BookmarkSearchDraft): BookmarkSearchDraft {
  return {
    query: search.query.trim(),
    mode: search.mode,
    sort: search.sort,
    createdWithin: search.createdWithin,
    openedWithin: search.openedWithin,
    favoriteOnly: search.favoriteOnly,
    folderId: search.folderId.trim(),
    includeDescendantFolders: search.folderId.trim()
      ? search.includeDescendantFolders
      : false,
    tagIds: Array.from(new Set(search.tagIds.map((tagId) => tagId.trim()).filter(Boolean))),
    tagMode: search.tagMode === "or" ? "or" : "and",
    bookmarkColor: search.bookmarkColor.trim(),
    urlColor: search.urlColor.trim(),
    summaryState: search.summaryState
  };
}

function hasActiveBookmarkAdvancedFilters(search: BookmarkSearchDraft) {
  const normalizedSearch = normalizeBookmarkSearchDraft(search);
  return Boolean(
      normalizedSearch.createdWithin !== "all" ||
      normalizedSearch.openedWithin !== "all" ||
      normalizedSearch.favoriteOnly ||
      normalizedSearch.folderId ||
      (normalizedSearch.folderId && normalizedSearch.includeDescendantFolders) ||
      normalizedSearch.tagIds.length > 0 ||
      (normalizedSearch.tagIds.length > 0 && normalizedSearch.tagMode !== "and") ||
      normalizedSearch.bookmarkColor ||
      normalizedSearch.urlColor ||
      normalizedSearch.summaryState !== "all"
  );
}

function hasActiveBookmarkSearch(search: BookmarkSearchDraft) {
  const normalizedSearch = normalizeBookmarkSearchDraft(search);
  return Boolean(
    normalizedSearch.query ||
    normalizedSearch.sort !== "created_desc" ||
    hasActiveBookmarkAdvancedFilters(normalizedSearch)
  );
}

function canResolveFolderOverviewSearchLocally(search: BookmarkSearchDraft) {
  const normalizedSearch = normalizeBookmarkSearchDraft(search);
  return (
    !normalizedSearch.query &&
    normalizedSearch.sort === "created_desc" &&
    normalizedSearch.createdWithin === "all" &&
    normalizedSearch.openedWithin === "all" &&
    !normalizedSearch.favoriteOnly &&
    normalizedSearch.tagIds.length === 0 &&
    !normalizedSearch.bookmarkColor &&
    !normalizedSearch.urlColor &&
    normalizedSearch.summaryState === "all"
  );
}

function filterBookmarksForFolderOverviewSearch(
  bookmarks: Bookmark[],
  folders: Folder[],
  search: BookmarkSearchDraft
) {
  const normalizedSearch = normalizeBookmarkSearchDraft(search);
  if (!normalizedSearch.folderId) {
    return bookmarks;
  }

  if (!normalizedSearch.includeDescendantFolders) {
    return bookmarks.filter((bookmark) => bookmark.folderId === normalizedSearch.folderId);
  }

  const descendantFolderIds = getFolderDescendantIds(folders, normalizedSearch.folderId);
  return bookmarks.filter(
    (bookmark) =>
      bookmark.folderId === normalizedSearch.folderId ||
      (bookmark.folderId ? descendantFolderIds.has(bookmark.folderId) : false)
  );
}

function isExtensionFolder(folder: Folder) {
  return folder.name.trim() === EXTENSION_FOLDER_NAME;
}

function getExtensionFolderIds(folders: Folder[]) {
  const extensionFolderIds = new Set<string>();

  for (const folder of folders) {
    if (!isExtensionFolder(folder)) {
      continue;
    }

    extensionFolderIds.add(folder.id);
    for (const descendantId of getFolderDescendantIds(folders, folder.id)) {
      extensionFolderIds.add(descendantId);
    }
  }

  return extensionFolderIds;
}

function isBookmarkUnfiled(bookmark: Bookmark, extensionFolderIds: Set<string>) {
  return !bookmark.folderId || extensionFolderIds.has(bookmark.folderId);
}

function upsertBookmarkById(bookmarks: Bookmark[], nextBookmark: Bookmark) {
  return bookmarks.some((bookmark) => bookmark.id === nextBookmark.id)
    ? bookmarks.map((bookmark) => (bookmark.id === nextBookmark.id ? nextBookmark : bookmark))
    : [nextBookmark, ...bookmarks];
}

function filterBookmarksForFolderOverviewSpecialFilter(
  bookmarks: Bookmark[],
  filter: FolderOverviewSpecialFilter,
  extensionFolderIds: Set<string>
) {
  switch (filter) {
    case "unfiled":
      return bookmarks.filter((bookmark) => isBookmarkUnfiled(bookmark, extensionFolderIds));
    case "trash":
      return [];
    default:
      return bookmarks;
  }
}

function getBookmarkSearchModeLabel(mode: BookmarkSearchMode) {
  switch (mode) {
    case "title":
      return "제목";
    case "content":
      return "내용";
    case "folder":
      return "폴더";
    default:
      return "전체";
  }
}

function getColorPresetLabel(color: string | null | undefined) {
  if (!color) {
    return null;
  }

  const normalizedColor = color.toLowerCase();
  return colorPresets.find((preset) => preset.value.toLowerCase() === normalizedColor)?.label ?? color;
}

function getFolderIconGlyph(icon: string | null | undefined) {
  switch (icon) {
    case "book-open":
      return "▤";
    case "newspaper":
      return "▥";
    case "file-text":
      return "≣";
    case "folder":
      return "□";
    case "link":
      return "↗";
    case "star":
      return "★";
    default:
      return null;
  }
}

function getColorPreset(color: string | null | undefined) {
  if (!color) {
    return null;
  }

  const normalizedColor = color.toLowerCase();
  return colorPresets.find((preset) => preset.value.toLowerCase() === normalizedColor) ?? null;
}

function renderColorSwatch(color: string, className = "color-swatch") {
  return (
    <span
      className={className}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

function ColorSelectField({
  label,
  selectedColor,
  onSelect,
  emptyLabel,
  compact = false
}: ColorSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fieldsetRef = useRef<HTMLFieldSetElement | null>(null);
  const selectedPreset = getColorPreset(selectedColor);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!fieldsetRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    globalThis.document.addEventListener("mousedown", handlePointerDown);
    globalThis.document.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.document.removeEventListener("mousedown", handlePointerDown);
      globalThis.document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleColorSelect(nextColor: string) {
    onSelect(nextColor);
    setIsOpen(false);
  }

  return (
    <fieldset
      ref={fieldsetRef}
      className={`picker-fieldset color-select-fieldset${
        compact ? " color-select-fieldset-compact" : ""
      }`}
    >
      <legend>{label}</legend>
      <div className={`color-select${compact ? " color-select-compact" : ""}`}>
        <button
          type="button"
          className={`color-select-trigger${isOpen ? " color-select-trigger-open" : ""}`}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((currentState) => !currentState)}
        >
          <span className="color-select-trigger-value">
            {selectedPreset ? (
              renderColorSwatch(selectedPreset.value, "picker-color-swatch")
            ) : (
              <span className="color-select-empty-swatch" aria-hidden="true" />
            )}
            <span>{selectedPreset?.label ?? emptyLabel}</span>
          </span>
          <span className="color-select-trigger-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
        {isOpen ? (
          <div role="dialog" aria-label={`${label} 선택`} className="color-select-popover">
            <div className="color-select-options">
              <button
                type="button"
                className={`color-select-option${selectedPreset ? "" : " color-select-option-active"}`}
                aria-label={`${label} ${emptyLabel} 선택`}
                aria-pressed={!selectedPreset}
                onClick={() => handleColorSelect("")}
              >
                <span className="color-select-option-copy">
                  <span className="color-select-empty-swatch" aria-hidden="true" />
                  <span>{emptyLabel}</span>
                </span>
                {!selectedPreset ? (
                  <span className="choice-selection-mark" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`color-select-option${
                    selectedPreset?.value === preset.value ? " color-select-option-active" : ""
                  }`}
                  aria-label={`${label} ${preset.label} 선택`}
                  aria-pressed={selectedPreset?.value === preset.value}
                  onClick={() => handleColorSelect(preset.value)}
                >
                  <span className="color-select-option-copy">
                    {renderColorSwatch(preset.value, "picker-color-swatch")}
                    <span>{preset.label}</span>
                  </span>
                  {selectedPreset?.value === preset.value ? (
                    <span className="choice-selection-mark" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

function getBookmarkSortLabel(sort: BookmarkSortMode) {
  return bookmarkSortOptions.find((option) => option.value === sort)?.label ?? "날짜순으로 ↓";
}

function getBookmarkSortShortLabel(sort: BookmarkSortMode) {
  return bookmarkSortOptions.find((option) => option.value === sort)?.shortLabel ?? "날짜 ↓";
}

function getBookmarkViewModeLabel(mode: BookmarkViewMode) {
  return bookmarkViewModeOptions.find((option) => option.value === mode)?.label ?? "리스트";
}

function clampBookmarkCoverSize(value: number) {
  if (!Number.isFinite(value)) {
    return defaultBookmarkCardDisplaySettings.coverSize;
  }

  return Math.min(220, Math.max(80, Math.round(value)));
}

function isBookmarkViewMode(value: unknown): value is BookmarkViewMode {
  return bookmarkViewModeOptions.some((option) => option.value === value);
}

function normalizeBookmarkDisplaySettings(
  parsedSettings: Partial<BookmarkCardDisplaySettings> | undefined,
  defaultSettings: BookmarkCardDisplaySettings
): BookmarkCardDisplaySettings {
  return {
    coverImage:
      typeof parsedSettings?.coverImage === "boolean"
        ? parsedSettings.coverImage
        : defaultSettings.coverImage,
    title:
      typeof parsedSettings?.title === "boolean"
        ? parsedSettings.title
        : defaultSettings.title,
    description:
      typeof parsedSettings?.description === "boolean"
        ? parsedSettings.description
        : defaultSettings.description,
    tags:
      typeof parsedSettings?.tags === "boolean" ? parsedSettings.tags : defaultSettings.tags,
    bookmarkInfo:
      typeof parsedSettings?.bookmarkInfo === "boolean"
        ? parsedSettings.bookmarkInfo
        : defaultSettings.bookmarkInfo,
    coverSize: clampBookmarkCoverSize(
      Number(parsedSettings?.coverSize ?? defaultSettings.coverSize)
    )
  };
}

function loadStoredBookmarkViewSettings() {
  try {
    const storedSettings = globalThis.localStorage?.getItem(BOOKMARK_VIEW_SETTINGS_STORAGE_KEY);
    if (!storedSettings) {
      return {
        mode: DEFAULT_BOOKMARK_VIEW_MODE,
        list: defaultBookmarkListDisplaySettings,
        card: defaultBookmarkCardDisplaySettings
      };
    }

    const parsedSettings = JSON.parse(storedSettings) as {
      mode?: unknown;
      list?: Partial<BookmarkCardDisplaySettings>;
      card?: Partial<BookmarkCardDisplaySettings>;
    };

    return {
      mode: isBookmarkViewMode(parsedSettings.mode)
        ? parsedSettings.mode
        : DEFAULT_BOOKMARK_VIEW_MODE,
      list: normalizeBookmarkDisplaySettings(
        parsedSettings.list,
        defaultBookmarkListDisplaySettings
      ),
      card: normalizeBookmarkDisplaySettings(
        parsedSettings.card,
        defaultBookmarkCardDisplaySettings
      )
    };
  } catch {
    return {
      mode: DEFAULT_BOOKMARK_VIEW_MODE,
      list: defaultBookmarkListDisplaySettings,
      card: defaultBookmarkCardDisplaySettings
    };
  }
}

function getBookmarkRelativeDateRangeValue(range: BookmarkRelativeDateRange) {
  switch (range) {
    case "7d":
      return "최근 7일";
    case "30d":
      return "최근 30일";
    default:
      return null;
  }
}

function hasTextContent(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function decodeHtmlEntitiesForDisplay(value: string) {
  if (!/[&]/.test(value)) {
    return value;
  }

  const ownerDocument = globalThis.document;
  if (ownerDocument) {
    const textarea = ownerDocument.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function normalizeDisplayWhitespace(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeExtractedDisplayText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const decodedValue = decodeHtmlEntitiesForDisplay(value);
  return normalizeDisplayWhitespace(
    decodeHtmlEntitiesForDisplay(
      decodedValue
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<li\b[^>]*>/gi, "\n- ")
        .replace(/<\/li>/gi, "\n")
        .replace(
          /<\/?(?:address|article|aside|blockquote|dd|details|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi,
          "\n\n"
        )
        .replace(/<[^>]+>/g, " ")
        .replace(/\b[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, " ")
    )
  );
}

function getBookmarkPreviewText(bookmark: Bookmark) {
  if (hasTextContent(bookmark.userSummary)) {
    return bookmark.userSummary ?? "";
  }

  if (hasTextContent(bookmark.userContent)) {
    return bookmark.userContent ?? "";
  }

  if (hasTextContent(bookmark.sourceSummary)) {
    return bookmark.sourceSummary ?? "";
  }

  if (hasTextContent(bookmark.displaySummary)) {
    return bookmark.displaySummary;
  }

  if (hasTextContent(bookmark.sourceContent)) {
    return bookmark.sourceContent ?? "";
  }

  if (hasTextContent(bookmark.displayContent)) {
    return bookmark.displayContent;
  }

  return "";
}

function getBookmarkSummaryStateLabel(bookmark: Bookmark) {
  if (hasTextContent(bookmark.userSummary)) {
    return "직접 요약";
  }

  if (hasTextContent(bookmark.userContent)) {
    return "직접 정리";
  }

  if (hasTextContent(bookmark.sourceSummary)) {
    return "자동 요약";
  }

  if (hasTextContent(bookmark.displaySummary)) {
    return "요약";
  }

  if (hasTextContent(bookmark.sourceContent)) {
    return "자동 추출";
  }

  if (hasTextContent(bookmark.displayContent)) {
    return "내용";
  }

  return "요약 없음";
}

function getBookmarkDetailFieldRows(bookmark: Bookmark, mode: "user" | "source") {
  const rows =
    mode === "user"
      ? [
          { label: "제목", value: bookmark.userTitle },
          { label: "내용", value: bookmark.userContent },
          { label: "요약", value: bookmark.userSummary }
        ]
      : [
          { label: "제목", value: bookmark.sourceTitle },
          { label: "내용", value: bookmark.sourceContent },
          { label: "요약", value: bookmark.sourceSummary }
        ];

  return rows
    .map((row) => ({
      ...row,
      value: mode === "source" ? sanitizeExtractedDisplayText(row.value) : row.value
    }))
    .filter((row) => hasTextContent(row.value));
}

function getBookmarkPreviewFieldRows(preview: BookmarkExtractPreview | null) {
  if (!preview) {
    return [];
  }

  const hasArticleBlocks = getBookmarkPreviewArticleBlocks(preview).length > 0;
  if (hasArticleBlocks) {
    return [];
  }

  return [
    { label: "제목", value: preview.sourceTitle },
    { label: "내용", value: preview.sourceContent },
    { label: "요약", value: preview.sourceSummary }
  ]
    .map((row) => ({
      ...row,
      value: sanitizeExtractedDisplayText(row.value)
    }))
    .filter((row) => hasTextContent(row.value));
}

function getBookmarkPreviewImageAlt(preview: BookmarkExtractPreview) {
  return `${sanitizeExtractedDisplayText(preview.sourceTitle) || preview.normalizedUrl || preview.url} 미리보기 이미지`;
}

function getBookmarkPreviewArticleBlocks(preview: BookmarkExtractPreview | null) {
  return (preview?.sourceBlocks ?? []).map((block) => {
    if (block.type === "image") {
      return {
        ...block,
        alt: sanitizeExtractedDisplayText(block.alt) || null
      };
    }

    return {
      ...block,
      text: sanitizeExtractedDisplayText(block.text)
    };
  }).filter((block) => {
    if (block.type === "image") {
      return hasTextContent(block.url);
    }

    return hasTextContent(block.text);
  });
}

function getBookmarkPreviewArticleImageAlt(
  preview: BookmarkExtractPreview,
  block: Extract<BookmarkExtractPreviewBlock, { type: "image" }>,
  index: number
) {
  return block.alt ?? `${sanitizeExtractedDisplayText(preview.sourceTitle) || preview.normalizedUrl || preview.url} 본문 이미지 ${index + 1}`;
}

function getBookmarkPreviewStoredSourceFields(preview: BookmarkExtractPreview | null) {
  return {
    sourceTitle: sanitizeExtractedDisplayText(preview?.sourceTitle) || null,
    sourceContent: sanitizeExtractedDisplayText(preview?.sourceContent) || null,
    sourceSummary: sanitizeExtractedDisplayText(preview?.sourceSummary) || null
  };
}

function isJsRequiredBookmarkPreview(preview: BookmarkExtractPreview | null | undefined) {
  return preview?.renderStatus === "js_required";
}

function getBookmarkPreviewWorkerFallbackMessage(status: "missing" | "failed") {
  if (status === "missing") {
    return "브라우저 렌더링이 필요해 worker 메타데이터만 표시합니다.";
  }

  return "확장 렌더링에 실패해 worker 메타데이터만 표시합니다.";
}

function renderBookmarkPreviewArticle(preview: BookmarkExtractPreview) {
  const blocks = getBookmarkPreviewArticleBlocks(preview);
  if (blocks.length === 0) {
    return null;
  }

  let imageIndex = 0;
  return (
    <section className="bookmark-preview-article" aria-label="미리보기 본문">
      {blocks.map((block, index) => {
        const key =
          block.type === "image"
            ? `${block.type}-${block.url}-${index}`
            : `${block.type}-${block.text.slice(0, 32)}-${index}`;

        if (block.type === "image") {
          const currentImageIndex = imageIndex;
          imageIndex += 1;
          return (
            <figure key={key} className="bookmark-preview-article-figure">
              <img
                className="bookmark-preview-article-image"
                src={block.url}
                alt={getBookmarkPreviewArticleImageAlt(preview, block, currentImageIndex)}
                loading="lazy"
              />
              {block.alt ? <figcaption>{block.alt}</figcaption> : null}
            </figure>
          );
        }

        if (block.type === "heading") {
          return (
            <h4 key={key} className="bookmark-preview-article-heading">
              {block.text}
            </h4>
          );
        }

        if (block.type === "list-item") {
          return (
            <p key={key} className="bookmark-preview-article-list-item">
              <span aria-hidden="true">•</span>
              <span>{block.text}</span>
            </p>
          );
        }

        return (
          <p key={key} className="bookmark-preview-article-paragraph">
            {block.text}
          </p>
        );
      })}
    </section>
  );
}

function hasBookmarkPreviewCoverImage(preview: BookmarkExtractPreview | null) {
  if (!preview?.sourceImageUrl) {
    return false;
  }

  return !getBookmarkPreviewArticleBlocks(preview).some(
    (block) => block.type === "image" && block.url === preview.sourceImageUrl
  );
}

function getRecommendationReasonLabel(kind: RecommendationKind) {
  switch (kind) {
    case "favorites":
      return "즐겨찾기 기반";
    case "recent":
      return "최근 열람 기반";
    case "frequent":
      return "반복 열람 기반";
    default:
      return "추천";
  }
}

function getBookmarkSearchSummaryItems(
  search: BookmarkSearchDraft,
  options: {
    getFolderName: (folderId: string | null) => string;
    getTagNames: (tagIds: string[]) => string[];
  }
) {
  const normalizedSearch = normalizeBookmarkSearchDraft(search);
  const items: BookmarkSearchSummaryItem[] = [];
  const push = (
    key: string,
    groupLabel: string,
    valueLabel: string,
    buildNextSearch: (currentSearch: BookmarkSearchDraft) => BookmarkSearchDraft
  ) => {
    items.push({
      key,
      groupLabel,
      valueLabel,
      nextSearch: normalizeBookmarkSearchDraft(buildNextSearch(normalizedSearch))
    });
  };

  if (normalizedSearch.query) {
    push(
      `query:${normalizedSearch.query}`,
      "검색어",
      normalizedSearch.query,
      (currentSearch) => ({
        ...currentSearch,
        query: ""
      })
    );
    if (normalizedSearch.mode !== "all") {
      push(
        `mode:${normalizedSearch.mode}`,
        "검색",
        getBookmarkSearchModeLabel(normalizedSearch.mode),
        (currentSearch) => ({
          ...currentSearch,
          mode: "all"
        })
      );
    }
  }

  if (normalizedSearch.sort !== "created_desc") {
    push(
      `sort:${normalizedSearch.sort}`,
      "정렬",
      getBookmarkSortLabel(normalizedSearch.sort),
      (currentSearch) => ({
        ...currentSearch,
        sort: "created_desc"
      })
    );
  }

  const createdWithinValue = getBookmarkRelativeDateRangeValue(normalizedSearch.createdWithin);
  if (createdWithinValue) {
    push(
      `createdWithin:${normalizedSearch.createdWithin}`,
      "기간",
      `최근 추가 ${createdWithinValue}`,
      (currentSearch) => ({
        ...currentSearch,
        createdWithin: "all"
      })
    );
  }

  const openedWithinValue = getBookmarkRelativeDateRangeValue(normalizedSearch.openedWithin);
  if (openedWithinValue) {
    push(
      `openedWithin:${normalizedSearch.openedWithin}`,
      "기간",
      `최근 열람 ${openedWithinValue}`,
      (currentSearch) => ({
        ...currentSearch,
        openedWithin: "all"
      })
    );
  }

  if (normalizedSearch.favoriteOnly) {
    push("favoriteOnly", "상태", "즐겨찾기만", (currentSearch) => ({
      ...currentSearch,
      favoriteOnly: false
    }));
  }

  if (normalizedSearch.folderId) {
    push(
      `folder:${normalizedSearch.folderId}`,
      "분류",
      `폴더 ${options.getFolderName(normalizedSearch.folderId)}`,
      (currentSearch) => ({
        ...currentSearch,
        folderId: "",
        includeDescendantFolders: false
      })
    );
    if (normalizedSearch.includeDescendantFolders) {
      push("includeDescendantFolders", "분류", "하위 폴더 포함", (currentSearch) => ({
        ...currentSearch,
        includeDescendantFolders: false
      }));
    }
  }

  if (normalizedSearch.tagIds.length > 0) {
    const tagNames = options.getTagNames(normalizedSearch.tagIds);
    normalizedSearch.tagIds.forEach((tagId, index) => {
      push(
        `tag:${tagId}`,
        "분류",
        `태그 ${tagNames[index] ?? tagId}`,
        (currentSearch) => {
          const nextTagIds = currentSearch.tagIds.filter((currentTagId) => currentTagId !== tagId);

          return {
            ...currentSearch,
            tagIds: nextTagIds,
            tagMode: nextTagIds.length === 0 ? "and" : currentSearch.tagMode
          };
        }
      );
    });

    if (normalizedSearch.tagMode !== "and") {
      push("tagMode", "분류", "하나라도 포함", (currentSearch) => ({
        ...currentSearch,
        tagMode: "and"
      }));
    }
  }

  if (normalizedSearch.bookmarkColor) {
    push(
      `bookmarkColor:${normalizedSearch.bookmarkColor}`,
      "상태",
      `북마크 ${getColorPresetLabel(normalizedSearch.bookmarkColor)}`,
      (currentSearch) => ({
        ...currentSearch,
        bookmarkColor: ""
      })
    );
  }

  if (normalizedSearch.urlColor) {
    push(
      `urlColor:${normalizedSearch.urlColor}`,
      "상태",
      `URL ${getColorPresetLabel(normalizedSearch.urlColor)}`,
      (currentSearch) => ({
        ...currentSearch,
        urlColor: ""
      })
    );
  }

  if (normalizedSearch.summaryState === "with") {
    push("summaryState:with", "상태", "요약 있음", (currentSearch) => ({
      ...currentSearch,
      summaryState: "all"
    }));
  }

  if (normalizedSearch.summaryState === "without") {
    push("summaryState:without", "상태", "요약 없음", (currentSearch) => ({
      ...currentSearch,
      summaryState: "all"
    }));
  }

  return items;
}

function getFolderDescendantIds(folders: Folder[], rootFolderId: string) {
  const descendants = new Set<string>();
  const pendingFolderIds = [rootFolderId];

  while (pendingFolderIds.length > 0) {
    const currentFolderId = pendingFolderIds.pop();
    if (!currentFolderId) {
      continue;
    }

    for (const folder of folders) {
      if (folder.parentFolderId !== currentFolderId || descendants.has(folder.id)) {
        continue;
      }

      descendants.add(folder.id);
      pendingFolderIds.push(folder.id);
    }
  }

  return descendants;
}

function getHiddenFolderIds(folders: Folder[]) {
  const hiddenFolderIds = new Set<string>();

  for (const folder of folders) {
    if (folder.isHidden === true) {
      hiddenFolderIds.add(folder.id);
      for (const descendantId of getFolderDescendantIds(folders, folder.id)) {
        hiddenFolderIds.add(descendantId);
      }
    }
  }

  return hiddenFolderIds;
}

function filterBookmarksByHiddenFolders(
  bookmarks: Bookmark[],
  hiddenFolderIds: Set<string>,
  showHiddenFolders: boolean
) {
  if (showHiddenFolders || hiddenFolderIds.size === 0) {
    return bookmarks;
  }

  return bookmarks.filter(
    (bookmark) => !bookmark.folderId || !hiddenFolderIds.has(bookmark.folderId)
  );
}

function filterRecommendationsByHiddenFolders(
  nextRecommendations: BookmarkRecommendationsState,
  hiddenFolderIds: Set<string>,
  showHiddenFolders: boolean
) {
  if (showHiddenFolders || hiddenFolderIds.size === 0) {
    return nextRecommendations;
  }

  return {
    favorites: filterBookmarksByHiddenFolders(
      nextRecommendations.favorites,
      hiddenFolderIds,
      showHiddenFolders
    ),
    recent: filterBookmarksByHiddenFolders(
      nextRecommendations.recent,
      hiddenFolderIds,
      showHiddenFolders
    ),
    frequent: filterBookmarksByHiddenFolders(
      nextRecommendations.frequent,
      hiddenFolderIds,
      showHiddenFolders
    )
  };
}

function filterBookmarksByHiddenBookmarks(bookmarks: Bookmark[], showHiddenBookmarks: boolean) {
  if (showHiddenBookmarks) {
    return bookmarks;
  }

  return bookmarks.filter((bookmark) => bookmark.isHidden !== true);
}

function filterRecommendationsByHiddenBookmarks(
  nextRecommendations: BookmarkRecommendationsState,
  showHiddenBookmarks: boolean
) {
  if (showHiddenBookmarks) {
    return nextRecommendations;
  }

  return {
    favorites: filterBookmarksByHiddenBookmarks(nextRecommendations.favorites, showHiddenBookmarks),
    recent: filterBookmarksByHiddenBookmarks(nextRecommendations.recent, showHiddenBookmarks),
    frequent: filterBookmarksByHiddenBookmarks(nextRecommendations.frequent, showHiddenBookmarks)
  };
}

function isBookmarkVisibleUnderHiddenRules(
  bookmark: Bookmark,
  hiddenFolderIds: Set<string>,
  showHiddenFolders: boolean,
  showHiddenBookmarks: boolean
) {
  const isFolderVisible =
    !bookmark.folderId || showHiddenFolders || !hiddenFolderIds.has(bookmark.folderId);
  const isBookmarkVisible = bookmark.isHidden !== true || showHiddenBookmarks;

  return isFolderVisible && isBookmarkVisible;
}

function getHierarchicalFolderOptions(folders: Folder[], excludedFolderIds = new Set<string>()) {
  const foldersByParentId = getFoldersByParentId(folders, excludedFolderIds);
  const options: Array<{ folder: Folder; label: string }> = [];

  function visit(parentFolderId: string | null, depth: number) {
    for (const folder of foldersByParentId.get(parentFolderId) ?? []) {
      options.push({
        folder,
        label: `${"-- ".repeat(depth)}${folder.name}`
      });
      visit(folder.id, depth + 1);
    }
  }

  visit(null, 0);
  return options;
}

function getFoldersByParentId(folders: Folder[], excludedFolderIds = new Set<string>()) {
  const foldersByParentId = new Map<string | null, Folder[]>();
  const knownFolderIds = new Set(folders.map((folder) => folder.id));
  const sortedFolders = [...folders].sort(
    (leftFolder, rightFolder) =>
      leftFolder.sortOrder - rightFolder.sortOrder || leftFolder.name.localeCompare(rightFolder.name)
  );

  for (const folder of sortedFolders) {
    if (excludedFolderIds.has(folder.id)) {
      continue;
    }

    const parentKey =
      folder.parentFolderId && knownFolderIds.has(folder.parentFolderId)
        ? folder.parentFolderId
        : null;
    const currentFolders = foldersByParentId.get(parentKey) ?? [];
    currentFolders.push(folder);
    foldersByParentId.set(parentKey, currentFolders);
  }

  return foldersByParentId;
}

function getFolderAncestorIds(folders: Folder[], folderId: string) {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const ancestors: string[] = [];
  let currentFolder = foldersById.get(folderId) ?? null;

  while (currentFolder?.parentFolderId) {
    ancestors.push(currentFolder.parentFolderId);
    currentFolder = foldersById.get(currentFolder.parentFolderId) ?? null;
  }

  return ancestors;
}

function getFolderVisibleIdsForQuery(folders: Folder[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return new Set(folders.map((folder) => folder.id));
  }

  const visibleFolderIds = new Set<string>();

  for (const folder of folders) {
    if (!folder.name.toLowerCase().includes(normalizedQuery)) {
      continue;
    }

    visibleFolderIds.add(folder.id);
    for (const ancestorId of getFolderAncestorIds(folders, folder.id)) {
      visibleFolderIds.add(ancestorId);
    }
  }

  return visibleFolderIds;
}

function countBookmarksInFolderTree(bookmarks: Bookmark[], folders: Folder[], folderId: string) {
  const descendantFolderIds = getFolderDescendantIds(folders, folderId);

  return bookmarks.filter(
    (bookmark) =>
      bookmark.folderId === folderId ||
      (bookmark.folderId ? descendantFolderIds.has(bookmark.folderId) : false)
  ).length;
}

function getBookmarkCountBucketValue(
  bucket: { total: number; visible: number } | undefined,
  showHiddenBookmarks: boolean
) {
  if (!bucket) {
    return 0;
  }

  return showHiddenBookmarks ? bucket.total : bucket.visible;
}

function countBookmarksInFolderTreeFromCounts(
  counts: BookmarkCounts,
  folders: Folder[],
  folderId: string,
  showHiddenBookmarks: boolean
) {
  const folderIds = [folderId, ...getFolderDescendantIds(folders, folderId)];

  return folderIds.reduce(
    (total, currentFolderId) =>
      total +
      getBookmarkCountBucketValue(counts.byFolderId[currentFolderId], showHiddenBookmarks),
    0
  );
}

function countVisibleActiveBookmarksFromCounts(
  counts: BookmarkCounts,
  hiddenFolderIds: Set<string>,
  showHiddenFolders: boolean,
  showHiddenBookmarks: boolean
) {
  let total = getBookmarkCountBucketValue(counts.unfiled, showHiddenBookmarks);

  for (const [folderId, bucket] of Object.entries(counts.byFolderId)) {
    if (!showHiddenFolders && hiddenFolderIds.has(folderId)) {
      continue;
    }

    total += getBookmarkCountBucketValue(bucket, showHiddenBookmarks);
  }

  return total;
}

function countUnfiledBookmarksFromCounts(
  counts: BookmarkCounts,
  extensionFolderIds: Set<string>,
  showHiddenBookmarks: boolean
) {
  let total = getBookmarkCountBucketValue(counts.unfiled, showHiddenBookmarks);

  for (const folderId of extensionFolderIds) {
    total += getBookmarkCountBucketValue(counts.byFolderId[folderId], showHiddenBookmarks);
  }

  return total;
}

function getSiblingFolders(folders: Folder[], parentFolderId: string | null) {
  return folders
    .filter((folder) => folder.parentFolderId === parentFolderId)
    .sort(
      (leftFolder, rightFolder) =>
        leftFolder.sortOrder - rightFolder.sortOrder ||
        leftFolder.name.localeCompare(rightFolder.name)
    );
}

function reorderSiblingFolders(
  siblingFolders: Folder[],
  draggedFolderId: string,
  targetFolderId: string
) {
  const draggedFolderIndex = siblingFolders.findIndex((folder) => folder.id === draggedFolderId);
  const targetFolderIndex = siblingFolders.findIndex((folder) => folder.id === targetFolderId);

  if (
    draggedFolderIndex === -1 ||
    targetFolderIndex === -1 ||
    draggedFolderIndex === targetFolderIndex
  ) {
    return siblingFolders;
  }

  const draggedFolder = siblingFolders[draggedFolderIndex];
  const remainingFolders = siblingFolders.filter((folder) => folder.id !== draggedFolderId);
  const insertionIndex =
    draggedFolderIndex < targetFolderIndex ? targetFolderIndex : targetFolderIndex;

  remainingFolders.splice(insertionIndex, 0, draggedFolder);
  return remainingFolders;
}

function renderColorPicker(
  legend: string,
  selectedColor: string,
  onSelect: (value: string) => void
) {
  return (
    <ColorSelectField
      label={legend}
      selectedColor={selectedColor}
      onSelect={onSelect}
      emptyLabel="선택 안 함"
    />
  );
}

function renderSearchColorSelect(
  label: string,
  selectedColor: string,
  onSelect: (value: string) => void
) {
  return (
    <ColorSelectField
      label={label}
      selectedColor={selectedColor}
      onSelect={onSelect}
      emptyLabel="전체 색상"
      compact
    />
  );
}

async function signInWithGoogle() {
  const firebaseAuth = await import("../lib/firebase");
  return firebaseAuth.signInWithGoogle();
}

async function signOutFromGoogle() {
  const firebaseAuth = await import("../lib/firebase");
  return firebaseAuth.signOutFromGoogle();
}

const LazyInstallHelpDialog = lazy(() => import("./InstallHelpDialog"));
const LazyExtensionDownloadDialog = lazy(() => import("./ExtensionDownloadDialog"));
const LazyExtensionTokenDialog = lazy(() => import("./ExtensionTokenDialog"));
const LazyBookmarkDetailPanel = lazy(() => import("./BookmarkDetailPanel"));
const LazyBookmarkComposerDialog = lazy(() => import("./BookmarkComposerDialog"));
const LazyFolderManagerDialog = lazy(() => import("./FolderManagerDialog"));
const LazyTagManagerDialog = lazy(() => import("./TagManagerDialog"));

type CheckboxFieldProps = {
  label: ReactNode;
  className?: string;
  inputProps: Omit<InputHTMLAttributes<HTMLInputElement>, "type">;
};

function renderCheckboxField({ label, className, inputProps }: CheckboxFieldProps) {
  const classes = ["checkbox-field", className].filter(Boolean).join(" ");
  const inputClasses = ["checkbox-field-input", inputProps.className].filter(Boolean).join(" ");

  return (
    <label className={classes}>
      <span className="checkbox-field-copy">{label}</span>
      <input {...inputProps} type="checkbox" className={inputClasses} />
    </label>
  );
}

function renderFolderColorPicker(selectedColor: string, onSelect: (value: string) => void) {
  return renderColorPicker("폴더 색상", selectedColor, onSelect);
}

function renderFolderIconPicker(
  selectedIcon: string,
  onSelect: (value: string) => void
) {
  const selectedPreset = folderIconPresets.find((preset) => preset.value === selectedIcon) ?? null;

  return (
    <fieldset className="picker-fieldset">
      <legend>폴더 아이콘</legend>
      <div className="picker-grid">
        <button
          type="button"
          className={`picker-chip${selectedIcon ? "" : " picker-chip-active"}`}
          aria-label="폴더 아이콘 선택 안 함"
          aria-pressed={!selectedIcon}
          onClick={() => onSelect("")}
        >
          <span className="picker-chip-copy">
            <span>선택 안 함</span>
          </span>
          {!selectedIcon ? (
            <span className="choice-selection-mark" aria-hidden="true">
              ✓
            </span>
          ) : null}
        </button>
        {folderIconPresets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`picker-chip${selectedIcon === preset.value ? " picker-chip-active" : ""}`}
            aria-label={`폴더 아이콘 ${preset.label} 선택`}
            aria-pressed={selectedIcon === preset.value}
            onClick={() => onSelect(preset.value)}
          >
            <span className="picker-chip-copy">
              {(() => {
                const folderIconGlyph = getFolderIconGlyph(preset.value);
                return folderIconGlyph ? (
                  <span className="folder-icon-badge picker-chip-icon-badge" aria-hidden="true">
                    {folderIconGlyph}
                  </span>
                ) : null;
              })()}
              <span>{preset.label}</span>
            </span>
            {selectedIcon === preset.value ? (
              <span className="choice-selection-mark" aria-hidden="true">
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <p className="picker-selection-summary" aria-live="polite">
        {`선택됨: ${selectedPreset?.label ?? "없음"}`}
      </p>
    </fieldset>
  );
}

function renderSearchModeSegmentedControl(
  selectedMode: BookmarkSearchMode,
  onSelect: (value: BookmarkSearchMode) => void
) {
  return (
    <div className="search-mode-segmented" role="radiogroup" aria-label="검색 모드">
      {bookmarkSearchModeOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`search-mode-button${selectedMode === option.value ? " search-mode-button-active" : ""}`}
          aria-pressed={selectedMode === option.value}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function AuthenticatedDashboardApp() {
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
  const [activeDashboardView, setActiveDashboardView] = useState<DashboardView>("home");
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
    useState(DEFAULT_BOOKMARK_PAGE_SIZE);
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
  const [expandedFolderManagerIds, setExpandedFolderManagerIds] = useState<string[]>([]);
  const [folderOverviewSpecialFilter, setFolderOverviewSpecialFilter] =
    useState<FolderOverviewSpecialFilter | null>(null);
  const [folderOverviewQuery, setFolderOverviewQuery] = useState("");
  const [showHiddenFolders, setShowHiddenFolders] = useState(false);
  const [showHiddenBookmarks, setShowHiddenBookmarks] = useState(false);
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
  const [isLoadingBookmarkPreview, setIsLoadingBookmarkPreview] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isSavingQuickFolder, setIsSavingQuickFolder] = useState(false);
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [isReorderingFolders, setIsReorderingFolders] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const bookmarkDetailRequestIdRef = useRef(0);
  const bookmarkPreviewRequestIdRef = useRef(0);
  const recommendationRequestIdRef = useRef(0);
  const bookmarkListElementRef = useRef<HTMLUListElement | null>(null);
  const preloadingBookmarkAssetIdsRef = useRef<Set<string>>(new Set());
  const deferredBookmarkAssetPreloadTimerRef =
    useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

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

  function openHomePage() {
    setActiveDashboardView("home");
    setSelectedBookmark(null);
    setBookmarkDetailDisplayMode("rail");
    setIsBookmarkPreviewFullscreen(false);
    closeOpenMenus();
  }

  function openBookmarkWorkspace() {
    setActiveDashboardView("bookmarks");
    requestDesktopRecommendationsIfNeeded();
    closeOpenMenus();
  }

  async function loadBookmarkAssetsByBookmark(bookmarksToLoad: Bookmark[]) {
    const bookmarkIds = bookmarksToLoad.map((bookmark) => bookmark.id);

    try {
      return await loadBookmarkAssetsByBookmarks(bookmarkIds);
    } catch {
      const assetEntries = await Promise.all(
        bookmarksToLoad.map(async (bookmark) => {
          try {
            const assets = await loadBookmarkAssets(bookmark.id);
            return [bookmark.id, assets] as const;
          } catch {
            return [bookmark.id, [] as BookmarkAsset[]] as const;
          }
        })
      );

      return Object.fromEntries(assetEntries) as Record<string, BookmarkAsset[]>;
    }
  }

  async function preloadBookmarkAssets(
    bookmarksToLoad: Bookmark[],
    currentAssetsByBookmarkId: Record<string, BookmarkAsset[]>
  ) {
    const bookmarksMissingAssets = bookmarksToLoad.filter(
      (bookmark) =>
        currentAssetsByBookmarkId[bookmark.id] === undefined &&
        !preloadingBookmarkAssetIdsRef.current.has(bookmark.id)
    );
    if (bookmarksMissingAssets.length === 0) {
      return;
    }

    for (const bookmark of bookmarksMissingAssets) {
      preloadingBookmarkAssetIdsRef.current.add(bookmark.id);
    }

    try {
      const nextBookmarkAssetsByBookmarkId = await loadBookmarkAssetsByBookmark(bookmarksMissingAssets);

      startTransition(() => {
        setBookmarkAssetsByBookmarkId((latestAssetsByBookmarkId) => {
          const missingAssetEntries = Object.entries(nextBookmarkAssetsByBookmarkId).filter(
            ([bookmarkId]) => latestAssetsByBookmarkId[bookmarkId] === undefined
          );
          if (missingAssetEntries.length === 0) {
            return latestAssetsByBookmarkId;
          }

          return {
            ...latestAssetsByBookmarkId,
            ...Object.fromEntries(missingAssetEntries)
          };
        });
      });
    } finally {
      for (const bookmark of bookmarksMissingAssets) {
        preloadingBookmarkAssetIdsRef.current.delete(bookmark.id);
      }
    }
  }

  function getBookmarkAssetPreloadCandidates(
    bookmarksToLoad: Bookmark[],
    dashboardView: DashboardView
  ) {
    if (
      dashboardView === "bookmarks" &&
      (bookmarkViewMode === "list" || bookmarkViewMode === "title") &&
      bookmarksToLoad.length > BOOKMARK_VIRTUALIZATION_THRESHOLD
    ) {
      const visibleWindowSize = shouldUseCompactMobileCards
        ? 28
        : BOOKMARK_VIRTUAL_WINDOW_SIZE;
      return bookmarksToLoad.slice(0, visibleWindowSize);
    }

    return bookmarksToLoad;
  }

  function queueBookmarkAssetPreload(
    bookmarksToLoad: Bookmark[],
    currentAssetsByBookmarkId: Record<string, BookmarkAsset[]>,
    dashboardView: DashboardView = activeDashboardView
  ) {
    if (deferredBookmarkAssetPreloadTimerRef.current) {
      globalThis.clearTimeout(deferredBookmarkAssetPreloadTimerRef.current);
      deferredBookmarkAssetPreloadTimerRef.current = null;
    }

    const preloadCandidates = getBookmarkAssetPreloadCandidates(
      bookmarksToLoad,
      dashboardView
    ).filter(
      (bookmark) =>
        currentAssetsByBookmarkId[bookmark.id] === undefined &&
        !preloadingBookmarkAssetIdsRef.current.has(bookmark.id)
    );
    if (preloadCandidates.length === 0) {
      return;
    }

    const batches = getBookmarkAssetPreloadBatches(preloadCandidates, {
      dashboardView,
      bookmarkViewMode
    });

    if (batches.eager.length > 0) {
      void preloadBookmarkAssets(batches.eager, currentAssetsByBookmarkId);
    }

    if (batches.deferred.length === 0) {
      return;
    }

    deferredBookmarkAssetPreloadTimerRef.current = globalThis.setTimeout(() => {
      void preloadBookmarkAssets(batches.deferred, currentAssetsByBookmarkId);
      deferredBookmarkAssetPreloadTimerRef.current = null;
    }, 500);
  }

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

  async function loadBookmarkCollections(search: BookmarkSearchDraft) {
    const normalizedSearch = normalizeBookmarkSearchDraft(search);

    if (hasActiveBookmarkSearch(normalizedSearch)) {
      const [visibleBookmarks, inventoryBookmarks] = await Promise.all([
        loadBookmarks(normalizedSearch),
        loadBookmarks(emptyBookmarkSearchDraft)
      ]);

      return {
        normalizedSearch,
        visibleBookmarks,
        inventoryBookmarks
      };
    }

    const visibleBookmarks = await loadBookmarks(normalizedSearch);

    return {
      normalizedSearch,
      visibleBookmarks,
      inventoryBookmarks: visibleBookmarks
    };
  }

  async function loadDashboardBookmarkData(search: BookmarkSearchDraft) {
    const normalizedSearch = normalizeBookmarkSearchDraft(search);

    if (activeDashboardView !== "home" || hasActiveBookmarkSearch(normalizedSearch)) {
      const collections = await loadBookmarkCollections(normalizedSearch);
      return {
        ...collections,
        bookmarkCounts: null as BookmarkCounts | null,
        homeFavoriteBookmarks: null as Bookmark[] | null,
        hasFullInventory: true
      };
    }

    try {
      const [favoritePage, nextBookmarkCounts] = await Promise.all([
        loadBookmarkPage({
          ...emptyBookmarkSearchDraft,
          favoriteOnly: true,
          limit: DEFAULT_BOOKMARK_PAGE_SIZE,
          offset: 0
        }),
        loadBookmarkCounts()
      ]);

      return {
        normalizedSearch,
        visibleBookmarks: [] as Bookmark[],
        inventoryBookmarks: [] as Bookmark[],
        bookmarkCounts: nextBookmarkCounts,
        homeFavoriteBookmarks: favoritePage.bookmarks,
        hasFullInventory: false
      };
    } catch {
      const collections = await loadBookmarkCollections(normalizedSearch);
      return {
        ...collections,
        bookmarkCounts: null as BookmarkCounts | null,
        homeFavoriteBookmarks: null as Bookmark[] | null,
        hasFullInventory: true
      };
    }
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

  async function refreshDashboardData(search = appliedBookmarkSearch) {
    setIsLoadingDashboard(true);

    try {
      const [
        {
          visibleBookmarks: nextBookmarks,
          inventoryBookmarks: nextBookmarkInventory,
          bookmarkCounts: nextBookmarkCounts,
          homeFavoriteBookmarks: nextHomeFavoriteBookmarks,
          hasFullInventory
        },
        nextFolders,
        nextTags
      ] = await Promise.all([
        loadDashboardBookmarkData(search),
        loadFolders(),
        loadTags()
      ]);

      startTransition(() => {
        setBookmarks(nextBookmarks);
        setBookmarkInventory(nextBookmarkInventory);
        setHasLoadedFullBookmarkInventory(hasFullInventory);
        setBookmarkCounts(nextBookmarkCounts);
        setHomeFavoriteBookmarks(nextHomeFavoriteBookmarks);
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
        setTags(nextTags);
      });

      queueBookmarkAssetPreload(
        activeDashboardView === "home"
          ? (nextHomeFavoriteBookmarks ?? nextBookmarkInventory)
          : nextBookmarks.slice(0, bookmarkListPageSize),
        bookmarkAssetsByBookmarkId
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
        setRecommendations(emptyBookmarkRecommendations);
        setHasLoadedRecommendations(false);
        setExtensionTokens([]);
        setErrorMessage("대시보드 데이터를 불러오지 못했습니다.");
      });
    } finally {
      setIsLoadingDashboard(false);
    }
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

        await refreshDashboardData();
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
    const folderChildrenByParentId = getFoldersByParentId(folders);
    const folderIdsWithChildren = Array.from(folderChildrenByParentId.entries())
      .filter(([folderId, childFolders]) => Boolean(folderId) && childFolders.length > 0)
      .map(([folderId]) => folderId as string);

    setExpandedFolderManagerIds((currentIds) => {
      const validFolderIds = new Set(folders.map((folder) => folder.id));
      const nextIdSet = new Set(currentIds.filter((folderId) => validFolderIds.has(folderId)));

      if (nextIdSet.size === 0) {
        for (const folderId of folderIdsWithChildren) {
          nextIdSet.add(folderId);
        }
      }

      if (folderDraft.parentFolderId) {
        nextIdSet.add(folderDraft.parentFolderId);
        for (const ancestorId of getFolderAncestorIds(folders, folderDraft.parentFolderId)) {
          nextIdSet.add(ancestorId);
        }
      }

      if (editingFolderId) {
        nextIdSet.add(editingFolderId);
        for (const ancestorId of getFolderAncestorIds(folders, editingFolderId)) {
          nextIdSet.add(ancestorId);
        }
      }

      const normalizedNextIds = Array.from(nextIdSet);
      return normalizedNextIds.length === currentIds.length &&
        normalizedNextIds.every((folderId) => currentIds.includes(folderId))
        ? currentIds
        : normalizedNextIds;
    });
  }, [folders, folderDraft.parentFolderId, editingFolderId]);

  async function handleGoogleLogin() {
    try {
      setErrorMessage(null);
      const idToken = await signInWithGoogle();
      const user = await exchangeIdTokenForSession(idToken);
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
        loadTags().catch(() => [])
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
        setTags(nextTags);
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
    });
  }

  async function handlePwaInstall() {
    if (!deferredInstallPrompt || typeof deferredInstallPrompt.prompt !== "function") {
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

  function openFolderManager() {
    const nextDraft = emptyFolderDraft;
    setErrorMessage(null);
    setIsMobileHeaderMenuOpen(false);
    setMobileSidebarPanel("folder");
    setEditingFolderId(null);
    setFolderDraft(nextDraft);
    setInitialFolderDraft(nextDraft);
    setDraggingFolderId(null);
    setOpenFolderActionMenuId(null);
    setIsFolderManagerOpen(true);
  }

  function beginFolderEdit(folder: Folder) {
    const nextDraft = {
      name: folder.name,
      color: folder.color ?? "",
      icon: folder.icon ?? "",
      isHidden: folder.isHidden === true,
      parentFolderId: folder.parentFolderId ?? ""
    };
    setIsMobileHeaderMenuOpen(false);
    setMobileSidebarPanel("folder");
    setIsFolderManagerOpen(true);
    setOpenFolderActionMenuId(null);
    setExpandedFolderManagerIds((currentIds) =>
      Array.from(
        new Set([...currentIds, folder.id, ...getFolderAncestorIds(folders, folder.id)])
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

  function beginChildFolderCreate(parentFolder: Folder) {
    const nextDraft = {
      ...emptyFolderDraft,
      isHidden: parentFolder.isHidden === true,
      parentFolderId: parentFolder.id
    };
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

  function resetDraggingFolder() {
    setDraggingFolderId(null);
    setFolderOverviewDropTarget(null);
  }

  function getFolderOverviewDropMode(targetFolder: Folder): FolderOverviewDropMode | null {
    if (!draggingFolderId || draggingFolderId === targetFolder.id) {
      return null;
    }

    const draggedFolder = folders.find((folder) => folder.id === draggingFolderId);
    if (!draggedFolder) {
      return null;
    }

    if (draggedFolder.parentFolderId === targetFolder.parentFolderId) {
      return "reorder";
    }

    const descendantFolderIds = getFolderDescendantIds(folders, draggingFolderId);
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

  async function handleFolderReorderDrop(targetFolder: Folder) {
    if (!draggingFolderId || draggingFolderId === targetFolder.id) {
      resetDraggingFolder();
      return;
    }

    const draggedFolder = folders.find((folder) => folder.id === draggingFolderId);
    if (!draggedFolder || draggedFolder.parentFolderId !== targetFolder.parentFolderId) {
      resetDraggingFolder();
      return;
    }

    const siblingFolders = getSiblingFolders(folders, targetFolder.parentFolderId);
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
      const nextFolders = await reorderFolders({
        parentFolderId: targetFolder.parentFolderId,
        folderIds: reorderedSiblingFolders.map((folder) => folder.id)
      });

      startTransition(() => {
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

  async function handleFolderMoveDrop(targetFolder: Folder) {
    if (!draggingFolderId || draggingFolderId === targetFolder.id) {
      resetDraggingFolder();
      return;
    }

    const draggedFolder = folders.find((folder) => folder.id === draggingFolderId);
    if (!draggedFolder) {
      resetDraggingFolder();
      return;
    }

    const descendantFolderIds = getFolderDescendantIds(folders, draggingFolderId);
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
      const nextFolders = await moveFolder(draggingFolderId, {
        parentFolderId: targetFolder.id
      });

      startTransition(() => {
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

  async function handleFolderMoveToRootDrop() {
    if (!draggingFolderId) {
      resetDraggingFolder();
      return;
    }

    const draggedFolder = folders.find((folder) => folder.id === draggingFolderId);
    if (!draggedFolder || draggedFolder.parentFolderId === null) {
      resetDraggingFolder();
      return;
    }

    try {
      setErrorMessage(null);
      setIsReorderingFolders(true);
      const nextFolders = await moveFolder(draggingFolderId, {
        parentFolderId: null
      });

      startTransition(() => {
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

  function openTagManager() {
    const nextDraft = emptyTagDraft;
    setErrorMessage(null);
    setIsMobileHeaderMenuOpen(false);
    setEditingTagId(null);
    setOpenTagActionMenuId(null);
    setTagDraft(nextDraft);
    setInitialTagDraft(nextDraft);
    setIsTagManagerOpen(true);
  }

  function beginTagEdit(tag: Tag) {
    const nextDraft = {
      name: tag.name,
      color: tag.color ?? ""
    };
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

  async function handleBookmarkSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await applyBookmarkSearch(bookmarkSearchDraft);
  }

  async function applyBookmarkSearch(nextSearchDraft: BookmarkSearchDraft) {
    try {
      setErrorMessage(null);
      setActiveDashboardView("bookmarks");
      requestDesktopRecommendationsIfNeeded();
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
      const exportBookmarkAssetsByBookmarkId = await loadBookmarkAssetsByBookmark(exportBookmarks);
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        bookmarks: exportBookmarks,
        folders: exportFolders,
        tags: exportTags,
        bookmarkAssetsByBookmarkId: exportBookmarkAssetsByBookmarkId
      };
      const exportBlob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json"
      });
      const exportUrl = globalThis.URL.createObjectURL(exportBlob);
      const link = globalThis.document.createElement("a");
      link.href = exportUrl;
      link.download = `bookmark-backup-${new Date().toISOString().slice(0, 10)}.json`;
      globalThis.document.body.append(link);
      link.click();
      link.remove();
      globalThis.URL.revokeObjectURL(exportUrl);
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "북마크 내보내기를 완료하지 못했습니다."
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

  async function loadSelectedBookmarkPreview(bookmarkId: string) {
    const requestId = bookmarkPreviewRequestIdRef.current + 1;
    bookmarkPreviewRequestIdRef.current = requestId;

    setIsLoadingSelectedBookmarkPreview(true);
    setSelectedBookmarkLivePreview(null);
    setSelectedBookmarkPreviewError(null);
    setSelectedBookmarkPreviewNotice(null);

    try {
      const preview = await loadBookmarkPreview(bookmarkId);
      if (bookmarkPreviewRequestIdRef.current !== requestId) {
        return;
      }

      let resolvedPreview = preview;
      let previewNotice: string | null = null;

      if (isJsRequiredBookmarkPreview(preview)) {
        setBookmarkExtensionPresence("checking");
        const renderedPreview = await requestRenderedBookmarkPreview(
          preview.normalizedUrl || preview.url
        );
        if (bookmarkPreviewRequestIdRef.current !== requestId) {
          return;
        }

        setBookmarkExtensionPresence(renderedPreview.presence);

        if (renderedPreview.status === "success") {
          resolvedPreview = renderedPreview.preview;
        } else {
          previewNotice = getBookmarkPreviewWorkerFallbackMessage(renderedPreview.status);
        }
      }

      startTransition(() => {
        setSelectedBookmarkLivePreview(resolvedPreview);
        setSelectedBookmarkPreviewNotice(previewNotice);
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
    const requestId = bookmarkDetailRequestIdRef.current + 1;
    bookmarkDetailRequestIdRef.current = requestId;
    const knownBookmark = findKnownBookmark(bookmarkId, bookmarkOverride);
    const shouldIncludeTrashedBookmark =
      knownBookmark?.isTrashed === true || folderOverviewSpecialFilter === "trash";
    const cachedAssets = bookmarkAssetsByBookmarkId[bookmarkId];

    try {
      setErrorMessage(null);
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

  function handlePendingAssetPaste(event: ReactClipboardEvent<HTMLElement>) {
    const files = extractImageFilesFromDataTransfer(event.clipboardData);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    appendPendingAssetFiles(files);
  }

  function handlePendingAssetDrop(event: ReactDragEvent<HTMLElement>) {
    event.preventDefault();
    appendPendingAssetFiles(extractImageFilesFromDataTransfer(event.dataTransfer));
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

  async function handleFolderDelete(folder: Folder) {
    if (
      globalThis.confirm &&
      !globalThis.confirm(`'${folder.name}' 폴더를 삭제할까요?`)
    ) {
      return;
    }

    try {
      setErrorMessage(null);
      setOpenFolderActionMenuId(null);
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

  async function handleTagDelete(tag: Tag) {
    if (globalThis.confirm && !globalThis.confirm(`'${tag.name}' 태그를 삭제할까요?`)) {
      return;
    }

    try {
      setErrorMessage(null);
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

  async function handleResetSourceContent(bookmarkId: string) {
    try {
      setErrorMessage(null);
      setIsBookmarkDetailActionMenuOpen(false);
      const nextBookmark = await updateBookmark(bookmarkId, {
        sourceTitle: null,
        sourceContent: null,
        sourceSummary: null
      });

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

  const shouldShowAdvancedBookmarkSearch = isAdvancedBookmarkSearchOpen;
  const shouldUseCompactMobileCards = isMobileSearchViewport;
  const shouldUseMobileSidebarPanels = isMobileSearchViewport;
  const isHomeDashboardView = activeDashboardView === "home";
  const shouldRenderMobileFolderTab =
    shouldUseMobileSidebarPanels && mobileSidebarPanel === "folder";
  const shouldRenderMobileBookmarkTab =
    shouldUseMobileSidebarPanels && mobileSidebarPanel === "bookmark";
  const shouldRenderMobileRecommendationTab =
    shouldUseMobileSidebarPanels && mobileSidebarPanel === "recommendation";
  const shouldRenderBookmarkComposerOverlay = isBookmarkComposerOpen;
  const shouldRenderFolderManagerOverlay = isFolderManagerOpen;
  const shouldRenderTagManagerOverlay = isTagManagerOpen;
  const shouldShowMobileSearchSummary = isMobileSearchViewport && hasActiveBookmarkSearch(appliedBookmarkSearch);
  const shouldShowSearchPanelBody = !isMobileSearchViewport || isMobileSearchPanelOpen;
  const extensionFolderIds = useMemo(() => getExtensionFolderIds(folders), [folders]);
  const rawHiddenFolderIds = useMemo(() => getHiddenFolderIds(folders), [folders]);
  const hiddenFolderIds = useMemo(
    () => new Set(
      Array.from(rawHiddenFolderIds).filter((folderId) => !extensionFolderIds.has(folderId))
    ),
    [extensionFolderIds, rawHiddenFolderIds]
  );
  const activeBookmarkSearchSummaryItems = getBookmarkSearchSummaryItems(
    appliedBookmarkSearch,
    {
      getFolderName,
      getTagNames
    }
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
  const canVirtualizeBookmarkList =
    (bookmarkViewMode === "list" || bookmarkViewMode === "title") &&
    visiblePagedBookmarks.length > BOOKMARK_VIRTUALIZATION_THRESHOLD;
  const bookmarkVirtualWindowSize = shouldUseCompactMobileCards ? 28 : BOOKMARK_VIRTUAL_WINDOW_SIZE;
  const bookmarkVirtualRowHeight = bookmarkVirtualRowHeightByMode[bookmarkViewMode];
  const bookmarkVirtualWindowStartMax = Math.max(
    0,
    visiblePagedBookmarks.length - bookmarkVirtualWindowSize
  );
  const normalizedBookmarkVirtualWindowStart = canVirtualizeBookmarkList
    ? Math.min(bookmarkVirtualWindowStart, bookmarkVirtualWindowStartMax)
    : 0;
  const bookmarkVirtualWindowEnd = canVirtualizeBookmarkList
    ? Math.min(
        visiblePagedBookmarks.length,
        normalizedBookmarkVirtualWindowStart + bookmarkVirtualWindowSize
      )
    : visiblePagedBookmarks.length;
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
  const bookmarkVirtualTopSpacerHeight = canVirtualizeBookmarkList
    ? normalizedBookmarkVirtualWindowStart * bookmarkVirtualRowHeight
    : 0;
  const bookmarkVirtualBottomSpacerHeight = canVirtualizeBookmarkList
    ? Math.max(0, visiblePagedBookmarks.length - bookmarkVirtualWindowEnd) * bookmarkVirtualRowHeight
    : 0;
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
  const selectedBookmarkTagIdSet = useMemo(
    () => new Set(bookmarkDraft.tagIds),
    [bookmarkDraft.tagIds]
  );
  const normalizedBookmarkTagSearchQuery = bookmarkTagSearchQuery.trim().toLocaleLowerCase();
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
  const homeFavoriteBookmarkCount = bookmarkCounts
    ? getBookmarkCountBucketValue(bookmarkCounts.favorite, showHiddenBookmarks)
    : visibleHomeFavoriteBookmarks.length;
  const activeFolderOverviewSpecialFilter =
    folderOverviewSpecialFilter ??
    (!hasActiveBookmarkSearch(appliedBookmarkSearch) ? "all" : null);
  const isTrashBookmarkView = activeFolderOverviewSpecialFilter === "trash";
  const visibleRecommendations = useMemo(
    () =>
      filterRecommendationsByHiddenBookmarks(
        filterRecommendationsByHiddenFolders(recommendations, hiddenFolderIds, showHiddenFolders),
        showHiddenBookmarks
      ),
    [hiddenFolderIds, recommendations, showHiddenBookmarks, showHiddenFolders]
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
        const listTop = listElement.getBoundingClientRect().top;
        const scrolledPastListTop = Math.max(0, -listTop);
        const nextWindowStart = Math.max(
          0,
          Math.min(
            bookmarkVirtualWindowStartMax,
            Math.floor(scrolledPastListTop / bookmarkVirtualRowHeight) - BOOKMARK_VIRTUAL_OVERSCAN
          )
        );

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
        ? new Set([editingFolderId, ...getFolderDescendantIds(folders, editingFolderId)])
        : new Set<string>(),
    [editingFolderId, folders]
  );
  const manageableFolders = useMemo(
    () => folders.filter((folder) => !extensionFolderIds.has(folder.id)),
    [extensionFolderIds, folders]
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
  const isFolderOverviewSearchActive = Boolean(folderOverviewQuery.trim());
  const folderOverviewVisibleFolderIds = useMemo(
    () => getFolderVisibleIdsForQuery(
      visibleFolders,
      folderOverviewQuery
    ),
    [folderOverviewQuery, visibleFolders]
  );
  const folderOverviewChildrenByParentId = useMemo(
    () => getFoldersByParentId(
      visibleFolders.filter((folder) => folderOverviewVisibleFolderIds.has(folder.id))
    ),
    [folderOverviewVisibleFolderIds, visibleFolders]
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
  const selectedBookmarkLivePreviewBlocks = useMemo(
    () => getBookmarkPreviewArticleBlocks(
      selectedBookmarkLivePreview
    ),
    [selectedBookmarkLivePreview]
  );
  const selectedBookmarkLivePreviewRows = useMemo(
    () => getBookmarkPreviewFieldRows(selectedBookmarkLivePreview),
    [selectedBookmarkLivePreview]
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
    !shouldUseMobileSidebarPanels && !shouldShowDesktopReadingRail;
  const shouldLoadRecommendations =
    sessionState.status === "authenticated" &&
    ((isHomeDashboardView && isHomeRecommendationOpen) ||
      (shouldUseMobileSidebarPanels && mobileSidebarPanel === "recommendation") ||
      (!shouldUseMobileSidebarPanels &&
        !isHomeDashboardView &&
        shouldShowDesktopRecommendationBoard));
  const isRecommendationSectionLoading =
    isLoadingDashboard || (shouldLoadRecommendations && isLoadingRecommendations);
  const isBookmarkDetailPreviewFullscreenActive =
    Boolean(visibleSelectedBookmark) &&
    bookmarkDetailActiveTab === "preview" &&
    isBookmarkPreviewFullscreen;

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
          livePreviewRows={selectedBookmarkLivePreviewRows}
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

  function renderVisibleSelectedBookmarkDetail(closeLabel: string) {
    if (!visibleSelectedBookmark) {
      return null;
    }

    const isPreviewFullscreenActive = isBookmarkDetailPreviewFullscreenActive;
    const previewFullscreenLabel = isPreviewFullscreenActive
      ? "미리보기 전체화면 종료"
      : "미리보기 전체화면";
    const renderBookmarkPreviewFullscreenButton = (extraClassName = "") => (
      <button
        type="button"
        className={`ghost-button bookmark-detail-window-button bookmark-preview-fullscreen-button${extraClassName}`}
        aria-label={previewFullscreenLabel}
        aria-pressed={isPreviewFullscreenActive}
        title={previewFullscreenLabel}
        onClick={() => toggleBookmarkPreviewFullscreen()}
      >
        <span aria-hidden="true">{isPreviewFullscreenActive ? "↙" : "↗"}</span>
        <span className="bookmark-detail-window-button-label">
          {isPreviewFullscreenActive ? "전체화면 종료" : "전체화면"}
        </span>
      </button>
    );

    return (
      <section
        aria-label="bookmark-detail"
        className={`surface-card panel-card bookmark-detail-card${
          isPreviewFullscreenActive ? " bookmark-detail-card-preview-fullscreen" : ""
        }`}
        aria-busy={
          isLoadingSelectedBookmark ||
          isLoadingSelectedBookmarkAssets ||
          isLoadingSelectedBookmarkPreview
        }
        style={
          visibleSelectedBookmark.bookmarkColor
            ? {
                borderLeftColor: visibleSelectedBookmark.bookmarkColor,
                borderLeftWidth: "3px"
              }
            : undefined
        }
      >
        {isPreviewFullscreenActive ? (
          <div className="bookmark-preview-fullscreen-controls">
            {renderBookmarkPreviewFullscreenButton(" bookmark-preview-fullscreen-floating-button")}
          </div>
        ) : null}
        {!isPreviewFullscreenActive ? (
          <>
        <header className="bookmark-detail-header">
          <div className="bookmark-detail-top-row">
            <p className="bookmark-detail-kicker">읽기 중심</p>
            <div className="bookmark-detail-window-actions">
              {bookmarkDetailActiveTab === "preview"
                ? renderBookmarkPreviewFullscreenButton()
                : null}
              <button
                type="button"
                className="ghost-button bookmark-detail-close-button"
                aria-label="상세 창 닫기"
                onClick={() => closeBookmarkDetail()}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </div>
          {selectedBookmarkStatusMessage ? (
            <p className="bookmark-detail-loading-status" aria-live="polite">
              {selectedBookmarkStatusMessage}
            </p>
          ) : null}
          <div className="bookmark-detail-title-row">
            <div className="bookmark-detail-title-copy">
              <h2>북마크 상세</h2>
              <div className="bookmark-detail-title-line">
                <strong>{visibleSelectedBookmark.displayTitle || visibleSelectedBookmark.url}</strong>
                {renderHiddenBookmarkIndicator(visibleSelectedBookmark.isHidden === true)}
              </div>
            </div>
            <p
              className="muted-text bookmark-detail-url"
              title={visibleSelectedBookmark.url}
              style={
                visibleSelectedBookmark.urlColor
                  ? { color: visibleSelectedBookmark.urlColor }
                  : undefined
              }
            >
              {visibleSelectedBookmark.url}
            </p>
          </div>
        </header>
        <div className="bookmark-detail-meta">
          <div className="bookmark-detail-meta-line bookmark-detail-meta-primary">
            <span className="bookmark-detail-meta-item">
              {getFolderName(visibleSelectedBookmark.folderId)}
            </span>
            <span className="bookmark-detail-meta-item">
              {getBookmarkSummaryStateLabel(visibleSelectedBookmark)}
            </span>
            {visibleSelectedBookmark.isTrashed ? (
              <span className="bookmark-detail-meta-item">휴지통</span>
            ) : null}
          </div>
          {selectedBookmarkVisibleTagItems.length > 0 ||
          selectedBookmarkRemainingTagCount > 0 ||
          selectedBookmarkAssetCount > 0 ? (
            <div className="bookmark-detail-meta-line">
              {selectedBookmarkVisibleTagItems.map((tag) => (
                <span
                  key={`${visibleSelectedBookmark.id}-${tag.id}`}
                  className="bookmark-detail-meta-item"
                >
                  {tag.name}
                </span>
              ))}
              {selectedBookmarkRemainingTagCount > 0 ? (
                <span className="bookmark-detail-meta-item">
                  +{selectedBookmarkRemainingTagCount}
                </span>
              ) : null}
              {selectedBookmarkAssetCount > 0 ? (
                <span className="bookmark-detail-meta-item">
                  이미지 {selectedBookmarkAssetCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div
          role="tablist"
          aria-label="bookmark-detail-tabs"
          className="bookmark-detail-tabs"
        >
          <button
            type="button"
            role="tab"
            id="bookmark-detail-tab-detail"
            aria-selected={bookmarkDetailActiveTab === "detail"}
            aria-controls="bookmark-detail-panel-detail"
            className={`bookmark-detail-tab${
              bookmarkDetailActiveTab === "detail" ? " bookmark-detail-tab-active" : ""
            }`}
            onClick={() => selectBookmarkDetailTab("detail", visibleSelectedBookmark.id)}
          >
            상세
          </button>
          <button
            type="button"
            role="tab"
            id="bookmark-detail-tab-preview"
            aria-selected={bookmarkDetailActiveTab === "preview"}
            aria-controls="bookmark-detail-panel-preview"
            className={`bookmark-detail-tab${
              bookmarkDetailActiveTab === "preview" ? " bookmark-detail-tab-active" : ""
            }`}
            onClick={() => selectBookmarkDetailTab("preview", visibleSelectedBookmark.id)}
          >
            미리보기
          </button>
          <button
            type="button"
            role="tab"
            id="bookmark-detail-tab-extract"
            aria-selected={bookmarkDetailActiveTab === "extract"}
            aria-controls="bookmark-detail-panel-extract"
            className={`bookmark-detail-tab${
              bookmarkDetailActiveTab === "extract" ? " bookmark-detail-tab-active" : ""
            }`}
            onClick={() => selectBookmarkDetailTab("extract", visibleSelectedBookmark.id)}
          >
            추출 정보
          </button>
        </div>
          </>
        ) : null}

        {bookmarkDetailActiveTab === "detail" ? (
          <div
            role="tabpanel"
            id="bookmark-detail-panel-detail"
            aria-labelledby="bookmark-detail-tab-detail"
            className="bookmark-detail-tab-panel"
          >
            <section className="detail-block">
              <h3>직접 정리</h3>
              {selectedBookmarkUserDetailRows.map((row) => (
                <div key={row.label} className="detail-row">
                  <p className="detail-row-label">{row.label}</p>
                  <p className="detail-row-value">{row.value}</p>
                </div>
              ))}
              {selectedBookmarkUserDetailRows.length === 0 ? (
                <p className="quiet-empty-state">사용자 입력값이 없습니다.</p>
              ) : null}
            </section>

            {selectedBookmarkAssetCount > 0 ? (
              <div className="asset-grid">
                {bookmarkAssetsByBookmarkId[visibleSelectedBookmark.id].map((asset, index) => (
                  <img
                    key={asset.id}
                    src={asset.contentUrl}
                    alt={`업로드 이미지 ${index + 1}`}
                  />
                ))}
              </div>
            ) : isLoadingSelectedBookmarkAssets ? (
              <p className="quiet-empty-state" aria-live="polite">
                이미지를 불러오는 중...
              </p>
            ) : (
              <p className="quiet-empty-state">이미지가 없습니다.</p>
            )}
          </div>
        ) : bookmarkDetailActiveTab === "preview" ? (
          <div
            role="tabpanel"
            id="bookmark-detail-panel-preview"
            aria-labelledby="bookmark-detail-tab-preview"
            className="bookmark-detail-tab-panel bookmark-detail-preview-panel"
          >
            {isLoadingSelectedBookmarkPreview ? (
              <p className="quiet-empty-state" aria-live="polite">
                최신 미리보기를 불러오는 중...
              </p>
            ) : null}
            {selectedBookmarkPreviewError ? (
              <p className="bookmark-preview-error" aria-live="polite">
                {selectedBookmarkPreviewError}
              </p>
            ) : null}
            {selectedBookmarkPreviewNotice ? (
              <p className="bookmark-preview-note" aria-live="polite">
                {selectedBookmarkPreviewNotice}
              </p>
            ) : null}
            <section className="detail-block">
              <h3>최신 미리보기</h3>
              {hasBookmarkPreviewCoverImage(selectedBookmarkLivePreview) &&
              selectedBookmarkLivePreview?.sourceImageUrl ? (
                <img
                  className="bookmark-preview-image"
                  src={selectedBookmarkLivePreview.sourceImageUrl}
                  alt={getBookmarkPreviewImageAlt(selectedBookmarkLivePreview)}
                />
              ) : null}
              {selectedBookmarkLivePreview
                ? renderBookmarkPreviewArticle(selectedBookmarkLivePreview)
                : null}
              {selectedBookmarkLivePreviewRows.map((row) => (
                <div key={row.label} className="detail-row">
                  <p className="detail-row-label">{row.label}</p>
                  <p className="detail-row-value">{row.value}</p>
                </div>
              ))}
              {selectedBookmarkLivePreviewRows.length === 0 &&
              selectedBookmarkLivePreviewBlocks.length === 0 &&
              selectedBookmarkLivePreview &&
              !isLoadingSelectedBookmarkPreview ? (
                <p className="quiet-empty-state">최신 미리보기 결과가 없습니다.</p>
              ) : null}
              {!selectedBookmarkLivePreview &&
              !isLoadingSelectedBookmarkPreview &&
              !selectedBookmarkPreviewError ? (
                <p className="quiet-empty-state">
                  미리보기 탭을 열면 최신 웹페이지를 불러옵니다.
                </p>
              ) : null}
            </section>
          </div>
        ) : (
          <div
            role="tabpanel"
            id="bookmark-detail-panel-extract"
            aria-labelledby="bookmark-detail-tab-extract"
            className="bookmark-detail-tab-panel"
          >
            <section className="detail-block bookmark-detail-extract-block">
              <h3>저장된 자동 추출</h3>
              {selectedBookmarkSourceDetailRows.map((row) => (
                <div key={row.label} className="detail-row">
                  <p className="detail-row-label">{row.label}</p>
                  <p className="detail-row-value">{row.value}</p>
                </div>
              ))}
              {selectedBookmarkSourceDetailRows.length === 0 ? (
                <p className="quiet-empty-state">자동 추출값이 없습니다.</p>
              ) : null}
            </section>
          </div>
        )}

        {!isPreviewFullscreenActive ? (
          <div className="bookmark-detail-actions">
          <button
            type="button"
            className="primary-button"
            aria-label={
              visibleSelectedBookmark.isTrashed
                ? `${visibleSelectedBookmark.displayTitle || visibleSelectedBookmark.url} 복구`
                : `${visibleSelectedBookmark.displayTitle || visibleSelectedBookmark.url} 열기`
            }
            onClick={() =>
              visibleSelectedBookmark.isTrashed
                ? void handleBookmarkRestore(visibleSelectedBookmark)
                : void handleBookmarkOpen(visibleSelectedBookmark)
            }
          >
            {visibleSelectedBookmark.isTrashed ? "복구" : "열기"}
          </button>
          <div className="bookmark-detail-secondary-actions">
            <button
              type="button"
              className="ghost-button"
              aria-label="상세 닫기"
              onClick={() => closeBookmarkDetail()}
            >
              {closeLabel}
            </button>
            <div
              className="folder-action-menu-shell bookmark-detail-menu-shell"
              data-open-menu-shell={isBookmarkDetailActionMenuOpen ? "true" : undefined}
            >
              <button
                type="button"
                className="ghost-button folder-action-trigger overflow-trigger"
                aria-label="상세 작업 더보기"
                aria-expanded={isBookmarkDetailActionMenuOpen}
                onClick={() => toggleBookmarkDetailActionMenu()}
              >
                ...
              </button>
              {isBookmarkDetailActionMenuOpen ? (
                <div
                  role="menu"
                  aria-label="상세 작업 메뉴"
                  className="folder-action-menu bookmark-detail-action-menu"
                >
                  {visibleSelectedBookmark.isTrashed ? (
                    <>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void handleBookmarkRestore(visibleSelectedBookmark)}
                      >
                        복구
                      </button>
                      <button
                        type="button"
                        className="danger-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void handleBookmarkPermanentDelete(visibleSelectedBookmark)}
                      >
                        영구 삭제
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void beginBookmarkEdit(visibleSelectedBookmark)}
                      >
                        수정 시작
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void handleBookmarkReextract(visibleSelectedBookmark.id)}
                      >
                        자동 추출 다시 시도
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void handleResetSourceContent(visibleSelectedBookmark.id)}
                      >
                        자동 추출 초기화
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void handleResetUserContent(visibleSelectedBookmark.id)}
                      >
                        사용자 입력 초기화
                      </button>
                      <button
                        type="button"
                        className="danger-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void handleBookmarkDelete(visibleSelectedBookmark)}
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          </div>
        ) : null}
      </section>
    );
  }

  function renderFolderLabel(
    label: string,
    color: string | null | undefined,
    icon: string | null | undefined,
    className: string,
    isHidden = false
  ) {
    const folderIconGlyph = getFolderIconGlyph(icon);

    return (
      <span className={className}>
        {folderIconGlyph ? (
          <span
            aria-hidden="true"
            className="folder-icon-badge"
            style={
              color
                ? {
                    color,
                    backgroundColor: `${color}1a`
                  }
                : undefined
            }
          >
            {folderIconGlyph}
          </span>
        ) : color ? (
          renderColorSwatch(color)
        ) : null}
        <span className="folder-label-text">{label}</span>
        {isHidden ? (
          <span className="folder-hidden-indicator" aria-hidden="true">
            🔒
          </span>
        ) : null}
      </span>
    );
  }

  function renderHiddenBookmarkIndicator(isHidden: boolean) {
    if (!isHidden) {
      return null;
    }

    return (
      <span className="folder-hidden-indicator bookmark-hidden-indicator" aria-hidden="true">
        🔒
      </span>
    );
  }

  function renderTagLabel(label: string, color: string | null | undefined, className: string) {
    return (
      <span className={className}>
        {color ? renderColorSwatch(color) : null}
        <span>{label}</span>
      </span>
    );
  }

  function renderMobileVisibilityIconButton(options: {
    ariaLabel: string;
    isActive: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        className={`ghost-button mobile-visibility-icon-button${
          options.isActive ? " mobile-visibility-icon-button-active" : ""
        }`}
        aria-label={options.ariaLabel}
        aria-pressed={options.isActive}
        title={options.ariaLabel}
        onClick={options.onClick}
      >
        <span aria-hidden="true" className="mobile-visibility-icon-glyph">
          {options.isActive ? "🔓" : "🔒"}
        </span>
      </button>
    );
  }

  function renderBookmarkSortControl() {
    const activeSortLabel = getBookmarkSortLabel(appliedBookmarkSearch.sort);
    const activeSortShortLabel = getBookmarkSortShortLabel(appliedBookmarkSearch.sort);
    const triggerLabel = shouldUseCompactMobileCards ? activeSortShortLabel : activeSortLabel;

    return (
      <div
        className="bookmark-sort-menu-shell"
        data-open-menu-shell={isBookmarkSortMenuOpen ? "true" : undefined}
      >
        <button
          type="button"
          className="secondary-button bookmark-sort-trigger"
          aria-label="북마크 정렬"
          aria-expanded={isBookmarkSortMenuOpen}
          onClick={() => {
            setIsBookmarkViewMenuOpen(false);
            setIsBookmarkSortMenuOpen((currentState) => !currentState);
          }}
        >
          <span className="bookmark-sort-trigger-label">정렬</span>
          <span className="bookmark-sort-trigger-value">{triggerLabel}</span>
        </button>
        {isBookmarkSortMenuOpen ? (
          <div
            role="menu"
            aria-label="북마크 정렬 메뉴"
            className="folder-action-menu bookmark-sort-menu"
          >
            <p className="bookmark-sort-menu-title">정렬 기준</p>
            {bookmarkSortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={appliedBookmarkSearch.sort === option.value}
                className={`secondary-button folder-action-menu-item bookmark-sort-menu-item${
                  appliedBookmarkSearch.sort === option.value
                    ? " bookmark-sort-menu-item-active"
                    : ""
                }`}
                onClick={() => void applyBookmarkSort(option.value)}
              >
                <span aria-hidden="true" className="bookmark-sort-menu-mark">
                  {appliedBookmarkSearch.sort === option.value ? "●" : "○"}
                </span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function getActiveBookmarkDisplaySettings() {
    return bookmarkViewMode === "list"
      ? bookmarkListDisplaySettings
      : bookmarkCardDisplaySettings;
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

  function renderBookmarkViewControl() {
    const activeViewLabel = getBookmarkViewModeLabel(bookmarkViewMode);
    const shouldShowDisplayControls = bookmarkViewMode !== "title";
    const shouldShowCoverSizeControl =
      bookmarkViewMode === "card" || bookmarkViewMode === "moodboard";
    const activeBookmarkDisplaySettings = getActiveBookmarkDisplaySettings();

    return (
      <div
        className="bookmark-view-menu-shell"
        data-open-menu-shell={isBookmarkViewMenuOpen ? "true" : undefined}
      >
        <button
          type="button"
          className="secondary-button bookmark-view-trigger"
          aria-label="보기 설정"
          aria-expanded={isBookmarkViewMenuOpen}
          onClick={() => {
            setIsBookmarkSortMenuOpen(false);
            setIsBookmarkViewMenuOpen((currentState) => !currentState);
          }}
        >
          <span aria-hidden="true" className="bookmark-view-trigger-icon">
            ▦
          </span>
          <span className="bookmark-view-trigger-value">{activeViewLabel}</span>
        </button>
        {isBookmarkViewMenuOpen ? (
          <div
            role="menu"
            aria-label="보기 설정 메뉴"
            className="folder-action-menu bookmark-view-menu"
          >
            <section className="bookmark-view-menu-section">
              <p className="bookmark-view-menu-title">보기</p>
              {bookmarkViewModeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={bookmarkViewMode === option.value}
                  className={`secondary-button folder-action-menu-item bookmark-view-menu-item${
                    bookmarkViewMode === option.value ? " bookmark-view-menu-item-active" : ""
                  }`}
                  onClick={() => setBookmarkViewMode(option.value)}
                >
                  <span aria-hidden="true" className="bookmark-view-menu-mark">
                    {bookmarkViewMode === option.value ? "●" : "○"}
                  </span>
                  <span aria-hidden="true" className="bookmark-view-menu-icon">
                    {option.icon}
                  </span>
                  <span>{option.label}</span>
                </button>
              ))}
            </section>
            {shouldShowDisplayControls ? (
            <section className="bookmark-view-menu-section">
              <p className="bookmark-view-menu-title">항목에서 표시</p>
              {[
                ["coverImage", "커버 이미지"],
                ["title", "제목"],
                ["description", "설명"],
                ["tags", "태그"],
                ["bookmarkInfo", "북마크 정보"]
              ].map(([key, label]) => {
                const settingKey = key as keyof Omit<BookmarkCardDisplaySettings, "coverSize">;
                const isChecked = activeBookmarkDisplaySettings[settingKey];

                return (
                  <button
                    key={key}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isChecked}
                    className={`secondary-button folder-action-menu-item bookmark-view-menu-item${
                      isChecked ? " bookmark-view-menu-item-active" : ""
                    }`}
                    onClick={() => updateBookmarkDisplaySetting(settingKey, !isChecked)}
                  >
                    <span aria-hidden="true" className="bookmark-view-menu-check">
                      {isChecked ? "✓" : ""}
                    </span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </section>
            ) : null}
            {shouldShowCoverSizeControl ? (
            <section className="bookmark-view-menu-section bookmark-cover-size-section">
              <label className="bookmark-cover-size-label" htmlFor="bookmark-cover-size-input">
                커버 이미지
              </label>
              <input
                id="bookmark-cover-size-input"
                aria-label="커버 이미지 크기"
                className="bookmark-cover-size-slider"
                type="range"
                min="80"
                max="220"
                step="10"
                value={bookmarkCardDisplaySettings.coverSize}
                onChange={(event) => {
                  const nextCoverSize = clampBookmarkCoverSize(Number(event.target.value));
                  setBookmarkCardDisplaySettings((currentSettings) => ({
                    ...currentSettings,
                    coverSize: nextCoverSize
                  }));
                }}
              />
            </section>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function renderPendingAssetComposerSection(existingBookmarkId: string | null = null) {
    const existingAssets = existingBookmarkId ? bookmarkAssetsByBookmarkId[existingBookmarkId] ?? [] : [];

    return (
      <>
        <div
          role="button"
          tabIndex={0}
          aria-label="이미지 붙여넣기 또는 끌어놓기"
          className="dropzone-button bookmark-asset-dropzone"
          onPaste={handlePendingAssetPaste}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handlePendingAssetDrop}
        >
          <strong>이미지 붙여넣기 또는 끌어놓기</strong>
          <span>Ctrl+V, 드래그앤드롭, 파일 선택을 함께 지원합니다.</span>
        </div>
        <label>
          이미지 업로드
          <input
            name="bookmarkAssetFile"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              appendPendingAssetFiles(Array.from(event.target.files ?? []));
              event.currentTarget.value = "";
            }}
          />
        </label>
        {pendingAssetFiles.length > 0 ? (
          <ul className="inline-file-list">
            {pendingAssetFiles.map((file) => (
              <li key={`${file.name}-${file.size}`}>
                <div className="inline-file-copy">
                  <span>{file.name}</span>
                  <small>{Math.max(1, Math.round(file.size / 1024))}KB</small>
                </div>
                <button
                  type="button"
                  className="ghost-button inline-file-remove-button"
                  aria-label={`${file.name} 제거`}
                  onClick={() => removePendingAssetFile(file.name, file.size)}
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {existingAssets.length > 0 ? (
          <div className="asset-grid">
            {existingAssets.map((asset, index) => (
              <div key={asset.id} className="asset-item">
                <img src={asset.contentUrl} alt={`업로드 이미지 ${index + 1}`} />
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleBookmarkAssetDelete(existingBookmarkId as string, asset.id)}
                >
                  이미지 삭제 {index + 1}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </>
    );
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
  const folderPanelSummary = editingFolderId
    ? `수정 중 · 폴더 ${folders.length}개`
    : `폴더 ${folders.length}개`;
  const tagPanelSummary = editingTagId
    ? `수정 중 · 태그 ${tags.length}개`
    : `태그 ${tags.length}개`;
  const bookmarkPanelKicker = "작성";
  const bookmarkBrowsePanelKicker = "보관";
  const recommendationPanelKicker = "추천";
  const folderPanelKicker = "구조";
  const tagPanelKicker = "분류";
  const quickFolderCreateSection = (
    <div className="inline-folder-create">
      <button
        type="button"
        className="secondary-button"
        onClick={() =>
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
      >
        {isQuickFolderOpen ? "새 폴더 바로 추가 닫기" : "새 폴더 바로 추가"}
      </button>
      {isQuickFolderOpen ? (
        <section aria-label="quick-folder-create" className="inline-folder-create-panel">
          <label>
            폴더 이름
            <input
              name="quickFolderName"
              value={quickFolderDraft.name}
              onChange={(event) => updateQuickFolderDraft({ name: event.target.value })}
            />
          </label>
          {renderFolderColorPicker(quickFolderDraft.color, (value) =>
            updateQuickFolderDraft({ color: value })
          )}
          {renderFolderIconPicker(quickFolderDraft.icon, (value) =>
            updateQuickFolderDraft({ icon: value })
          )}
          <label>
            부모 폴더
            <select
              name="quickFolderParentFolderId"
              value={quickFolderDraft.parentFolderId}
              disabled={quickFolderParentOptions.length === 0}
              onChange={(event) =>
                updateQuickFolderDraft({ parentFolderId: event.target.value })
              }
            >
              <option value="">상위 없음</option>
              {quickFolderParentOptions.map(({ folder, label }) => (
                <option key={folder.id} value={folder.id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {quickFolderParentOptions.length === 0 ? (
            <p className="field-note">폴더가 없어 최상위 폴더로 생성됩니다.</p>
          ) : null}
          <div className="action-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleQuickFolderCreate()}
              disabled={isSavingQuickFolder}
            >
              {isSavingQuickFolder ? "저장 중..." : "빠른 폴더 저장"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
  const quickTagCreateSection = (
    <div className="inline-folder-create">
      <button
        type="button"
        className="secondary-button"
        onClick={() => setIsQuickTagOpen((currentValue) => !currentValue)}
      >
        {isQuickTagOpen ? "새 태그 바로 추가 닫기" : "새 태그 바로 추가"}
      </button>
      {isQuickTagOpen ? (
        <section aria-label="quick-tag-create" className="inline-folder-create-panel">
          <label>
            태그 이름
            <input
              name="quickTagName"
              value={quickTagDraft.name}
              onChange={(event) => updateQuickTagDraft({ name: event.target.value })}
            />
          </label>
          {renderColorPicker("태그 색상", quickTagDraft.color, (value) =>
            updateQuickTagDraft({ color: value })
          )}
          <div className="action-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleQuickTagCreate()}
              disabled={isSavingTag}
            >
              {isSavingTag ? "저장 중..." : "빠른 태그 저장"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );

  function renderWorkspacePanelHeader(options: {
    heading: string;
    summary: string;
    kicker: string;
  }) {
    return (
      <header className="workspace-panel-header">
        <p className="workspace-panel-kicker">{options.kicker}</p>
        <div className="workspace-panel-heading-row">
          <h2>{options.heading}</h2>
          <span className="workspace-panel-summary">{options.summary}</span>
        </div>
      </header>
    );
  }

  function renderSidebarPanel(options: {
    panelId: SidebarPanelId;
    heading: string;
    summary: string;
    kicker: string;
    regionLabel: string;
    className?: string;
    children: ReactNode;
  }) {
    const panelClassName = [
      "surface-card panel-card",
      options.panelId === "tag" ? "tag-manager-panel-readable" : "",
      options.className ?? ""
    ]
      .filter(Boolean)
      .join(" ");
    const panelContent = (
      <>
        {!shouldUseMobileSidebarPanels ? renderWorkspacePanelHeader(options) : null}
        {options.children}
      </>
    );

    return (
      <section
        key={options.panelId}
        aria-label={options.regionLabel}
        className={panelClassName}
      >
        {panelContent}
      </section>
    );
  }

  function renderDesktopSidebarPanel(options: {
    panelId: SidebarPanelId;
    heading: string;
    summary: string;
    kicker: string;
    regionLabel: string;
    className?: string;
    children: ReactNode;
  }) {
    return renderSidebarPanel(options);
  }

  function renderMobileSidebarTabButton(options: {
    panelId: MobileSidebarPanelId;
    heading: string;
    summary: string;
    kicker: string;
  }) {
    const isSelected = mobileSidebarPanel === options.panelId;
    const panelId = `sidebar-panel-${options.panelId}`;

    return (
      <button
        key={options.panelId}
        type="button"
        role="tab"
        id={`sidebar-tab-${options.panelId}`}
        className={`sidebar-segment-tab${isSelected ? " sidebar-segment-tab-active" : ""}`}
        aria-label={options.heading}
        aria-selected={isSelected}
        aria-controls={panelId}
        onClick={() => {
          openBookmarkWorkspace();
          setMobileSidebarPanel(options.panelId);
          if (options.panelId === "recommendation") {
            requestRecommendationsIfNeeded();
          }
        }}
      >
        <span className="sidebar-segment-copy">
          <span className="sidebar-segment-kicker">{options.kicker}</span>
          <strong>{options.heading}</strong>
          <span>{options.summary}</span>
        </span>
      </button>
    );
  }

  function renderMobileSidebarPanelBody(options: {
    panelId: MobileSidebarPanelId;
    heading: string;
    summary: string;
    kicker: string;
    regionLabel: string;
    children: ReactNode;
  }) {
    if (mobileSidebarPanel !== options.panelId) {
      return null;
    }

    const regionId = `sidebar-panel-${options.panelId}`;

    return (
      <section
        key={options.panelId}
        id={regionId}
        aria-label={options.regionLabel}
        role="tabpanel"
        aria-labelledby={`sidebar-tab-${options.panelId}`}
        className="surface-card panel-card sidebar-panel-shell sidebar-panel-body-panel"
      >
        <div className="sidebar-panel-body">
          {renderWorkspacePanelHeader(options)}
          {options.children}
        </div>
      </section>
    );
  }

  function renderFolderOverviewSystemItem(options: {
    filter: FolderOverviewSpecialFilter;
    label: string;
    ariaLabel: string;
    icon: string;
    count: number;
    hint?: string;
  }) {
    const isActive =
      activeDashboardView === "bookmarks" && activeFolderOverviewSpecialFilter === options.filter;

    return (
      <li className="folder-overview-system-item">
        <button
          type="button"
          className={`folder-overview-system-trigger${
            isActive ? " folder-overview-system-trigger-active" : ""
          }`}
          aria-label={options.ariaLabel}
          aria-pressed={isActive}
          onClick={() => void handleFolderOverviewSpecialSelect(options.filter)}
        >
          <span aria-hidden="true" className="folder-overview-system-icon">
            {options.icon}
          </span>
          <span className="folder-overview-system-copy">
            <span className="folder-overview-system-label">{options.label}</span>
            {options.hint ? (
              <span className="folder-overview-system-hint">{options.hint}</span>
            ) : null}
          </span>
          <span className="folder-overview-system-count">{options.count}</span>
        </button>
      </li>
    );
  }

  function renderFolderOverviewNodes(parentFolderId: string | null, depth = 0): ReactNode {
    return (folderOverviewChildrenByParentId.get(parentFolderId) ?? []).map((folder) => {
      const childFolders = folderOverviewChildrenByParentId.get(folder.id) ?? [];
      const hasChildren = childFolders.length > 0;
      const isExpanded =
        hasChildren && (isFolderOverviewSearchActive || expandedFolderOverviewIds.includes(folder.id));
      const bookmarkCount =
        hasLoadedFullBookmarkInventory || !bookmarkCounts
          ? countBookmarksInFolderTree(
              visibleBookmarkInventory,
              visibleFolders,
              folder.id
            )
          : countBookmarksInFolderTreeFromCounts(
              bookmarkCounts,
              visibleFolders,
              folder.id,
              showHiddenBookmarks
            );
      const isActive =
        activeDashboardView === "bookmarks" && appliedBookmarkSearch.folderId === folder.id;

      return (
        <li key={folder.id} className="folder-overview-item">
          <div className="folder-overview-entry">
            <div
              className={`folder-overview-row${isActive ? " folder-overview-row-active" : ""}`}
              data-depth={depth}
              style={{ "--folder-overview-depth": Math.min(depth, 6) } as CSSProperties}
            >
              {hasChildren ? (
                <button
                  type="button"
                  className="folder-overview-disclosure"
                  aria-label={`${folder.name} 폴더 ${isExpanded ? "접기" : "펼치기"}`}
                  aria-expanded={isExpanded}
                  onClick={() => toggleFolderOverviewExpansion(folder.id)}
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              ) : (
                <span aria-hidden="true" className="folder-overview-disclosure-spacer" />
              )}
              {!shouldUseMobileSidebarPanels ? (
                <button
                  type="button"
                  className="ghost-button folder-overview-handle"
                  draggable
                  disabled={isReorderingFolders}
                  aria-label={`${folder.name} 폴더 드래그 정렬`}
                  onDragStart={(event) => {
                    if (event.dataTransfer) {
                      event.dataTransfer.effectAllowed = "move";
                    }
                    setDraggingFolderId(folder.id);
                    setFolderOverviewDropTarget(null);
                  }}
                  onDragEnd={() => resetDraggingFolder()}
                >
                  ⋮⋮
                </button>
              ) : null}
              <button
                type="button"
                className={`folder-overview-trigger${isActive ? " folder-overview-trigger-active" : ""}${
                  !shouldUseMobileSidebarPanels &&
                  folderOverviewDropTarget?.folderId === folder.id
                    ? folderOverviewDropTarget.mode === "reorder"
                      ? " folder-overview-trigger-drop-reorder"
                      : " folder-overview-trigger-drop-move"
                    : ""
                }`}
                aria-label={`${folder.name} 폴더 보기`}
                aria-pressed={isActive}
                title={folder.name}
                onClick={() => void handleFolderOverviewSelect(folder)}
                onDragOver={shouldUseMobileSidebarPanels ? undefined : (event) => {
                  const nextDropMode = getFolderOverviewDropMode(folder);
                  if (!nextDropMode) {
                    return;
                  }

                  event.preventDefault();
                  if (event.dataTransfer) {
                    event.dataTransfer.dropEffect = "move";
                  }
                  setFolderOverviewDropTarget({ folderId: folder.id, mode: nextDropMode });
                }}
                onDragLeave={shouldUseMobileSidebarPanels ? undefined : () => {
                  setFolderOverviewDropTarget((currentTarget) =>
                    currentTarget?.folderId === folder.id ? null : currentTarget
                  );
                }}
                onDrop={shouldUseMobileSidebarPanels ? undefined : (event) => {
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
                }}
              >
                <span className="folder-overview-copy">
                  {renderFolderLabel(
                    folder.name,
                    folder.color,
                    folder.icon,
                    "folder-overview-name",
                    folder.isHidden === true
                  )}
                </span>
                <span className="folder-overview-count">{bookmarkCount}</span>
              </button>
              {shouldUseMobileSidebarPanels ? (
                <div className="folder-overview-mobile-actions">
                  <button
                    type="button"
                    className="secondary-button folder-overview-mobile-edit"
                    aria-label={`${folder.name} 폴더 수정`}
                    onClick={() => beginFolderEdit(folder)}
                  >
                    편집
                  </button>
                </div>
              ) : (
                <div className="folder-overview-inline-actions folder-overview-inline-actions-visible">
                  <button
                    type="button"
                    className="secondary-button folder-overview-child-create"
                    aria-label={`${folder.name} 하위 폴더 추가`}
                    onClick={() => beginChildFolderCreate(folder)}
                  >
                    + 하위
                  </button>
                  <div
                    className="folder-action-menu-shell folder-overview-menu-shell"
                    data-open-menu-shell={
                      openFolderActionMenuId === folder.id ? "true" : undefined
                    }
                  >
                    <button
                      type="button"
                      className="ghost-button folder-action-trigger overflow-trigger"
                      aria-label={`${folder.name} 폴더 더보기`}
                      aria-expanded={openFolderActionMenuId === folder.id}
                      onClick={() => toggleFolderActionMenu(folder.id)}
                    >
                      ...
                    </button>
                    {openFolderActionMenuId === folder.id ? (
                      <div
                        role="menu"
                        aria-label={`${folder.name} 폴더 메뉴`}
                        className="folder-action-menu"
                      >
                        <button
                          type="button"
                          className="secondary-button folder-action-menu-item"
                          aria-label={`${folder.name} 하위 폴더 추가`}
                          onClick={() => beginChildFolderCreate(folder)}
                        >
                          추가
                        </button>
                        <button
                          type="button"
                          className="secondary-button folder-action-menu-item"
                          aria-label={`${folder.name} 폴더 수정`}
                          onClick={() => beginFolderEdit(folder)}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="danger-button folder-action-menu-item"
                          aria-label={`${folder.name} 폴더 삭제`}
                          onClick={() => void handleFolderDelete(folder)}
                        >
                          삭제
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
            {hasChildren && isExpanded ? (
              <ul className="folder-overview-children">
                {renderFolderOverviewNodes(folder.id, depth + 1)}
              </ul>
            ) : null}
          </div>
        </li>
      );
    });
  }

  const folderOverviewSection = (
    <section
      aria-label="folder-overview"
      className={`surface-card panel-card folder-overview-card${
        shouldUseMobileSidebarPanels && isHomeDashboardView ? " dashboard-panel-visually-hidden" : ""
      }`}
    >
      <header className="folder-overview-header">
        {!shouldUseMobileSidebarPanels ? (
          <p className="bookmark-list-kicker">구조 둘러보기</p>
        ) : null}
        <div
          className={`folder-overview-title-row${
            shouldUseMobileSidebarPanels ? " mobile-visibility-title-row" : ""
          }`}
        >
          <div className="bookmark-list-heading-copy">
            <h2>폴더</h2>
          </div>
          {shouldUseMobileSidebarPanels
            ? renderMobileVisibilityIconButton({
                ariaLabel: showHiddenFolders ? "숨김 폴더 숨기기" : "숨김 폴더 보기",
                isActive: showHiddenFolders,
                onClick: () => void handleToggleHiddenFolders()
              })
            : null}
          {!shouldUseMobileSidebarPanels ? (
            <div className="folder-overview-controls">
              <button
                type="button"
                className="ghost-button folder-overview-reset-button folder-overview-lock-button"
                aria-label={showHiddenFolders ? "숨김 폴더 숨기기" : "숨김 폴더 보기"}
                aria-pressed={showHiddenFolders}
                onClick={() => void handleToggleHiddenFolders()}
              >
                <span aria-hidden="true">{showHiddenFolders ? "🔓" : "🔒"}</span>
              </button>
              <button
                type="button"
                className="ghost-button folder-overview-reset-button"
                aria-label="폴더 전부 펼치기"
                onClick={() => expandAllFolderOverviewGroups()}
              >
                펼치기
              </button>
              <button
                type="button"
                className="ghost-button folder-overview-reset-button"
                aria-label="폴더 모두 접기"
                onClick={() => collapseAllFolderOverviewGroups()}
              >
                접기
              </button>
              <button
                type="button"
                className="ghost-button folder-overview-reset-button"
                aria-label="전체 폴더 보기"
                aria-pressed={activeDashboardView === "bookmarks" && !appliedBookmarkSearch.folderId}
                onClick={() => void handleFolderOverviewReset()}
              >
                전체
              </button>
            </div>
          ) : null}
        </div>
        <p className="folder-overview-helper">
          {shouldUseMobileSidebarPanels ? "폴더를 누르면 해당 북마크를 바로 봅니다." : "범위를 바로 바꿉니다."}
        </p>
        <input
          type="search"
          className="folder-overview-search-input"
          placeholder="폴더 찾기"
          value={folderOverviewQuery}
          onChange={(event) => setFolderOverviewQuery(event.target.value)}
        />
      </header>
      <ul className="folder-overview-system-list" aria-label="folder-system-list">
        {renderFolderOverviewSystemItem({
          filter: "all",
          label: "모든 북마크",
          ariaLabel: "모든 북마크 보기",
          icon: "☁",
          count: folderOverviewAllBookmarkCount
        })}
        {renderFolderOverviewSystemItem({
          filter: "unfiled",
          label: "미분류",
          ariaLabel: "미분류 보기",
          icon: "▱",
          count: folderOverviewUnfiledBookmarkCount
        })}
        {renderFolderOverviewSystemItem({
          filter: "trash",
          label: "휴지통",
          ariaLabel: "휴지통 보기",
          icon: "⌫",
          count: folderOverviewTrashBookmarkCount
        })}
      </ul>
      {(folderOverviewChildrenByParentId.get(null) ?? []).length === 0 ? (
        <p className="quiet-empty-state folder-overview-empty-state">
          {showHiddenFolders ? "폴더가 없습니다." : "보이는 폴더가 없습니다."}
        </p>
      ) : (
        <ul className="folder-overview-list">{renderFolderOverviewNodes(null)}</ul>
      )}
    </section>
  );

  function renderRecommendationLoadingCard() {
    return (
      <div className="recommendation-loading-card" aria-hidden="true">
        <span className="recommendation-loading-orb" />
        <div className="recommendation-loading-copy">
          <span className="recommendation-loading-line recommendation-loading-line-strong" />
          <span className="recommendation-loading-line recommendation-loading-line-soft" />
        </div>
        <span className="recommendation-loading-action" />
      </div>
    );
  }

  function renderRecommendationColumn(
    kind: RecommendationKind,
    label: string,
    recommendationBookmarks: Bookmark[]
  ) {
    return (
      <div className="recommendation-column">
        <h3>{label}</h3>
        {isRecommendationSectionLoading ? renderRecommendationLoadingCard() : null}
        {!isRecommendationSectionLoading && recommendationBookmarks.length === 0 ? (
          <p className="quiet-empty-state recommendation-empty-state">없음</p>
        ) : null}
        {!isRecommendationSectionLoading ? (
          <ul className="recommendation-list">
            {recommendationBookmarks.map((bookmark) => (
              <li key={`${kind}-${bookmark.id}`} className="recommendation-item">
                <div className="recommendation-copy">
                  <div className="recommendation-title-line">
                    <strong>{bookmark.displayTitle || bookmark.url}</strong>
                    {renderHiddenBookmarkIndicator(bookmark.isHidden === true)}
                  </div>
                  <p className="recommendation-meta-line">
                    {getRecommendationReasonLabel(kind)} · {getFolderName(bookmark.folderId)}
                  </p>
                  <p className="muted-text">
                    {hasTextContent(getBookmarkPreviewText(bookmark))
                      ? getBookmarkPreviewText(bookmark)
                      : "요약 없음"}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-button recommendation-action-button"
                  aria-label={`${bookmark.displayTitle || bookmark.url} 열기`}
                  onClick={() => void handleBookmarkOpen(bookmark)}
                >
                  열기
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  function renderRecommendationSection(options?: {
    ariaLabel?: string;
    className?: string;
    isEmbedded?: boolean;
    isHidden?: boolean;
  }) {
    const sectionClassName = `${
      options?.isEmbedded ? "recommendation-panel-card" : "surface-card panel-card recommendation-panel-card"
    }${
      isRecommendationSectionLoading ? " recommendation-panel-card-loading" : ""
    }${options?.className ? ` ${options.className}` : ""}${
      options?.isHidden ? " dashboard-panel-visually-hidden" : ""
    }`;

    return (
      <section
        aria-label={options?.ariaLabel ?? "recommendation-list"}
        className={sectionClassName}
        aria-busy={isRecommendationSectionLoading}
      >
        <header className="recommendation-panel-header">
          <p className="recommendation-panel-kicker">빠른 진입점</p>
          <div className="recommendation-panel-title-row">
            <h2>추천</h2>
            <p className="recommendation-panel-helper" aria-live="polite">
              {isRecommendationSectionLoading ? "추천을 준비하는 중" : "자주 여는 링크"}
            </p>
          </div>
        </header>
        <div className="recommendation-grid">
          {renderRecommendationColumn("favorites", "즐겨찾기", visibleRecommendations.favorites)}
          {renderRecommendationColumn("recent", "최근", visibleRecommendations.recent)}
          {renderRecommendationColumn("frequent", "반복", visibleRecommendations.frequent)}
        </div>
      </section>
    );
  }

  const recommendationSection = renderRecommendationSection({
    isHidden: isHomeDashboardView
  });

  const homeSection = (
    <section aria-label="home-page" className="surface-card panel-card home-page">
      <header className="home-page-header">
        <div className="home-page-title-block">
          <p className="bookmark-list-kicker">홈</p>
          <div className="home-page-title-row">
            <h2>홈</h2>
            <span className="home-page-count">즐겨찾기 {homeFavoriteBookmarkCount}개</span>
          </div>
        </div>
        <button
          type="button"
          className={`home-recommendation-toggle${
            isHomeRecommendationOpen ? " home-recommendation-toggle-active" : ""
          }`}
          aria-label="추천 보기"
          aria-pressed={isHomeRecommendationOpen}
          onClick={() => {
            const nextIsOpen = !isHomeRecommendationOpen;
            setIsHomeRecommendationOpen(nextIsOpen);
            if (nextIsOpen) {
              requestRecommendationsIfNeeded();
            }
          }}
        >
          <span className="home-recommendation-toggle-label">추천</span>
          <span className="home-recommendation-toggle-track" aria-hidden="true">
            <span className="home-recommendation-toggle-thumb" />
          </span>
        </button>
      </header>
      {isLoadingDashboard ? (
        <div className="bookmark-loading-state" role="status" aria-live="polite">
          <span className="bookmark-loading-spinner" aria-hidden="true" />
          <span>홈을 불러오는 중입니다.</span>
        </div>
      ) : null}
      {!isLoadingDashboard && visibleHomeFavoriteBookmarks.length === 0 ? (
        <p className="quiet-empty-state home-page-empty-state">즐겨찾기가 없습니다.</p>
      ) : null}
      {!isLoadingDashboard && visibleHomeFavoriteBookmarks.length > 0 ? (
        <ul className="home-favorite-grid">
          {visibleHomeFavoriteBookmarks.map((bookmark) => {
            const bookmarkAssets = bookmarkAssetsByBookmarkId[bookmark.id] ?? [];
            const bookmarkCoverAsset = bookmarkAssets[0] ?? null;
            const bookmarkTagItems = getTagDisplayItems(bookmark.tagIds).slice(0, 2);
            const bookmarkMenuId = `home:${bookmark.id}`;

            return (
              <li
                key={`home-${bookmark.id}`}
                className="bookmark-card home-favorite-card"
                style={
                  bookmark.bookmarkColor
                    ? {
                        borderLeftColor: bookmark.bookmarkColor,
                        borderLeftWidth: "3px"
                      }
                    : undefined
                }
              >
                {bookmarkCoverAsset ? (
                  <div className="asset-grid home-favorite-cover">
                    <img src={bookmarkCoverAsset.contentUrl} alt="업로드 이미지 1" />
                  </div>
                ) : null}
                <div className="home-favorite-main">
                  <div className="bookmark-title-line">
                    <strong>{bookmark.displayTitle || bookmark.url}</strong>
                    {renderHiddenBookmarkIndicator(bookmark.isHidden === true)}
                  </div>
                  <p
                    className="muted-text home-favorite-url"
                    title={bookmark.url}
                    style={bookmark.urlColor ? { color: bookmark.urlColor } : undefined}
                  >
                    {bookmark.url}
                  </p>
                  {hasTextContent(getBookmarkPreviewText(bookmark)) ? (
                    <p className="bookmark-row-summary home-favorite-summary">
                      {getBookmarkPreviewText(bookmark)}
                    </p>
                  ) : null}
                  <div className="bookmark-row-meta-line home-favorite-meta">
                    <span className="bookmark-row-meta-item">{getFolderName(bookmark.folderId)}</span>
                    {bookmarkTagItems.map((tag) => (
                      <span key={`home-${bookmark.id}-${tag.id}`} className="bookmark-row-meta-item">
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="action-row bookmark-card-actions bookmark-row-actions home-favorite-actions">
                  <button
                    type="button"
                    className="primary-button bookmark-row-primary-action"
                    aria-label={`${bookmark.displayTitle || bookmark.url} 열기`}
                    onClick={() => void handleBookmarkOpen(bookmark)}
                  >
                    열기
                  </button>
                  <div className="bookmark-card-secondary-actions">
                    <button
                      type="button"
                      className="secondary-button bookmark-row-detail-action"
                      aria-label={`${bookmark.displayTitle || bookmark.url} 상세 보기`}
                      onClick={() => void openBookmarkDetail(bookmark.id, bookmark, "dialog")}
                    >
                      상세
                    </button>
                    <button
                      type="button"
                      className="ghost-button folder-action-trigger bookmark-url-copy-button"
                      aria-label={`${bookmark.displayTitle || bookmark.url} URL 복사`}
                      title="URL 복사"
                      onClick={() => void handleBookmarkUrlCopy(bookmark)}
                    >
                      <span className="bookmark-url-copy-icon" aria-hidden="true" />
                    </button>
                    <div
                      className="folder-action-menu-shell bookmark-card-menu-shell"
                      data-open-menu-shell={
                        openBookmarkActionMenuId === bookmarkMenuId ? "true" : undefined
                      }
                    >
                      <button
                        type="button"
                        className="ghost-button folder-action-trigger overflow-trigger"
                        aria-label={`${bookmark.displayTitle || bookmark.url} 북마크 더보기`}
                        aria-expanded={openBookmarkActionMenuId === bookmarkMenuId}
                        onClick={() => toggleBookmarkActionMenu(bookmarkMenuId)}
                      >
                        ...
                      </button>
                      {openBookmarkActionMenuId === bookmarkMenuId ? (
                        <div
                          role="menu"
                          aria-label={`${bookmark.displayTitle || bookmark.url} 북마크 메뉴`}
                          className="folder-action-menu bookmark-card-action-menu"
                        >
                          <button
                            type="button"
                            className="secondary-button folder-action-menu-item bookmark-card-action-menu-item"
                            onClick={() => beginBookmarkEdit(bookmark)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="danger-button folder-action-menu-item bookmark-card-action-menu-item"
                            onClick={() => void handleBookmarkDelete(bookmark)}
                          >
                            삭제
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {isHomeRecommendationOpen
        ? renderRecommendationSection({
            ariaLabel: "home-recommendation-list",
            className: "home-recommendation-panel",
            isEmbedded: true
          })
        : null}
    </section>
  );

  return (
    <main
      className={`app-shell${
        isBookmarkDetailPreviewFullscreenActive ? " app-shell-preview-fullscreen" : ""
      }`}
    >
      <header className="app-hero">
        <button
          type="button"
          className="hero-copy hero-home-button"
          aria-label="홈으로 이동"
          onClick={() => openHomePage()}
        >
          <h1>Bookmark</h1>
          <p className="hero-support">개인 링크 보관함</p>
        </button>
        {sessionState.status === "authenticated" && !shouldUseMobileSidebarPanels ? (
          <section aria-label="navigation-sidebar" className="hero-command-bar">
            <div className="hero-command-meta">
              <p className="hero-command-label">빠른 작업</p>
              <p className="hero-command-summary">
                북마크 {folderOverviewAllBookmarkCount}개 · 폴더 {visibleFolders.length}개 · 태그 {tags.length}개
              </p>
            </div>
            <div
              role="toolbar"
              aria-label="quick-actions-toolbar"
              className="hero-command-toolbar"
            >
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setIsQuickActionsMenuOpen(false);
                  beginBookmarkCreate();
                }}
              >
                새 북마크
              </button>
              <div
                className="folder-action-menu-shell hero-command-menu-shell"
                data-open-menu-shell={isQuickActionsMenuOpen ? "true" : undefined}
              >
                <button
                  type="button"
                  className="ghost-button overflow-trigger"
                  aria-label="빠른 작업 더보기"
                  aria-expanded={isQuickActionsMenuOpen}
                  onClick={() => setIsQuickActionsMenuOpen((currentState) => !currentState)}
                >
                  ...
                </button>
                {isQuickActionsMenuOpen ? (
                  <div
                    role="menu"
                    aria-label="빠른 작업 메뉴"
                    className="folder-action-menu"
                  >
                    <button
                      type="button"
                      className="secondary-button folder-action-menu-item"
                      aria-label="새 폴더"
                      onClick={() => {
                        setIsQuickActionsMenuOpen(false);
                        openFolderManager();
                      }}
                    >
                      새 폴더
                    </button>
                    <button
                      type="button"
                      className="secondary-button folder-action-menu-item"
                      aria-label="태그 관리"
                      onClick={() => {
                        setIsQuickActionsMenuOpen(false);
                        openTagManager();
                      }}
                    >
                      태그 관리
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
        <div className={`hero-actions${shouldUseMobileSidebarPanels ? " hero-actions-mobile" : ""}`}>
          {sessionState.status === "loading" ? <p>세션을 확인하는 중입니다.</p> : null}
          {shouldUseMobileSidebarPanels && sessionState.status === "authenticated" ? (
            <>
              <button
                type="button"
                className="primary-button hero-mobile-create-button"
                aria-label="북마크 등록"
                onClick={() => beginBookmarkCreate()}
              >
                등록
              </button>
              <div
                className="folder-action-menu-shell hero-mobile-menu-shell"
                data-open-menu-shell={isMobileHeaderMenuOpen ? "true" : undefined}
              >
                <button
                  type="button"
                  className="ghost-button overflow-trigger hero-mobile-menu-trigger"
                  aria-label="모바일 메뉴"
                  aria-expanded={isMobileHeaderMenuOpen}
                  onClick={() =>
                    setIsMobileHeaderMenuOpen((currentState) => !currentState)
                  }
                >
                  ☰
                </button>
                {isMobileHeaderMenuOpen ? (
                  <div role="menu" aria-label="모바일 헤더 메뉴" className="folder-action-menu hero-mobile-menu">
                    <div className="hero-mobile-menu-account">
                      <p className="session-label">계정</p>
                      <strong>{sessionState.user.email}</strong>
                    </div>
                    <button
                      type="button"
                      className="secondary-button folder-action-menu-item"
                      onClick={() => void handlePwaInstall()}
                    >
                      앱 설치
                    </button>
                    <button
                      type="button"
                      className="secondary-button folder-action-menu-item"
                      onClick={() => {
                        setIsMobileHeaderMenuOpen(false);
                        openFolderManager();
                      }}
                    >
                      새 폴더
                    </button>
                    <button
                      type="button"
                      className="secondary-button folder-action-menu-item"
                      onClick={() => {
                        setIsMobileHeaderMenuOpen(false);
                        openTagManager();
                      }}
                    >
                      태그 관리
                    </button>
                    <button
                      type="button"
                      className="secondary-button folder-action-menu-item"
                      onClick={() => {
                        setIsMobileHeaderMenuOpen(false);
                        setIsExtensionDownloadDialogOpen(true);
                      }}
                    >
                      확장 다운로드
                    </button>
                    <button
                      type="button"
                      className="secondary-button folder-action-menu-item"
                      onClick={() => void openExtensionTokenDialog()}
                    >
                      확장 토큰
                    </button>
                    <button
                      type="button"
                      className="danger-button folder-action-menu-item"
                      onClick={() => void handleLogout()}
                    >
                      로그아웃
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          {!shouldUseMobileSidebarPanels && sessionState.status !== "loading" ? (
            <button
              type="button"
              className="secondary-button hero-install-button"
              aria-label="앱 설치"
              onClick={() => void handlePwaInstall()}
            >
              앱 설치
            </button>
          ) : null}
          {sessionState.status === "anonymous" ? (
            <>
              {shouldUseMobileSidebarPanels ? (
                <button
                  type="button"
                  className="secondary-button hero-install-button"
                  aria-label="앱 설치"
                  onClick={() => void handlePwaInstall()}
                >
                  앱 설치
                </button>
              ) : null}
              <button type="button" className="primary-button" onClick={() => void handleGoogleLogin()}>
                Google로 로그인
              </button>
            </>
          ) : null}
          {!shouldUseMobileSidebarPanels && sessionState.status === "authenticated" ? (
            <section className="session-card">
              <div className="session-card-copy">
                <p className="session-label">계정</p>
                <strong>{sessionState.user.email}</strong>
              </div>
              <div className="session-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  aria-label="브라우저 확장 다운로드"
                  onClick={() => setIsExtensionDownloadDialogOpen(true)}
                >
                  확장 다운로드
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label="확장 토큰 관리"
                  onClick={() => void openExtensionTokenDialog()}
                >
                  확장 토큰
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handleLogout()}
                >
                  로그아웃
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </header>
      {sessionState.status === "authenticated" ? (
        <section aria-label="dashboard-workspace" className="dashboard-workspace">
          <div className="dashboard-layout">
            <aside
              aria-label="dashboard-sidebar"
              className="dashboard-sidebar"
            >
              {!shouldUseMobileSidebarPanels ? (
                folderOverviewSection
              ) : null}
              {shouldUseMobileSidebarPanels ? (
                <div className="sidebar-segmented-panels">
                  <div role="tablist" aria-label="mobile-sidebar-tabs" className="sidebar-segment-tabs">
                    {renderMobileSidebarTabButton({
                      panelId: "folder",
                      heading: "폴더",
                      summary: folderPanelSummary,
                      kicker: folderPanelKicker
                    })}
                    {renderMobileSidebarTabButton({
                      panelId: "bookmark",
                      heading: "북마크",
                      summary: bookmarkBrowsePanelSummary,
                      kicker: bookmarkBrowsePanelKicker
                    })}
                    {renderMobileSidebarTabButton({
                      panelId: "recommendation",
                      heading: "추천",
                      summary: recommendationPanelSummary,
                      kicker: recommendationPanelKicker
                    })}
                  </div>
                </div>
              ) : null}
          </aside>

          <section
            id={shouldUseMobileSidebarPanels ? `sidebar-panel-${mobileSidebarPanel}` : undefined}
            aria-label={shouldUseMobileSidebarPanels ? mobileSidebarPanel : "dashboard-main"}
            aria-labelledby={
              shouldUseMobileSidebarPanels ? `sidebar-tab-${mobileSidebarPanel}` : undefined
            }
            role={shouldUseMobileSidebarPanels ? "tabpanel" : undefined}
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
            {isHomeDashboardView ? homeSection : null}
            {shouldRenderMobileFolderTab ? folderOverviewSection : null}
            {!shouldUseMobileSidebarPanels || shouldRenderMobileBookmarkTab ? (
            <section
              aria-label="bookmark-results"
              className={`bookmark-results-stack${
                isHomeDashboardView ? " dashboard-panel-visually-hidden" : ""
              }`}
            >
            <section aria-label="search-panel" className="surface-card panel-card search-panel-card">
              {isMobileSearchViewport ? (
                <div className="search-panel-header">
                  <div className="search-panel-heading">
                    <p className="search-panel-kicker">탐색 기준</p>
                    <div className="search-panel-title-row">
                      <h2>검색과 필터</h2>
                      {shouldShowMobileSearchSummary ? (
                        <span className="search-panel-summary-pill">
                          활성 필터 {activeBookmarkSearchSummaryItems.length}개
                        </span>
                      ) : null}
                    </div>
                    <p className="search-panel-helper">검색과 조건을 함께 봅니다.</p>
                    {shouldShowMobileSearchSummary ? (
                      <p className="search-panel-helper search-panel-helper-mobile">
                        활성 필터 {activeBookmarkSearchSummaryItems.length}개
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="secondary-button search-panel-toggle"
                    aria-expanded={isMobileSearchPanelOpen}
                    onClick={() =>
                      setIsMobileSearchPanelOpen((currentState) => !currentState)
                    }
                  >
                    {isMobileSearchPanelOpen ? "검색/필터 닫기" : "검색/필터 열기"}
                  </button>
                </div>
              ) : null}
              {shouldShowSearchPanelBody ? (
              <form className="search-form" onSubmit={(event) => void handleBookmarkSearchSubmit(event)}>
                {isMobileSearchViewport ? (
                  <fieldset className="search-grid search-grid-basic search-grid-surface">
                    <legend>기본 검색</legend>
                    <label>
                      검색어
                      <input
                        name="bookmarkSearchQuery"
                        value={bookmarkSearchDraft.query}
                        onChange={(event) =>
                          updateBookmarkSearchDraft({ query: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      검색 모드
                      <select
                        name="bookmarkSearchMode"
                        value={bookmarkSearchDraft.mode}
                        onChange={(event) =>
                          updateBookmarkSearchDraft({
                            mode: event.target.value as BookmarkSearchMode
                          })
                        }
                      >
                        {bookmarkSearchModeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      정렬
                      <select
                        name="bookmarkSearchSort"
                        value={bookmarkSearchDraft.sort}
                        onChange={(event) =>
                          updateBookmarkSearchDraft({
                            sort: event.target.value as BookmarkSortMode
                          })
                        }
                      >
                        {bookmarkSortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="secondary-button"
                      aria-expanded={shouldShowAdvancedBookmarkSearch}
                      onClick={() =>
                        setIsAdvancedBookmarkSearchOpen((currentState) => !currentState)
                      }
                    >
                      {shouldShowAdvancedBookmarkSearch ? "고급 필터 접기" : "고급 필터 열기"}
                    </button>
                  </fieldset>
                ) : (
                  <div
                    role="region"
                    aria-label="desktop-search-toolbar"
                    className="search-toolbar search-toolbar-shell"
                  >
                    <div className="search-toolbar-field search-toolbar-field-query">
                      <input
                        aria-label="검색어"
                        name="bookmarkSearchQuery"
                        placeholder="링크, 제목, 내용 검색"
                        value={bookmarkSearchDraft.query}
                        onChange={(event) =>
                          updateBookmarkSearchDraft({ query: event.target.value })
                        }
                      />
                    </div>
                    <div className="search-toolbar-mode">
                      {renderSearchModeSegmentedControl(bookmarkSearchDraft.mode, (value) =>
                        updateBookmarkSearchDraft({ mode: value })
                      )}
                    </div>
                    <div className="search-toolbar-field">
                      <select
                        aria-label="정렬"
                        name="bookmarkSearchSort"
                        value={bookmarkSearchDraft.sort}
                        onChange={(event) =>
                          updateBookmarkSearchDraft({
                            sort: event.target.value as BookmarkSortMode
                          })
                        }
                      >
                        {bookmarkSortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="search-toolbar-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        aria-label={shouldShowAdvancedBookmarkSearch ? "고급 필터 접기" : "고급 필터 열기"}
                        aria-expanded={shouldShowAdvancedBookmarkSearch}
                        onClick={() =>
                          setIsAdvancedBookmarkSearchOpen((currentState) => !currentState)
                        }
                      >
                        필터
                      </button>
                      <button type="submit" className="primary-button" aria-label="검색 실행">
                        검색
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        aria-label="검색 초기화"
                        onClick={() => void handleBookmarkSearchReset()}
                      >
                        초기화
                      </button>
                    </div>
                  </div>
                )}
                {shouldShowAdvancedBookmarkSearch ? (
                  <fieldset className="search-grid search-grid-advanced search-grid-surface">
                    <legend>필터</legend>
                    <div className="search-filter-group">
                      <h3>기간</h3>
                      <div className="search-filter-group-grid">
                        <label>
                          최근 추가
                          <select
                            name="bookmarkSearchCreatedWithin"
                            value={bookmarkSearchDraft.createdWithin}
                            onChange={(event) =>
                              updateBookmarkSearchDraft({
                                createdWithin: event.target.value as BookmarkRelativeDateRange
                              })
                            }
                          >
                            <option value="all">전체</option>
                            <option value="7d">최근 7일</option>
                            <option value="30d">최근 30일</option>
                          </select>
                        </label>
                        <label>
                          최근 열람
                          <select
                            name="bookmarkSearchOpenedWithin"
                            value={bookmarkSearchDraft.openedWithin}
                            onChange={(event) =>
                              updateBookmarkSearchDraft({
                                openedWithin: event.target.value as BookmarkRelativeDateRange
                              })
                            }
                          >
                            <option value="all">전체</option>
                            <option value="7d">최근 7일</option>
                            <option value="30d">최근 30일</option>
                          </select>
                        </label>
                      </div>
                    </div>
                    <div className="search-filter-group">
                      <h3>분류</h3>
                      <div className="search-filter-group-grid">
                        <label>
                          <span aria-hidden="true">폴더</span>
                          <select
                            aria-label="필터 폴더"
                            name="bookmarkSearchFolderId"
                            value={bookmarkSearchDraft.folderId}
                            onChange={(event) =>
                              updateBookmarkSearchDraft({
                                folderId: event.target.value,
                                includeDescendantFolders: event.target.value
                                  ? bookmarkSearchDraft.includeDescendantFolders
                                  : false
                              })
                            }
                          >
                            <option value="">전체 폴더</option>
                            {visibleFolderOptions.map(({ folder, label }) => (
                              <option key={folder.id} value={folder.id}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {renderCheckboxField({
                          className: "search-filter-checkbox",
                          label: <span aria-hidden="true">하위 포함</span>,
                          inputProps: {
                            "aria-label": "하위 폴더 포함",
                            name: "bookmarkSearchIncludeDescendantFolders",
                            checked: bookmarkSearchDraft.includeDescendantFolders,
                            onChange: (event) =>
                              updateBookmarkSearchDraft({
                                includeDescendantFolders: event.currentTarget.checked
                              }),
                            disabled: !bookmarkSearchDraft.folderId
                          }
                        })}
                        <label>
                          태그 조건
                          <select
                            name="bookmarkSearchTagMode"
                            value={bookmarkSearchDraft.tagMode}
                            onChange={(event) =>
                              updateBookmarkSearchDraft({
                                tagMode: event.target.value as BookmarkTagMode
                              })
                            }
                          >
                            <option value="and">모두 포함</option>
                            <option value="or">하나라도 포함</option>
                          </select>
                        </label>
                        <fieldset className="tag-fieldset">
                          <legend>필터 태그</legend>
                          {tags.length === 0 ? (
                            <p className="quiet-empty-state">태그가 없습니다.</p>
                          ) : null}
                          <div className="pill-list">
                            {tags.map((tag) => (
                              <label key={tag.id} className="pill-option">
                                <input
                                  type="checkbox"
                                  name="bookmarkSearchTagIds"
                                  checked={bookmarkSearchDraft.tagIds.includes(tag.id)}
                                  onChange={(event) =>
                                    toggleBookmarkSearchTag(tag.id, event.target.checked)
                                  }
                                />
                                {renderTagLabel(tag.name, tag.color, "tag-option-label")}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      </div>
                    </div>
                    <div className="search-filter-group">
                      <h3>상태</h3>
                      <div className="search-filter-group-grid">
                        {renderCheckboxField({
                          className: "search-filter-checkbox",
                          label: <span aria-hidden="true">즐겨찾기</span>,
                          inputProps: {
                            "aria-label": "즐겨찾기만",
                            name: "bookmarkSearchFavoriteOnly",
                            checked: bookmarkSearchDraft.favoriteOnly,
                            onChange: (event) =>
                              updateBookmarkSearchDraft({
                                favoriteOnly: event.currentTarget.checked
                              })
                          }
                        })}
                        {renderSearchColorSelect("북마크 색상 필터", bookmarkSearchDraft.bookmarkColor, (value) =>
                          updateBookmarkSearchDraft({ bookmarkColor: value })
                        )}
                        {renderSearchColorSelect("url 색상 필터", bookmarkSearchDraft.urlColor, (value) =>
                          updateBookmarkSearchDraft({ urlColor: value })
                        )}
                        <label>
                          <span aria-hidden="true">요약</span>
                          <select
                            aria-label="요약 필터"
                            name="bookmarkSearchSummaryState"
                            value={bookmarkSearchDraft.summaryState}
                            onChange={(event) =>
                              updateBookmarkSearchDraft({
                                summaryState: event.target.value as "all" | "with" | "without"
                              })
                            }
                          >
                            <option value="all">전체 요약</option>
                            <option value="with">요약 있음</option>
                            <option value="without">요약 없음</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </fieldset>
                ) : null}
                {isMobileSearchViewport ? (
                  <div className="action-row search-action-row">
                    <button type="submit" className="primary-button">검색 실행</button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleBookmarkSearchReset()}
                    >
                      검색 초기화
                    </button>
                  </div>
                ) : null}
              </form>
              ) : null}
              {hasActiveBookmarkSearch(appliedBookmarkSearch) && shouldShowSearchPanelBody ? (
                <div className="filter-summary-card">
                  <div className="filter-summary-header">
                    <p className="filter-summary-kicker">현재 작업 조건</p>
                    <p className="filter-summary-count">
                      선택된 필터 {activeBookmarkSearchSummaryItems.length}개
                    </p>
                  </div>
                  <ul aria-label="active-search-filters" className="active-filter-list">
                    {activeBookmarkSearchSummaryItems.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          className="chip-button"
                          aria-label={`검색 조건 제거: ${item.groupLabel} - ${item.valueLabel}`}
                          onClick={() => void applyBookmarkSearch(item.nextSearch)}
                        >
                          <span className="chip-button-group">{item.groupLabel}</span>
                          <span className="chip-button-value">{item.valueLabel}</span>
                          <span className="chip-button-remove" aria-hidden="true">
                            ×
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
            </section>
            ) : null}
            {shouldRenderMobileRecommendationTab ? recommendationSection : null}
            {!shouldUseMobileSidebarPanels || shouldRenderMobileBookmarkTab ? (
            <section
              aria-label="bookmark-list"
              className={`surface-card panel-card${
                isHomeDashboardView ? " dashboard-panel-visually-hidden" : ""
              }`}
            >
            <header className="bookmark-list-header">
              <div
                className={`bookmark-list-title-row${
                  shouldUseCompactMobileCards ? " mobile-visibility-title-row" : ""
                }`}
              >
                <div className="bookmark-list-heading-copy">
                  <h2>저장된 북마크</h2>
                </div>
                <div
                  className={`bookmark-list-header-actions${
                    shouldUseCompactMobileCards ? " bookmark-list-header-actions-mobile" : ""
                  }`}
                >
                  {renderBookmarkSortControl()}
                  {renderBookmarkViewControl()}
                  <label className="bookmark-page-size-control">
                    <span>보기 개수</span>
                    <select
                      aria-label="보기 개수"
                      value={bookmarkListPageSize}
                      onChange={(event) => void handleBookmarkPageSizeChange(event.target.value)}
                    >
                      {bookmarkPageSizeOptions.map((pageSize) => (
                        <option key={pageSize} value={pageSize}>
                          {pageSize}개
                        </option>
                      ))}
                    </select>
                  </label>
                  {shouldUseCompactMobileCards ? (
                    renderMobileVisibilityIconButton({
                      ariaLabel: showHiddenBookmarks ? "숨김 북마크 숨기기" : "숨김 북마크 보기",
                      isActive: showHiddenBookmarks,
                      onClick: () => handleToggleHiddenBookmarks()
                    })
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ghost-button bookmark-list-hidden-toggle"
                        aria-label={showHiddenBookmarks ? "숨김 북마크 숨기기" : "숨김 북마크 보기"}
                        aria-pressed={showHiddenBookmarks}
                        onClick={() => handleToggleHiddenBookmarks()}
                      >
                        <span aria-hidden="true" className="bookmark-list-hidden-toggle-icon">
                          {showHiddenBookmarks ? "🔓" : "🔒"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="secondary-button bookmark-list-export-button"
                        aria-label="북마크 내보내기"
                        onClick={() => void handleBookmarkExport()}
                      >
                        내보내기
                      </button>
                    </>
                  )}
                </div>
              </div>
            </header>
            {isLoadingDashboard ? (
              <div className="bookmark-loading-state" role="status" aria-live="polite">
                <span className="bookmark-loading-spinner" aria-hidden="true" />
                <span>북마크를 불러오는 중입니다.</span>
              </div>
            ) : null}
            {!isLoadingDashboard && visibleBookmarks.length === 0 ? (
              <p className="quiet-empty-state bookmark-list-empty-state">보관한 북마크가 없습니다.</p>
            ) : null}
            <ul
              ref={bookmarkListElementRef}
              className={`bookmark-grid bookmark-list-table bookmark-list-table-view-${bookmarkViewMode}`}
              data-virtualized-bookmark-list={canVirtualizeBookmarkList ? "true" : undefined}
              data-virtualized-bookmark-total={
                canVirtualizeBookmarkList ? visiblePagedBookmarks.length : undefined
              }
              style={
                {
                  "--bookmark-cover-size": `${bookmarkCardDisplaySettings.coverSize}px`
                } as CSSProperties
              }
            >
              {canVirtualizeBookmarkList && bookmarkVirtualTopSpacerHeight > 0 ? (
                <li
                  aria-hidden="true"
                  className="bookmark-virtual-spacer"
                  style={{ height: `${bookmarkVirtualTopSpacerHeight}px` }}
                />
              ) : null}
              {renderedPagedBookmarks.map((bookmark) => {
                const bookmarkAssets = bookmarkAssetsByBookmarkId[bookmark.id] ?? [];
                const bookmarkTagItems = getTagDisplayItems(bookmark.tagIds);
                const appliesItemDisplaySettings = bookmarkViewMode !== "title";
                const bookmarkDisplaySettings =
                  bookmarkViewMode === "list"
                    ? bookmarkListDisplaySettings
                    : bookmarkCardDisplaySettings;
                const shouldShowBookmarkCover =
                  (bookmarkViewMode === "card" || bookmarkViewMode === "moodboard") &&
                  bookmarkDisplaySettings.coverImage &&
                  bookmarkAssets.length > 0;
                const shouldShowListBookmarkCover =
                  bookmarkViewMode === "list" &&
                  bookmarkDisplaySettings.coverImage &&
                  bookmarkAssets.length > 0;
                const shouldShowBookmarkTitle =
                  !appliesItemDisplaySettings || bookmarkDisplaySettings.title;
                const shouldShowBookmarkDescription =
                  bookmarkViewMode !== "title" &&
                  (!appliesItemDisplaySettings || bookmarkDisplaySettings.description);
                const shouldShowBookmarkTags =
                  !appliesItemDisplaySettings || bookmarkDisplaySettings.tags;
                const shouldShowBookmarkInfo =
                  bookmarkViewMode !== "title" &&
                  (!appliesItemDisplaySettings || bookmarkDisplaySettings.bookmarkInfo);
                const visibleBookmarkTagItems = bookmarkTagItems.slice(
                  0,
                  shouldUseCompactMobileCards ? 1 : 2
                );
                const remainingBookmarkTagCount = Math.max(
                  0,
                  bookmarkTagItems.length - visibleBookmarkTagItems.length
                );
                const bookmarkAssetCount = bookmarkAssets.length;
                const bookmarkCoverAsset = bookmarkAssets[0] ?? null;
                const isTrashedBookmark = bookmark.isTrashed || isTrashBookmarkView;
                const isSelectedBookmarkCard =
                  !shouldUseCompactMobileCards &&
                  bookmarkDetailDisplayMode === "rail" &&
                  visibleSelectedBookmark?.id === bookmark.id;

                return (
                <li
                  key={bookmark.id}
                  className={`bookmark-card bookmark-list-row bookmark-list-row-view-${bookmarkViewMode}${
                    isSelectedBookmarkCard ? " bookmark-list-row-selected" : ""
                  }${
                    shouldShowListBookmarkCover ? " bookmark-list-row-has-cover" : ""
                  }`}
                  style={
                    bookmark.bookmarkColor
                      ? {
                          borderLeftColor: bookmark.bookmarkColor,
                          borderLeftWidth: "3px"
                        }
                      : undefined
                  }
                >
                  {shouldShowListBookmarkCover && bookmarkCoverAsset ? (
                    <div className="asset-grid bookmark-row-assets bookmark-row-list-thumbnail">
                      <img
                        src={bookmarkCoverAsset.contentUrl}
                        alt="업로드 이미지 1"
                      />
                    </div>
                  ) : null}
                  <div
                    className={`bookmark-row-main${shouldUseCompactMobileCards ? "" : " bookmark-row-click-target"}`}
                    onClick={
                      shouldUseCompactMobileCards
                        ? undefined
                        : () => toggleBookmarkDetailFromCard(bookmark)
                    }
                  >
                    {shouldShowBookmarkCover && bookmarkCoverAsset ? (
                      <div className="asset-grid bookmark-row-assets">
                        <img
                          src={bookmarkCoverAsset.contentUrl}
                          alt="업로드 이미지 1"
                        />
                      </div>
                    ) : null}
                    <div className="bookmark-card-header">
                      <div className="bookmark-card-title-block">
                        {shouldShowBookmarkTitle ? (
                          <div className="bookmark-title-line">
                            <strong>{bookmark.displayTitle || bookmark.url}</strong>
                            {renderHiddenBookmarkIndicator(bookmark.isHidden === true)}
                          </div>
                        ) : null}
                        {shouldShowBookmarkInfo && !shouldUseCompactMobileCards ? (
                          <p
                            className="muted-text bookmark-row-url"
                            title={bookmark.url}
                            style={bookmark.urlColor ? { color: bookmark.urlColor } : undefined}
                          >
                            {bookmark.url}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {shouldShowBookmarkDescription && hasTextContent(getBookmarkPreviewText(bookmark)) ? (
                      <p
                        className={`bookmark-row-summary${
                          shouldUseCompactMobileCards ? " bookmark-card-summary" : ""
                        }`}
                      >
                        {getBookmarkPreviewText(bookmark)}
                      </p>
                    ) : shouldShowBookmarkDescription && shouldUseCompactMobileCards ? (
                      <p className="bookmark-row-summary bookmark-card-summary">{bookmark.url}</p>
                    ) : null}
                  </div>
                  {shouldShowBookmarkInfo || shouldShowBookmarkTags ? (
                    <div
                      className={`bookmark-row-meta${shouldUseCompactMobileCards ? "" : " bookmark-row-click-target"}`}
                      onClick={
                        shouldUseCompactMobileCards
                          ? undefined
                          : () => toggleBookmarkDetailFromCard(bookmark)
                      }
                    >
                      {shouldShowBookmarkInfo ? (
                        <div className="bookmark-row-meta-line bookmark-row-meta-primary">
                          <span className="bookmark-row-meta-item">{getFolderName(bookmark.folderId)}</span>
                          {bookmark.isFavorite ? (
                            <span className="bookmark-row-meta-item">즐겨찾기</span>
                          ) : null}
                          {isTrashedBookmark ? (
                            <span className="bookmark-row-meta-item">휴지통</span>
                          ) : null}
                        </div>
                      ) : null}
                      {!shouldUseCompactMobileCards ? (
                      <div className="bookmark-row-meta-line bookmark-row-meta-secondary">
                        {shouldShowBookmarkInfo ? (
                          <span className="bookmark-row-meta-item">
                            {getBookmarkSummaryStateLabel(bookmark)}
                          </span>
                        ) : null}
                        {shouldShowBookmarkTags
                          ? visibleBookmarkTagItems.map((tag) => (
                              <span
                                key={`${bookmark.id}-${tag.id}`}
                                className="bookmark-row-meta-item"
                              >
                                {tag.name}
                              </span>
                            ))
                          : null}
                        {shouldShowBookmarkTags && remainingBookmarkTagCount > 0 ? (
                          <span className="bookmark-row-meta-item">+{remainingBookmarkTagCount}</span>
                        ) : null}
                        {shouldShowBookmarkInfo && bookmarkAssetCount > 0 ? (
                          <span className="bookmark-row-meta-item">이미지 {bookmarkAssetCount}</span>
                        ) : null}
                      </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div
                    className={`action-row bookmark-card-actions bookmark-row-actions${
                      shouldUseCompactMobileCards ? " bookmark-row-actions-mobile-compact" : ""
                    }`}
                  >
                    {isTrashedBookmark ? (
                      <>
                        <button
                          type="button"
                          className="primary-button bookmark-row-primary-action"
                          aria-label={`${bookmark.displayTitle || bookmark.url} 복구`}
                          onClick={() => void handleBookmarkRestore(bookmark)}
                        >
                          복구
                        </button>
                        <div className="bookmark-card-secondary-actions">
                          <button
                            type="button"
                            className="danger-button"
                            aria-label={`${bookmark.displayTitle || bookmark.url} 영구 삭제`}
                            onClick={() => void handleBookmarkPermanentDelete(bookmark)}
                          >
                            영구 삭제
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="primary-button bookmark-row-primary-action"
                          aria-label={`${bookmark.displayTitle || bookmark.url} 열기`}
                          onClick={() => void handleBookmarkOpen(bookmark)}
                        >
                          열기
                        </button>
                        <div className="bookmark-card-secondary-actions">
                          {shouldUseCompactMobileCards ? (
                            <button
                              type="button"
                              className="secondary-button bookmark-row-detail-action"
                              aria-label={`${bookmark.displayTitle || bookmark.url} 상세 보기`}
                              onClick={() => void openBookmarkDetail(bookmark.id, bookmark, "dialog")}
                            >
                              상세
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="ghost-button folder-action-trigger bookmark-url-copy-button"
                            aria-label={`${bookmark.displayTitle || bookmark.url} URL 복사`}
                            title="URL 복사"
                            onClick={() => void handleBookmarkUrlCopy(bookmark)}
                          >
                            <span className="bookmark-url-copy-icon" aria-hidden="true" />
                          </button>
                          <div
                            className="folder-action-menu-shell bookmark-card-menu-shell"
                            data-open-menu-shell={
                              openBookmarkActionMenuId === bookmark.id ? "true" : undefined
                            }
                          >
                            <button
                              type="button"
                              className="ghost-button folder-action-trigger overflow-trigger"
                              aria-label={`${bookmark.displayTitle || bookmark.url} 북마크 더보기`}
                              aria-expanded={openBookmarkActionMenuId === bookmark.id}
                              onClick={() => toggleBookmarkActionMenu(bookmark.id)}
                            >
                              ...
                            </button>
                            {openBookmarkActionMenuId === bookmark.id ? (
                              <div
                                role="menu"
                                aria-label={`${bookmark.displayTitle || bookmark.url} 북마크 메뉴`}
                                className="folder-action-menu bookmark-card-action-menu"
                              >
                                <button
                                  type="button"
                                  className="secondary-button folder-action-menu-item bookmark-card-action-menu-item"
                                  onClick={() => beginBookmarkEdit(bookmark)}
                                >
                                  수정
                                </button>
                                <button
                                  type="button"
                                  className="danger-button folder-action-menu-item bookmark-card-action-menu-item"
                                  onClick={() => void handleBookmarkDelete(bookmark)}
                                >
                                  삭제
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </li>
              )})}
              {canVirtualizeBookmarkList && bookmarkVirtualBottomSpacerHeight > 0 ? (
                <li
                  aria-hidden="true"
                  className="bookmark-virtual-spacer"
                  style={{ height: `${bookmarkVirtualBottomSpacerHeight}px` }}
                />
              ) : null}
            </ul>
            {!isLoadingDashboard && visibleBookmarks.length > 0 ? (
              <div className="bookmark-pagination-bar">
                <p className="bookmark-pagination-summary">
                  {visiblePagedBookmarks.length} / {visibleBookmarkTotalCount}개 표시
                </p>
                {hasMoreVisibleBookmarks ? (
                  <button
                    type="button"
                    className="secondary-button bookmark-pagination-more-button"
                    disabled={isLoadingMoreBookmarks}
                    onClick={() => void handleBookmarkListLoadMore()}
                  >
                    {isLoadingMoreBookmarks ? "불러오는 중" : "더 보기"}
                  </button>
                ) : null}
              </div>
            ) : null}
            </section>
            ) : null}
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
                quickFolderCreateSection={quickFolderCreateSection}
                quickTagCreateSection={quickTagCreateSection}
                pendingAssetSection={renderPendingAssetComposerSection(editingBookmarkId)}
                onClose={requestCloseBookmarkComposer}
                onSubmit={handleBookmarkSubmit}
                onDraftChange={updateBookmarkDraft}
                onUrlChange={handleBookmarkUrlChange}
                onPreviewLoad={handleBookmarkPreviewLoad}
                onOpenPreviewSourceUrl={handleOpenBookmarkPreviewSourceUrl}
                onOpenExtensionDownload={() => setIsExtensionDownloadDialogOpen(true)}
                onDismissPreviewFallback={handleDismissBookmarkPreviewFallback}
                onUseUrlOnly={handleUseUrlOnlyBookmarkDraft}
                onClearPreview={handleClearBookmarkPreview}
                onClassificationOpenChange={setIsBookmarkComposerClassificationOpen}
                onDisplayOpenChange={setIsBookmarkComposerDisplayOpen}
                onTagSearchQueryChange={setBookmarkTagSearchQuery}
                onTagToggle={toggleBookmarkTag}
                onCancelEdit={cancelBookmarkEdit}
              />
            </Suspense>
          ) : null}
          {shouldRenderFolderManagerOverlay ? (
            <Suspense fallback={null}>
              <LazyFolderManagerDialog
                isEditing={Boolean(editingFolderId)}
                draft={folderDraft}
                allFolders={folders}
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
                onBeginFolderEdit={beginFolderEdit}
                onBeginChildFolderCreate={beginChildFolderCreate}
                onFolderDelete={handleFolderDelete}
                onFolderReorderDrop={handleFolderReorderDrop}
                onFolderMoveDrop={handleFolderMoveDrop}
                onFolderMoveToRootDrop={handleFolderMoveToRootDrop}
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
                tags={tags}
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
                onBeginTagEdit={beginTagEdit}
                onTagDelete={handleTagDelete}
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
        <p className="status-banner" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  );
}
