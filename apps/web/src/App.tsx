import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode
} from "react";
import "./App.css";

import type {
  AuthenticatedUser,
  Bookmark,
  BookmarkAsset,
  BookmarkExtractPreview,
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
  uploadBookmarkAsset
} from "./lib/bookmark-assets";
import { extractBookmarkPreview } from "./lib/bookmark-extract";
import {
  createBookmark,
  deleteBookmark,
  loadBookmark,
  loadBookmarkPreview,
  loadBookmarks,
  permanentlyDeleteBookmark,
  reextractBookmark,
  restoreBookmark,
  updateBookmark
} from "./lib/bookmarks";
import { signInWithGoogle, signOutFromGoogle } from "./lib/firebase";
import {
  createFolder,
  deleteFolder,
  loadFolders,
  moveFolder,
  reorderFolders,
  updateFolder
} from "./lib/folders";
import { colorPresets, folderIconPresets } from "./lib/folder-presets";
import { loadRecommendations, recordBookmarkOpen } from "./lib/recommendations";
import { exchangeIdTokenForSession, loadSession, logoutSession } from "./lib/session";
import { createTag, deleteTag, loadTags, updateTag } from "./lib/tags";
import {
  createExtensionToken,
  loadExtensionTokens,
  revokeExtensionToken
} from "./lib/extension-tokens";
import { extractImageFilesFromDataTransfer } from "./lib/clipboard-images";

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
type SidebarPanelId = "compose" | "folder" | "bookmark" | "tag";
type MobileSidebarPanelId = "folder" | "bookmark" | "recommendation";
type BookmarkDetailDisplayMode = "rail" | "dialog";
type BookmarkDetailTab = "detail" | "preview";
type BookmarkViewMode = "list" | "card" | "title" | "moodboard";
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
const BOOKMARK_VIEW_SETTINGS_STORAGE_KEY = "bookmark-view-settings:v1";

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

const defaultBookmarkCardDisplaySettings: BookmarkCardDisplaySettings = {
  coverImage: true,
  title: true,
  description: true,
  tags: true,
  bookmarkInfo: true,
  coverSize: 132
};

const MOBILE_SEARCH_BREAKPOINT = 720;
const EXTENSION_FOLDER_NAME = "확장";

