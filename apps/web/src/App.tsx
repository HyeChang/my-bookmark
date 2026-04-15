import { startTransition, useEffect, useState, type FormEvent, type ReactNode } from "react";
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
  loadBookmarks,
  reextractBookmark,
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
import { folderColorPresets, folderIconPresets } from "./lib/folder-presets";
import { loadRecommendations, recordBookmarkOpen } from "./lib/recommendations";
import { exchangeIdTokenForSession, loadSession, logoutSession } from "./lib/session";
import { createTag, deleteTag, loadTags, updateTag } from "./lib/tags";

type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthenticatedUser };

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
};

type FolderDraft = {
  name: string;
  color: string;
  icon: string;
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
type MobileSidebarPanelId = "bookmark" | "folder" | "tag";

type BookmarkSearchSummaryItem = {
  key: string;
  groupLabel: string;
  valueLabel: string;
  nextSearch: BookmarkSearchDraft;
};

const emptyBookmarkDraft: BookmarkDraft = {
  url: "",
  folderId: "",
  tagIds: [],
  bookmarkColor: "",
  urlColor: "",
  userTitle: "",
  userContent: "",
  userSummary: "",
  isFavorite: false
};

const emptyFolderDraft: FolderDraft = {
  name: "",
  color: "",
  icon: "",
  parentFolderId: ""
};

const emptyTagDraft: TagDraft = {
  name: "",
  color: ""
};

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

const MOBILE_SEARCH_BREAKPOINT = 720;

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

function getBookmarkSearchModeLabel(mode: BookmarkSearchMode) {
  switch (mode) {
    case "title":
      return "제목 검색";
    case "content":
      return "내용 검색";
    case "folder":
      return "폴더명 검색";
    default:
      return "통합 검색";
  }
}

function getBookmarkSortLabel(sort: BookmarkSortMode) {
  return sort === "opened_desc" ? "최근 열람순" : "최근 추가순";
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

function getBookmarkSummaryStateLabel(bookmark: Bookmark) {
  if (hasTextContent(bookmark.userSummary)) {
    return "수동 요약";
  }

  if (hasTextContent(bookmark.sourceSummary)) {
    return "자동 요약";
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
      `북마크 색상 ${normalizedSearch.bookmarkColor}`,
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
      `URL 색상 ${normalizedSearch.urlColor}`,
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

function getHierarchicalFolderOptions(folders: Folder[], excludedFolderIds = new Set<string>()) {
  const foldersByParentId = new Map<string | null, Folder[]>();
  const knownFolderIds = new Set(folders.map((folder) => folder.id));
  const sortedFolders = [...folders].sort(
    (leftFolder, rightFolder) =>
      leftFolder.sortOrder - rightFolder.sortOrder || leftFolder.name.localeCompare(rightFolder.name)
  );

  for (const folder of sortedFolders) {
    const parentKey =
      folder.parentFolderId && knownFolderIds.has(folder.parentFolderId)
        ? folder.parentFolderId
        : null;
    const currentFolders = foldersByParentId.get(parentKey) ?? [];
    currentFolders.push(folder);
    foldersByParentId.set(parentKey, currentFolders);
  }

  const options: Array<{ folder: Folder; label: string }> = [];

  function visit(parentFolderId: string | null, depth: number) {
    for (const folder of foldersByParentId.get(parentFolderId) ?? []) {
      if (excludedFolderIds.has(folder.id)) {
        continue;
      }

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

function renderFolderColorPicker(
  selectedColor: string,
  onSelect: (value: string) => void
) {
  return (
    <fieldset className="picker-fieldset">
      <legend>폴더 색상</legend>
      <div className="picker-grid">
        <button
          type="button"
          className={`picker-chip${selectedColor ? "" : " picker-chip-active"}`}
          aria-label="폴더 색상 선택 안 함"
          aria-pressed={!selectedColor}
          onClick={() => onSelect("")}
        >
          선택 안 함
        </button>
        {folderColorPresets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`picker-chip${selectedColor === preset.value ? " picker-chip-active" : ""}`}
            aria-label={`폴더 색상 ${preset.label} 선택`}
            aria-pressed={selectedColor === preset.value}
            onClick={() => onSelect(preset.value)}
          >
            <span
              className="picker-color-swatch"
              style={{ backgroundColor: preset.value }}
              aria-hidden="true"
            />
            {preset.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function renderFolderIconPicker(
  selectedIcon: string,
  onSelect: (value: string) => void
) {
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
          선택 안 함
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
            {preset.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function App() {
  const [sessionState, setSessionState] = useState<SessionState>({
    status: "loading"
  });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
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
  const [isBookmarkComposerOpen, setIsBookmarkComposerOpen] = useState(false);
  const [isBookmarkComposerClassificationOpen, setIsBookmarkComposerClassificationOpen] = useState(false);
  const [isBookmarkComposerDisplayOpen, setIsBookmarkComposerDisplayOpen] = useState(false);
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [pendingAssetFiles, setPendingAssetFiles] = useState<File[]>([]);
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
  const [mobileSidebarPanel, setMobileSidebarPanel] = useState<MobileSidebarPanelId>("bookmark");
  const [folderDraft, setFolderDraft] = useState<FolderDraft>(emptyFolderDraft);
  const [quickFolderDraft, setQuickFolderDraft] = useState<FolderDraft>(emptyFolderDraft);
  const [tagDraft, setTagDraft] = useState<TagDraft>(emptyTagDraft);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<string | null>(null);
  const [openBookmarkActionMenuId, setOpenBookmarkActionMenuId] = useState<string | null>(null);
  const [isBookmarkDetailActionMenuOpen, setIsBookmarkDetailActionMenuOpen] = useState(false);
  const [openFolderActionMenuId, setOpenFolderActionMenuId] = useState<string | null>(null);
  const [openTagActionMenuId, setOpenTagActionMenuId] = useState<string | null>(null);
  const [isQuickFolderOpen, setIsQuickFolderOpen] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);
  const [isLoadingBookmarkPreview, setIsLoadingBookmarkPreview] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isSavingQuickFolder, setIsSavingQuickFolder] = useState(false);
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [isReorderingFolders, setIsReorderingFolders] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refreshDashboardData(search = appliedBookmarkSearch) {
    setIsLoadingDashboard(true);

    try {
      const [nextBookmarks, nextFolders, nextTags, nextRecommendations] = await Promise.all([
        loadBookmarks(search),
        loadFolders(),
        loadTags(),
        loadRecommendations()
      ]);

      startTransition(() => {
        setBookmarks(nextBookmarks);
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
    } catch {
      startTransition(() => {
        setBookmarks([]);
        setSelectedBookmark(null);
        setFolders([]);
        setTags([]);
        setRecommendations(emptyBookmarkRecommendations);
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

  async function handleGoogleLogin() {
    try {
      setErrorMessage(null);
      const idToken = await signInWithGoogle();
      const user = await exchangeIdTokenForSession(idToken);
      const [nextBookmarks, nextFolders, nextTags, nextRecommendations] = await Promise.all([
        loadBookmarks(appliedBookmarkSearch).catch(() => []),
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
        setSelectedBookmark(null);
        setFolders(nextFolders);
        setTags(nextTags);
        setRecommendations(nextRecommendations);
      });
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
      setSelectedBookmark(null);
      setBookmarkAssetsByBookmarkId({});
      setFolders([]);
      setTags([]);
      setRecommendations(emptyBookmarkRecommendations);
      setBookmarkDraft(emptyBookmarkDraft);
      setBookmarkPreview(null);
      setPendingAssetFiles([]);
      setBookmarkSearchDraft(emptyBookmarkSearchDraft);
      setAppliedBookmarkSearch(emptyBookmarkSearchDraft);
      setFolderDraft(emptyFolderDraft);
      setQuickFolderDraft(emptyFolderDraft);
      setTagDraft(emptyTagDraft);
      setIsQuickFolderOpen(false);
    });
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
          isFavorite: bookmarkDraft.isFavorite,
          bookmarkColor: bookmarkDraft.bookmarkColor || null,
          urlColor: bookmarkDraft.urlColor || null
        });
        const uploadedAssets = await uploadPendingAssets(editingBookmarkId);

        if (hasActiveBookmarkSearch(appliedBookmarkSearch)) {
          const nextBookmarks = await loadBookmarks(appliedBookmarkSearch);

          startTransition(() => {
            setBookmarks(nextBookmarks);
            setSelectedBookmark((currentSelectedBookmark) =>
              currentSelectedBookmark?.id === updatedBookmark.id
                ? updatedBookmark
                : currentSelectedBookmark
            );
            setBookmarkDraft(emptyBookmarkDraft);
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
            setIsBookmarkComposerOpen(false);
          });
        } else {
          startTransition(() => {
            setBookmarks((currentBookmarks) =>
              currentBookmarks.map((bookmark) =>
                bookmark.id === updatedBookmark.id ? updatedBookmark : bookmark
              )
            );
            setSelectedBookmark((currentSelectedBookmark) =>
              currentSelectedBookmark?.id === updatedBookmark.id
                ? updatedBookmark
                : currentSelectedBookmark
            );
            setBookmarkDraft(emptyBookmarkDraft);
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
          bookmarkColor: bookmarkDraft.bookmarkColor || null,
          urlColor: bookmarkDraft.urlColor || null
        };
        const createdBookmark = await createBookmark(payload);
        const uploadedAssets = await uploadPendingAssets(createdBookmark.id);

        if (hasActiveBookmarkSearch(appliedBookmarkSearch)) {
          const nextBookmarks = await loadBookmarks(appliedBookmarkSearch);

          startTransition(() => {
            setBookmarks(nextBookmarks);
            setBookmarkDraft(emptyBookmarkDraft);
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
            setIsBookmarkComposerOpen(false);
          });
        } else {
          startTransition(() => {
            setBookmarks((currentBookmarks) => [createdBookmark, ...currentBookmarks]);
            setBookmarkDraft(emptyBookmarkDraft);
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
          parentFolderId: folderDraft.parentFolderId || null
        });

        startTransition(() => {
          replaceFolderState(nextFolder);
          setEditingFolderId(null);
          setFolderDraft(emptyFolderDraft);
        });
      } else {
        const createdFolder = await createFolder({
          name: folderDraft.name,
          color: folderDraft.color || null,
          icon: folderDraft.icon || null,
          parentFolderId: folderDraft.parentFolderId || null
        });

        startTransition(() => {
          setFolders((currentFolders) => [...currentFolders, createdFolder]);
          setFolderDraft(emptyFolderDraft);
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
        });
      } else {
        const createdTag = await createTag({
          name: tagDraft.name,
          color: tagDraft.color || null
        });

        startTransition(() => {
          setTags((currentTags) => [...currentTags, createdTag]);
          setTagDraft(emptyTagDraft);
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

  function updateTagDraft(nextValues: Partial<TagDraft>) {
    setTagDraft((currentDraft) => ({
      ...currentDraft,
      ...nextValues
    }));
  }

  function openFolderManager() {
    setErrorMessage(null);
    setEditingFolderId(null);
    setFolderDraft(emptyFolderDraft);
    setDraggingFolderId(null);
    setOpenFolderActionMenuId(null);
    setIsFolderManagerOpen(true);
  }

  function beginFolderEdit(folder: Folder) {
    setIsFolderManagerOpen(true);
    setOpenFolderActionMenuId(null);
    setEditingFolderId(folder.id);
    setFolderDraft({
      name: folder.name,
      color: folder.color ?? "",
      icon: folder.icon ?? "",
      parentFolderId: folder.parentFolderId ?? ""
    });
  }

  function cancelFolderEdit() {
    setEditingFolderId(null);
    setFolderDraft(emptyFolderDraft);
  }

  function closeFolderManager() {
    cancelFolderEdit();
    setDraggingFolderId(null);
    setOpenFolderActionMenuId(null);
    setIsFolderManagerOpen(false);
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
    setErrorMessage(null);
    setEditingTagId(null);
    setOpenTagActionMenuId(null);
    setTagDraft(emptyTagDraft);
    setIsTagManagerOpen(true);
  }

  function beginTagEdit(tag: Tag) {
    setIsTagManagerOpen(true);
    setOpenTagActionMenuId(null);
    setEditingTagId(tag.id);
    setTagDraft({
      name: tag.name,
      color: tag.color ?? ""
    });
  }

  function cancelTagEdit() {
    setEditingTagId(null);
    setOpenTagActionMenuId(null);
    setTagDraft(emptyTagDraft);
  }

  function closeTagManager() {
    cancelTagEdit();
    setIsTagManagerOpen(false);
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
    const normalizedSearch = normalizeBookmarkSearchDraft(nextSearchDraft);

    try {
      setErrorMessage(null);
      setIsLoadingDashboard(true);
      const nextBookmarks = await loadBookmarks(normalizedSearch);

      startTransition(() => {
        setBookmarks(nextBookmarks);
        setSelectedBookmark(null);
        setBookmarkSearchDraft(normalizedSearch);
        setAppliedBookmarkSearch(normalizedSearch);
      });
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

  async function handleBookmarkSearchReset() {
    await applyBookmarkSearch(emptyBookmarkSearchDraft);
  }

  async function beginBookmarkEdit(bookmark: Bookmark) {
    setOpenBookmarkActionMenuId(null);
    setIsBookmarkDetailActionMenuOpen(false);
    setIsBookmarkComposerOpen(true);
    setIsBookmarkComposerClassificationOpen(bookmark.tagIds.length > 0 || bookmark.isFavorite);
    setIsBookmarkComposerDisplayOpen(
      Boolean(
        bookmark.bookmarkColor ||
          bookmark.urlColor ||
          (bookmarkAssetsByBookmarkId[bookmark.id]?.length ?? 0) > 0
      )
    );
    setEditingBookmarkId(bookmark.id);
    setBookmarkDraft({
      url: bookmark.url,
      folderId: bookmark.folderId ?? "",
      tagIds: bookmark.tagIds,
      bookmarkColor: bookmark.bookmarkColor ?? "",
      urlColor: bookmark.urlColor ?? "",
      userTitle: bookmark.userTitle ?? "",
      userContent: bookmark.userContent ?? "",
      userSummary: bookmark.userSummary ?? "",
      isFavorite: bookmark.isFavorite
    });
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

  function cancelBookmarkEdit() {
    setEditingBookmarkId(null);
    setIsBookmarkComposerClassificationOpen(false);
    setIsBookmarkComposerDisplayOpen(false);
    setBookmarkDraft(emptyBookmarkDraft);
    setBookmarkPreview(null);
    setPendingAssetFiles([]);
    setIsQuickFolderOpen(false);
    setQuickFolderDraft(emptyFolderDraft);
    setIsBookmarkComposerOpen(false);
  }

  function beginBookmarkCreate() {
    setErrorMessage(null);
    setOpenBookmarkActionMenuId(null);
    setIsBookmarkDetailActionMenuOpen(false);
    setEditingBookmarkId(null);
    setIsBookmarkComposerClassificationOpen(false);
    setIsBookmarkComposerDisplayOpen(false);
    setBookmarkDraft(emptyBookmarkDraft);
    setBookmarkPreview(null);
    setPendingAssetFiles([]);
    setIsQuickFolderOpen(false);
    setQuickFolderDraft(emptyFolderDraft);
    setIsBookmarkComposerOpen(true);
  }

  async function openBookmarkDetail(bookmarkId: string) {
    try {
      setErrorMessage(null);
      setOpenBookmarkActionMenuId(null);
      setIsBookmarkDetailActionMenuOpen(false);
      const [bookmark, assets] = await Promise.all([
        loadBookmark(bookmarkId),
        loadBookmarkAssets(bookmarkId)
      ]);

      startTransition(() => {
        setSelectedBookmark(bookmark);
        setBookmarkAssetsByBookmarkId((currentAssetsByBookmarkId) => ({
          ...currentAssetsByBookmarkId,
          [bookmarkId]: assets
        }));
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "북마크 상세 정보를 불러오지 못했습니다."
        );
      });
    }
  }

  function closeBookmarkDetail() {
    setIsBookmarkDetailActionMenuOpen(false);
    setSelectedBookmark(null);
  }

  function removeBookmarkState(bookmarkId: string) {
    setBookmarks((currentBookmarks) =>
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
    setSelectedBookmark((currentSelectedBookmark) =>
      currentSelectedBookmark?.id === nextBookmark.id ? nextBookmark : currentSelectedBookmark
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
      startTransition(() => {
        removeBookmarkState(bookmark.id);
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
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "사용자 입력값을 초기화하지 못했습니다."
        );
      });
    }
  }

  function getFolderName(folderId: string | null) {
    if (!folderId) {
      return "폴더 없음";
    }

    return folders.find((folder) => folder.id === folderId)?.name ?? folderId;
  }

  function getTagNames(tagIds: string[]) {
    return tagIds.map((tagId) => tags.find((tag) => tag.id === tagId)?.name ?? tagId);
  }

  const shouldShowAdvancedBookmarkSearch =
    isAdvancedBookmarkSearchOpen ||
    hasActiveBookmarkAdvancedFilters(bookmarkSearchDraft) ||
    hasActiveBookmarkAdvancedFilters(appliedBookmarkSearch);
  const shouldUseCompactMobileCards = isMobileSearchViewport;
  const shouldUseMobileSidebarPanels = isMobileSearchViewport;
  const shouldRenderDesktopBookmarkComposer =
    !shouldUseMobileSidebarPanels && isBookmarkComposerOpen;
  const shouldRenderDesktopFolderManager =
    !shouldUseMobileSidebarPanels && isFolderManagerOpen;
  const shouldRenderDesktopTagManager = !shouldUseMobileSidebarPanels && isTagManagerOpen;
  const shouldShowMobileSearchSummary = isMobileSearchViewport && hasActiveBookmarkSearch(appliedBookmarkSearch);
  const shouldShowSearchPanelBody = !isMobileSearchViewport || isMobileSearchPanelOpen;
  const activeBookmarkSearchSummaryItems = getBookmarkSearchSummaryItems(
    appliedBookmarkSearch,
    {
      getFolderName,
      getTagNames
    }
  );
  const disallowedParentFolderIds = editingFolderId
    ? new Set([editingFolderId, ...getFolderDescendantIds(folders, editingFolderId)])
    : new Set<string>();
  const parentFolderOptions = getHierarchicalFolderOptions(folders, disallowedParentFolderIds);
  const visibleFolderOptions = getHierarchicalFolderOptions(folders);
  const quickFolderParentOptions = getHierarchicalFolderOptions(folders);
  const selectedBookmarkUserDetailRows = selectedBookmark
    ? getBookmarkDetailFieldRows(selectedBookmark, "user")
    : [];
  const selectedBookmarkSourceDetailRows = selectedBookmark
    ? getBookmarkDetailFieldRows(selectedBookmark, "source")
    : [];
  const selectedBookmarkAssetCount = selectedBookmark
    ? bookmarkAssetsByBookmarkId[selectedBookmark.id]?.length ?? 0
    : 0;
  const selectedBookmarkTagNames = selectedBookmark ? getTagNames(selectedBookmark.tagIds) : [];
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
    pendingAssetFiles.length > 0;
  const bookmarkPanelSummary = editingBookmarkId
    ? "수정 중"
    : hasActiveBookmarkDraft
      ? "작성 중"
      : "새 북마크";
  const folderPanelSummary = editingFolderId
    ? `수정 중 · 폴더 ${folders.length}개`
    : `폴더 ${folders.length}개`;
  const tagPanelSummary = editingTagId
    ? `수정 중 · 태그 ${tags.length}개`
    : `태그 ${tags.length}개`;
  const bookmarkPanelKicker = "작성 흐름";
  const folderPanelKicker = "구조 정리";
  const tagPanelKicker = "분류 체계";
  const quickFolderCreateSection = (
    <div className="inline-folder-create">
      <button
        type="button"
        className="secondary-button"
        onClick={() => setIsQuickFolderOpen((currentValue) => !currentValue)}
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
    panelId: MobileSidebarPanelId;
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

    if (!shouldUseMobileSidebarPanels) {
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

    return null;
  }

  function renderDesktopSidebarPanel(options: {
    panelId: MobileSidebarPanelId;
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
    return (
      <div className="manager-workspace">
        <section className="manager-surface manager-editor-surface">
          <div className="manager-section-header">
            <p className="manager-section-kicker">입력 설정</p>
            <div>
              <h3>{editingFolderId ? "폴더 수정" : "새 폴더 만들기"}</h3>
              <p>{editingFolderId ? "선택한 폴더의 구조와 표시 정보를 다듬습니다." : "새 폴더를 만들고 트리에 바로 추가합니다."}</p>
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
              <button type="submit" className="primary-button" disabled={isSavingFolder}>
                {isSavingFolder
                  ? editingFolderId
                    ? "수정 중..."
                    : "추가 중..."
                  : editingFolderId
                    ? "폴더 수정"
                    : "폴더 추가"}
              </button>
              {editingFolderId ? (
                <button type="button" className="secondary-button" onClick={() => cancelFolderEdit()}>
                  수정 취소
                </button>
              ) : null}
            </div>
          </form>
        </section>
        <section className="manager-surface manager-list-surface">
          <div className="manager-section-header">
            <p className="manager-section-kicker">현재 폴더</p>
            <div>
              <h3>트리와 이동</h3>
              <p>정렬, 하위 이동, 루트 이동을 같은 구조 안에서 관리합니다.</p>
            </div>
          </div>
          <button
            type="button"
            className="dropzone-button manager-dropzone"
            disabled={isReorderingFolders}
            aria-label="최상위로 이동"
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
            최상위로 이동
          </button>
          <ul className="folder-tree">
            {visibleFolderOptions.map(({ folder, label }) => (
              <li
                key={folder.id}
                className={`folder-tree-item${folder.parentFolderId ? " folder-tree-item-child" : ""}`}
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
                <div className="folder-tree-row">
                  <div className="folder-tree-summary">
                    <strong>{label}</strong>
                    {folder.parentFolderId ? (
                      <div className="folder-tree-meta">
                        <p>하위 폴더</p>
                        <p>상위: {getFolderName(folder.parentFolderId)}</p>
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
                      하위로 이동
                    </button>
                    <div className="folder-action-menu-shell">
                      <button
                        type="button"
                        className="ghost-button folder-action-trigger"
                        aria-label={`${folder.name} 폴더 더보기`}
                        aria-expanded={openFolderActionMenuId === folder.id}
                        onClick={() => toggleFolderActionMenu(folder.id)}
                      >
                        더보기
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
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  function renderTagManagerContent() {
    return (
      <div className="manager-workspace">
        <section className="manager-surface manager-editor-surface">
          <div className="manager-section-header">
            <p className="manager-section-kicker">입력 설정</p>
            <div>
              <h3>{editingTagId ? "태그 수정" : "새 태그 만들기"}</h3>
              <p>{editingTagId ? "선택한 태그의 이름과 색을 다듬습니다." : "분류에 바로 쓸 태그를 짧게 추가합니다."}</p>
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
            <label>
              태그 색상
              <input
                name="tagColor"
                value={tagDraft.color}
                onChange={(event) => updateTagDraft({ color: event.target.value })}
              />
            </label>
            <div className="action-row">
              <button type="submit" className="primary-button" disabled={isSavingTag}>
                {isSavingTag
                  ? editingTagId
                    ? "수정 중..."
                    : "추가 중..."
                  : editingTagId
                    ? "태그 수정"
                    : "태그 추가"}
              </button>
              {editingTagId ? (
                <button type="button" className="secondary-button" onClick={() => cancelTagEdit()}>
                  수정 취소
                </button>
              ) : null}
            </div>
          </form>
        </section>
        <section className="manager-surface manager-list-surface">
          <div className="manager-section-header">
            <p className="manager-section-kicker">현재 태그</p>
            <div>
              <h3>분류 목록</h3>
              <p>현재 쓰는 태그를 훑고 필요한 항목만 빠르게 수정합니다.</p>
            </div>
          </div>
          <ul className="tag-list">
            {tags.map((tag) => (
              <li key={tag.id} className="tag-list-item">
                <span>{tag.name}</span>
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

  return (
    <main className="app-shell">
      <header className="app-hero">
        <div className="hero-copy">
          <p className="hero-eyebrow">Personal Bookmark Workspace</p>
          <p className="hero-support">개인 아카이브 작업 공간</p>
          <h1>Bookmark</h1>
          <p>Save, search, and organize links from anywhere.</p>
        </div>
        <div className="hero-actions">
          {sessionState.status === "loading" ? <p>세션을 확인하는 중입니다.</p> : null}
          {sessionState.status === "anonymous" ? (
            <button type="button" className="primary-button" onClick={() => void handleGoogleLogin()}>
              Google로 로그인
            </button>
          ) : null}
          {sessionState.status === "authenticated" ? (
            <section className="session-card">
              <p className="session-label">로그인 계정</p>
              <strong>{sessionState.user.email}</strong>
              <button type="button" className="secondary-button" onClick={() => void handleLogout()}>
                로그아웃
              </button>
            </section>
          ) : null}
        </div>
      </header>
      {sessionState.status === "authenticated" ? (
        <section aria-label="dashboard-workspace" className="dashboard-workspace">
          <div className="dashboard-layout">
            <aside aria-label="dashboard-sidebar" className="dashboard-sidebar">
              <p className="section-eyebrow">작업 패널</p>
              {!shouldUseMobileSidebarPanels ? (
                <section aria-label="navigation-sidebar" className="surface-card panel-card navigation-sidebar-card">
                  <div className="navigation-sidebar-header">
                    <p className="workspace-panel-kicker">빠른 진입</p>
                    <div className="navigation-sidebar-heading-row">
                      <h2>작업 시작</h2>
                      <span className="workspace-panel-summary">데스크톱 중심</span>
                    </div>
                  </div>
                  <div className="navigation-sidebar-actions">
                    <button type="button" className="primary-button" onClick={() => beginBookmarkCreate()}>
                      새 북마크
                    </button>
                    <button type="button" className="secondary-button" onClick={() => openFolderManager()}>
                      새 폴더
                    </button>
                    <button type="button" className="ghost-button" onClick={() => openTagManager()}>
                      태그 관리
                    </button>
                  </div>
                </section>
              ) : null}
              {shouldUseMobileSidebarPanels ? (
                <div className="sidebar-segmented-panels">
                  <div role="tablist" aria-label="mobile-sidebar-tabs" className="sidebar-segment-tabs">
                    {renderMobileSidebarTabButton({
                      panelId: "bookmark",
                      heading: bookmarkPanelTitle,
                      summary: bookmarkPanelSummary,
                      kicker: bookmarkPanelKicker
                    })}
                    {renderMobileSidebarTabButton({
                      panelId: "folder",
                      heading: "폴더",
                      summary: folderPanelSummary,
                      kicker: folderPanelKicker
                    })}
                    {renderMobileSidebarTabButton({
                      panelId: "tag",
                      heading: "태그",
                      summary: tagPanelSummary,
                      kicker: tagPanelKicker
                    })}
                  </div>
                  {renderMobileSidebarPanelBody({
                    panelId: "bookmark",
                    heading: bookmarkPanelTitle,
                    summary: bookmarkPanelSummary,
                    kicker: bookmarkPanelKicker,
                    regionLabel: "bookmark-form",
                    children: (
                      <form className="stack-form" onSubmit={(event) => void handleBookmarkSubmit(event)}>
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
                        <section aria-label="bookmark-preview">
                          <h3>자동 추출 미리보기</h3>
                          {bookmarkPreview.sourceTitle ? <p>{bookmarkPreview.sourceTitle}</p> : null}
                          {bookmarkPreview.sourceSummary ? <p>{bookmarkPreview.sourceSummary}</p> : null}
                          {bookmarkPreview.sourceContent ? <p>{bookmarkPreview.sourceContent}</p> : null}
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
                      <label>
                        북마크 색상
                        <input
                          name="bookmarkColor"
                          value={bookmarkDraft.bookmarkColor}
                          onChange={(event) =>
                            updateBookmarkDraft({ bookmarkColor: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        URL 색상
                        <input
                          name="urlColor"
                          value={bookmarkDraft.urlColor}
                          onChange={(event) => updateBookmarkDraft({ urlColor: event.target.value })}
                        />
                      </label>
                      <label>
                        이미지 업로드
                        <input
                          name="bookmarkAssetFile"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) =>
                            setPendingAssetFiles(Array.from(event.target.files ?? []))
                          }
                        />
                      </label>
                      {pendingAssetFiles.length > 0 ? (
                        <ul className="inline-file-list">
                          {pendingAssetFiles.map((file) => (
                            <li key={`${file.name}-${file.size}`}>{file.name}</li>
                          ))}
                        </ul>
                      ) : null}
                      {editingBookmarkId &&
                      (bookmarkAssetsByBookmarkId[editingBookmarkId]?.length ?? 0) > 0 ? (
                        <div className="asset-grid">
                          {bookmarkAssetsByBookmarkId[editingBookmarkId].map((asset, index) => (
                            <div key={asset.id} className="asset-item">
                              <img src={asset.contentUrl} alt={`업로드 이미지 ${index + 1}`} />
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() =>
                                  void handleBookmarkAssetDelete(editingBookmarkId, asset.id)
                                }
                              >
                                이미지 삭제 {index + 1}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <fieldset className="tag-fieldset">
                        <legend>태그 선택</legend>
                        {tags.length === 0 ? <p>등록된 태그가 없습니다.</p> : null}
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
                              {tag.name}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <label>
                        즐겨찾기
                        <input
                          name="isFavorite"
                          type="checkbox"
                          checked={bookmarkDraft.isFavorite}
                          onChange={(event) =>
                            updateBookmarkDraft({ isFavorite: event.target.checked })
                          }
                        />
                      </label>
                      <div className="action-row">
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
                {renderMobileSidebarPanelBody({
                  panelId: "folder",
                  heading: "폴더 관리",
                  summary: folderPanelSummary,
                  kicker: folderPanelKicker,
                  regionLabel: "folder-manager",
                  children: renderFolderManagerContent()
                })}
                {renderMobileSidebarPanelBody({
                  panelId: "tag",
                  heading: "태그 관리",
                  summary: tagPanelSummary,
                  kicker: tagPanelKicker,
                  regionLabel: "tag-manager",
                  children: renderTagManagerContent()
                })}
              </div>
            ) : null}
          </aside>

          <section aria-label="dashboard-main" className="dashboard-main">
            <p className="section-eyebrow">작업 결과</p>
            <div role="region" aria-label="result-primary-column" className="result-primary-column">
            <section aria-label="bookmark-results" className="bookmark-results-stack">
            <section aria-label="search-panel" className="surface-card panel-card search-panel-card">
              <div className="search-panel-header">
                <div className="search-panel-heading">
                  {isMobileSearchViewport ? (
                    <p className="search-panel-kicker">탐색 기준</p>
                  ) : null}
                  <div className="search-panel-title-row">
                    <h2>검색과 필터</h2>
                    {shouldShowMobileSearchSummary ? (
                      <span className="search-panel-summary-pill">
                        활성 필터 {activeBookmarkSearchSummaryItems.length}개
                      </span>
                    ) : null}
                  </div>
                  <p className="search-panel-helper">
                    {isMobileSearchViewport
                      ? "검색 입력부터 고급 조건 초안까지 한 번에 조정합니다."
                      : "검색어, 정렬, 고급 조건을 빠르게 조합해 현재 보관 목록을 좁혀봅니다."}
                  </p>
                  {shouldShowMobileSearchSummary ? (
                    <p className="search-panel-helper search-panel-helper-mobile">
                      활성 필터 {activeBookmarkSearchSummaryItems.length}개
                    </p>
                  ) : null}
                </div>
                {isMobileSearchViewport ? (
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
                ) : null}
              </div>
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
                        <option value="all">통합 검색</option>
                        <option value="title">제목 검색</option>
                        <option value="content">내용 검색</option>
                        <option value="folder">폴더명 검색</option>
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
                        <option value="created_desc">최근 추가순</option>
                        <option value="opened_desc">최근 열람순</option>
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
                    className="search-toolbar search-grid-surface"
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
                    <div className="search-toolbar-field">
                      <select
                        aria-label="검색 모드"
                        name="bookmarkSearchMode"
                        value={bookmarkSearchDraft.mode}
                        onChange={(event) =>
                          updateBookmarkSearchDraft({
                            mode: event.target.value as BookmarkSearchMode
                          })
                        }
                      >
                        <option value="all">통합 검색</option>
                        <option value="title">제목 검색</option>
                        <option value="content">내용 검색</option>
                        <option value="folder">폴더명 검색</option>
                      </select>
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
                        <option value="created_desc">최근 추가순</option>
                        <option value="opened_desc">최근 열람순</option>
                      </select>
                    </div>
                    <div className="search-toolbar-actions">
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
                      <button type="submit" className="primary-button">검색 실행</button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleBookmarkSearchReset()}
                      >
                        검색 초기화
                      </button>
                    </div>
                  </div>
                )}
                {shouldShowAdvancedBookmarkSearch ? (
                  <fieldset className="search-grid search-grid-advanced search-grid-surface">
                    <legend>고급 필터</legend>
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
                          필터 폴더
                          <select
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
                        <label>
                          하위 폴더 포함
                          <input
                            name="bookmarkSearchIncludeDescendantFolders"
                            type="checkbox"
                            checked={bookmarkSearchDraft.includeDescendantFolders}
                            onChange={(event) =>
                              updateBookmarkSearchDraft({
                                includeDescendantFolders: event.target.checked
                              })
                            }
                            disabled={!bookmarkSearchDraft.folderId}
                          />
                        </label>
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
                          {tags.length === 0 ? <p>등록된 태그가 없습니다.</p> : null}
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
                                {tag.name}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      </div>
                    </div>
                    <div className="search-filter-group">
                      <h3>상태</h3>
                      <div className="search-filter-group-grid">
                        <label>
                          즐겨찾기만
                          <input
                            name="bookmarkSearchFavoriteOnly"
                            type="checkbox"
                            checked={bookmarkSearchDraft.favoriteOnly}
                            onChange={(event) =>
                              updateBookmarkSearchDraft({
                                favoriteOnly: event.target.checked
                              })
                            }
                          />
                        </label>
                        <label>
                          북마크 색상 필터
                          <input
                            name="bookmarkSearchBookmarkColor"
                            value={bookmarkSearchDraft.bookmarkColor}
                            onChange={(event) =>
                              updateBookmarkSearchDraft({ bookmarkColor: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          URL 색상 필터
                          <input
                            name="bookmarkSearchUrlColor"
                            value={bookmarkSearchDraft.urlColor}
                            onChange={(event) =>
                              updateBookmarkSearchDraft({ urlColor: event.target.value })
                            }
                          />
                        </label>
                        <label>
                          요약 필터
                          <select
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

            <section aria-label="recommendation-list" className="surface-card panel-card recommendation-panel-card">
              <header className="recommendation-panel-header">
                <p className="recommendation-panel-kicker">빠른 진입점</p>
                <div className="recommendation-panel-title-row">
                  <h2>추천 링크</h2>
                  <p className="recommendation-panel-helper">
                    열람 기록과 즐겨찾기 흐름에서 바로 다시 열 수 있는 링크입니다.
                  </p>
                </div>
              </header>
              <div className="recommendation-grid">
              <div className="recommendation-column">
                <h3>즐겨찾기 추천</h3>
                {recommendations.favorites.length === 0 ? <p>추천 링크가 없습니다.</p> : null}
                <ul className="recommendation-list">
                  {recommendations.favorites.map((bookmark) => (
                    <li key={`favorite-${bookmark.id}`} className="recommendation-item">
                      <div className="recommendation-copy">
                        <div className="meta-pill-list">
                          <span className="meta-pill meta-pill-accent">
                            {getRecommendationReasonLabel("favorites")}
                          </span>
                          <span className="meta-pill">{getFolderName(bookmark.folderId)}</span>
                        </div>
                        <strong>{bookmark.displayTitle || bookmark.url}</strong>
                        <p className="muted-text">
                          {hasTextContent(bookmark.displaySummary)
                            ? bookmark.displaySummary
                            : "요약 없음"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ghost-button recommendation-action-button"
                        onClick={() => void handleBookmarkOpen(bookmark)}
                      >
                        열기 {bookmark.displayTitle || bookmark.url}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="recommendation-column">
                <h3>최근 열람</h3>
                <ul className="recommendation-list">
                  {recommendations.recent.map((bookmark) => (
                    <li key={`recent-${bookmark.id}`} className="recommendation-item">
                      <div className="recommendation-copy">
                        <div className="meta-pill-list">
                          <span className="meta-pill meta-pill-accent">
                            {getRecommendationReasonLabel("recent")}
                          </span>
                          <span className="meta-pill">{getFolderName(bookmark.folderId)}</span>
                        </div>
                        <strong>{bookmark.displayTitle || bookmark.url}</strong>
                        <p className="muted-text">
                          {hasTextContent(bookmark.displaySummary)
                            ? bookmark.displaySummary
                            : "요약 없음"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ghost-button recommendation-action-button"
                        onClick={() => void handleBookmarkOpen(bookmark)}
                      >
                        열기 {bookmark.displayTitle || bookmark.url}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="recommendation-column">
                <h3>자주 연 링크</h3>
                <ul className="recommendation-list">
                  {recommendations.frequent.map((bookmark) => (
                    <li key={`frequent-${bookmark.id}`} className="recommendation-item">
                      <div className="recommendation-copy">
                        <div className="meta-pill-list">
                          <span className="meta-pill meta-pill-accent">
                            {getRecommendationReasonLabel("frequent")}
                          </span>
                          <span className="meta-pill">{getFolderName(bookmark.folderId)}</span>
                        </div>
                        <strong>{bookmark.displayTitle || bookmark.url}</strong>
                        <p className="muted-text">
                          {hasTextContent(bookmark.displaySummary)
                            ? bookmark.displaySummary
                            : "요약 없음"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="ghost-button recommendation-action-button"
                        onClick={() => void handleBookmarkOpen(bookmark)}
                      >
                        열기 {bookmark.displayTitle || bookmark.url}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              </div>
            </section>
            <section aria-label="bookmark-list" className="surface-card panel-card">
            <header className="bookmark-list-header">
              <p className="bookmark-list-kicker">보관 목록</p>
              <div className="bookmark-list-title-row">
                <h2>저장된 북마크</h2>
                <p className="bookmark-list-helper">
                  정리된 링크와 상태 배지를 한 번에 훑어보고 바로 동작합니다.
                </p>
              </div>
            </header>
            {isLoadingDashboard ? <p>대시보드 데이터를 불러오는 중입니다.</p> : null}
            {bookmarks.length === 0 ? <p>아직 저장된 북마크가 없습니다.</p> : null}
            <ul className="bookmark-grid">
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id} className="bookmark-card">
                  <div className="bookmark-card-header">
                    <div className="bookmark-card-title-block">
                      <strong>{bookmark.displayTitle || bookmark.url}</strong>
                      <p className="muted-text">{bookmark.url}</p>
                    </div>
                    <div className="meta-pill-list bookmark-card-primary-meta">
                      <span className="meta-pill">{getFolderName(bookmark.folderId)}</span>
                      {bookmark.isFavorite ? <span className="meta-pill">즐겨찾기</span> : null}
                    </div>
                  </div>
                  <div className="meta-pill-list">
                    <span className="meta-pill">{getBookmarkSummaryStateLabel(bookmark)}</span>
                    <span className="meta-pill">태그 {bookmark.tagIds.length}개</span>
                    {(bookmarkAssetsByBookmarkId[bookmark.id]?.length ?? 0) > 0 ? (
                      <span className="meta-pill">
                        이미지 {bookmarkAssetsByBookmarkId[bookmark.id].length}장
                      </span>
                    ) : null}
                    {bookmark.bookmarkColor || bookmark.urlColor ? (
                      <span className="meta-pill">
                        {shouldUseCompactMobileCards
                          ? "색상 설정됨"
                          : `색상 ${
                              Number(Boolean(bookmark.bookmarkColor)) +
                              Number(Boolean(bookmark.urlColor))
                            }개`}
                      </span>
                    ) : null}
                  </div>
                  {bookmark.displaySummary ? (
                    <p className={shouldUseCompactMobileCards ? "bookmark-card-summary" : undefined}>
                      {bookmark.displaySummary}
                    </p>
                  ) : null}
                  {!shouldUseCompactMobileCards &&
                  (bookmarkAssetsByBookmarkId[bookmark.id]?.length ?? 0) > 0 ? (
                    <div className="asset-grid">
                      {bookmarkAssetsByBookmarkId[bookmark.id].map((asset, index) => (
                        <img
                          key={asset.id}
                          src={asset.contentUrl}
                          alt={`업로드 이미지 ${index + 1}`}
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="action-row bookmark-card-actions">
                    <button type="button" className="primary-button" onClick={() => void handleBookmarkOpen(bookmark)}>
                      열기 {bookmark.displayTitle || bookmark.url}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void openBookmarkDetail(bookmark.id)}>
                      상세 보기
                    </button>
                    {shouldUseCompactMobileCards ? (
                      <>
                        <button type="button" className="secondary-button" onClick={() => beginBookmarkEdit(bookmark)}>
                          수정
                        </button>
                        <button type="button" className="danger-button" onClick={() => void handleBookmarkDelete(bookmark)}>
                          삭제
                        </button>
                      </>
                    ) : (
                      <div className="folder-action-menu-shell bookmark-card-menu-shell">
                        <button
                          type="button"
                          className="ghost-button folder-action-trigger"
                          aria-label={`${bookmark.displayTitle || bookmark.url} 북마크 더보기`}
                          aria-expanded={openBookmarkActionMenuId === bookmark.id}
                          onClick={() => toggleBookmarkActionMenu(bookmark.id)}
                        >
                          더보기
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
                              onClick={() => beginBookmarkEdit(bookmark)}
                            >
                              {bookmark.displayTitle || bookmark.url} 북마크 수정
                            </button>
                            <button
                              type="button"
                              className="danger-button folder-action-menu-item"
                              onClick={() => void handleBookmarkDelete(bookmark)}
                            >
                              {bookmark.displayTitle || bookmark.url} 북마크 삭제
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          </div>
          <aside role="region" aria-label="bookmark-reading-rail" className="bookmark-reading-rail">
            <section aria-label="bookmark-detail-shell" className="bookmark-detail-region">
            {selectedBookmark ? (
              <section aria-label="bookmark-detail" className="surface-card panel-card bookmark-detail-card">
                <header className="bookmark-detail-header">
                  <p className="bookmark-detail-kicker">읽기 중심</p>
                  <div className="bookmark-detail-title-row">
                    <div className="bookmark-detail-title-copy">
                      <h2>북마크 상세</h2>
                      <strong>{selectedBookmark.displayTitle || selectedBookmark.url}</strong>
                    </div>
                    <p className="muted-text">{selectedBookmark.url}</p>
                  </div>
                </header>
                <div className="meta-pill-list bookmark-detail-meta">
                  <span className="meta-pill">{getFolderName(selectedBookmark.folderId)}</span>
                  <span className="meta-pill">{getBookmarkSummaryStateLabel(selectedBookmark)}</span>
                  <span className="meta-pill">태그 {selectedBookmark.tagIds.length}개</span>
                  {selectedBookmarkAssetCount > 0 ? (
                    <span className="meta-pill">이미지 {selectedBookmarkAssetCount}장</span>
                  ) : null}
                </div>
                {selectedBookmarkTagNames.length > 0 ? (
                  <p className="bookmark-detail-tag-line">{selectedBookmarkTagNames.join(", ")}</p>
                ) : null}

                <section className="detail-block">
                  <h3>직접 정리한 내용</h3>
                  {selectedBookmarkUserDetailRows.map((row) => (
                    <div key={row.label} className="detail-row">
                      <p className="detail-row-label">{row.label}</p>
                      <p className="detail-row-value">{row.value}</p>
                    </div>
                  ))}
                  {selectedBookmarkUserDetailRows.length === 0 ? (
                    <p>사용자 입력값이 없습니다.</p>
                  ) : null}
                </section>

                <section className="detail-block">
                  <h3>자동 추출 내용</h3>
                  {selectedBookmarkSourceDetailRows.map((row) => (
                    <div key={row.label} className="detail-row">
                      <p className="detail-row-label">{row.label}</p>
                      <p className="detail-row-value">{row.value}</p>
                    </div>
                  ))}
                  {selectedBookmarkSourceDetailRows.length === 0 ? (
                    <p>자동 추출값이 없습니다.</p>
                  ) : null}
                </section>

                {selectedBookmarkAssetCount > 0 ? (
                  <div className="asset-grid">
                    {bookmarkAssetsByBookmarkId[selectedBookmark.id].map((asset, index) => (
                      <img
                        key={asset.id}
                        src={asset.contentUrl}
                        alt={`업로드 이미지 ${index + 1}`}
                      />
                    ))}
                  </div>
                ) : (
                  <p>업로드된 이미지가 없습니다.</p>
                )}

                <div className="bookmark-detail-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void handleBookmarkOpen(selectedBookmark)}
                  >
                    열기 {selectedBookmark.displayTitle || selectedBookmark.url}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => closeBookmarkDetail()}
                  >
                    닫기
                  </button>
                  <div className="folder-action-menu-shell bookmark-detail-menu-shell">
                    <button
                      type="button"
                      className="ghost-button folder-action-trigger"
                      aria-label="상세 작업 더보기"
                      aria-expanded={isBookmarkDetailActionMenuOpen}
                      onClick={() => toggleBookmarkDetailActionMenu()}
                    >
                      더보기
                    </button>
                    {isBookmarkDetailActionMenuOpen ? (
                      <div
                        role="menu"
                        aria-label="상세 작업 메뉴"
                        className="folder-action-menu"
                      >
                        <button
                          type="button"
                          className="secondary-button folder-action-menu-item"
                          onClick={() => void beginBookmarkEdit(selectedBookmark)}
                        >
                          수정 시작
                        </button>
                        <button
                          type="button"
                          className="secondary-button folder-action-menu-item"
                          onClick={() => void handleBookmarkReextract(selectedBookmark.id)}
                        >
                          자동 추출 다시 시도
                        </button>
                        <button
                          type="button"
                          className="secondary-button folder-action-menu-item"
                          onClick={() => void handleResetUserContent(selectedBookmark.id)}
                        >
                          사용자 입력 초기화
                        </button>
                        <button
                          type="button"
                          className="danger-button folder-action-menu-item"
                          onClick={() => void handleBookmarkDelete(selectedBookmark)}
                        >
                          삭제
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : (
              <section className="surface-card panel-card bookmark-detail-placeholder">
                <p className="bookmark-detail-kicker">읽기 중심</p>
                <h2>상세 북마크를 선택하세요</h2>
                <p className="muted-text">
                  목록이나 추천 링크에서 상세 보기를 누르면 제목, 자동 추출값, 사용자 입력값,
                  업로드 이미지와 빠른 조작이 이 영역에 정리됩니다.
                </p>
              </section>
            )}
            </section>
          </aside>
          </section>
          {shouldRenderDesktopBookmarkComposer ? (
            <div className="overlay-backdrop">
              <section
                role="dialog"
                aria-modal="true"
                aria-label="bookmark-composer-dialog"
                className="surface-card overlay-dialog-shell"
              >
                <div className="overlay-dialog-header">
                  <div className="overlay-dialog-title">
                    <p className="workspace-panel-kicker">작성 오버레이</p>
                    <h2>{editingBookmarkId ? "북마크 수정" : "새 북마크"}</h2>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => cancelBookmarkEdit()}>
                    닫기
                  </button>
                </div>
                <div className="overlay-dialog-panel">
                  {renderDesktopSidebarPanel({
                    panelId: "bookmark",
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
                              <p>저장 URL과 폴더, 표시 제목을 먼저 정리합니다.</p>
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
                              <h3>내용과 요약</h3>
                              <p>읽기 전에 보이는 핵심 설명을 정리합니다.</p>
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
                                  {tags.length === 0 ? <p>등록된 태그가 없습니다.</p> : null}
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
                                        {tag.name}
                                      </label>
                                    ))}
                                  </div>
                                </fieldset>
                                <label>
                                  즐겨찾기
                                  <input
                                    name="isFavorite"
                                    type="checkbox"
                                    checked={bookmarkDraft.isFavorite}
                                    onChange={(event) =>
                                      updateBookmarkDraft({ isFavorite: event.target.checked })
                                    }
                                  />
                                </label>
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
                                <label>
                                  북마크 색상
                                  <input
                                    name="bookmarkColor"
                                    value={bookmarkDraft.bookmarkColor}
                                    onChange={(event) =>
                                      updateBookmarkDraft({ bookmarkColor: event.target.value })
                                    }
                                  />
                                </label>
                                <label>
                                  URL 색상
                                  <input
                                    name="urlColor"
                                    value={bookmarkDraft.urlColor}
                                    onChange={(event) => updateBookmarkDraft({ urlColor: event.target.value })}
                                  />
                                </label>
                                <label>
                                  이미지 업로드
                                  <input
                                    name="bookmarkAssetFile"
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(event) =>
                                      setPendingAssetFiles(Array.from(event.target.files ?? []))
                                    }
                                  />
                                </label>
                                {pendingAssetFiles.length > 0 ? (
                                  <ul className="inline-file-list">
                                    {pendingAssetFiles.map((file) => (
                                      <li key={`${file.name}-${file.size}`}>{file.name}</li>
                                    ))}
                                  </ul>
                                ) : null}
                                {editingBookmarkId &&
                                (bookmarkAssetsByBookmarkId[editingBookmarkId]?.length ?? 0) > 0 ? (
                                  <div className="asset-grid">
                                    {bookmarkAssetsByBookmarkId[editingBookmarkId].map((asset, index) => (
                                      <div key={asset.id} className="asset-item">
                                        <img src={asset.contentUrl} alt={`업로드 이미지 ${index + 1}`} />
                                        <button
                                          type="button"
                                          className="ghost-button"
                                          onClick={() =>
                                            void handleBookmarkAssetDelete(editingBookmarkId, asset.id)
                                          }
                                        >
                                          이미지 삭제 {index + 1}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
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
          {shouldRenderDesktopFolderManager ? (
            <div className="overlay-backdrop">
              <section
                role="dialog"
                aria-modal="true"
                aria-label="folder-manager-dialog"
                className="surface-card overlay-dialog-shell"
              >
                <div className="overlay-dialog-header">
                  <div className="overlay-dialog-title">
                    <p className="workspace-panel-kicker">구조 오버레이</p>
                    <h2>{editingFolderId ? "폴더 수정" : "폴더 관리"}</h2>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => closeFolderManager()}>
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
          {shouldRenderDesktopTagManager ? (
            <div className="overlay-backdrop">
              <section
                role="dialog"
                aria-modal="true"
                aria-label="tag-manager-dialog"
                className="surface-card overlay-dialog-shell"
              >
                <div className="overlay-dialog-header">
                  <div className="overlay-dialog-title">
                    <p className="workspace-panel-kicker">분류 오버레이</p>
                    <h2>{editingTagId ? "태그 수정" : "태그 관리"}</h2>
                  </div>
                  <button type="button" className="ghost-button" onClick={() => closeTagManager()}>
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
          </div>
        </section>
      ) : null}
      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  );
}
