import { lazy, startTransition, Suspense, useEffect, useState } from "react";
import type { AuthenticatedUser } from "@bookmark/shared";

import { exchangeIdTokenForSession, loadSession } from "../lib/session";
import { loadFirebaseAuth, preloadFirebaseAuth } from "../lib/firebase-auth-loader";

const LazyAuthenticatedDashboardApp = lazy(() => import("./AuthenticatedDashboardApp"));
const LazyInstallHelpDialog = lazy(() => import("./InstallHelpDialog"));

type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthenticatedUser };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

async function signInWithGoogle() {
  const firebaseAuth = await loadFirebaseAuth();
  return firebaseAuth.signInWithGoogle();
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
    <main className="app-shell">
      <header className="app-hero">
        <div className="hero-copy">
          <h1>Bookmark</h1>
          <p className="hero-support">개인 링크 보관함</p>
        </div>
        <section aria-label="auth-actions" className="hero-command-bar">
          <div className="hero-command-meta">
            <p className="hero-command-label">계정</p>
            <p className="hero-command-summary">
              {sessionState.status === "loading"
                ? "세션을 확인하는 중입니다."
                : "Google 계정으로 링크 보관함을 시작합니다."}
            </p>
          </div>
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
                onMouseEnter={preloadFirebaseAuth}
                onFocus={preloadFirebaseAuth}
                onClick={() => void handleGoogleLogin()}
              >
                {isLoggingIn ? "로그인 중" : "Google로 로그인"}
              </button>
            ) : null}
          </div>
        </section>
      </header>
      <section aria-label="dashboard-workspace" className="dashboard-workspace">
        <div className="bookmark-loading-state" role="status" aria-live="polite">
          <span className="bookmark-loading-spinner" aria-hidden="true" />
          <span>
            {sessionState.status === "loading"
              ? "세션을 확인하는 중입니다."
              : "로그인하면 저장된 북마크를 불러옵니다."}
          </span>
        </div>
      </section>
      {isInstallHelpDialogOpen ? (
        <Suspense fallback={null}>
          <LazyInstallHelpDialog onClose={() => setIsInstallHelpDialogOpen(false)} />
        </Suspense>
      ) : null}
      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </main>
  );
}