function getIsMobileSearchViewport() {
  return (globalThis.innerWidth ?? 1024) <= MOBILE_SEARCH_BREAKPOINT;
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
  return bookmarkViewModeOptions.find((option) => option.value === mode)?.label ?? "카드";
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

function loadStoredBookmarkViewSettings() {
  try {
    const storedSettings = globalThis.localStorage?.getItem(BOOKMARK_VIEW_SETTINGS_STORAGE_KEY);
    if (!storedSettings) {
      return {
        mode: "card" as BookmarkViewMode,
        card: defaultBookmarkCardDisplaySettings
      };
    }

    const parsedSettings = JSON.parse(storedSettings) as {
      mode?: unknown;
      card?: Partial<BookmarkCardDisplaySettings>;
    };
    const parsedCardSettings = parsedSettings.card ?? {};

    return {
      mode: isBookmarkViewMode(parsedSettings.mode) ? parsedSettings.mode : "card",
      card: {
        coverImage:
          typeof parsedCardSettings.coverImage === "boolean"
            ? parsedCardSettings.coverImage
            : defaultBookmarkCardDisplaySettings.coverImage,
        title:
          typeof parsedCardSettings.title === "boolean"
            ? parsedCardSettings.title
            : defaultBookmarkCardDisplaySettings.title,
        description:
          typeof parsedCardSettings.description === "boolean"
            ? parsedCardSettings.description
            : defaultBookmarkCardDisplaySettings.description,
        tags:
          typeof parsedCardSettings.tags === "boolean"
            ? parsedCardSettings.tags
            : defaultBookmarkCardDisplaySettings.tags,
        bookmarkInfo:
          typeof parsedCardSettings.bookmarkInfo === "boolean"
            ? parsedCardSettings.bookmarkInfo
            : defaultBookmarkCardDisplaySettings.bookmarkInfo,
        coverSize: clampBookmarkCoverSize(
          Number(parsedCardSettings.coverSize ?? defaultBookmarkCardDisplaySettings.coverSize)
        )
      }
    };
  } catch {
    return {
      mode: "card" as BookmarkViewMode,
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

  if (hasTextContent(bookmark.sourceContent)) {
    return bookmark.sourceContent ?? "";
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

  if (hasTextContent(bookmark.sourceContent)) {
    return "자동 추출";
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

  return rows.filter((row) => hasTextContent(row.value));
}

function getBookmarkPreviewFieldRows(preview: BookmarkExtractPreview | null) {
  if (!preview) {
    return [];
  }

  return [
    { label: "제목", value: preview.sourceTitle },
    { label: "내용", value: preview.sourceContent },
    { label: "요약", value: preview.sourceSummary }
  ].filter((row) => hasTextContent(row.value));
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

export default function App() {
  const [sessionState, setSessionState] = useState<SessionState>({
    status: "loading"
  });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bookmarkInventory, setBookmarkInventory] = useState<Bookmark[]>([]);
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
  const [extensionTokenLabelDraft, setExtensionTokenLabelDraft] = useState("");
  const [latestIssuedExtensionToken, setLatestIssuedExtensionToken] = useState<string | null>(null);
  const [bookmarkPreview, setBookmarkPreview] = useState<BookmarkExtractPreview | null>(null);
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
  const [bookmarkDetailDisplayMode, setBookmarkDetailDisplayMode] =
    useState<BookmarkDetailDisplayMode>("rail");
  const [isLoadingSelectedBookmark, setIsLoadingSelectedBookmark] = useState(false);
  const [isLoadingSelectedBookmarkAssets, setIsLoadingSelectedBookmarkAssets] = useState(false);
  const [bookmarkDetailActiveTab, setBookmarkDetailActiveTab] =
    useState<BookmarkDetailTab>("detail");
  const [selectedBookmarkLivePreview, setSelectedBookmarkLivePreview] =
    useState<BookmarkExtractPreview | null>(null);
  const [selectedBookmarkPreviewError, setSelectedBookmarkPreviewError] =
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
  const bookmarkDetailRequestIdRef = useRef(0);
  const bookmarkPreviewRequestIdRef = useRef(0);

  async function loadBookmarkAssetsByBookmark(bookmarksToLoad: Bookmark[]) {
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

  async function preloadBookmarkAssets(
    bookmarksToLoad: Bookmark[],
    currentAssetsByBookmarkId: Record<string, BookmarkAsset[]>
  ) {
    const bookmarksMissingAssets = bookmarksToLoad.filter(
      (bookmark) => currentAssetsByBookmarkId[bookmark.id] === undefined
    );
    if (bookmarksMissingAssets.length === 0) {
      return;
    }

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

  async function refreshDashboardData(search = appliedBookmarkSearch) {
    setIsLoadingDashboard(true);

    try {
      const [
        { visibleBookmarks: nextBookmarks, inventoryBookmarks: nextBookmarkInventory },
        nextFolders,
        nextTags,
        nextRecommendations
      ] = await Promise.all([
        loadBookmarkCollections(search),
        loadFolders(),
        loadTags(),
        loadRecommendations()
      ]);

      startTransition(() => {
        setBookmarks(nextBookmarks);
        setBookmarkInventory(nextBookmarkInventory);
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
        setRecommendations(nextRecommendations);
      });

      void preloadBookmarkAssets(nextBookmarks, bookmarkAssetsByBookmarkId);
    } catch {
      startTransition(() => {
        setBookmarks([]);
        setBookmarkInventory([]);
        setTrashedBookmarks([]);
        setBookmarkAssetsByBookmarkId({});
        setSelectedBookmark(null);
        setFolders([]);
        setTags([]);
        setRecommendations(emptyBookmarkRecommendations);
        setExtensionTokens([]);
        setErrorMessage("대시보드 데이터를 불러오지 못했습니다.");
      });
    } finally {
      setIsLoadingDashboard(false);
    }
  }

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
    try {
      globalThis.localStorage?.setItem(
        BOOKMARK_VIEW_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          mode: bookmarkViewMode,
          card: bookmarkCardDisplaySettings
        })
      );
    } catch {
      // The setting is a convenience preference; keep the UI usable if storage is unavailable.
    }
  }, [bookmarkViewMode, bookmarkCardDisplaySettings]);

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
        nextTags,
        nextRecommendations
      ] = await Promise.all([
        loadBookmarkCollections(appliedBookmarkSearch).catch(() => ({
          normalizedSearch: normalizeBookmarkSearchDraft(appliedBookmarkSearch),
          visibleBookmarks: [] as Bookmark[],
          inventoryBookmarks: [] as Bookmark[]
        })),
        loadFolders().catch(() => []),
        loadTags().catch(() => []),
        loadRecommendations().catch(() => emptyBookmarkRecommendations)
      ]);

      startTransition(() => {
        setSessionState({
          status: "authenticated",
          user
        });
        setBookmarks(nextBookmarks);
        setBookmarkInventory(nextBookmarkInventory);
        setTrashedBookmarks([]);
        setSelectedBookmark(null);
        setFolders(nextFolders);
        setTags(nextTags);
        setRecommendations(nextRecommendations);
        setExtensionTokens([]);
        setExtensionTokenLabelDraft("");
        setLatestIssuedExtensionToken(null);
        setIsExtensionTokenDialogOpen(false);
      });

      void preloadBookmarkAssets(nextBookmarks, bookmarkAssetsByBookmarkId);
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

    startTransition(() => {
      setSessionState({ status: "anonymous" });
      setBookmarks([]);
      setBookmarkInventory([]);
      setTrashedBookmarks([]);
      setSelectedBookmark(null);
      setBookmarkAssetsByBookmarkId({});
      setFolders([]);
      setTags([]);
      setRecommendations(emptyBookmarkRecommendations);
      setExtensionTokens([]);
      setExtensionTokenLabelDraft("");
      setLatestIssuedExtensionToken(null);
      setIsExtensionTokenDialogOpen(false);
      setIsInstallHelpDialogOpen(false);
      setBookmarkDraft(emptyBookmarkDraft);
      setInitialBookmarkDraft(emptyBookmarkDraft);
      setBookmarkPreview(null);
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

      if (editingBookmarkId) {
        const updatedBookmark = await updateBookmark(editingBookmarkId, {
          folderId: bookmarkDraft.folderId || null,
          tagIds: bookmarkDraft.tagIds,
          userTitle: bookmarkDraft.userTitle || null,
          userContent: bookmarkDraft.userContent || null,
          userSummary: bookmarkDraft.userSummary || null,
          sourceTitle: bookmarkPreview?.sourceTitle ?? null,
          sourceContent: bookmarkPreview?.sourceContent ?? null,
          sourceSummary: bookmarkPreview?.sourceSummary ?? null,
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
          sourceTitle: bookmarkPreview?.sourceTitle ?? null,
          sourceContent: bookmarkPreview?.sourceContent ?? null,
          sourceSummary: bookmarkPreview?.sourceSummary ?? null,
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
            setBookmarkDraft(emptyBookmarkDraft);
            setInitialBookmarkDraft(emptyBookmarkDraft);
            setBookmarkPreview(null);
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
            setBookmarkDraft(emptyBookmarkDraft);
            setInitialBookmarkDraft(emptyBookmarkDraft);
            setBookmarkPreview(null);
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
      setIsLoadingDashboard(true);
      const {
        normalizedSearch,
        visibleBookmarks: nextBookmarks,
        inventoryBookmarks: nextBookmarkInventory
      } = await loadBookmarkCollections(nextSearchDraft);

      startTransition(() => {
        setBookmarks(nextBookmarks);
        setBookmarkInventory(nextBookmarkInventory);
        setSelectedBookmark(null);
        setBookmarkSearchDraft(normalizedSearch);
        setAppliedBookmarkSearch(normalizedSearch);
        setFolderOverviewSpecialFilter(null);
      });

      void preloadBookmarkAssets(nextBookmarks, bookmarkAssetsByBookmarkId);
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
          });
          void preloadBookmarkAssets(nextBookmarks, bookmarkAssetsByBookmarkId);
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
          setSelectedBookmark(null);
          setBookmarkSearchDraft(nextSearch);
          setAppliedBookmarkSearch(nextSearch);
        });
        void preloadBookmarkAssets(nextBookmarks, bookmarkAssetsByBookmarkId);
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

    if (shouldUseMobileSidebarPanels) {
      setMobileSidebarPanel("bookmark");
    }

    if (canResolveFolderOverviewSearchLocally(nextSearch)) {
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
      });
      void preloadBookmarkAssets(nextBookmarks, bookmarkAssetsByBookmarkId);
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

    if (shouldUseMobileSidebarPanels) {
      setMobileSidebarPanel("bookmark");
    }

    if (canResolveFolderOverviewSearchLocally(nextSearch)) {
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
      });
      void preloadBookmarkAssets(nextBookmarks, bookmarkAssetsByBookmarkId);
      return;
    }

    await applyBookmarkSearch(nextSearch);
  }

  async function handleFolderOverviewSpecialSelect(filter: FolderOverviewSpecialFilter) {
    const nextSearch = normalizeBookmarkSearchDraft({
      ...emptyBookmarkSearchDraft,
      sort: appliedBookmarkSearch.sort
    });

    if (shouldUseMobileSidebarPanels) {
      setMobileSidebarPanel("bookmark");
    }

    try {
      setErrorMessage(null);
      if (filter === "trash") {
        setIsLoadingDashboard(true);
      }

      let nextBookmarks: Bookmark[];
      let nextBookmarkInventory: Bookmark[] | null = null;

      if (filter === "trash") {
        nextBookmarks = await loadBookmarks({ ...nextSearch, trashMode: "trashed" });
      } else if (nextSearch.sort !== "created_desc") {
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
        }
        setSelectedBookmark(null);
        setBookmarkSearchDraft(nextSearch);
        setAppliedBookmarkSearch(nextSearch);
        setFolderOverviewSpecialFilter(filter);
      });

      void preloadBookmarkAssets(nextBookmarks, bookmarkAssetsByBookmarkId);
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "북마크 범위를 바꾸지 못했습니다."
        );
      });
    } finally {
      if (filter === "trash") {
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
    const nextDraft = {
      url: bookmark.url,
      folderId:
        bookmark.folderId && !extensionFolderIds.has(bookmark.folderId)
          ? bookmark.folderId
          : "",
      tagIds: bookmark.tagIds,
      bookmarkColor: bookmark.bookmarkColor ?? "",
      urlColor: bookmark.urlColor ?? "",
      userTitle: bookmark.userTitle ?? "",
      userContent: bookmark.userContent ?? "",
      userSummary: bookmark.userSummary ?? "",
      isFavorite: bookmark.isFavorite,
      isHidden: bookmark.isHidden
    };

    setIsMobileHeaderMenuOpen(false);
    setOpenBookmarkActionMenuId(null);
    setIsBookmarkDetailActionMenuOpen(false);
    setIsBookmarkComposerOpen(true);
    setIsBookmarkComposerClassificationOpen(
      bookmark.tagIds.length > 0 || bookmark.isFavorite || bookmark.isHidden
    );
    setIsBookmarkComposerDisplayOpen(
      Boolean(
        bookmark.bookmarkColor ||
          bookmark.urlColor ||
          (bookmarkAssetsByBookmarkId[bookmark.id]?.length ?? 0) > 0
      )
    );
    setEditingBookmarkId(bookmark.id);
    setBookmarkDraft(nextDraft);
    setInitialBookmarkDraft(nextDraft);
    setBookmarkPreview(
      bookmark.sourceTitle || bookmark.sourceContent || bookmark.sourceSummary
        ? {
            url: bookmark.url,
            normalizedUrl: bookmark.url,
            sourceTitle: bookmark.sourceTitle,
            sourceContent: bookmark.sourceContent,
            sourceSummary: bookmark.sourceSummary
          }
        : null
    );
    setIsQuickFolderOpen(false);
    setQuickFolderDraft(emptyFolderDraft);
    setIsQuickTagOpen(false);
    setQuickTagDraft(emptyTagDraft);

    if (bookmarkAssetsByBookmarkId[bookmark.id]) {
      return;
    }

    try {
      const assets = await loadBookmarkAssets(bookmark.id);
      startTransition(() => {
        setBookmarkAssetsByBookmarkId((currentAssetsByBookmarkId) => ({
          ...currentAssetsByBookmarkId,
          [bookmark.id]: assets
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
    setBookmarkDraft(emptyBookmarkDraft);
    setInitialBookmarkDraft(emptyBookmarkDraft);
    setBookmarkPreview(null);
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
    setPendingAssetFiles([]);
    setIsQuickFolderOpen(false);
    setQuickFolderDraft(emptyFolderDraft);
    setIsQuickTagOpen(false);
    setQuickTagDraft(emptyTagDraft);
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
    setIsLoadingSelectedBookmarkPreview(false);
  }

  function showBookmarkDetailTab(tab: BookmarkDetailTab) {
    bookmarkPreviewRequestIdRef.current += 1;
    setBookmarkDetailActiveTab(tab);
    setSelectedBookmarkLivePreview(null);
    setSelectedBookmarkPreviewError(null);
    setIsLoadingSelectedBookmarkPreview(false);
  }

  async function loadSelectedBookmarkPreview(bookmarkId: string) {
    const requestId = bookmarkPreviewRequestIdRef.current + 1;
    bookmarkPreviewRequestIdRef.current = requestId;

    setIsLoadingSelectedBookmarkPreview(true);
    setSelectedBookmarkLivePreview(null);
    setSelectedBookmarkPreviewError(null);

    try {
      const preview = await loadBookmarkPreview(bookmarkId);
      if (bookmarkPreviewRequestIdRef.current !== requestId) {
        return;
      }

      startTransition(() => {
        setSelectedBookmarkLivePreview(preview);
      });
    } catch (error) {
      if (bookmarkPreviewRequestIdRef.current !== requestId) {
        return;
      }

      startTransition(() => {
        setSelectedBookmarkPreviewError(
          error instanceof Error ? error.message : "미리보기를 불러오지 못했습니다."
        );
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
    if (tab === "preview") {
      void loadSelectedBookmarkPreview(bookmarkId);
    }
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
    setIsLoadingSelectedBookmark(false);
    setIsLoadingSelectedBookmarkAssets(false);
    setIsLoadingSelectedBookmarkPreview(false);
    setSelectedBookmarkLivePreview(null);
    setSelectedBookmarkPreviewError(null);
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
  }

  function closeExtensionDownloadDialog() {
    setIsExtensionDownloadDialogOpen(false);
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

  async function handleBookmarkPreviewLoad() {
    if (!bookmarkDraft.url.trim()) {
      setErrorMessage("미리보기를 불러올 URL을 입력해주세요.");
      return;
    }

    try {
      setErrorMessage(null);
      setIsLoadingBookmarkPreview(true);
      const preview = await extractBookmarkPreview(bookmarkDraft.url.trim());
      startTransition(() => {
        setBookmarkPreview(preview);
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "URL 메타 미리보기를 불러오지 못했습니다."
        );
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
        showBookmarkDetailTab("preview");
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
        showBookmarkDetailTab("preview");
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
  }

  function getFolder(folderId: string | null) {
    if (!folderId) {
      return null;
    }

    return folders.find((folder) => folder.id === folderId) ?? null;
  }

  function getFolderName(folderId: string | null) {
    if (!folderId || extensionFolderIds.has(folderId)) {
      return "미분류";
    }

    return getFolder(folderId)?.name ?? folderId;
  }

  function getTag(tagId: string) {
    return tags.find((tag) => tag.id === tagId) ?? null;
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
  const extensionFolderIds = getExtensionFolderIds(folders);
  const rawHiddenFolderIds = getHiddenFolderIds(folders);
  const hiddenFolderIds = new Set(
    Array.from(rawHiddenFolderIds).filter((folderId) => !extensionFolderIds.has(folderId))
  );
  const activeBookmarkSearchSummaryItems = getBookmarkSearchSummaryItems(
    appliedBookmarkSearch,
    {
      getFolderName,
      getTagNames
    }
  );
  const visibleFolders = showHiddenFolders
    ? folders.filter((folder) => !extensionFolderIds.has(folder.id))
    : folders.filter(
        (folder) => !hiddenFolderIds.has(folder.id) && !extensionFolderIds.has(folder.id)
      );
  const visibleBookmarks = filterBookmarksByHiddenBookmarks(
    filterBookmarksByHiddenFolders(bookmarks, hiddenFolderIds, showHiddenFolders),
    showHiddenBookmarks
  );
  const visibleBookmarkInventory = filterBookmarksByHiddenBookmarks(
    filterBookmarksByHiddenFolders(bookmarkInventory, hiddenFolderIds, showHiddenFolders),
    showHiddenBookmarks
  );
  const folderOverviewAllBookmarkCount = visibleBookmarkInventory.length;
  const folderOverviewUnfiledBookmarkCount = visibleBookmarkInventory.filter(
    (bookmark) => isBookmarkUnfiled(bookmark, extensionFolderIds)
  ).length;
  const folderOverviewTrashBookmarkCount = filterBookmarksByHiddenBookmarks(
    trashedBookmarks,
    showHiddenBookmarks
  ).length;
  const activeFolderOverviewSpecialFilter =
    folderOverviewSpecialFilter ??
    (!hasActiveBookmarkSearch(appliedBookmarkSearch) ? "all" : null);
  const isTrashBookmarkView = activeFolderOverviewSpecialFilter === "trash";
  const visibleRecommendations = filterRecommendationsByHiddenBookmarks(
    filterRecommendationsByHiddenFolders(recommendations, hiddenFolderIds, showHiddenFolders),
    showHiddenBookmarks
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
  const disallowedParentFolderIds = editingFolderId
    ? new Set([editingFolderId, ...getFolderDescendantIds(folders, editingFolderId)])
    : new Set<string>();
  const manageableFolders = folders.filter((folder) => !extensionFolderIds.has(folder.id));
  const parentFolderOptions = getHierarchicalFolderOptions(
    manageableFolders,
    disallowedParentFolderIds
  );
  const folderManagerChildrenByParentId = getFoldersByParentId(manageableFolders);
  const visibleFolderOptions = getHierarchicalFolderOptions(visibleFolders);
  const quickFolderParentOptions = getHierarchicalFolderOptions(visibleFolders);
  const isFolderOverviewSearchActive = Boolean(folderOverviewQuery.trim());
  const folderOverviewVisibleFolderIds = getFolderVisibleIdsForQuery(
    visibleFolders,
    folderOverviewQuery
  );
  const folderOverviewChildrenByParentId = getFoldersByParentId(
    visibleFolders.filter((folder) => folderOverviewVisibleFolderIds.has(folder.id))
  );
  const selectedBookmarkUserDetailRows = visibleSelectedBookmark
    ? getBookmarkDetailFieldRows(visibleSelectedBookmark, "user")
    : [];
  const selectedBookmarkSourceDetailRows = visibleSelectedBookmark
    ? getBookmarkDetailFieldRows(visibleSelectedBookmark, "source")
    : [];
  const selectedBookmarkLivePreviewRows =
    getBookmarkPreviewFieldRows(selectedBookmarkLivePreview);
  const selectedBookmarkAssetCount = visibleSelectedBookmark
    ? bookmarkAssetsByBookmarkId[visibleSelectedBookmark.id]?.length ?? 0
    : 0;
  const selectedBookmarkTagItems = visibleSelectedBookmark
    ? getTagDisplayItems(visibleSelectedBookmark.tagIds)
    : [];
  const selectedBookmarkVisibleTagItems = selectedBookmarkTagItems.slice(0, 4);
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

  function renderVisibleSelectedBookmarkDetail(closeLabel: string) {
    if (!visibleSelectedBookmark) {
      return null;
    }

    return (
      <section
        aria-label="bookmark-detail"
        className="surface-card panel-card bookmark-detail-card"
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
        <header className="bookmark-detail-header">
          <div className="bookmark-detail-top-row">
            <p className="bookmark-detail-kicker">읽기 중심</p>
            <button
              type="button"
              className="ghost-button bookmark-detail-close-button"
              aria-label="상세 창 닫기"
              onClick={() => closeBookmarkDetail()}
            >
              <span aria-hidden="true">×</span>
            </button>
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
        </div>

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
        ) : (
          <div
            role="tabpanel"
            id="bookmark-detail-panel-preview"
            aria-labelledby="bookmark-detail-tab-preview"
            className="bookmark-detail-tab-panel"
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
            <section className="detail-block">
              <h3>최신 미리보기</h3>
              {selectedBookmarkLivePreviewRows.map((row) => (
                <div key={row.label} className="detail-row">
                  <p className="detail-row-label">{row.label}</p>
                  <p className="detail-row-value">{row.value}</p>
                </div>
              ))}
              {selectedBookmarkLivePreviewRows.length === 0 &&
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
            <section className="detail-block">
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
            <div className="folder-action-menu-shell bookmark-detail-menu-shell">
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
                  className="folder-action-menu"
                >
                  {visibleSelectedBookmark.isTrashed ? (
                    <>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        onClick={() => void handleBookmarkRestore(visibleSelectedBookmark)}
                      >
                        복구
                      </button>
                      <button
                        type="button"
                        className="danger-button folder-action-menu-item"
                        onClick={() => void handleBookmarkPermanentDelete(visibleSelectedBookmark)}
                      >
                        영구 삭제
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        onClick={() => void beginBookmarkEdit(visibleSelectedBookmark)}
                      >
                        수정 시작
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        onClick={() => void handleBookmarkReextract(visibleSelectedBookmark.id)}
                      >
                        자동 추출 다시 시도
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        onClick={() => void handleResetSourceContent(visibleSelectedBookmark.id)}
                      >
                        자동 추출 초기화
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        onClick={() => void handleResetUserContent(visibleSelectedBookmark.id)}
                      >
                        사용자 입력 초기화
                      </button>
                      <button
                        type="button"
                        className="danger-button folder-action-menu-item"
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
      <div className="bookmark-sort-menu-shell">
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

  function updateBookmarkCardDisplaySetting(
    key: keyof Omit<BookmarkCardDisplaySettings, "coverSize">,
    value: boolean
  ) {
    setBookmarkCardDisplaySettings((currentSettings) => ({
      ...currentSettings,
      [key]: value
    }));
  }

  function renderBookmarkViewControl() {
    const activeViewLabel = getBookmarkViewModeLabel(bookmarkViewMode);

    return (
      <div className="bookmark-view-menu-shell">
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
            <section className="bookmark-view-menu-section">
              <p className="bookmark-view-menu-title">보기 in 카드</p>
              {[
                ["coverImage", "커버 이미지"],
                ["title", "제목"],
                ["description", "설명"],
                ["tags", "태그"],
                ["bookmarkInfo", "북마크 정보"]
              ].map(([key, label]) => {
                const settingKey = key as keyof Omit<BookmarkCardDisplaySettings, "coverSize">;
                const isChecked = bookmarkCardDisplaySettings[settingKey];

                return (
                  <button
                    key={key}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isChecked}
                    className={`secondary-button folder-action-menu-item bookmark-view-menu-item${
                      isChecked ? " bookmark-view-menu-item-active" : ""
                    }`}
                    onClick={() => updateBookmarkCardDisplaySetting(settingKey, !isChecked)}
                  >
                    <span aria-hidden="true" className="bookmark-view-menu-check">
                      {isChecked ? "✓" : ""}
                    </span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </section>
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
    children: ReactNode;
  }) {
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
        className="surface-card panel-card"
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
        onClick={() => setMobileSidebarPanel(options.panelId)}
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

  function renderFolderManagerContent() {
    function renderFolderManagerNodes(parentFolderId: string | null, depth = 0): ReactNode {
      return (folderManagerChildrenByParentId.get(parentFolderId) ?? []).map((folder) => {
        const childFolders = folderManagerChildrenByParentId.get(folder.id) ?? [];
        const hasChildren = childFolders.length > 0;
        const isExpanded = hasChildren && expandedFolderManagerIds.includes(folder.id);
        const rowStyle = {
          "--folder-tree-depth": depth
        } as CSSProperties;

        return (
          <li
            key={folder.id}
            className={`folder-tree-item${depth > 0 ? " folder-tree-item-child" : ""}`}
            onDragOver={(event) => {
              if (
                !draggingFolderId ||
                draggingFolderId === folder.id ||
                folders.find((currentFolder) => currentFolder.id === draggingFolderId)
                  ?.parentFolderId !== folder.parentFolderId
              ) {
                return;
              }

              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              void handleFolderReorderDrop(folder);
            }}
          >
            <div className="folder-tree-entry">
              <div className="folder-tree-row" style={rowStyle}>
                {hasChildren ? (
                  <button
                    type="button"
                    className="folder-tree-disclosure"
                    aria-label={`${folder.name} 폴더 ${isExpanded ? "접기" : "펼치기"}`}
                    aria-expanded={isExpanded}
                    onClick={() => toggleFolderManagerExpansion(folder.id)}
                  >
                    {isExpanded ? "▾" : "▸"}
                  </button>
                ) : (
                  <span aria-hidden="true" className="folder-tree-disclosure-spacer" />
                )}
                <div className="folder-tree-summary">
                  {renderFolderLabel(
                    folder.name,
                    folder.color,
                    folder.icon,
                    "folder-tree-label",
                    folder.isHidden === true
                  )}
                  {folder.parentFolderId ? (
                    <div className="folder-tree-meta">
                      <p>상위 {getFolderName(folder.parentFolderId)}</p>
                    </div>
                  ) : null}
                </div>
                <div className="folder-tree-actions">
                  <button
                    type="button"
                    className="ghost-button folder-tree-handle"
                    draggable
                    disabled={isReorderingFolders}
                    aria-label={`${folder.name} 폴더 드래그 정렬`}
                    onDragStart={() => {
                      setOpenFolderActionMenuId(null);
                      setDraggingFolderId(folder.id);
                    }}
                    onDragEnd={() => resetDraggingFolder()}
                  >
                    정렬
                  </button>
                  <button
                    type="button"
                    className="secondary-button folder-tree-child-create"
                    aria-label={`${folder.name} 하위 폴더 추가`}
                    onClick={() => beginChildFolderCreate(folder)}
                  >
                    + 하위
                  </button>
                  <button
                    type="button"
                    className="ghost-button folder-tree-drop-action"
                    disabled={isReorderingFolders}
                    aria-label={`${folder.name} 폴더 하위로 이동`}
                    onDragOver={(event) => {
                      event.stopPropagation();
                      if (!draggingFolderId || draggingFolderId === folder.id) {
                        return;
                      }

                      const descendantFolderIds = getFolderDescendantIds(folders, draggingFolderId);
                      if (descendantFolderIds.has(folder.id)) {
                        return;
                      }

                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      void handleFolderMoveDrop(folder);
                    }}
                  >
                    이동
                  </button>
                  <div className="folder-action-menu-shell">
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
                          onClick={() => beginFolderEdit(folder)}
                        >
                          {folder.name} 폴더 수정 시작
                        </button>
                        <button
                          type="button"
                          className="danger-button folder-action-menu-item"
                          onClick={() => void handleFolderDelete(folder)}
                        >
                          {folder.name} 폴더 삭제
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {hasChildren && isExpanded ? (
                <ul className="folder-tree-children">
                  {renderFolderManagerNodes(folder.id, depth + 1)}
                </ul>
              ) : null}
            </div>
          </li>
        );
      });
    }

    return (
      <div className="manager-workspace">
        <section className="manager-surface manager-editor-surface">
          <div className="manager-section-header">
            <p className="manager-section-kicker">입력</p>
            <div>
              <h3>{editingFolderId ? "폴더 수정" : "새 폴더"}</h3>
              <p>{editingFolderId ? "구조를 정리합니다." : "트리에 추가합니다."}</p>
            </div>
          </div>
          <form className="stack-form manager-stack-form" onSubmit={(event) => void handleFolderSubmit(event)}>
            <label>
              폴더 이름
              <input
                name="folderName"
                value={folderDraft.name}
                onChange={(event) => updateFolderDraft({ name: event.target.value })}
                required
              />
            </label>
            {renderCheckboxField({
              className: "manager-checkbox-row",
              label: "숨김 폴더",
              inputProps: {
                name: "folderIsHidden",
                checked: folderDraft.isHidden,
                onChange: (event) => updateFolderDraft({ isHidden: event.currentTarget.checked })
              }
            })}
            {renderFolderColorPicker(folderDraft.color, (value) => updateFolderDraft({ color: value }))}
            {renderFolderIconPicker(folderDraft.icon, (value) => updateFolderDraft({ icon: value }))}
            <label>
              부모 폴더
              <select
                name="folderParentFolderId"
                value={folderDraft.parentFolderId}
                onChange={(event) => updateFolderDraft({ parentFolderId: event.target.value })}
              >
                <option value="">상위 없음</option>
                {parentFolderOptions.map(({ folder, label }) => (
                  <option key={folder.id} value={folder.id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="action-row">
              <button
                type="submit"
                className="primary-button"
                aria-label={editingFolderId ? "폴더 수정" : "폴더 추가"}
                disabled={isSavingFolder}
              >
                {isSavingFolder
                  ? "저장 중..."
                  : editingFolderId
                    ? "저장"
                    : "추가"}
              </button>
              {editingFolderId ? (
                <button
                  type="button"
                  className="secondary-button"
                  aria-label="수정 취소"
                  onClick={() => cancelFolderEdit()}
                >
                  취소
                </button>
              ) : null}
            </div>
          </form>
        </section>
        <section className="manager-surface manager-list-surface">
          <div className="manager-section-header">
            <p className="manager-section-kicker">폴더 트리</p>
            <div>
              <h3>트리</h3>
              <p>{folders.length}개 폴더</p>
            </div>
          </div>
          <button
            type="button"
            className="dropzone-button manager-dropzone"
            disabled={isReorderingFolders}
            aria-label="루트 이동"
            onDragOver={(event) => {
              const draggedFolder = draggingFolderId
                ? folders.find((folder) => folder.id === draggingFolderId)
                : null;
              if (!draggedFolder || draggedFolder.parentFolderId === null) {
                return;
              }

              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              void handleFolderMoveToRootDrop();
            }}
          >
            루트 이동
          </button>
          <ul className="folder-tree">{renderFolderManagerNodes(null)}</ul>
        </section>
      </div>
    );
  }

  function renderTagManagerContent() {
    return (
      <div className="manager-workspace">
        <section className="manager-surface manager-editor-surface">
          <div className="manager-section-header">
            <p className="manager-section-kicker">입력</p>
            <div>
              <h3>{editingTagId ? "태그 수정" : "새 태그"}</h3>
              <p>{editingTagId ? "이름과 색을 정리합니다." : "바로 쓸 태그를 추가합니다."}</p>
            </div>
          </div>
          <form className="stack-form manager-stack-form" onSubmit={(event) => void handleTagSubmit(event)}>
            <label>
              태그 이름
              <input
                name="tagName"
                value={tagDraft.name}
                onChange={(event) => updateTagDraft({ name: event.target.value })}
                required
              />
            </label>
            {renderColorPicker("태그 색상", tagDraft.color, (value) =>
              updateTagDraft({ color: value })
            )}
            <div className="action-row">
              <button
                type="submit"
                className="primary-button"
                aria-label={editingTagId ? "태그 수정" : "태그 추가"}
                disabled={isSavingTag}
              >
                {isSavingTag
                  ? "저장 중..."
                  : editingTagId
                    ? "저장"
                    : "추가"}
              </button>
              {editingTagId ? (
                <button
                  type="button"
                  className="secondary-button"
                  aria-label="수정 취소"
                  onClick={() => cancelTagEdit()}
                >
                  취소
                </button>
              ) : null}
            </div>
          </form>
        </section>
        <section className="manager-surface manager-list-surface">
          <div className="manager-section-header">
            <p className="manager-section-kicker">현재 태그</p>
            <div>
              <h3>태그 목록</h3>
              <p>지금 쓰는 태그를 빠르게 정리합니다.</p>
            </div>
          </div>
          <ul className="tag-list">
            {tags.map((tag) => (
              <li key={tag.id} className="tag-list-item">
                {renderTagLabel(tag.name, tag.color, "tag-list-name")}
                <div className="folder-action-menu-shell">
                  <button
                    type="button"
                    className="ghost-button folder-action-trigger"
                    aria-label={`${tag.name} 태그 더보기`}
                    aria-expanded={openTagActionMenuId === tag.id}
                    onClick={() => toggleTagActionMenu(tag.id)}
                  >
                    더보기
                  </button>
                  {openTagActionMenuId === tag.id ? (
                    <div
                      role="menu"
                      aria-label={`${tag.name} 태그 메뉴`}
                      className="folder-action-menu"
                    >
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        onClick={() => beginTagEdit(tag)}
                      >
                        {tag.name} 태그 수정 시작
                      </button>
                      <button
                        type="button"
                        className="danger-button folder-action-menu-item"
                        onClick={() => void handleTagDelete(tag)}
                      >
                        {tag.name} 태그 삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
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
    const isActive = activeFolderOverviewSpecialFilter === options.filter;

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
      const bookmarkCount = countBookmarksInFolderTree(
        visibleBookmarkInventory,
        visibleFolders,
        folder.id
      );
      const isActive = appliedBookmarkSearch.folderId === folder.id;

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
                <div className="folder-overview-inline-actions">
                  <button
                    type="button"
                    className="secondary-button folder-overview-child-create"
                    aria-label={`${folder.name} 하위 폴더 추가`}
                    onClick={() => beginChildFolderCreate(folder)}
                  >
                    + 하위
                  </button>
                  <div className="folder-action-menu-shell folder-overview-menu-shell">
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
                          onClick={() => beginFolderEdit(folder)}
                        >
                          {folder.name} 폴더 수정 시작
                        </button>
                        <button
                          type="button"
                          className="danger-button folder-action-menu-item"
                          onClick={() => void handleFolderDelete(folder)}
                        >
                          {folder.name} 폴더 삭제
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
    <section aria-label="folder-overview" className="surface-card panel-card folder-overview-card">
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
                aria-pressed={!appliedBookmarkSearch.folderId}
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
        <p className="quiet-empty-state">
          {showHiddenFolders ? "폴더가 없습니다." : "보이는 폴더가 없습니다."}
        </p>
      ) : (
        <ul className="folder-overview-list">{renderFolderOverviewNodes(null)}</ul>
      )}
    </section>
  );

  const recommendationSection = (
    <section aria-label="recommendation-list" className="surface-card panel-card recommendation-panel-card">
      <header className="recommendation-panel-header">
        <p className="recommendation-panel-kicker">빠른 진입점</p>
        <div className="recommendation-panel-title-row">
          <h2>추천</h2>
          <p className="recommendation-panel-helper">자주 여는 링크</p>
        </div>
      </header>
      <div className="recommendation-grid">
        <div className="recommendation-column">
          <h3>즐겨찾기</h3>
          {visibleRecommendations.favorites.length === 0 ? (
            <p className="quiet-empty-state">없음</p>
          ) : null}
          <ul className="recommendation-list">
            {visibleRecommendations.favorites.map((bookmark) => (
              <li key={`favorite-${bookmark.id}`} className="recommendation-item">
                <div className="recommendation-copy">
                  <div className="recommendation-title-line">
                    <strong>{bookmark.displayTitle || bookmark.url}</strong>
                    {renderHiddenBookmarkIndicator(bookmark.isHidden === true)}
                  </div>
                  <p className="recommendation-meta-line">
                    {getRecommendationReasonLabel("favorites")} · {getFolderName(bookmark.folderId)}
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
        </div>
        <div className="recommendation-column">
          <h3>최근</h3>
          {visibleRecommendations.recent.length === 0 ? (
            <p className="quiet-empty-state">없음</p>
          ) : null}
          <ul className="recommendation-list">
            {visibleRecommendations.recent.map((bookmark) => (
              <li key={`recent-${bookmark.id}`} className="recommendation-item">
                <div className="recommendation-copy">
                  <div className="recommendation-title-line">
                    <strong>{bookmark.displayTitle || bookmark.url}</strong>
                    {renderHiddenBookmarkIndicator(bookmark.isHidden === true)}
                  </div>
                  <p className="recommendation-meta-line">
                    {getRecommendationReasonLabel("recent")} · {getFolderName(bookmark.folderId)}
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
        </div>
        <div className="recommendation-column">
          <h3>반복</h3>
          {visibleRecommendations.frequent.length === 0 ? (
            <p className="quiet-empty-state">없음</p>
          ) : null}
          <ul className="recommendation-list">
            {visibleRecommendations.frequent.map((bookmark) => (
              <li key={`frequent-${bookmark.id}`} className="recommendation-item">
                <div className="recommendation-copy">
                  <div className="recommendation-title-line">
                    <strong>{bookmark.displayTitle || bookmark.url}</strong>
                    {renderHiddenBookmarkIndicator(bookmark.isHidden === true)}
                  </div>
                  <p className="recommendation-meta-line">
                    {getRecommendationReasonLabel("frequent")} · {getFolderName(bookmark.folderId)}
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
        </div>
      </div>
    </section>
  );

  return (
    <main className="app-shell">
      <header className="app-hero">
        <div className="hero-copy">
          <h1>Bookmark</h1>
          <p className="hero-support">개인 링크 보관함</p>
        </div>
        {sessionState.status === "authenticated" && !shouldUseMobileSidebarPanels ? (
          <section aria-label="navigation-sidebar" className="hero-command-bar">
            <div className="hero-command-meta">
              <p className="hero-command-label">빠른 작업</p>
              <p className="hero-command-summary">
                북마크 {visibleBookmarks.length}개 · 폴더 {visibleFolders.length}개 · 태그 {tags.length}개
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
              <div className="folder-action-menu-shell hero-command-menu-shell">
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
              <div className="folder-action-menu-shell hero-mobile-menu-shell">
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
            <aside aria-label="dashboard-sidebar" className="dashboard-sidebar">
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
            <div role="region" aria-label="result-primary-column" className="result-primary-column">
            {shouldRenderMobileFolderTab ? folderOverviewSection : null}
            {!shouldUseMobileSidebarPanels || shouldRenderMobileBookmarkTab ? (
            <section aria-label="bookmark-results" className="bookmark-results-stack">
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
            <section aria-label="bookmark-list" className="surface-card panel-card">
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
              <p className="quiet-empty-state">대시보드 데이터를 불러오는 중입니다.</p>
            ) : null}
            {visibleBookmarks.length === 0 ? (
              <p className="quiet-empty-state">보관한 북마크가 없습니다.</p>
            ) : null}
            <ul
              className={`bookmark-grid bookmark-list-table bookmark-list-table-view-${bookmarkViewMode}`}
              style={
                {
                  "--bookmark-cover-size": `${bookmarkCardDisplaySettings.coverSize}px`
                } as CSSProperties
              }
            >
              {visibleBookmarks.map((bookmark) => {
                const bookmarkAssets = bookmarkAssetsByBookmarkId[bookmark.id] ?? [];
                const bookmarkTagItems = getTagDisplayItems(bookmark.tagIds);
                const appliesCardDisplaySettings =
                  bookmarkViewMode === "card" || bookmarkViewMode === "moodboard";
                const shouldShowBookmarkCover =
                  appliesCardDisplaySettings &&
                  bookmarkCardDisplaySettings.coverImage &&
                  bookmarkAssets.length > 0;
                const shouldShowBookmarkTitle =
                  !appliesCardDisplaySettings || bookmarkCardDisplaySettings.title;
                const shouldShowBookmarkDescription =
                  bookmarkViewMode !== "title" &&
                  (!appliesCardDisplaySettings || bookmarkCardDisplaySettings.description);
                const shouldShowBookmarkTags =
                  !appliesCardDisplaySettings || bookmarkCardDisplaySettings.tags;
                const shouldShowBookmarkInfo =
                  bookmarkViewMode !== "title" &&
                  (!appliesCardDisplaySettings || bookmarkCardDisplaySettings.bookmarkInfo);
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
                  <div className="action-row bookmark-card-actions bookmark-row-actions">
                    {isTrashedBookmark ? (
                      <>
                        <button
                          type="button"
                          className="primary-button"
                          aria-label={`${bookmark.displayTitle || bookmark.url} 복구`}
                          onClick={() => void handleBookmarkRestore(bookmark)}
                        >
                          복구
                        </button>
                        <div className="bookmark-card-secondary-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            aria-label={`${bookmark.displayTitle || bookmark.url} 상세 보기`}
                            onClick={() => void openBookmarkDetail(bookmark.id, bookmark, "dialog")}
                          >
                            상세
                          </button>
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
                          className="primary-button"
                          aria-label={`${bookmark.displayTitle || bookmark.url} 열기`}
                          onClick={() => void handleBookmarkOpen(bookmark)}
                        >
                          열기
                        </button>
                        <div className="bookmark-card-secondary-actions">
                          {shouldUseCompactMobileCards ? (
                            <button
                              type="button"
                              className="secondary-button"
                              aria-label={`${bookmark.displayTitle || bookmark.url} 상세 보기`}
                              onClick={() => void openBookmarkDetail(bookmark.id, bookmark, "dialog")}
                            >
                              상세
                            </button>
                          ) : (
                            <div className="folder-action-menu-shell bookmark-card-menu-shell">
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
                                  className="folder-action-menu"
                                >
                                  <button
                                    type="button"
                                    className="secondary-button folder-action-menu-item"
                                    onClick={() => void openBookmarkDetail(bookmark.id, bookmark, "dialog")}
                                  >
                                    상세 보기
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary-button folder-action-menu-item"
                                    onClick={() => beginBookmarkEdit(bookmark)}
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    className="danger-button folder-action-menu-item"
                                    onClick={() => void handleBookmarkDelete(bookmark)}
                                  >
                                    삭제
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </li>
              )})}
            </ul>
            </section>
            ) : null}
            {shouldShowDesktopRecommendationBoard ? recommendationSection : null}
          </div>
          {shouldShowDesktopReadingRail ? (
          <aside role="region" aria-label="bookmark-reading-rail" className="bookmark-reading-rail">
            <section aria-label="bookmark-detail-shell" className="bookmark-detail-region">
            {visibleSelectedBookmark && bookmarkDetailDisplayMode === "rail" ? (
              renderVisibleSelectedBookmarkDetail("목록")
            ) : isLoadingSelectedBookmark && bookmarkDetailDisplayMode === "rail" ? (
              <section className="surface-card panel-card bookmark-detail-placeholder">
                <p className="bookmark-detail-kicker">읽기 중심</p>
                <h2>북마크를 불러오는 중입니다</h2>
                <p className="muted-text">상세 내용을 준비하고 있습니다.</p>
              </section>
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
                {visibleSelectedBookmark ? (
                  renderVisibleSelectedBookmarkDetail("닫기")
                ) : (
                  <section className="surface-card panel-card bookmark-detail-placeholder">
                    <p className="bookmark-detail-kicker">읽기 중심</p>
                    <h2>북마크를 불러오는 중입니다</h2>
                    <p className="muted-text">상세 내용을 준비하고 있습니다.</p>
                  </section>
                )}
              </section>
            </div>
          ) : null}
          {shouldRenderBookmarkComposerOverlay ? (
            <div className="overlay-backdrop" onClick={() => requestCloseBookmarkComposer()}>
              <section
                role="dialog"
                aria-modal="true"
                aria-label="bookmark-composer-dialog"
                className="surface-card overlay-dialog-shell"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="overlay-dialog-header">
                  <div className="overlay-dialog-title">
                    <p className="workspace-panel-kicker">작성</p>
                    <h2>{editingBookmarkId ? "북마크 수정" : "새 북마크"}</h2>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => requestCloseBookmarkComposer()}
                  >
                    닫기
                  </button>
                </div>
                <div className="overlay-dialog-panel">
                  {renderDesktopSidebarPanel({
                    panelId: "compose",
                    heading: bookmarkPanelTitle,
                    summary: bookmarkPanelSummary,
                    kicker: bookmarkPanelKicker,
                    regionLabel: "bookmark-form",
                    children: (
                      <form className="stack-form bookmark-composer-form" onSubmit={(event) => void handleBookmarkSubmit(event)}>
                        <div className="bookmark-composer-grid">
                          <section className="bookmark-composer-section">
                            <div className="bookmark-composer-section-header">
                              <h3>기본 정보</h3>
                              <p>URL, 폴더, 제목을 먼저 정리합니다.</p>
                            </div>
                            <label>
                              URL
                              <input
                                name="url"
                                type="url"
                                value={bookmarkDraft.url}
                                onChange={(event) => handleBookmarkUrlChange(event.target.value)}
                                disabled={Boolean(editingBookmarkId)}
                                required
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => void handleBookmarkPreviewLoad()}
                              disabled={Boolean(editingBookmarkId) || isLoadingBookmarkPreview}
                            >
                              {isLoadingBookmarkPreview ? "불러오는 중..." : "URL 메타 불러오기"}
                            </button>
                            {bookmarkPreview ? (
                              <section aria-label="bookmark-preview" className="bookmark-preview-card">
                                <h3>자동 추출 미리보기</h3>
                                {bookmarkPreview.sourceTitle ? <p>{bookmarkPreview.sourceTitle}</p> : null}
                                {bookmarkPreview.sourceSummary ? <p>{bookmarkPreview.sourceSummary}</p> : null}
                                {bookmarkPreview.sourceContent ? <p>{bookmarkPreview.sourceContent}</p> : null}
                                <button
                                  type="button"
                                  className="ghost-button bookmark-preview-clear-button"
                                  onClick={() => handleClearBookmarkPreview()}
                                >
                                  자동 추출 초기화
                                </button>
                              </section>
                            ) : null}
                            <label>
                              저장 폴더
                              <select
                                name="folderId"
                                value={bookmarkDraft.folderId}
                                onChange={(event) => updateBookmarkDraft({ folderId: event.target.value })}
                              >
                                <option value="">폴더 없음</option>
                                {visibleFolderOptions.map(({ folder, label }) => (
                                  <option key={folder.id} value={folder.id}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {quickFolderCreateSection}
                            <label>
                              제목
                              <input
                                name="userTitle"
                                value={bookmarkDraft.userTitle}
                                onChange={(event) => updateBookmarkDraft({ userTitle: event.target.value })}
                              />
                            </label>
                          </section>

                          <section className="bookmark-composer-section">
                            <div className="bookmark-composer-section-header">
                              <h3>내용/요약</h3>
                              <p>읽기 전 핵심 설명을 정리합니다.</p>
                            </div>
                            <label>
                              내용
                              <textarea
                                name="userContent"
                                value={bookmarkDraft.userContent}
                                onChange={(event) => updateBookmarkDraft({ userContent: event.target.value })}
                              />
                            </label>
                            <label>
                              요약
                              <textarea
                                name="userSummary"
                                value={bookmarkDraft.userSummary}
                                onChange={(event) => updateBookmarkDraft({ userSummary: event.target.value })}
                              />
                            </label>
                          </section>

                          <section className="bookmark-composer-section bookmark-composer-disclosure">
                            <button
                              type="button"
                              className="ghost-button bookmark-composer-disclosure-trigger"
                              aria-label={
                                isBookmarkComposerClassificationOpen
                                  ? "분류와 상태 닫기"
                                  : "분류와 상태 열기"
                              }
                              aria-expanded={isBookmarkComposerClassificationOpen}
                              onClick={() =>
                                setIsBookmarkComposerClassificationOpen((currentValue) => !currentValue)
                              }
                            >
                              <span>분류와 상태</span>
                              <span aria-hidden="true">
                                {isBookmarkComposerClassificationOpen ? "닫기" : "열기"}
                              </span>
                            </button>
                            {isBookmarkComposerClassificationOpen ? (
                              <div className="bookmark-composer-disclosure-body">
                                <fieldset className="tag-fieldset">
                                  <legend>태그 선택</legend>
                                  {tags.length === 0 ? (
                                    <p className="quiet-empty-state">태그가 없습니다.</p>
                                  ) : null}
                                  <div className="pill-list">
                                    {tags.map((tag) => (
                                      <label key={tag.id} className="pill-option">
                                        <input
                                          type="checkbox"
                                          name="tagIds"
                                          value={tag.id}
                                          checked={bookmarkDraft.tagIds.includes(tag.id)}
                                          onChange={(event) => toggleBookmarkTag(tag.id, event.target.checked)}
                                        />
                                        {renderTagLabel(tag.name, tag.color, "tag-option-label")}
                                      </label>
                                    ))}
                                  </div>
                                </fieldset>
                                {quickTagCreateSection}
                                {renderCheckboxField({
                                  label: "즐겨찾기",
                                  inputProps: {
                                    name: "isFavorite",
                                    checked: bookmarkDraft.isFavorite,
                                    onChange: (event) =>
                                      updateBookmarkDraft({
                                        isFavorite: event.currentTarget.checked
                                      })
                                  }
                                })}
                                {renderCheckboxField({
                                  label: "숨김 북마크",
                                  inputProps: {
                                    name: "isHidden",
                                    checked: bookmarkDraft.isHidden,
                                    onChange: (event) =>
                                      updateBookmarkDraft({
                                        isHidden: event.currentTarget.checked
                                      })
                                  }
                                })}
                              </div>
                            ) : null}
                          </section>

                          <section className="bookmark-composer-section bookmark-composer-disclosure">
                            <button
                              type="button"
                              className="ghost-button bookmark-composer-disclosure-trigger"
                              aria-label={
                                isBookmarkComposerDisplayOpen
                                  ? "표시와 이미지 닫기"
                                  : "표시와 이미지 열기"
                              }
                              aria-expanded={isBookmarkComposerDisplayOpen}
                              onClick={() =>
                                setIsBookmarkComposerDisplayOpen((currentValue) => !currentValue)
                              }
                            >
                              <span>표시와 이미지</span>
                              <span aria-hidden="true">
                                {isBookmarkComposerDisplayOpen ? "닫기" : "열기"}
                              </span>
                            </button>
                            {isBookmarkComposerDisplayOpen ? (
                              <div className="bookmark-composer-disclosure-body">
                                {renderColorPicker("북마크 색상", bookmarkDraft.bookmarkColor, (value) =>
                                  updateBookmarkDraft({ bookmarkColor: value })
                                )}
                                {renderColorPicker("url 색상", bookmarkDraft.urlColor, (value) =>
                                  updateBookmarkDraft({ urlColor: value })
                                )}
                                {renderPendingAssetComposerSection(editingBookmarkId)}
                              </div>
                            ) : null}
                          </section>
                        </div>
                        <div className="action-row bookmark-composer-footer">
                          <button type="submit" className="primary-button" disabled={isSavingBookmark}>
                            {isSavingBookmark
                              ? editingBookmarkId
                                ? "수정 중..."
                                : "저장 중..."
                              : editingBookmarkId
                                ? "북마크 수정"
                                : "북마크 저장"}
                          </button>
                          {editingBookmarkId ? (
                            <button type="button" className="secondary-button" onClick={() => cancelBookmarkEdit()}>
                              수정 취소
                            </button>
                          ) : null}
                        </div>
                      </form>
                    )
                  })}
                </div>
              </section>
            </div>
          ) : null}
          {shouldRenderFolderManagerOverlay ? (
            <div className="overlay-backdrop" onClick={() => requestCloseFolderManager()}>
              <section
                role="dialog"
                aria-modal="true"
                aria-label="folder-manager-dialog"
                className="surface-card overlay-dialog-shell"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="overlay-dialog-header">
                  <div className="overlay-dialog-title">
                    <p className="workspace-panel-kicker">구조</p>
                    <h2>{editingFolderId ? "폴더 수정" : "폴더 관리"}</h2>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => requestCloseFolderManager()}
                  >
                    닫기
                  </button>
                </div>
                <div className="overlay-dialog-panel">
                  {renderDesktopSidebarPanel({
                    panelId: "folder",
                    heading: "폴더 관리",
                    summary: folderPanelSummary,
                    kicker: folderPanelKicker,
                    regionLabel: "folder-manager",
                    children: renderFolderManagerContent()
                  })}
                </div>
              </section>
            </div>
          ) : null}
          {shouldRenderTagManagerOverlay ? (
            <div className="overlay-backdrop" onClick={() => requestCloseTagManager()}>
              <section
                role="dialog"
                aria-modal="true"
                aria-label="tag-manager-dialog"
                className="surface-card overlay-dialog-shell"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="overlay-dialog-header">
                  <div className="overlay-dialog-title">
                    <p className="workspace-panel-kicker">분류</p>
                    <h2>{editingTagId ? "태그 수정" : "태그 관리"}</h2>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => requestCloseTagManager()}
                  >
                    닫기
                  </button>
                </div>
                <div className="overlay-dialog-panel">
                  {renderDesktopSidebarPanel({
                    panelId: "tag",
                    heading: "태그 관리",
                    summary: tagPanelSummary,
                    kicker: tagPanelKicker,
                    regionLabel: "tag-manager",
                    children: renderTagManagerContent()
                  })}
                </div>
              </section>
            </div>
          ) : null}
          {isExtensionTokenDialogOpen ? (
            <div className="overlay-backdrop" onClick={() => requestCloseExtensionTokenDialog()}>
              <section
                role="dialog"
                aria-modal="true"
                aria-label="extension-token-dialog"
                className="surface-card overlay-dialog-shell"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="overlay-dialog-header">
                  <div className="overlay-dialog-title">
                    <p className="workspace-panel-kicker">확장</p>
                    <h2>확장 토큰 관리</h2>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => requestCloseExtensionTokenDialog()}
                  >
                    닫기
                  </button>
                </div>
                <div className="overlay-dialog-panel extension-token-panel">
                  <section className="surface-card extension-token-create-card">
                    <div className="bookmark-composer-section-header">
                      <h3>새 토큰</h3>
                      <p>Chrome/Edge 확장에서 사용할 토큰을 발급합니다.</p>
                    </div>
                    <label>
                      토큰 이름
                      <input
                        name="extensionTokenLabel"
                        value={extensionTokenLabelDraft}
                        onChange={(event) => setExtensionTokenLabelDraft(event.target.value)}
                        placeholder="예: Chrome desktop"
                      />
                    </label>
                    <div className="action-row">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void handleExtensionTokenCreate()}
                      >
                        토큰 발급
                      </button>
                    </div>
                  </section>
                  {latestIssuedExtensionToken ? (
                    <section className="surface-card extension-token-secret-card">
                      <div className="bookmark-composer-section-header">
                        <h3>방금 발급한 토큰</h3>
                        <p>이 값은 지금만 다시 확인할 수 있습니다.</p>
                      </div>
                      <code>{latestIssuedExtensionToken}</code>
                    </section>
                  ) : null}
                  <section className="surface-card extension-token-list-card">
                    <div className="bookmark-composer-section-header">
                      <h3>발급된 토큰</h3>
                      <p>사용하지 않는 토큰은 바로 폐기할 수 있습니다.</p>
                    </div>
                    {extensionTokens.length > 0 ? (
                      <ul className="extension-token-list">
                        {extensionTokens.map((token) => (
                          <li key={token.id} className="extension-token-row">
                            <div className="extension-token-copy">
                              <strong>{token.label}</strong>
                              <span>{new Date(token.createdAt).toLocaleString("ko-KR")}</span>
                            </div>
                            <button
                              type="button"
                              className="ghost-button"
                              aria-label={`${token.label} 토큰 삭제`}
                              onClick={() => void handleExtensionTokenRevoke(token.id)}
                            >
                              삭제
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted-text">아직 발급한 확장 토큰이 없습니다.</p>
                    )}
                  </section>
                </div>
              </section>
            </div>
          ) : null}
          {isExtensionDownloadDialogOpen ? (
            <div className="overlay-backdrop" onClick={() => closeExtensionDownloadDialog()}>
              <section
                role="dialog"
                aria-modal="true"
                aria-label="extension-download-dialog"
                className="surface-card overlay-dialog-shell"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="overlay-dialog-header">
                  <div className="overlay-dialog-title">
                    <p className="workspace-panel-kicker">확장</p>
                    <h2>브라우저 확장 다운로드</h2>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => closeExtensionDownloadDialog()}
                  >
                    닫기
                  </button>
                </div>
                <div className="overlay-dialog-panel extension-download-panel">
                  <section className="surface-card extension-download-card">
                    <div className="bookmark-composer-section-header">
                      <h3>설치 파일</h3>
                      <p>Chrome 또는 Edge에서 직접 불러올 수 있는 압축 파일입니다.</p>
                    </div>
                    <a
                      className="primary-button extension-download-link"
                      href={EXTENSION_DOWNLOAD_PATH}
                      download
                    >
                      확장 다운로드 (.zip)
                    </a>
                  </section>
                  <section className="surface-card extension-download-card">
                    <div className="bookmark-composer-section-header">
                      <h3>설치 방법</h3>
                      <p>스토어 등록 전에는 개발자 모드에서 압축을 해제한 뒤 불러와야 합니다.</p>
                    </div>
                    <ol className="extension-download-steps">
                      <li>다운로드한 zip 파일을 압축 해제합니다.</li>
                      <li>
                        Chrome은 <code>chrome://extensions</code>, Edge는{" "}
                        <code>edge://extensions</code>로 이동합니다.
                      </li>
                      <li>개발자 모드를 켠 뒤 압축해제된 확장 프로그램 로드를 누릅니다.</li>
                      <li>압축을 푼 폴더를 선택하면 바로 사용할 수 있습니다.</li>
                    </ol>
                  </section>
                </div>
              </section>
            </div>
          ) : null}
          </div>
        </section>
      ) : null}
      {isInstallHelpDialogOpen ? (
        <div className="overlay-backdrop" onClick={() => setIsInstallHelpDialogOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="install-help-dialog"
            className="surface-card overlay-dialog-shell"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="overlay-dialog-header">
              <div className="overlay-dialog-title">
                <p className="workspace-panel-kicker">설치</p>
                <h2>모바일 앱 설치 방법</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsInstallHelpDialogOpen(false)}
              >
                닫기
              </button>
            </div>
            <div className="overlay-dialog-panel extension-download-panel">
              <section className="surface-card extension-download-card">
                <div className="bookmark-composer-section-header">
                  <h3>Android Chrome/Edge</h3>
                  <p>브라우저 메뉴에서 앱 설치 또는 홈 화면에 추가를 선택하면 됩니다.</p>
                </div>
                <ol className="extension-download-steps">
                  <li>상단 또는 하단의 브라우저 메뉴를 엽니다.</li>
                  <li>
                    <code>앱 설치</code>, <code>홈 화면에 추가</code>, <code>설치</code> 중 하나를 누릅니다.
                  </li>
                  <li>홈 화면에 생긴 Bookmark 아이콘으로 바로 실행합니다.</li>
                </ol>
              </section>
              <section className="surface-card extension-download-card">
                <div className="bookmark-composer-section-header">
                  <h3>iPhone / iPad Safari</h3>
                  <p>Safari에서는 공유 메뉴를 통해 설치형 웹앱으로 추가합니다.</p>
                </div>
                <ol className="extension-download-steps">
                  <li>Safari에서 현재 페이지를 연 상태로 하단 공유 버튼을 누릅니다.</li>
                  <li>
                    <code>홈 화면에 추가</code>를 선택합니다.
                  </li>
                  <li>이름을 확인하고 추가하면 앱처럼 실행할 수 있습니다.</li>
                </ol>
              </section>
            </div>
          </section>
        </div>
      ) : null}
      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  );
}
