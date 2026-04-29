import { lazy, Suspense } from "react";
import "./App.css";

const LazyAuthGate = lazy(() => import("./components/AuthGate"));

function renderAppFallback() {
  return (
    <main className="app-shell">
      <header className="app-hero">
        <div className="hero-copy">
          <h1>Bookmark</h1>
          <p className="hero-support">개인 링크 보관함</p>
        </div>
        <section aria-hidden="true" className="hero-command-bar">
          <div className="hero-command-meta">
            <p className="hero-command-label">빠른 작업</p>
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

export default function App() {
  return (
    <Suspense fallback={renderAppFallback()}>
      <LazyAuthGate />
    </Suspense>
  );
}
