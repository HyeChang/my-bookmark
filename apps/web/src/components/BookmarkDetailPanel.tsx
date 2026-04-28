import type {
  Bookmark,
  BookmarkAsset,
  BookmarkExtractPreview
} from "@bookmark/shared";
import {
  getBookmarkPreviewArticleBlocks,
  getBookmarkPreviewImageAlt,
  hasBookmarkPreviewCoverImage,
  renderBookmarkPreviewArticle,
  renderHiddenBookmarkIndicator
} from "./bookmark-preview-utils";

type BookmarkDetailTab = "detail" | "preview" | "extract";
type MaybePromise = void | Promise<void>;

export type BookmarkDetailFieldRow = {
  label: string;
  value: string | null | undefined;
};

export type BookmarkDetailTagItem = {
  id: string;
  name: string;
};

export type BookmarkDetailPanelProps = {
  bookmark: Bookmark | null;
  closeLabel: string;
  activeTab: BookmarkDetailTab;
  isPreviewFullscreen: boolean;
  isLoadingBookmark: boolean;
  isLoadingAssets: boolean;
  isLoadingPreview: boolean;
  statusMessage: string | null;
  folderName: string;
  summaryStateLabel: string;
  visibleTagItems: BookmarkDetailTagItem[];
  remainingTagCount: number;
  assets: BookmarkAsset[];
  userRows: BookmarkDetailFieldRow[];
  sourceRows: BookmarkDetailFieldRow[];
  livePreview: BookmarkExtractPreview | null;
  livePreviewRows: BookmarkDetailFieldRow[];
  previewError: string | null;
  previewNotice: string | null;
  isActionMenuOpen: boolean;
  onClose: () => void;
  onSelectTab: (tab: BookmarkDetailTab) => void;
  onTogglePreviewFullscreen: () => void;
  onToggleActionMenu: () => void;
  onBookmarkOpen: (bookmark: Bookmark) => MaybePromise;
  onBookmarkRestore: (bookmark: Bookmark) => MaybePromise;
  onBookmarkPermanentDelete: (bookmark: Bookmark) => MaybePromise;
  onBookmarkEdit: (bookmark: Bookmark) => MaybePromise;
  onBookmarkReextract: (bookmarkId: string) => MaybePromise;
  onResetSourceContent: (bookmarkId: string) => MaybePromise;
  onResetUserContent: (bookmarkId: string) => MaybePromise;
  onBookmarkDelete: (bookmark: Bookmark) => MaybePromise;
};

function BookmarkDetailPlaceholder() {
  return (
    <section className="surface-card panel-card bookmark-detail-placeholder">
      <p className="bookmark-detail-kicker">읽기 중심</p>
      <h2>북마크를 불러오는 중입니다</h2>
      <p className="muted-text">상세 내용을 준비하고 있습니다.</p>
    </section>
  );
}

