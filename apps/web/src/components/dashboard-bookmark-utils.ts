import type {
  Bookmark,
  BookmarkCounts,
  BookmarkRelativeDateRange,
  BookmarkSearchMode,
  BookmarkSortMode,
  Folder
} from "@bookmark/shared";

import { colorPresets } from "../lib/folder-presets";
import type { FolderOverviewSpecialFilter } from "./FolderOverviewPanel";
import type {
  BookmarkDisplaySettings,
  BookmarkPageSize,
  BookmarkSearchDraft,
  BookmarkSearchSummaryItem,
  BookmarkViewMode
} from "./BookmarkResultsPanel";

export type BookmarkRecommendationsState = {
  favorites: Bookmark[];
  recent: Bookmark[];
  frequent: Bookmark[];
};

export type RecommendationKind = keyof BookmarkRecommendationsState;
export type FolderReorderPosition = "top" | "up" | "down" | "bottom";

export const DEFAULT_BOOKMARK_VIEW_MODE: BookmarkViewMode = "list";
export const DEFAULT_BOOKMARK_PAGE_SIZE: BookmarkPageSize = 20;
export const BOOKMARK_VIEW_SETTINGS_STORAGE_KEY = "bookmark-view-settings:v2";
export const EXTENSION_FOLDER_NAME = "확장";

