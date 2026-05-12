import { lazy, startTransition, Suspense, useEffect, useState } from "react";
import type { AuthenticatedUser } from "@bookmark/shared";

import { exchangeIdTokenForSession, loadSession } from "../lib/session";
import { preloadFirebaseAuth, signInWithGoogle } from "../lib/firebase-auth-actions";
import "./AuthGate.css";

function createAuthGateChunkLoader<TModule>(loadChunk: () => Promise<TModule>) {
  let chunkPromise: Promise<TModule> | null = null;

  return () => {
    chunkPromise ??= loadChunk();
    return chunkPromise;
  };
}

const loadAuthenticatedDashboardApp = createAuthGateChunkLoader(
  () => import("./AuthenticatedDashboardApp")
);
const LazyAuthenticatedDashboardApp = lazy(loadAuthenticatedDashboardApp);
const LazyInstallHelpDialog = lazy(() => import("./InstallHelpDialog"));

type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthenticatedUser };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function preloadAuthenticatedDashboardApp() {
  void loadAuthenticatedDashboardApp().catch(() => undefined);
}

function renderDashboardFallback() {
  return (
    <main className="app-shell">
      <header className="app-hero">
        <div className="hero-copy">
          <h1>Bookmark</h1>
          <p className="hero-support">개인 링크 보관함</p>
        </div>
        <section aria-hidden="true" className="hero-command-bar">
          <div className="hero-command-meta">
            <p className="hero-command-label">계정</p>
            <p className="hero-command-summary">대시보드를 준비하는 중입니다.</p>
          </div>
        </section>
      </header>
      <section aria-label="dashboard-loading" className="dashboard-workspace">
        <div className="bookmark-loading-state" role="status" aria-live="polite">
          <span className="bookmark-loading-spinner" aria-hidden="true" />
          <span>대시보드를 불러오는 중입니다.</span>
        </div>
      </section>
    </main>
  );
}

export default function AuthGate() {
  const [sessionState, setSessionState] = useState<SessionState>({ status: "loading" });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInstallHelpDialogOpen, setIsInstallHelpDialogOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadSession()
      .then((user) => {
        if (cancelled) {
          return;
        }

        if (user) {
          preloadAuthenticatedDashboardApp();
        }

        startTransition(() => {
          setSessionState(user ? { status: "authenticated", user } : { status: "anonymous" });
        });
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

  async function handleGoogleLogin() {
    try {
      setErrorMessage(null);
      setIsLoggingIn(true);
      const idToken = await signInWithGoogle();
      const user = await exchangeIdTokenForSession(idToken);

      preloadAuthenticatedDashboardApp();

      startTransition(() => {
        setSessionState({ status: "authenticated", user });
      });
    } catch (error) {
      startTransition(() => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Google 로그인을 완료하지 못했습니다."
        );
      });
    } finally {
      setIsLoggingIn(false);
    }
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
      setDeferredInstallPrompt(null);
    }
  }

  if (sessionState.status === "authenticated") {
    return (
      <Suspense fallback={renderDashboardFallback()}>
        <LazyAuthenticatedDashboardApp
          initialUser={sessionState.user}
          onSessionEnd={() => setSessionState({ status: "anonymous" })}
        />
      </Suspense>
    );
  }

  return (
    <main className="app-shell auth-shell">
      <section aria-label="auth-landing" className="auth-landing">
        <div className="auth-brand-panel">
          <span className="auth-brand-mark" aria-hidden="true">
            B
          </span>
          <h1>Bookmark</h1>
          <p className="auth-lede">
            저장한 링크를 Google 계정으로 동기화하고, 폴더와 태그로 빠르게 다시 찾습니다.
          </p>
          <ul className="auth-preview-list" aria-label="bookmark-preview-benefits">
            <li>
              <strong>링크 정리</strong>
              <span>폴더와 태그로 필요한 자료를 빠르게 분류합니다.</span>
            </li>
            <li>
              <strong>검색과 필터</strong>
              <span>제목, 내용, 색상 조건을 함께 좁혀 봅니다.</span>
            </li>
            <li>
              <strong>확장 저장</strong>
              <span>브라우저에서 보고 있는 페이지를 바로 보관합니다.</span>
            </li>
          </ul>
        </div>
        <section aria-label="auth-actions" className="auth-card">
          <div className="auth-card-header">
            <p className="auth-card-label">계정</p>
            <h2>Google 계정으로 시작합니다.</h2>
            <p className="auth-card-summary">
              로그인하면 저장된 북마크와 설정을 불러옵니다.
            </p>
          </div>
          <p className="auth-status-row">
            <span className="auth-status-dot" aria-hidden="true" />
            <span>
              {sessionState.status === "loading"
                ? "세션을 확인하는 중입니다."
                : "개인 링크 보관함을 준비했습니다."}
            </span>
          </p>
          <div className="auth-gate-actions">
            <button
              type="button"
              className="secondary-button hero-install-button"
              aria-label="앱 설치"
              onClick={() => void handlePwaInstall()}
            >
              앱 설치
            </button>
            {sessionState.status === "anonymous" ? (
              <button
                type="button"
                className="primary-button"
                disabled={isLoggingIn}
                onFocus={() => void preloadFirebaseAuth()}
                onPointerDown={() => void preloadFirebaseAuth()}
                onClick={() => void handleGoogleLogin()}
              >
                {isLoggingIn ? "로그인 중" : "Google로 로그인"}
              </button>
            ) : null}
          </div>
          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </section>
      </section>
      {isInstallHelpDialogOpen ? (
        <Suspense fallback={null}>
          <LazyInstallHelpDialog onClose={() => setIsInstallHelpDialogOpen(false)} />
        </Suspense>
      ) : null}
    </main>
  );
}
