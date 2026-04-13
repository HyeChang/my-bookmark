import { startTransition, useEffect, useState, type FormEvent } from "react";

import type { AuthenticatedUser, Bookmark, CreateBookmarkRequest } from "@bookmark/shared";

import { createBookmark, loadBookmarks } from "./lib/bookmarks";
import { signInWithGoogle, signOutFromGoogle } from "./lib/firebase";
import { exchangeIdTokenForSession, loadSession, logoutSession } from "./lib/session";

type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthenticatedUser };

type BookmarkDraft = {
  url: string;
  userTitle: string;
  userContent: string;
  userSummary: string;
  isFavorite: boolean;
};

const emptyBookmarkDraft: BookmarkDraft = {
  url: "",
  userTitle: "",
  userContent: "",
  userSummary: "",
  isFavorite: false
};

export default function App() {
  const [sessionState, setSessionState] = useState<SessionState>({
    status: "loading"
  });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bookmarkDraft, setBookmarkDraft] = useState<BookmarkDraft>(emptyBookmarkDraft);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function refreshBookmarks() {
    setIsLoadingBookmarks(true);

    try {
      const nextBookmarks = await loadBookmarks();

      startTransition(() => {
        setBookmarks(nextBookmarks);
      });
    } catch {
      startTransition(() => {
        setBookmarks([]);
        setErrorMessage("북마크를 불러오지 못했습니다.");
      });
    } finally {
      setIsLoadingBookmarks(false);
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

        await refreshBookmarks();
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
      const nextBookmarks = await loadBookmarks().catch(() => []);

      startTransition(() => {
        setSessionState({
          status: "authenticated",
          user
        });
        setBookmarks(nextBookmarks);
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
      setBookmarkDraft(emptyBookmarkDraft);
    });
  }

  async function handleBookmarkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setErrorMessage(null);
      setIsSavingBookmark(true);

      const payload: CreateBookmarkRequest = {
        url: bookmarkDraft.url,
        userTitle: bookmarkDraft.userTitle || null,
        userContent: bookmarkDraft.userContent || null,
        userSummary: bookmarkDraft.userSummary || null,
        isFavorite: bookmarkDraft.isFavorite
      };
      const createdBookmark = await createBookmark(payload);

      startTransition(() => {
        setBookmarks((currentBookmarks) => [createdBookmark, ...currentBookmarks]);
        setBookmarkDraft(emptyBookmarkDraft);
      });
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

  function updateDraft(nextValues: Partial<BookmarkDraft>) {
    setBookmarkDraft((currentDraft) => ({
      ...currentDraft,
      ...nextValues
    }));
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
                  onChange={(event) => updateDraft({ url: event.target.value })}
                  required
                />
              </label>
              <label>
                제목
                <input
                  name="userTitle"
                  value={bookmarkDraft.userTitle}
                  onChange={(event) => updateDraft({ userTitle: event.target.value })}
                />
              </label>
              <label>
                내용
                <textarea
                  name="userContent"
                  value={bookmarkDraft.userContent}
                  onChange={(event) => updateDraft({ userContent: event.target.value })}
                />
              </label>
              <label>
                요약
                <textarea
                  name="userSummary"
                  value={bookmarkDraft.userSummary}
                  onChange={(event) => updateDraft({ userSummary: event.target.value })}
                />
              </label>
              <label>
                즐겨찾기
                <input
                  name="isFavorite"
                  type="checkbox"
                  checked={bookmarkDraft.isFavorite}
                  onChange={(event) => updateDraft({ isFavorite: event.target.checked })}
                />
              </label>
              <button type="submit" disabled={isSavingBookmark}>
                {isSavingBookmark ? "저장 중..." : "북마크 저장"}
              </button>
            </form>
          </section>

          <section aria-label="bookmark-list">
            <h2>저장된 북마크</h2>
            {isLoadingBookmarks ? <p>북마크를 불러오는 중입니다.</p> : null}
            {bookmarks.length === 0 ? <p>아직 저장된 북마크가 없습니다.</p> : null}
            <ul>
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id}>
                  <strong>{bookmark.displayTitle || bookmark.url}</strong>
                  <p>{bookmark.url}</p>
                  {bookmark.displaySummary ? <p>{bookmark.displaySummary}</p> : null}
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