export const emptyBookmarkSearchDraft: BookmarkSearchDraft = {
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

export const emptyBookmarkRecommendations: BookmarkRecommendationsState = {
  favorites: [],
  recent: [],
  frequent: []
};

export const bookmarkSearchModeOptions: Array<{ value: BookmarkSearchMode; label: string }> = [
  { value: "all", label: "전체" },
  { value: "title", label: "제목" },
  { value: "content", label: "내용" },
  { value: "folder", label: "폴더" }
];

export const bookmarkSortOptions: Array<{
  value: BookmarkSortMode;
  label: string;
  shortLabel: string;
}> = [
  { value: "created_desc", label: "날짜순으로 ↓", shortLabel: "날짜 ↓" },
  { value: "created_asc", label: "날짜순으로 ↑", shortLabel: "날짜 ↑" },
  { value: "opened_desc", label: "최근 열람순", shortLabel: "열람" },
  { value: "title_asc", label: "이름순으로 (A-Z)", shortLabel: "이름 A-Z" },
  { value: "title_desc", label: "이름순으로 (Z-A)", shortLabel: "이름 Z-A" },
  { value: "site_asc", label: "사이트 (A-Z)", shortLabel: "사이트 A-Z" },
  { value: "site_desc", label: "사이트 (Z-A)", shortLabel: "사이트 Z-A" }
];

export const bookmarkViewModeOptions: Array<{
  value: BookmarkViewMode;
  label: string;
  icon: string;
}> = [
  { value: "list", label: "리스트", icon: "☷" },
  { value: "card", label: "카드", icon: "▦" },
  { value: "title", label: "제목", icon: "☰" },
  { value: "moodboard", label: "무드보드", icon: "▧" }
];

export const bookmarkPageSizeOptions: BookmarkPageSize[] = [20, 50, 100];

export const defaultBookmarkCardDisplaySettings: BookmarkDisplaySettings = {
  coverImage: true,
  title: true,
  description: true,
  tags: true,
  bookmarkInfo: true,
  coverSize: 132
};

export const defaultBookmarkListDisplaySettings: BookmarkDisplaySettings = {
  coverImage: true,
  title: true,
  description: false,
  tags: true,
  bookmarkInfo: true,
  coverSize: 132
};

export function normalizeBookmarkSearchDraft(search: BookmarkSearchDraft): BookmarkSearchDraft {
  const folderId = search.folderId.trim();
  return {
    query: search.query.trim(),
    mode: search.mode,
    sort: search.sort,
    createdWithin: search.createdWithin,
    openedWithin: search.openedWithin,
    favoriteOnly: search.favoriteOnly,
    folderId,
    includeDescendantFolders: folderId ? search.includeDescendantFolders : false,
    tagIds: Array.from(new Set(search.tagIds.map((tagId) => tagId.trim()).filter(Boolean))),
    tagMode: search.tagMode === "or" ? "or" : "and",
    bookmarkColor: search.bookmarkColor.trim(),
    urlColor: search.urlColor.trim(),
    summaryState: search.summaryState
  };
}

export function hasActiveBookmarkAdvancedFilters(search: BookmarkSearchDraft) {
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

export function hasActiveBookmarkSearch(search: BookmarkSearchDraft) {
  const normalizedSearch = normalizeBookmarkSearchDraft(search);
  return Boolean(
    normalizedSearch.query ||
      normalizedSearch.sort !== "created_desc" ||
      hasActiveBookmarkAdvancedFilters(normalizedSearch)
  );
}

export function canResolveFolderOverviewSearchLocally(search: BookmarkSearchDraft) {
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

export function filterBookmarksForFolderOverviewSearch(
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

export function getFolderDescendantIds(folders: Folder[], rootFolderId: string) {
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

function isExtensionFolder(folder: Folder) {
  return folder.name.trim() === EXTENSION_FOLDER_NAME;
}

export function getExtensionFolderIds(folders: Folder[]) {
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

export function isBookmarkUnfiled(bookmark: Bookmark, extensionFolderIds: Set<string>) {
  return !bookmark.folderId || extensionFolderIds.has(bookmark.folderId);
}

export function upsertBookmarkById(bookmarks: Bookmark[], nextBookmark: Bookmark) {
  return bookmarks.some((bookmark) => bookmark.id === nextBookmark.id)
    ? bookmarks.map((bookmark) => (bookmark.id === nextBookmark.id ? nextBookmark : bookmark))
    : [nextBookmark, ...bookmarks];
}

export function filterBookmarksForFolderOverviewSpecialFilter(
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

export function getBookmarkSearchModeLabel(mode: BookmarkSearchMode) {
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

export function getColorPresetLabel(color: string | null | undefined) {
  if (!color) {
    return null;
  }

  const normalizedColor = color.toLowerCase();
  return colorPresets.find((preset) => preset.value.toLowerCase() === normalizedColor)?.label ?? color;
}

export function getBookmarkSortLabel(sort: BookmarkSortMode) {
  return bookmarkSortOptions.find((option) => option.value === sort)?.label ?? "날짜순으로 ↓";
}

export function clampBookmarkCoverSize(value: number) {
  if (!Number.isFinite(value)) {
    return defaultBookmarkCardDisplaySettings.coverSize;
  }

  return Math.min(220, Math.max(80, Math.round(value)));
}

export function isBookmarkViewMode(value: unknown): value is BookmarkViewMode {
  return bookmarkViewModeOptions.some((option) => option.value === value);
}

export function normalizeBookmarkDisplaySettings(
  parsedSettings: Partial<BookmarkDisplaySettings> | undefined,
  defaultSettings: BookmarkDisplaySettings
): BookmarkDisplaySettings {
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

export function loadStoredBookmarkViewSettings() {
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
      list?: Partial<BookmarkDisplaySettings>;
      card?: Partial<BookmarkDisplaySettings>;
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

export function getBookmarkRelativeDateRangeValue(range: BookmarkRelativeDateRange) {
  switch (range) {
    case "7d":
      return "최근 7일";
    case "30d":
      return "최근 30일";
    default:
      return null;
  }
}

export function getBookmarkSearchSummaryItems(
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
    push(`query:${normalizedSearch.query}`, "검색어", normalizedSearch.query, (currentSearch) => ({
      ...currentSearch,
      query: ""
    }));
    if (normalizedSearch.mode !== "all") {
      push(`mode:${normalizedSearch.mode}`, "검색", getBookmarkSearchModeLabel(normalizedSearch.mode), (currentSearch) => ({
        ...currentSearch,
        mode: "all"
      }));
    }
  }

  if (normalizedSearch.sort !== "created_desc") {
    push(`sort:${normalizedSearch.sort}`, "정렬", getBookmarkSortLabel(normalizedSearch.sort), (currentSearch) => ({
      ...currentSearch,
      sort: "created_desc"
    }));
  }

  const createdWithinValue = getBookmarkRelativeDateRangeValue(normalizedSearch.createdWithin);
  if (createdWithinValue) {
    push(`createdWithin:${normalizedSearch.createdWithin}`, "기간", `최근 추가 ${createdWithinValue}`, (currentSearch) => ({
      ...currentSearch,
      createdWithin: "all"
    }));
  }

  const openedWithinValue = getBookmarkRelativeDateRangeValue(normalizedSearch.openedWithin);
  if (openedWithinValue) {
    push(`openedWithin:${normalizedSearch.openedWithin}`, "기간", `최근 열람 ${openedWithinValue}`, (currentSearch) => ({
      ...currentSearch,
      openedWithin: "all"
    }));
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
      push(`tag:${tagId}`, "분류", `태그 ${tagNames[index] ?? tagId}`, (currentSearch) => {
        const nextTagIds = currentSearch.tagIds.filter((currentTagId) => currentTagId !== tagId);

        return {
          ...currentSearch,
          tagIds: nextTagIds,
          tagMode: nextTagIds.length === 0 ? "and" : currentSearch.tagMode
        };
      });
    });

    if (normalizedSearch.tagMode !== "and") {
      push("tagMode", "분류", "하나라도 포함", (currentSearch) => ({
        ...currentSearch,
        tagMode: "and"
      }));
    }
  }

  if (normalizedSearch.bookmarkColor) {
    push(`bookmarkColor:${normalizedSearch.bookmarkColor}`, "상태", `북마크 ${getColorPresetLabel(normalizedSearch.bookmarkColor)}`, (currentSearch) => ({
      ...currentSearch,
      bookmarkColor: ""
    }));
  }

  if (normalizedSearch.urlColor) {
    push(`urlColor:${normalizedSearch.urlColor}`, "상태", `URL ${getColorPresetLabel(normalizedSearch.urlColor)}`, (currentSearch) => ({
      ...currentSearch,
      urlColor: ""
    }));
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

export function getHiddenFolderIds(folders: Folder[]) {
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

export function filterBookmarksByHiddenFolders(
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

export function filterRecommendationsByHiddenFolders(
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

export function filterBookmarksByHiddenBookmarks(
  bookmarks: Bookmark[],
  showHiddenBookmarks: boolean
) {
  if (showHiddenBookmarks) {
    return bookmarks;
  }

  return bookmarks.filter((bookmark) => bookmark.isHidden !== true);
}

export function filterRecommendationsByHiddenBookmarks(
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

export function isBookmarkVisibleUnderHiddenRules(
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

export function getHierarchicalFolderOptions(
  folders: Folder[],
  excludedFolderIds = new Set<string>()
) {
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

export function getFoldersByParentId(folders: Folder[], excludedFolderIds = new Set<string>()) {
  const foldersByParentId = new Map<string | null, Folder[]>();
  const knownFolderIds = new Set(folders.map((folder) => folder.id));
  const sortedFolders = [...folders].sort(
    (leftFolder, rightFolder) =>
      leftFolder.sortOrder - rightFolder.sortOrder ||
      leftFolder.name.localeCompare(rightFolder.name)
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

export function getFolderAncestorIds(folders: Folder[], folderId: string) {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const ancestors: string[] = [];
  let currentFolder = foldersById.get(folderId) ?? null;

  while (currentFolder?.parentFolderId) {
    ancestors.push(currentFolder.parentFolderId);
    currentFolder = foldersById.get(currentFolder.parentFolderId) ?? null;
  }

  return ancestors;
}

export function getFolderVisibleIdsForQuery(folders: Folder[], query: string) {
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

export function getBookmarkCountBucketValue(
  bucket: { total: number; visible: number } | undefined,
  showHiddenBookmarks: boolean
) {
  if (!bucket) {
    return 0;
  }

  return showHiddenBookmarks ? bucket.total : bucket.visible;
}

export function countVisibleActiveBookmarksFromCounts(
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

export function countUnfiledBookmarksFromCounts(
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

export function getSiblingFolders(folders: Folder[], parentFolderId: string | null) {
  return folders
    .filter((folder) => folder.parentFolderId === parentFolderId)
    .sort(
      (leftFolder, rightFolder) =>
        leftFolder.sortOrder - rightFolder.sortOrder ||
        leftFolder.name.localeCompare(rightFolder.name)
    );
}

export function reorderSiblingFolders(
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

export function moveFolderToSiblingPosition(
  siblingFolders: Folder[],
  folderId: string,
  position: FolderReorderPosition
) {
  const currentIndex = siblingFolders.findIndex((folder) => folder.id === folderId);

  if (currentIndex === -1) {
    return siblingFolders;
  }

  const lastIndex = siblingFolders.length - 1;
  const targetIndex =
    position === "top"
      ? 0
      : position === "up"
        ? Math.max(0, currentIndex - 1)
        : position === "down"
          ? Math.min(lastIndex, currentIndex + 1)
          : lastIndex;

  if (targetIndex === currentIndex) {
    return siblingFolders;
  }

  const nextFolders = [...siblingFolders];
  const [folder] = nextFolders.splice(currentIndex, 1);
  nextFolders.splice(targetIndex, 0, folder);
  return nextFolders;
}
