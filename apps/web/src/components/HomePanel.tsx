import { memo, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { Bookmark, BookmarkAsset } from "@bookmark/shared";
import {
  getBookmarkAssetCardImageUrl,
  getHomeFavoriteImageLoadingPriority,
  type BookmarkImageLoadingPriority
} from "../lib/bookmark-image-loading";
import {
  hasTextContent,
  renderHiddenBookmarkIndicator
} from "./bookmark-preview-utils";
import {
  useActionMenuPlacement
} from "./action-menu-placement";
import "./BookmarkAssetGrid.css";
import "./BookmarkCard.css";
import "./HomePanel.css";

const HOME_FAVORITE_ACTION_MENU_ESTIMATED_HEIGHT = 96;

type HomeFavoriteTagItem = {
  id: string;
  name: string;
  color: string | null;
};

export type HomeFavoriteCardViewModel = {
  bookmark: Bookmark;
  coverAsset: BookmarkAsset | null;
  folderName: string;
  previewText: string;
  visibleTagItems: HomeFavoriteTagItem[];
  menuId: string;
};

export type HomePanelActions = {
  onOpen: (bookmark: Bookmark) => void | Promise<void>;
  onOpenDetailDialog: (bookmark: Bookmark) => void | Promise<void>;
  onCopyUrl: (bookmark: Bookmark) => void | Promise<void>;
  onToggleActionMenu: (bookmarkId: string) => void | Promise<void>;
  onEdit: (bookmark: Bookmark) => void | Promise<void>;
  onDelete: (bookmark: Bookmark) => void | Promise<void>;
};

type HomeFavoriteCardProps = {
  card: HomeFavoriteCardViewModel;
  imageLoadingPriority: BookmarkImageLoadingPriority;
  isActionMenuOpen: boolean;
  actions: HomePanelActions;
};

type HomePanelProps = {
  isLoadingDashboard: boolean;
  homeFavoriteBookmarkCount: number;
  homeFavoriteCards: HomeFavoriteCardViewModel[];
  isHomeRecommendationOpen: boolean;
  openBookmarkActionMenuId: string | null;
  actions: HomePanelActions;
  onToggleRecommendations: () => void;
  recommendationPanel: ReactNode;
};

function HomeFavoriteCard({
  card,
  imageLoadingPriority,
  isActionMenuOpen,
  actions
}: HomeFavoriteCardProps) {
  const {
    bookmark,
    coverAsset,
    folderName,
    previewText,
    visibleTagItems,
    menuId
  } = card;
  const cardTitle = bookmark.displayTitle || bookmark.url;
  const accentStyle: CSSProperties | undefined =
    bookmark.bookmarkColor || bookmark.urlColor
      ? ({
          "--bookmark-accent-color": bookmark.bookmarkColor ?? undefined,
          "--bookmark-url-color": bookmark.urlColor ?? undefined
        } as CSSProperties)
      : undefined;
  const { actionMenuPlacement, updateActionMenuPlacement } =
    useActionMenuPlacement("below", HOME_FAVORITE_ACTION_MENU_ESTIMATED_HEIGHT);
  const handleActionMenuToggle = (event: MouseEvent<HTMLButtonElement>) => {
    if (!isActionMenuOpen && typeof window !== "undefined") {
      updateActionMenuPlacement(event);
    }

    void actions.onToggleActionMenu(menuId);
  };

  return (
    <li
      className={`bookmark-card home-favorite-card${
        bookmark.bookmarkColor ? " home-favorite-card-has-accent" : ""
      }`}
      data-open-action-menu={isActionMenuOpen ? "true" : undefined}
      style={accentStyle}
    >
      {coverAsset ? (
        <div className="asset-grid home-favorite-cover">
          <img
            src={getBookmarkAssetCardImageUrl(coverAsset)}
            alt="업로드 이미지 1"
            loading={imageLoadingPriority.loading}
            decoding="async"
            fetchPriority={imageLoadingPriority.fetchPriority}
            sizes="(max-width: 720px) 100vw, 180px"
          />
        </div>
      ) : null}
      <div className="home-favorite-main">
        <div className="bookmark-title-line">
          <strong>{cardTitle}</strong>
          {renderHiddenBookmarkIndicator(bookmark.isHidden === true)}
        </div>
        <p
          className={`muted-text home-favorite-url${
            bookmark.urlColor ? " home-favorite-url-accent" : ""
          }`}
          title={bookmark.url}
        >
          {bookmark.url}
        </p>
        {hasTextContent(previewText) ? (
          <p className="bookmark-row-summary home-favorite-summary">
            {previewText}
          </p>
        ) : null}
        <div className="bookmark-row-meta-line home-favorite-meta">
          <span className="bookmark-row-meta-item">{folderName}</span>
          {visibleTagItems.map((tag) => (
            <span key={`home-${bookmark.id}-${tag.id}`} className="bookmark-row-meta-item">
              {tag.name}
            </span>
          ))}
        </div>
      </div>
      <div className="action-row bookmark-card-actions bookmark-row-actions home-favorite-actions">
        <button
          type="button"
          className="primary-button bookmark-row-primary-action"
          aria-label={`${cardTitle} 열기`}
          onClick={() => void actions.onOpen(bookmark)}
        >
          열기
        </button>
        <div className="bookmark-card-secondary-actions">
          <button
            type="button"
            className="secondary-button bookmark-row-detail-action"
            aria-label={`${cardTitle} 상세 보기`}
            onClick={() => void actions.onOpenDetailDialog(bookmark)}
          >
            상세
          </button>
          <button
            type="button"
            className="ghost-button folder-action-trigger bookmark-url-copy-button"
            aria-label={`${cardTitle} URL 복사`}
            title="URL 복사"
            onClick={() => void actions.onCopyUrl(bookmark)}
          >
            <span className="bookmark-url-copy-icon" aria-hidden="true" />
          </button>
          <div
            className="folder-action-menu-shell bookmark-card-menu-shell"
            data-open-menu-shell={isActionMenuOpen ? "true" : undefined}
          >
            <button
              type="button"
              className="ghost-button folder-action-trigger overflow-trigger"
              aria-label={`${cardTitle} 북마크 더보기`}
              aria-expanded={isActionMenuOpen}
              onClick={handleActionMenuToggle}
            >
              ...
            </button>
            {isActionMenuOpen ? (
              <div
                role="menu"
                aria-label={`${cardTitle} 북마크 메뉴`}
                className="folder-action-menu bookmark-card-action-menu"
                data-menu-placement={actionMenuPlacement}
              >
                <button
                  type="button"
                  className="secondary-button folder-action-menu-item bookmark-card-action-menu-item"
                  onClick={() => void actions.onEdit(bookmark)}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="danger-button folder-action-menu-item bookmark-card-action-menu-item"
                  onClick={() => void actions.onDelete(bookmark)}
                >
                  삭제
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

const MemoizedHomeFavoriteCard = memo(HomeFavoriteCard);

export default function HomePanel({
  isLoadingDashboard,
  homeFavoriteBookmarkCount,
  homeFavoriteCards,
  isHomeRecommendationOpen,
  openBookmarkActionMenuId,
  actions,
  onToggleRecommendations,
  recommendationPanel
}: HomePanelProps) {
  return (
    <section aria-label="home-page" className="surface-card panel-card home-page">
      <header className="home-page-header">
        <div className="home-page-title-block">
          <p className="bookmark-list-kicker">홈</p>
          <div className="home-page-title-row">
            <h2>홈</h2>
            <span className="home-page-count">즐겨찾기 {homeFavoriteBookmarkCount}개</span>
          </div>
        </div>
        <button
          type="button"
          className={`home-recommendation-toggle${
            isHomeRecommendationOpen ? " home-recommendation-toggle-active" : ""
          }`}
          aria-label="추천 보기"
          aria-pressed={isHomeRecommendationOpen}
          onClick={onToggleRecommendations}
        >
          <span className="home-recommendation-toggle-label">추천</span>
          <span className="home-recommendation-toggle-track" aria-hidden="true">
            <span className="home-recommendation-toggle-thumb" />
          </span>
        </button>
      </header>
      {isLoadingDashboard ? (
        <div className="bookmark-loading-state" role="status" aria-live="polite">
          <span className="bookmark-loading-spinner" aria-hidden="true" />
          <span>홈을 불러오는 중입니다.</span>
        </div>
      ) : null}
      {!isLoadingDashboard && homeFavoriteCards.length === 0 ? (
        <p className="quiet-empty-state home-page-empty-state">즐겨찾기가 없습니다.</p>
      ) : null}
      {!isLoadingDashboard && homeFavoriteCards.length > 0 ? (
        <ul className="home-favorite-grid">
          {homeFavoriteCards.map((card, index) => {
            const imageLoadingPriority = getHomeFavoriteImageLoadingPriority(index);

            return (
              <MemoizedHomeFavoriteCard
                key={card.menuId}
                card={card}
                imageLoadingPriority={imageLoadingPriority}
                isActionMenuOpen={openBookmarkActionMenuId === card.menuId}
                actions={actions}
              />
            );
          })}
        </ul>
      ) : null}
      {isHomeRecommendationOpen ? recommendationPanel : null}
    </section>
  );
}