export default function BookmarkDetailPanel({
  bookmark,
  closeLabel,
  activeTab,
  isPreviewFullscreen,
  isLoadingBookmark,
  isLoadingAssets,
  isLoadingPreview,
  statusMessage,
  folderName,
  summaryStateLabel,
  visibleTagItems,
  remainingTagCount,
  assets,
  userRows,
  sourceRows,
  livePreview,
  livePreviewRows,
  previewError,
  previewNotice,
  isActionMenuOpen,
  onClose,
  onSelectTab,
  onTogglePreviewFullscreen,
  onToggleActionMenu,
  onBookmarkOpen,
  onBookmarkRestore,
  onBookmarkPermanentDelete,
  onBookmarkEdit,
  onBookmarkReextract,
  onResetSourceContent,
  onResetUserContent,
  onBookmarkDelete
}: BookmarkDetailPanelProps) {
  if (!bookmark) {
    return <BookmarkDetailPlaceholder />;
  }

  const previewFullscreenLabel = isPreviewFullscreen
    ? "미리보기 전체화면 종료"
    : "미리보기 전체화면";
  const livePreviewBlocks = getBookmarkPreviewArticleBlocks(livePreview);
  const title = bookmark.displayTitle || bookmark.url;
  const renderBookmarkPreviewFullscreenButton = (extraClassName = "") => (
    <button
      type="button"
      className={`ghost-button bookmark-detail-window-button bookmark-preview-fullscreen-button${extraClassName}`}
      aria-label={previewFullscreenLabel}
      aria-pressed={isPreviewFullscreen}
      title={previewFullscreenLabel}
      onClick={onTogglePreviewFullscreen}
    >
      <span aria-hidden="true">{isPreviewFullscreen ? "↙" : "↗"}</span>
      <span className="bookmark-detail-window-button-label">
        {isPreviewFullscreen ? "전체화면 종료" : "전체화면"}
      </span>
    </button>
  );

  return (
    <section
      aria-label="bookmark-detail"
      className={`surface-card panel-card bookmark-detail-card${
        isPreviewFullscreen ? " bookmark-detail-card-preview-fullscreen" : ""
      }`}
      aria-busy={isLoadingBookmark || isLoadingAssets || isLoadingPreview}
      style={
        bookmark.bookmarkColor
          ? {
              borderLeftColor: bookmark.bookmarkColor,
              borderLeftWidth: "3px"
            }
          : undefined
      }
    >
      {isPreviewFullscreen ? (
        <div className="bookmark-preview-fullscreen-controls">
          {renderBookmarkPreviewFullscreenButton(" bookmark-preview-fullscreen-floating-button")}
        </div>
      ) : null}
      {!isPreviewFullscreen ? (
        <>
          <header className="bookmark-detail-header">
            <div className="bookmark-detail-top-row">
              <p className="bookmark-detail-kicker">읽기 중심</p>
              <div className="bookmark-detail-window-actions">
                {activeTab === "preview" ? renderBookmarkPreviewFullscreenButton() : null}
                <button
                  type="button"
                  className="ghost-button bookmark-detail-close-button"
                  aria-label="상세 창 닫기"
                  onClick={onClose}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            </div>
            {statusMessage ? (
              <p className="bookmark-detail-loading-status" aria-live="polite">
                {statusMessage}
              </p>
            ) : null}
            <div className="bookmark-detail-title-row">
              <div className="bookmark-detail-title-copy">
                <h2>북마크 상세</h2>
                <div className="bookmark-detail-title-line">
                  <strong>{title}</strong>
                  {renderHiddenBookmarkIndicator(bookmark.isHidden === true)}
                </div>
              </div>
              <p
                className="muted-text bookmark-detail-url"
                title={bookmark.url}
                style={bookmark.urlColor ? { color: bookmark.urlColor } : undefined}
              >
                {bookmark.url}
              </p>
            </div>
          </header>
          <div className="bookmark-detail-meta">
            <div className="bookmark-detail-meta-line bookmark-detail-meta-primary">
              <span className="bookmark-detail-meta-item">{folderName}</span>
              <span className="bookmark-detail-meta-item">{summaryStateLabel}</span>
              {bookmark.isTrashed ? (
                <span className="bookmark-detail-meta-item">휴지통</span>
              ) : null}
            </div>
            {visibleTagItems.length > 0 ||
            remainingTagCount > 0 ||
            assets.length > 0 ? (
              <div className="bookmark-detail-meta-line">
                {visibleTagItems.map((tag) => (
                  <span key={`${bookmark.id}-${tag.id}`} className="bookmark-detail-meta-item">
                    {tag.name}
                  </span>
                ))}
                {remainingTagCount > 0 ? (
                  <span className="bookmark-detail-meta-item">+{remainingTagCount}</span>
                ) : null}
                {assets.length > 0 ? (
                  <span className="bookmark-detail-meta-item">이미지 {assets.length}</span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div role="tablist" aria-label="bookmark-detail-tabs" className="bookmark-detail-tabs">
            <button
              type="button"
              role="tab"
              id="bookmark-detail-tab-detail"
              aria-selected={activeTab === "detail"}
              aria-controls="bookmark-detail-panel-detail"
              className={`bookmark-detail-tab${
                activeTab === "detail" ? " bookmark-detail-tab-active" : ""
              }`}
              onClick={() => onSelectTab("detail")}
            >
              상세
            </button>
            <button
              type="button"
              role="tab"
              id="bookmark-detail-tab-preview"
              aria-selected={activeTab === "preview"}
              aria-controls="bookmark-detail-panel-preview"
              className={`bookmark-detail-tab${
                activeTab === "preview" ? " bookmark-detail-tab-active" : ""
              }`}
              onClick={() => onSelectTab("preview")}
            >
              미리보기
            </button>
            <button
              type="button"
              role="tab"
              id="bookmark-detail-tab-extract"
              aria-selected={activeTab === "extract"}
              aria-controls="bookmark-detail-panel-extract"
              className={`bookmark-detail-tab${
                activeTab === "extract" ? " bookmark-detail-tab-active" : ""
              }`}
              onClick={() => onSelectTab("extract")}
            >
              추출 정보
            </button>
          </div>
        </>
      ) : null}

      {activeTab === "detail" ? (
        <div
          role="tabpanel"
          id="bookmark-detail-panel-detail"
          aria-labelledby="bookmark-detail-tab-detail"
          className="bookmark-detail-tab-panel"
        >
          <section className="detail-block">
            <h3>직접 정리</h3>
            {userRows.map((row) => (
              <div key={row.label} className="detail-row">
                <p className="detail-row-label">{row.label}</p>
                <p className="detail-row-value">{row.value}</p>
              </div>
            ))}
            {userRows.length === 0 ? (
              <p className="quiet-empty-state">사용자 입력값이 없습니다.</p>
            ) : null}
          </section>

          {assets.length > 0 ? (
            <div className="asset-grid">
              {assets.map((asset, index) => (
                <img key={asset.id} src={asset.contentUrl} alt={`업로드 이미지 ${index + 1}`} />
              ))}
            </div>
          ) : isLoadingAssets ? (
            <p className="quiet-empty-state" aria-live="polite">
              이미지를 불러오는 중...
            </p>
          ) : (
            <p className="quiet-empty-state">이미지가 없습니다.</p>
          )}
        </div>
      ) : activeTab === "preview" ? (
        <div
          role="tabpanel"
          id="bookmark-detail-panel-preview"
          aria-labelledby="bookmark-detail-tab-preview"
          className="bookmark-detail-tab-panel bookmark-detail-preview-panel"
        >
          {isLoadingPreview ? (
            <p className="quiet-empty-state" aria-live="polite">
              최신 미리보기를 불러오는 중...
            </p>
          ) : null}
          {previewError ? (
            <p className="bookmark-preview-error" aria-live="polite">
              {previewError}
            </p>
          ) : null}
          {previewNotice ? (
            <p className="bookmark-preview-note" aria-live="polite">
              {previewNotice}
            </p>
          ) : null}
          <section className="detail-block">
            <h3>최신 미리보기</h3>
            {hasBookmarkPreviewCoverImage(livePreview) && livePreview?.sourceImageUrl ? (
              <img
                className="bookmark-preview-image"
                src={livePreview.sourceImageUrl}
                alt={getBookmarkPreviewImageAlt(livePreview)}
              />
            ) : null}
            {livePreview ? renderBookmarkPreviewArticle(livePreview) : null}
            {livePreviewRows.map((row) => (
              <div key={row.label} className="detail-row">
                <p className="detail-row-label">{row.label}</p>
                <p className="detail-row-value">{row.value}</p>
              </div>
            ))}
            {livePreviewRows.length === 0 &&
            livePreviewBlocks.length === 0 &&
            livePreview &&
            !isLoadingPreview ? (
              <p className="quiet-empty-state">최신 미리보기 결과가 없습니다.</p>
            ) : null}
            {!livePreview && !isLoadingPreview && !previewError ? (
              <p className="quiet-empty-state">
                미리보기 탭을 열면 최신 웹페이지를 불러옵니다.
              </p>
            ) : null}
          </section>
        </div>
      ) : (
        <div
          role="tabpanel"
          id="bookmark-detail-panel-extract"
          aria-labelledby="bookmark-detail-tab-extract"
          className="bookmark-detail-tab-panel"
        >
          <section className="detail-block bookmark-detail-extract-block">
            <h3>저장된 자동 추출</h3>
            {sourceRows.map((row) => (
              <div key={row.label} className="detail-row">
                <p className="detail-row-label">{row.label}</p>
                <p className="detail-row-value">{row.value}</p>
              </div>
            ))}
            {sourceRows.length === 0 ? (
              <p className="quiet-empty-state">자동 추출값이 없습니다.</p>
            ) : null}
          </section>
        </div>
      )}

      {!isPreviewFullscreen ? (
        <div className="bookmark-detail-actions">
          <button
            type="button"
            className="primary-button"
            aria-label={bookmark.isTrashed ? `${title} 복구` : `${title} 열기`}
            onClick={() =>
              bookmark.isTrashed
                ? void onBookmarkRestore(bookmark)
                : void onBookmarkOpen(bookmark)
            }
          >
            {bookmark.isTrashed ? "복구" : "열기"}
          </button>
          <div className="bookmark-detail-secondary-actions">
            <button type="button" className="ghost-button" aria-label="상세 닫기" onClick={onClose}>
              {closeLabel}
            </button>
            <div
              className="folder-action-menu-shell bookmark-detail-menu-shell"
              data-open-menu-shell={isActionMenuOpen ? "true" : undefined}
            >
              <button
                type="button"
                className="ghost-button folder-action-trigger overflow-trigger"
                aria-label="상세 작업 더보기"
                aria-expanded={isActionMenuOpen}
                onClick={onToggleActionMenu}
              >
                ...
              </button>
              {isActionMenuOpen ? (
                <div
                  role="menu"
                  aria-label="상세 작업 메뉴"
                  className="folder-action-menu bookmark-detail-action-menu"
                >
                  {bookmark.isTrashed ? (
                    <>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void onBookmarkRestore(bookmark)}
                      >
                        복구
                      </button>
                      <button
                        type="button"
                        className="danger-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void onBookmarkPermanentDelete(bookmark)}
                      >
                        영구 삭제
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void onBookmarkEdit(bookmark)}
                      >
                        수정 시작
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void onBookmarkReextract(bookmark.id)}
                      >
                        자동 추출 다시 시도
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void onResetSourceContent(bookmark.id)}
                      >
                        자동 추출 초기화
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void onResetUserContent(bookmark.id)}
                      >
                        사용자 입력 초기화
                      </button>
                      <button
                        type="button"
                        className="danger-button folder-action-menu-item bookmark-detail-action-menu-item"
                        onClick={() => void onBookmarkDelete(bookmark)}
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
