import type { Dispatch, SetStateAction } from "react";
import type { AuthenticatedUser } from "@bookmark/shared";

type DashboardHeaderSessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthenticatedUser };

type DashboardHeaderAction = () => void | Promise<void>;

type DashboardHeaderProps = {
  appThemeToggleLabel: string;
  isDarkAppTheme: boolean;
  isMobileHeaderMenuOpen: boolean;
  isMemoView: boolean;
  isQuickActionsMenuOpen: boolean;
  quickActionSummary: string;
  sessionState: DashboardHeaderSessionState;
  shouldUseMobileSidebarPanels: boolean;
  onBookmarkWorkspaceOpen: () => void;
  onBookmarkWorkspacePreload: () => void;
  onCreateBookmark: () => void;
  onCreateBookmarkPreload: () => void;
  onExtensionDownloadPreload: () => void;
  onExtensionTokenPreload: () => void;
  onFirebaseAuthPreload: DashboardHeaderAction;
  onFolderManagerPreload: () => void;
  onGoogleLogin: DashboardHeaderAction;
  onHomeOpen: () => void;
  onHomePreload: () => void;
  onInstallHelpPreload: () => void;
  onLogout: DashboardHeaderAction;
  onMobileHeaderMenuOpenChange: Dispatch<SetStateAction<boolean>>;
  onMemoCreate: () => void;
  onMemoOpen: () => void;
  onMemoPreload: () => void;
  onOpenExtensionDownloadDialog: () => void;
  onOpenExtensionTokenDialog: DashboardHeaderAction;
  onOpenFolderManager: () => void;
  onOpenTagManager: () => void;
  onPwaInstall: DashboardHeaderAction;
  onQuickActionsMenuOpenChange: Dispatch<SetStateAction<boolean>>;
  onTagManagerPreload: () => void;
  onToggleAppTheme: () => void;
};

