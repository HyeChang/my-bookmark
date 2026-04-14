import { startTransition, useEffect, useState, type FormEvent } from "react";

import type {
  AuthenticatedUser,
  Bookmark,
  BookmarkAsset,
  BookmarkExtractPreview,
  BookmarkSearchMode,
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
  updateFolder
} from "./lib/folders";
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
};

type TagDraft = {
  name: string;
  color: string;
};

type BookmarkSearchDraft = {
  query: string;
  mode: BookmarkSearchMode;
  favoriteOnly: boolean;
  folderId: string;
  tagId: string;
  bookmarkColor: string;
  urlColor: string;
  summaryState: "all" | "with" | "without";
};

type BookmarkRecommendationsState = {
  favorites: Bookmark[];
  recent: Bookmark[];
  frequent: Bookmark[];
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
  icon: ""
};

const emptyTagDraft: TagDraft = {
  name: "",
  color: ""
};

const emptyBookmarkSearchDraft: BookmarkSearchDraft = {
  query: "",
  mode: "all",
  favoriteOnly: false,
  folderId: "",
  tagId: "",
  bookmarkColor: "",
  urlColor: "",
  summaryState: "all"
};

const emptyBookmarkRecommendations: BookmarkRecommendationsState = {
  favorites: [],
  recent: [],
  frequent: []
};

function normalizeBookmarkSearchDraft(search: BookmarkSearchDraft): BookmarkSearchDraft {
  return {
    query: search.query.trim(),
    mode: search.mode,
    favoriteOnly: search.favoriteOnly,
    folderId: search.folderId.trim(),
    tagId: search.tagId.trim(),
    bookmarkColor: search.bookmarkColor.trim(),
    urlColor: search.urlColor.trim(),
    summaryState: search.summaryState
  };
}

