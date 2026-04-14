import { startTransition, useEffect, useState, type FormEvent } from "react";

import type {
  AuthenticatedUser,
  Bookmark,
  BookmarkSearchMode,
  CreateBookmarkRequest,
  Folder,
  Tag
} from "@bookmark/shared";

import { createBookmark, loadBookmarks } from "./lib/bookmarks";
import { signInWithGoogle, signOutFromGoogle } from "./lib/firebase";
import { createFolder, loadFolders } from "./lib/folders";
import { exchangeIdTokenForSession, loadSession, logoutSession } from "./lib/session";
import { createTag, loadTags } from "./lib/tags";

type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthenticatedUser };

type BookmarkDraft = {
  url: string;
  folderId: string;
  tagIds: string[];
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
};

const emptyBookmarkDraft: BookmarkDraft = {
  url: "",
  folderId: "",
  tagIds: [],
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
  mode: "all"
};

export default function App() {
  const [sessionState, setSessionState] = useState<SessionState>({
    status: "loading"
  });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [bookmarkDraft, setBookmarkDraft] = useState<BookmarkDraft>(emptyBookmarkDraft);
  const [bookmarkSearchDraft, setBookmarkSearchDraft] = useState<BookmarkSearchDraft>(
    emptyBookmarkSearchDraft
  );
  const [appliedBookmarkSearch, setAppliedBookmarkSearch] = useState<BookmarkSearchDraft>(
    emptyBookmarkSearchDraft
  );
  const [folderDraft, setFolderDraft] = useState<FolderDraft>(emptyFolderDraft);
  const [tagDraft, setTagDraft] = useState<TagDraft>(emptyTagDraft);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const [isSavingTag, setIsSavingTag] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refreshDashboardData(search = appliedBookmarkSearch) {
    setIsLoadingDashboard(true);

    try {
      const [nextBookmarks, nextFolders, nextTags] = await Promise.all([
        loadBookmarks({
          query: search.query,
          mode: search.mode
        }),
        loadFolders(),
        loadTags()
      ]);

      startTransition(() => {
        setBookmarks(nextBookmarks);
        setFolders(nextFolders);
        setTags(nextTags);
      });
    } catch {
      startTransition(() => {
        setBookmarks([]);
        setFolders([]);
        setTags([]);
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
      const [nextBookmarks, nextFolders, nextTags] = await Promise.all([
        loadBookmarks({
          query: appliedBookmarkSearch.query,
          mode: appliedBookmarkSearch.mode
        }).catch(() => []),
        loadFolders().catch(() => []),
        loadTags().catch(() => [])
      ]);

      startTransition(() => {
        setSessionState({
          status: "authenticated",
          user
        });
        setBookmarks(nextBookmarks);
        setFolders(nextFolders);
        setTags(nextTags);
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
      setFolders([]);
      setTags([]);
      setBookmarkDraft(emptyBookmarkDraft);
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

      const payload: CreateBookmarkRequest = {
        url: bookmarkDraft.url,
        folderId: bookmarkDraft.folderId || null,
        tagIds: bookmarkDraft.tagIds,
        userTitle: bookmarkDraft.userTitle || null,
        userContent: bookmarkDraft.userContent || null,
        userSummary: bookmarkDraft.userSummary || null,
        isFavorite: bookmarkDraft.isFavorite
      };
      const createdBookmark = await createBookmark(payload);

      if (appliedBookmarkSearch.query) {
        const nextBookmarks = await loadBookmarks({
          query: appliedBookmarkSearch.query,
          mode: appliedBookmarkSearch.mode
        });

        startTransition(() => {
          setBookmarks(nextBookmarks);
          setBookmarkDraft(emptyBookmarkDraft);
        });
      } else {
        startTransition(() => {
          setBookmarks((currentBookmarks) => [createdBookmark, ...currentBookmarks]);
          setBookmarkDraft(emptyBookmarkDraft);
        });
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

      const createdFolder = await createFolder({
        name: folderDraft.name,
        color: folderDraft.color || null,
        icon: folderDraft.icon || null
      });

      startTransition(() => {
        setFolders((currentFolders) => [...currentFolders, createdFolder]);
        setFolderDraft(emptyFolderDraft);
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "폴더를 저장하지 못했습니다."
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

      const createdTag = await createTag({
        name: tagDraft.name,
        color: tagDraft.color || null
      });

      startTransition(() => {
        setTags((currentTags) => [...currentTags, createdTag]);
        setTagDraft(emptyTagDraft);
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error ? error.message : "태그를 저장하지 못했습니다."
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

  async function handleBookmarkSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setErrorMessage(null);
      setIsLoadingDashboard(true);

      const nextSearch = {
        query: bookmarkSearchDraft.query.trim(),
        mode: bookmarkSearchDraft.mode
      } satisfies BookmarkSearchDraft;
      const nextBookmarks = await loadBookmarks(nextSearch);

      startTransition(() => {
        setBookmarks(nextBookmarks);
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
            <h2>북마크 저장</h2>
            <form onSubmit={(event) => void handleBookmarkSubmit(event)}>
              <label>
                URL
                <input
                  name="url"
                  type="url"
                  value={bookmarkDraft.url}
                  onChange={(event) => updateBookmarkDraft({ url: event.target.value })}
                  required
                />
              </label>
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
                {isSavingBookmark ? "저장 중..." : "북마크 저장"}
              </button>
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
                {isSavingFolder ? "추가 중..." : "폴더 추가"}
              </button>
            </form>
            <ul>
              {folders.map((folder) => (
                <li key={folder.id}>{folder.name}</li>
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
                {isSavingTag ? "추가 중..." : "태그 추가"}
              </button>
            </form>
            <ul>
              {tags.map((tag) => (
                <li key={tag.id}>{tag.name}</li>
              ))}
            </ul>
          </section>

          <section aria-label="bookmark-list">
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
              <button type="submit">검색 실행</button>
              <button type="button" onClick={() => void handleBookmarkSearchReset()}>
                검색 초기화
              </button>
            </form>
            {isLoadingDashboard ? <p>대시보드 데이터를 불러오는 중입니다.</p> : null}
            {appliedBookmarkSearch.query ? (
              <p>
                현재 검색: {appliedBookmarkSearch.query} ({appliedBookmarkSearch.mode})
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