export function DashboardHeader({
  appThemeToggleLabel,
  isDarkAppTheme,
  isMobileHeaderMenuOpen,
  isMemoView,
  isQuickActionsMenuOpen,
  quickActionSummary,
  sessionState,
  shouldUseMobileSidebarPanels,
  onBookmarkWorkspaceOpen,
  onBookmarkWorkspacePreload,
  onCreateBookmark,
  onCreateBookmarkPreload,
  onExtensionDownloadPreload,
  onExtensionTokenPreload,
  onFirebaseAuthPreload,
  onFolderManagerPreload,
  onGoogleLogin,
  onHomeOpen,
  onHomePreload,
  onInstallHelpPreload,
  onLogout,
  onMobileHeaderMenuOpenChange,
  onMemoCreate,
  onMemoOpen,
  onMemoPreload,
  onOpenExtensionDownloadDialog,
  onOpenExtensionTokenDialog,
  onOpenFolderManager,
  onOpenTagManager,
  onPwaInstall,
  onQuickActionsMenuOpenChange,
  onTagManagerPreload,
  onToggleAppTheme
}: DashboardHeaderProps) {
  const primaryCreateLabel = isMemoView ? "새 메모" : "새 북마크";
  const mobilePrimaryCreateLabel = isMemoView ? "새 메모" : "북마크 등록";
  const handlePrimaryCreate = isMemoView ? onMemoCreate : onCreateBookmark;
  const handlePrimaryCreatePreload = isMemoView ? onMemoPreload : onCreateBookmarkPreload;

  return (
    <header className="app-hero">
      <button
        type="button"
        className="hero-copy hero-home-button"
        aria-label="홈으로 이동"
        onMouseEnter={onHomePreload}
        onFocus={onHomePreload}
        onClick={onHomeOpen}
      >
        <h1>Bookmark</h1>
        <p className="hero-support">개인 링크 보관함</p>
      </button>
      {sessionState.status === "authenticated" && !shouldUseMobileSidebarPanels ? (
        <section aria-label="navigation-sidebar" className="hero-command-bar">
          <div className="hero-command-meta">
            <p className="hero-command-label">빠른 작업</p>
            <p className="hero-command-summary">{quickActionSummary}</p>
          </div>
          <nav
            aria-label="dashboard-view-navigation"
            className="hero-command-view-navigation"
          >
            <button
              type="button"
              className="secondary-button"
              onMouseEnter={onBookmarkWorkspacePreload}
              onFocus={onBookmarkWorkspacePreload}
              onPointerDown={onBookmarkWorkspacePreload}
              onClick={onBookmarkWorkspaceOpen}
            >
              북마크
            </button>
            <button
              type="button"
              className="secondary-button"
              onMouseEnter={onMemoPreload}
              onFocus={onMemoPreload}
              onPointerDown={onMemoPreload}
              onClick={onMemoOpen}
            >
              메모
            </button>
          </nav>
          <div
            role="toolbar"
            aria-label="quick-actions-toolbar"
            className="hero-command-toolbar"
          >
            <button
              type="button"
              className="primary-button"
              onMouseEnter={handlePrimaryCreatePreload}
              onFocus={handlePrimaryCreatePreload}
              onPointerDown={handlePrimaryCreatePreload}
              onClick={() => {
                onQuickActionsMenuOpenChange(false);
                handlePrimaryCreate();
              }}
            >
              {primaryCreateLabel}
            </button>
            <div
              className="folder-action-menu-shell hero-command-menu-shell"
              data-open-menu-shell={isQuickActionsMenuOpen ? "true" : undefined}
            >
              <button
                type="button"
                className="ghost-button overflow-trigger"
                aria-label="빠른 작업 더보기"
                aria-expanded={isQuickActionsMenuOpen}
                onClick={() =>
                  onQuickActionsMenuOpenChange((currentState) => !currentState)
                }
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
                    onMouseEnter={onFolderManagerPreload}
                    onFocus={onFolderManagerPreload}
                    onPointerDown={onFolderManagerPreload}
                    onClick={() => {
                      onQuickActionsMenuOpenChange(false);
                      onOpenFolderManager();
                    }}
                  >
                    새 폴더
                  </button>
                  <button
                    type="button"
                    className="secondary-button folder-action-menu-item"
                    aria-label="태그 관리"
                    onMouseEnter={onTagManagerPreload}
                    onFocus={onTagManagerPreload}
                    onPointerDown={onTagManagerPreload}
                    onClick={() => {
                      onQuickActionsMenuOpenChange(false);
                      onOpenTagManager();
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
        <button
          type="button"
          className="secondary-button hero-theme-toggle"
          aria-label={appThemeToggleLabel}
          aria-pressed={isDarkAppTheme}
          title={appThemeToggleLabel}
          onClick={onToggleAppTheme}
        >
          <span className="theme-toggle-icon" aria-hidden="true">
            {isDarkAppTheme ? "☀" : "◐"}
          </span>
          <span className="theme-toggle-label">
            {isDarkAppTheme ? "라이트" : "다크"}
          </span>
        </button>
        {shouldUseMobileSidebarPanels && sessionState.status === "authenticated" ? (
          <>
            <button
              type="button"
              className="primary-button hero-mobile-create-button"
              aria-label={mobilePrimaryCreateLabel}
              onMouseEnter={handlePrimaryCreatePreload}
              onFocus={handlePrimaryCreatePreload}
              onPointerDown={handlePrimaryCreatePreload}
              onClick={handlePrimaryCreate}
            >
              {isMemoView ? "새 메모" : "등록"}
            </button>
            <div
              className="folder-action-menu-shell hero-mobile-menu-shell"
              data-open-menu-shell={isMobileHeaderMenuOpen ? "true" : undefined}
            >
              <button
                type="button"
                className="ghost-button overflow-trigger hero-mobile-menu-trigger"
                aria-label="모바일 메뉴"
                aria-expanded={isMobileHeaderMenuOpen}
                onClick={() =>
                  onMobileHeaderMenuOpenChange((currentState) => !currentState)
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
                    onMouseEnter={onBookmarkWorkspacePreload}
                    onFocus={onBookmarkWorkspacePreload}
                    onPointerDown={onBookmarkWorkspacePreload}
                    onClick={() => {
                      onMobileHeaderMenuOpenChange(false);
                      onBookmarkWorkspaceOpen();
                    }}
                  >
                    북마크
                  </button>
                  <button
                    type="button"
                    className="secondary-button folder-action-menu-item"
                    onMouseEnter={onMemoPreload}
                    onFocus={onMemoPreload}
                    onPointerDown={onMemoPreload}
                    onClick={() => {
                      onMobileHeaderMenuOpenChange(false);
                      onMemoOpen();
                    }}
                  >
                    메모
                  </button>
                  <button
                    type="button"
                    className="secondary-button folder-action-menu-item"
                    onMouseEnter={onInstallHelpPreload}
                    onFocus={onInstallHelpPreload}
                    onPointerDown={onInstallHelpPreload}
                    onClick={() => void onPwaInstall()}
                  >
                    앱 설치
                  </button>
                  <button
                    type="button"
                    className="secondary-button folder-action-menu-item"
                    onMouseEnter={onFolderManagerPreload}
                    onFocus={onFolderManagerPreload}
                    onPointerDown={onFolderManagerPreload}
                    onClick={() => {
                      onMobileHeaderMenuOpenChange(false);
                      onOpenFolderManager();
                    }}
                  >
                    새 폴더
                  </button>
                  <button
                    type="button"
                    className="secondary-button folder-action-menu-item"
                    onMouseEnter={onTagManagerPreload}
                    onFocus={onTagManagerPreload}
                    onPointerDown={onTagManagerPreload}
                    onClick={() => {
                      onMobileHeaderMenuOpenChange(false);
                      onOpenTagManager();
                    }}
                  >
                    태그 관리
                  </button>
                  <button
                    type="button"
                    className="secondary-button folder-action-menu-item"
                    onMouseEnter={onExtensionDownloadPreload}
                    onFocus={onExtensionDownloadPreload}
                    onPointerDown={onExtensionDownloadPreload}
                    onClick={() => {
                      onMobileHeaderMenuOpenChange(false);
                      onOpenExtensionDownloadDialog();
                    }}
                  >
                    확장 다운로드
                  </button>
                  <button
                    type="button"
                    className="secondary-button folder-action-menu-item"
                    onMouseEnter={onExtensionTokenPreload}
                    onFocus={onExtensionTokenPreload}
                    onPointerDown={onExtensionTokenPreload}
                    onClick={() => void onOpenExtensionTokenDialog()}
                  >
                    확장 토큰
                  </button>
                  <button
                    type="button"
                    className="danger-button folder-action-menu-item"
                    onClick={() => void onLogout()}
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
            onMouseEnter={onInstallHelpPreload}
            onFocus={onInstallHelpPreload}
            onPointerDown={onInstallHelpPreload}
            onClick={() => void onPwaInstall()}
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
                onMouseEnter={onInstallHelpPreload}
                onFocus={onInstallHelpPreload}
                onPointerDown={onInstallHelpPreload}
                onClick={() => void onPwaInstall()}
              >
                앱 설치
              </button>
            ) : null}
            <button
              type="button"
              className="primary-button"
              onFocus={() => void onFirebaseAuthPreload()}
              onPointerDown={() => void onFirebaseAuthPreload()}
              onClick={() => void onGoogleLogin()}
            >
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
                onMouseEnter={onExtensionDownloadPreload}
                onFocus={onExtensionDownloadPreload}
                onPointerDown={onExtensionDownloadPreload}
                onClick={onOpenExtensionDownloadDialog}
              >
                확장 다운로드
              </button>
              <button
                type="button"
                className="secondary-button"
                aria-label="확장 토큰 관리"
                onMouseEnter={onExtensionTokenPreload}
                onFocus={onExtensionTokenPreload}
                onPointerDown={onExtensionTokenPreload}
                onClick={() => void onOpenExtensionTokenDialog()}
              >
                확장 토큰
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void onLogout()}
              >
                로그아웃
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </header>
  );
}