function hasActiveBookmarkSearch(search: BookmarkSearchDraft) {
  const normalizedSearch = normalizeBookmarkSearchDraft(search);
  return Boolean(
    normalizedSearch.query ||
      normalizedSearch.favoriteOnly ||
      normalizedSearch.folderId ||
      normalizedSearch.tagId ||
      normalizedSearch.bookmarkColor ||
      normalizedSearch.urlColor ||
      normalizedSearch.summaryState !== "all"
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
  const [folderDraft, setFolderDraft] = useState<FolderDraft>(emptyFolderDraft);
  const [tagDraft, setTagDraft] = useState<TagDraft>(emptyTagDraft);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);
  const [isLoadingBookmarkPreview, setIsLoadingBookmarkPreview] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isSavingTag, setIsSavingTag] = useState(false);
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
      setTagDraft(emptyTagDraft);
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
          icon: folderDraft.icon || null
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
          icon: folderDraft.icon || null
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
    setBookmarkSearchDraft((currentDraft) => ({
      ...currentDraft,
      ...nextValues
    }));
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

  function updateFolderDraft(nextValues: Partial<FolderDraft>) {
    setFolderDraft((currentDraft) => ({
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
      icon: folder.icon ?? ""
    });
  }

  function cancelFolderEdit() {
    setEditingFolderId(null);
    setFolderDraft(emptyFolderDraft);
  }

  function replaceFolderState(nextFolder: Folder) {
    setFolders((currentFolders) =>
      currentFolders.map((folder) => (folder.id === nextFolder.id ? nextFolder : folder))
    );
  }

  function removeFolderState(folderId: string) {
    setFolders((currentFolders) =>
      currentFolders.filter((folder) => folder.id !== folderId)
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
    setBookmarkSearchDraft((currentDraft) =>
      currentDraft.folderId === folderId ? { ...currentDraft, folderId: "" } : currentDraft
    );
    setAppliedBookmarkSearch((currentSearch) =>
      currentSearch.folderId === folderId ? { ...currentSearch, folderId: "" } : currentSearch
    );

    if (editingFolderId === folderId) {
      cancelFolderEdit();
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
      currentDraft.tagId === tagId ? { ...currentDraft, tagId: "" } : currentDraft
    );
    setAppliedBookmarkSearch((currentSearch) =>
      currentSearch.tagId === tagId ? { ...currentSearch, tagId: "" } : currentSearch
    );

    if (editingTagId === tagId) {
      cancelTagEdit();
    }
  }

  async function handleBookmarkSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setErrorMessage(null);
      setIsLoadingDashboard(true);

      const nextSearch = normalizeBookmarkSearchDraft(bookmarkSearchDraft);
      const nextBookmarks = await loadBookmarks(nextSearch);

      startTransition(() => {
        setBookmarks(nextBookmarks);
        setSelectedBookmark(null);
        setAppliedBookmarkSearch(nextSearch);
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
    try {
      setErrorMessage(null);
      setIsLoadingDashboard(true);
      const nextBookmarks = await loadBookmarks();

      startTransition(() => {
        setBookmarks(nextBookmarks);
        setSelectedBookmark(null);
        setBookmarkSearchDraft(emptyBookmarkSearchDraft);
        setAppliedBookmarkSearch(emptyBookmarkSearchDraft);
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "북마크 목록을 다시 불러오지 못했습니다."
        );
      });
    } finally {
      setIsLoadingDashboard(false);
    }
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
      const shouldRefreshSearch = appliedBookmarkSearch.tagId === tag.id;
      const nextSearch = shouldRefreshSearch
        ? {
            ...appliedBookmarkSearch,
            tagId: ""
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

  return (
    <main>
      <h1>Bookmark</h1>
      <p>Save, search, and organize links from anywhere.</p>
      {sessionState.status === "loading" ? <p>세션을 확인하는 중입니다.</p> : null}
      {sessionState.status === "anonymous" ? (
        <button type="button" onClick={() => void handleGoogleLogin()}>
          Google로 로그인
        </button>
      ) : null}
      {sessionState.status === "authenticated" ? (
        <>
          <section>
            <p>{sessionState.user.email}</p>
            <button type="button" onClick={() => void handleLogout()}>
              로그아웃
            </button>
          </section>

          <section aria-label="bookmark-form">
            <h2>{editingBookmarkId ? "북마크 수정" : "북마크 저장"}</h2>
            <form onSubmit={(event) => void handleBookmarkSubmit(event)}>
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
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
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
                <ul>
                  {pendingAssetFiles.map((file) => (
                    <li key={`${file.name}-${file.size}`}>{file.name}</li>
                  ))}
                </ul>
              ) : null}
              {editingBookmarkId &&
              (bookmarkAssetsByBookmarkId[editingBookmarkId]?.length ?? 0) > 0 ? (
                <div>
                  {bookmarkAssetsByBookmarkId[editingBookmarkId].map((asset, index) => (
                    <div key={asset.id}>
                      <img src={asset.contentUrl} alt={`업로드 이미지 ${index + 1}`} />
                      <button
                        type="button"
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
              <fieldset>
                <legend>태그 선택</legend>
                {tags.length === 0 ? <p>등록된 태그가 없습니다.</p> : null}
                {tags.map((tag) => (
                  <label key={tag.id}>
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
              </fieldset>
              <label>
                즐겨찾기
                <input
                  name="isFavorite"
                  type="checkbox"
                  checked={bookmarkDraft.isFavorite}
                  onChange={(event) => updateBookmarkDraft({ isFavorite: event.target.checked })}
                />
              </label>
              <button type="submit" disabled={isSavingBookmark}>
                {isSavingBookmark
                  ? editingBookmarkId
                    ? "수정 중..."
                    : "저장 중..."
                  : editingBookmarkId
                    ? "북마크 수정"
                    : "북마크 저장"}
              </button>
              {editingBookmarkId ? (
                <button type="button" onClick={() => cancelBookmarkEdit()}>
                  수정 취소
                </button>
              ) : null}
            </form>
          </section>

          <section aria-label="folder-manager">
            <h2>폴더 관리</h2>
            <form onSubmit={(event) => void handleFolderSubmit(event)}>
              <label>
                폴더 이름
                <input
                  name="folderName"
                  value={folderDraft.name}
                  onChange={(event) => updateFolderDraft({ name: event.target.value })}
                  required
                />
              </label>
              <label>
                폴더 색상
                <input
                  name="folderColor"
                  value={folderDraft.color}
                  onChange={(event) => updateFolderDraft({ color: event.target.value })}
                />
              </label>
              <label>
                폴더 아이콘
                <input
                  name="folderIcon"
                  value={folderDraft.icon}
                  onChange={(event) => updateFolderDraft({ icon: event.target.value })}
                />
              </label>
              <button type="submit" disabled={isSavingFolder}>
                {isSavingFolder
                  ? editingFolderId
                    ? "수정 중..."
                    : "추가 중..."
                  : editingFolderId
                    ? "폴더 수정"
                    : "폴더 추가"}
              </button>
              {editingFolderId ? (
                <button type="button" onClick={() => cancelFolderEdit()}>
                  수정 취소
                </button>
              ) : null}
            </form>
            <ul>
              {folders.map((folder) => (
                <li key={folder.id}>
                  <span>{folder.name}</span>
                  <button type="button" onClick={() => beginFolderEdit(folder)}>
                    {folder.name} 폴더 수정 시작
                  </button>
                  <button type="button" onClick={() => void handleFolderDelete(folder)}>
                    {folder.name} 폴더 삭제
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="tag-manager">
            <h2>태그 관리</h2>
            <form onSubmit={(event) => void handleTagSubmit(event)}>
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
              <button type="submit" disabled={isSavingTag}>
                {isSavingTag
                  ? editingTagId
                    ? "수정 중..."
                    : "추가 중..."
                  : editingTagId
                    ? "태그 수정"
                    : "태그 추가"}
              </button>
              {editingTagId ? (
                <button type="button" onClick={() => cancelTagEdit()}>
                  수정 취소
                </button>
              ) : null}
            </form>
            <ul>
              {tags.map((tag) => (
                <li key={tag.id}>
                  <span>{tag.name}</span>
                  <button type="button" onClick={() => beginTagEdit(tag)}>
                    {tag.name} 태그 수정 시작
                  </button>
                  <button type="button" onClick={() => void handleTagDelete(tag)}>
                    {tag.name} 태그 삭제
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="bookmark-list">
            <section aria-label="recommendation-list">
              <h2>추천 링크</h2>
              <div>
                <h3>즐겨찾기 추천</h3>
                {recommendations.favorites.length === 0 ? <p>추천 링크가 없습니다.</p> : null}
                <ul>
                  {recommendations.favorites.map((bookmark) => (
                    <li key={`favorite-${bookmark.id}`}>
                      <span>{bookmark.displayTitle || bookmark.url}</span>
                      <button
                        type="button"
                        onClick={() => void handleBookmarkOpen(bookmark)}
                      >
                        열기 {bookmark.displayTitle || bookmark.url}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>최근 열람</h3>
                <ul>
                  {recommendations.recent.map((bookmark) => (
                    <li key={`recent-${bookmark.id}`}>
                      <span>{bookmark.displayTitle || bookmark.url}</span>
                      <button
                        type="button"
                        onClick={() => void handleBookmarkOpen(bookmark)}
                      >
                        열기 {bookmark.displayTitle || bookmark.url}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>자주 연 링크</h3>
                <ul>
                  {recommendations.frequent.map((bookmark) => (
                    <li key={`frequent-${bookmark.id}`}>
                      <span>{bookmark.displayTitle || bookmark.url}</span>
                      <button
                        type="button"
                        onClick={() => void handleBookmarkOpen(bookmark)}
                      >
                        열기 {bookmark.displayTitle || bookmark.url}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
            {selectedBookmark ? (
              <section aria-label="bookmark-detail">
                <h2>북마크 상세</h2>
                <strong>{selectedBookmark.displayTitle || selectedBookmark.url}</strong>
                <p>{selectedBookmark.url}</p>
                <p>폴더: {getFolderName(selectedBookmark.folderId)}</p>
                <p>태그: {getTagNames(selectedBookmark.tagIds).join(", ") || "없음"}</p>

                <section>
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

                <section>
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
                  <div>
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

                <button type="button" onClick={() => void handleBookmarkOpen(selectedBookmark)}>
                  열기 {selectedBookmark.displayTitle || selectedBookmark.url}
                </button>
                <button
                  type="button"
                  onClick={() => void handleBookmarkReextract(selectedBookmark.id)}
                >
                  자동 추출 다시 시도
                </button>
                <button
                  type="button"
                  onClick={() => void handleResetUserContent(selectedBookmark.id)}
                >
                  사용자 입력 초기화
                </button>
                <button
                  type="button"
                  onClick={() => void handleBookmarkDelete(selectedBookmark)}
                >
                  삭제
                </button>
                <button type="button" onClick={() => void beginBookmarkEdit(selectedBookmark)}>
                  수정 시작
                </button>
                <button type="button" onClick={() => closeBookmarkDetail()}>
                  닫기
                </button>
              </section>
            ) : null}
            <h2>저장된 북마크</h2>
            <form onSubmit={(event) => void handleBookmarkSearchSubmit(event)}>
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
                필터 폴더
                <select
                  name="bookmarkSearchFolderId"
                  value={bookmarkSearchDraft.folderId}
                  onChange={(event) =>
                    updateBookmarkSearchDraft({ folderId: event.target.value })
                  }
                >
                  <option value="">전체 폴더</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                필터 태그
                <select
                  name="bookmarkSearchTagId"
                  value={bookmarkSearchDraft.tagId}
                  onChange={(event) =>
                    updateBookmarkSearchDraft({ tagId: event.target.value })
                  }
                >
                  <option value="">전체 태그</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
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
              <button type="submit">검색 실행</button>
              <button type="button" onClick={() => void handleBookmarkSearchReset()}>
                검색 초기화
              </button>
            </form>
            {isLoadingDashboard ? <p>대시보드 데이터를 불러오는 중입니다.</p> : null}
            {hasActiveBookmarkSearch(appliedBookmarkSearch) ? (
              <p>
                현재 검색: {appliedBookmarkSearch.query || "전체"} ({appliedBookmarkSearch.mode}
                {appliedBookmarkSearch.favoriteOnly ? ", 즐겨찾기만" : ""}
                {appliedBookmarkSearch.folderId
                  ? `, 폴더:${getFolderName(appliedBookmarkSearch.folderId)}`
                  : ""}
                {appliedBookmarkSearch.tagId
                  ? `, 태그:${getTagNames([appliedBookmarkSearch.tagId]).join(", ")}`
                  : ""}
                {appliedBookmarkSearch.bookmarkColor
                  ? `, 북마크색상:${appliedBookmarkSearch.bookmarkColor}`
                  : ""}
                {appliedBookmarkSearch.urlColor
                  ? `, URL색상:${appliedBookmarkSearch.urlColor}`
                  : ""}
                {appliedBookmarkSearch.summaryState === "with" ? ", 요약있음" : ""}
                {appliedBookmarkSearch.summaryState === "without" ? ", 요약없음" : ""}
                )
              </p>
            ) : null}
            {bookmarks.length === 0 ? <p>아직 저장된 북마크가 없습니다.</p> : null}
            <ul>
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id}>
                  <strong>{bookmark.displayTitle || bookmark.url}</strong>
                  <p>{bookmark.url}</p>
                  {bookmark.displaySummary ? <p>{bookmark.displaySummary}</p> : null}
                  {bookmark.tagIds.length > 0 ? (
                    <p>{bookmark.tagIds.map((tagId) => tags.find((tag) => tag.id === tagId)?.name ?? tagId).join(", ")}</p>
                  ) : null}
                  {(bookmarkAssetsByBookmarkId[bookmark.id]?.length ?? 0) > 0 ? (
                    <div>
                      {bookmarkAssetsByBookmarkId[bookmark.id].map((asset, index) => (
                        <img
                          key={asset.id}
                          src={asset.contentUrl}
                          alt={`업로드 이미지 ${index + 1}`}
                        />
                      ))}
                    </div>
                  ) : null}
                  <button type="button" onClick={() => void handleBookmarkOpen(bookmark)}>
                    열기 {bookmark.displayTitle || bookmark.url}
                  </button>
                  <button type="button" onClick={() => void openBookmarkDetail(bookmark.id)}>
                    상세 보기
                  </button>
                  <button type="button" onClick={() => void handleBookmarkDelete(bookmark)}>
                    삭제
                  </button>
                  <button type="button" onClick={() => beginBookmarkEdit(bookmark)}>
                    수정
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
      {errorMessage ? <p>{errorMessage}</p> : null}
    </main>
  );
}
