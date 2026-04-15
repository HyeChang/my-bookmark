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

  function beginFolderEdit(folder: Folder) {
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

  function beginTagEdit(tag: Tag) {
    setEditingTagId(tag.id);
    setTagDraft({
      name: tag.name,
      color: tag.color ?? ""
    });
  }

  function cancelTagEdit() {
    setEditingTagId(null);
    setTagDraft(emptyTagDraft);
  }

  function replaceTagState(nextTag: Tag) {
    setTags((currentTags) =>
      currentTags.map((tag) => (tag.id === nextTag.id ? nextTag : tag))
    );
  }

  function removeTagState(tagId: string) {
    setTags((currentTags) => currentTags.filter((tag) => tag.id !== tagId));
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
    setBookmarkDraft(emptyBookmarkDraft);
    setBookmarkPreview(null);
    setPendingAssetFiles([]);
  }

  async function openBookmarkDetail(bookmarkId: string) {
    try {
      setErrorMessage(null);
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
                    <button type="button" className="primary-button">
                      새 북마크
                    </button>
                    <button type="button" className="secondary-button">
                      새 폴더
                    </button>
                    <button type="button" className="ghost-button">
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
                  children: (
                    <>
                      <form className="stack-form" onSubmit={(event) => void handleFolderSubmit(event)}>
                        <label>
                          폴더 이름
                          <input
                            name="folderName"
                            value={folderDraft.name}
                            onChange={(event) => updateFolderDraft({ name: event.target.value })}
                            required
                          />
                        </label>
                        {renderFolderColorPicker(folderDraft.color, (value) =>
                          updateFolderDraft({ color: value })
                        )}
                        {renderFolderIconPicker(folderDraft.icon, (value) =>
                          updateFolderDraft({ icon: value })
                        )}
                        <label>
                          부모 폴더
                          <select
                            name="folderParentFolderId"
                            value={folderDraft.parentFolderId}
                            onChange={(event) =>
                              updateFolderDraft({ parentFolderId: event.target.value })
                            }
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
                      <button
                        type="button"
                        className="dropzone-button"
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
                                className="ghost-button"
                                draggable
                                disabled={isReorderingFolders}
                                aria-label={`${folder.name} 폴더 드래그 정렬`}
                                onDragStart={() => setDraggingFolderId(folder.id)}
                                onDragEnd={() => resetDraggingFolder()}
                              >
                                드래그 정렬
                              </button>
                              <button
                                type="button"
                                className="ghost-button"
                                disabled={isReorderingFolders}
                                aria-label={`${folder.name} 폴더 하위로 이동`}
                                onDragOver={(event) => {
                                  event.stopPropagation();
                                  if (!draggingFolderId || draggingFolderId === folder.id) {
                                    return;
                                  }

                                  const descendantFolderIds = getFolderDescendantIds(
                                    folders,
                                    draggingFolderId
                                  );
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
                              <button type="button" className="secondary-button" onClick={() => beginFolderEdit(folder)}>
                                {folder.name} 폴더 수정 시작
                              </button>
                              <button type="button" className="danger-button" onClick={() => void handleFolderDelete(folder)}>
                                {folder.name} 폴더 삭제
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )
                })}
                {renderMobileSidebarPanelBody({
                  panelId: "tag",
                  heading: "태그 관리",
                  summary: tagPanelSummary,
                  kicker: tagPanelKicker,
                  regionLabel: "tag-manager",
                  children: (
                    <>
                      <form className="stack-form" onSubmit={(event) => void handleTagSubmit(event)}>
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
                      <ul className="tag-list">
                        {tags.map((tag) => (
                          <li key={tag.id} className="tag-list-item">
                            <span>{tag.name}</span>
                            <div className="inline-actions">
                              <button type="button" className="secondary-button" onClick={() => beginTagEdit(tag)}>
                                {tag.name} 태그 수정 시작
                              </button>
                              <button type="button" className="danger-button" onClick={() => void handleTagDelete(tag)}>
                                {tag.name} 태그 삭제
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )
                })}
              </div>
            ) : null}
            {!shouldUseMobileSidebarPanels ? renderDesktopSidebarPanel({
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
            }) : null}

            {!shouldUseMobileSidebarPanels ? renderDesktopSidebarPanel({
              panelId: "folder",
              heading: "폴더 관리",
              summary: folderPanelSummary,
              kicker: folderPanelKicker,
              regionLabel: "folder-manager",
              children: (
                <>
                  <form className="stack-form" onSubmit={(event) => void handleFolderSubmit(event)}>
                    <label>
                      폴더 이름
                      <input
                        name="folderName"
                        value={folderDraft.name}
                        onChange={(event) => updateFolderDraft({ name: event.target.value })}
                        required
                      />
                    </label>
                    {renderFolderColorPicker(folderDraft.color, (value) =>
                      updateFolderDraft({ color: value })
                    )}
                    {renderFolderIconPicker(folderDraft.icon, (value) =>
                      updateFolderDraft({ icon: value })
                    )}
                    <label>
                      부모 폴더
                      <select
                        name="folderParentFolderId"
                        value={folderDraft.parentFolderId}
                        onChange={(event) =>
                          updateFolderDraft({ parentFolderId: event.target.value })
                        }
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
                  <button
                    type="button"
                    className="dropzone-button"
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
                            className="ghost-button"
                            draggable
                            disabled={isReorderingFolders}
                            aria-label={`${folder.name} 폴더 드래그 정렬`}
                            onDragStart={() => setDraggingFolderId(folder.id)}
                            onDragEnd={() => resetDraggingFolder()}
                          >
                            드래그 정렬
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={isReorderingFolders}
                            aria-label={`${folder.name} 폴더 하위로 이동`}
                            onDragOver={(event) => {
                              event.stopPropagation();
                              if (!draggingFolderId || draggingFolderId === folder.id) {
                                return;
                              }

                              const descendantFolderIds = getFolderDescendantIds(
                                folders,
                                draggingFolderId
                              );
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
                          <button type="button" className="secondary-button" onClick={() => beginFolderEdit(folder)}>
                            {folder.name} 폴더 수정 시작
                          </button>
                          <button type="button" className="danger-button" onClick={() => void handleFolderDelete(folder)}>
                            {folder.name} 폴더 삭제
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )
            }) : null}

            {!shouldUseMobileSidebarPanels ? renderDesktopSidebarPanel({
              panelId: "tag",
              heading: "태그 관리",
              summary: tagPanelSummary,
              kicker: tagPanelKicker,
              regionLabel: "tag-manager",
              children: (
                <>
                  <form className="stack-form" onSubmit={(event) => void handleTagSubmit(event)}>
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
                  <ul className="tag-list">
                    {tags.map((tag) => (
                      <li key={tag.id} className="tag-list-item">
                        <span>{tag.name}</span>
                        <div className="inline-actions">
                          <button type="button" className="secondary-button" onClick={() => beginTagEdit(tag)}>
                            {tag.name} 태그 수정 시작
                          </button>
                          <button type="button" className="danger-button" onClick={() => void handleTagDelete(tag)}>
                            {tag.name} 태그 삭제
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )
            }) : null}
          </aside>

          <section aria-label="dashboard-main" className="dashboard-main">
            <p className="section-eyebrow">작업 결과</p>
            <section aria-label="bookmark-results" className="bookmark-results-stack">
            <section aria-label="search-panel" className="surface-card panel-card search-panel-card">
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
                  <p className="search-panel-helper">
                    검색 입력부터 고급 조건 초안까지 한 번에 조정합니다.
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
                <div className="meta-pill-list">
                  <span className="meta-pill">폴더: {getFolderName(selectedBookmark.folderId)}</span>
                  <span className="meta-pill">
                    태그: {getTagNames(selectedBookmark.tagIds).join(", ") || "없음"}
                  </span>
                </div>

                <section className="detail-block">
                  <h3>사용자 입력값</h3>
                  {selectedBookmark.userTitle ? <p>{selectedBookmark.userTitle}</p> : null}
                  {selectedBookmark.userContent ? <p>{selectedBookmark.userContent}</p> : null}
                  {selectedBookmark.userSummary ? <p>{selectedBookmark.userSummary}</p> : null}
                  {!selectedBookmark.userTitle &&
                  !selectedBookmark.userContent &&
                  !selectedBookmark.userSummary ? (
                    <p>사용자 입력값이 없습니다.</p>
                  ) : null}
                </section>

                <section className="detail-block">
                  <h3>자동 추출값</h3>
                  {selectedBookmark.sourceTitle ? <p>{selectedBookmark.sourceTitle}</p> : null}
                  {selectedBookmark.sourceContent ? <p>{selectedBookmark.sourceContent}</p> : null}
                  {selectedBookmark.sourceSummary ? <p>{selectedBookmark.sourceSummary}</p> : null}
                  {!selectedBookmark.sourceTitle &&
                  !selectedBookmark.sourceContent &&
                  !selectedBookmark.sourceSummary ? (
                    <p>자동 추출값이 없습니다.</p>
                  ) : null}
                </section>

                {(bookmarkAssetsByBookmarkId[selectedBookmark.id]?.length ?? 0) > 0 ? (
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
                  <div className="bookmark-detail-action-group">
                    <p className="bookmark-detail-action-label">핵심 액션</p>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void handleBookmarkOpen(selectedBookmark)}
                    >
                      열기 {selectedBookmark.displayTitle || selectedBookmark.url}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void beginBookmarkEdit(selectedBookmark)}
                    >
                      수정 시작
                    </button>
                  </div>
                  <div className="bookmark-detail-action-group">
                    <p className="bookmark-detail-action-label">정리 작업</p>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleBookmarkReextract(selectedBookmark.id)}
                    >
                      자동 추출 다시 시도
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void handleResetUserContent(selectedBookmark.id)}
                    >
                      사용자 입력 초기화
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => closeBookmarkDetail()}
                    >
                      닫기
                    </button>
                  </div>
                  <div className="bookmark-detail-action-group bookmark-detail-danger-actions">
                    <p className="bookmark-detail-action-label">위험 작업</p>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void handleBookmarkDelete(selectedBookmark)}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </section>
            ) : null}
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
                  {!shouldUseCompactMobileCards ? (
                    <p className="bookmark-card-section-label">상태 배지</p>
                  ) : null}
                  <div className="meta-pill-list">
                    <span className="meta-pill">{getBookmarkSummaryStateLabel(bookmark)}</span>
                    <span className="meta-pill">태그 {bookmark.tagIds.length}개</span>
                    {(bookmarkAssetsByBookmarkId[bookmark.id]?.length ?? 0) > 0 ? (
                      <span className="meta-pill">
                        이미지 {bookmarkAssetsByBookmarkId[bookmark.id].length}장
                      </span>
                    ) : null}
                    {shouldUseCompactMobileCards &&
                    (bookmark.bookmarkColor || bookmark.urlColor) ? (
                      <span className="meta-pill">색상 설정됨</span>
                    ) : null}
                  </div>
                  {bookmark.displaySummary ? (
                    <p className={shouldUseCompactMobileCards ? "bookmark-card-summary" : undefined}>
                      {bookmark.displaySummary}
                    </p>
                  ) : null}
                  {!shouldUseCompactMobileCards && bookmark.tagIds.length > 0 ? (
                    <>
                    <p className="bookmark-card-section-label">분류</p>
                    <div className="meta-pill-list">
                      {bookmark.tagIds.map((tagId) => (
                        <span key={tagId} className="meta-pill">
                          {tags.find((tag) => tag.id === tagId)?.name ?? tagId}
                        </span>
                      ))}
                    </div>
                    </>
                  ) : null}
                  {!shouldUseCompactMobileCards ? (
                  <>
                  {(bookmark.bookmarkColor || bookmark.urlColor) ? (
                    <p className="bookmark-card-section-label">표시 설정</p>
                  ) : null}
                  <div className="meta-pill-list">
                    {bookmark.bookmarkColor ? (
                      <span className="meta-pill color-pill">
                        <span
                          aria-hidden="true"
                          className="color-swatch"
                          style={{ backgroundColor: bookmark.bookmarkColor }}
                        />
                        북마크 색상 {bookmark.bookmarkColor}
                      </span>
                    ) : null}
                    {bookmark.urlColor ? (
                      <span className="meta-pill color-pill">
                        <span
                          aria-hidden="true"
                          className="color-swatch"
                          style={{ backgroundColor: bookmark.urlColor }}
                        />
                        URL 색상 {bookmark.urlColor}
                      </span>
                    ) : null}
                  </div>
                  </>
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
                  {!shouldUseCompactMobileCards ? (
                    <p className="bookmark-card-section-label">빠른 조작</p>
                  ) : null}
                  <div className="action-row bookmark-card-actions">
                    <button type="button" className="primary-button" onClick={() => void handleBookmarkOpen(bookmark)}>
                      열기 {bookmark.displayTitle || bookmark.url}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => void openBookmarkDetail(bookmark.id)}>
                      상세 보기
                    </button>
                    <button type="button" className="secondary-button" onClick={() => beginBookmarkEdit(bookmark)}>
                      수정
                    </button>
                    <button type="button" className="danger-button" onClick={() => void handleBookmarkDelete(bookmark)}>
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          </section>
          </div>
        </section>
      ) : null}
      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  );
}
