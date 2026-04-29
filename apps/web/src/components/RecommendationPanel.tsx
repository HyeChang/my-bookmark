import { memo } from "react";
import type { Bookmark } from "@bookmark/shared";
import { renderHiddenBookmarkIndicator } from "./bookmark-preview-utils";
import "./RecommendationPanel.css";

type RecommendationPanelKind = "favorites" | "recent" | "frequent";

export type RecommendationCardViewModel = {
  itemKey: string;
  bookmark: Bookmark;
  reasonLabel: string;
  folderName: string;
  summaryText: string;
};

export type RecommendationPanelActions = {
  onOpen: (bookmark: Bookmark) => void | Promise<void>;
};

type RecommendationCardProps = {
  card: RecommendationCardViewModel;
  actions: RecommendationPanelActions;
};

export type RecommendationPanelProps = {
  ariaLabel?: string;
  className?: string;
  isEmbedded?: boolean;
  isHidden?: boolean;
  isLoading: boolean;
  cardsByKind: Record<RecommendationPanelKind, RecommendationCardViewModel[]>;
  actions: RecommendationPanelActions;
};

function RecommendationCard({ card, actions }: RecommendationCardProps) {
  const { bookmark, reasonLabel, folderName, summaryText } = card;
  const cardTitle = bookmark.displayTitle || bookmark.url;

  return (
    <li className="recommendation-item">
      <div className="recommendation-copy">
        <div className="recommendation-title-line">
          <strong>{cardTitle}</strong>
          {renderHiddenBookmarkIndicator(bookmark.isHidden === true)}
        </div>
        <p className="recommendation-meta-line">
          {reasonLabel} · {folderName}
        </p>
        <p className="muted-text">{summaryText}</p>
      </div>
      <button
        type="button"
        className="ghost-button recommendation-action-button"
        aria-label={`${cardTitle} 열기`}
        onClick={() => void actions.onOpen(bookmark)}
      >
        열기
      </button>
    </li>
  );
}

const MemoizedRecommendationCard = memo(RecommendationCard);

function RecommendationLoadingCard() {
  return (
    <div className="recommendation-loading-card" aria-hidden="true">
      <span className="recommendation-loading-orb" />
      <div className="recommendation-loading-copy">
        <span className="recommendation-loading-line recommendation-loading-line-strong" />
        <span className="recommendation-loading-line recommendation-loading-line-soft" />
      </div>
      <span className="recommendation-loading-action" />
    </div>
  );
}

function RecommendationColumn({
  label,
  recommendationCards,
  isLoading,
  actions
}: {
  label: string;
  recommendationCards: RecommendationCardViewModel[];
  isLoading: boolean;
  actions: RecommendationPanelActions;
}) {
  return (
    <div className="recommendation-column">
      <h3>{label}</h3>
      {isLoading ? <RecommendationLoadingCard /> : null}
      {!isLoading && recommendationCards.length === 0 ? (
        <p className="quiet-empty-state recommendation-empty-state">없음</p>
      ) : null}
      {!isLoading ? (
        <ul className="recommendation-list">
          {recommendationCards.map((card) => (
            <MemoizedRecommendationCard
              key={card.itemKey}
              card={card}
              actions={actions}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function RecommendationPanel({
  ariaLabel,
  className,
  isEmbedded,
  isHidden,
  isLoading,
  cardsByKind,
  actions
}: RecommendationPanelProps) {
  const sectionClassName = `${
    isEmbedded ? "recommendation-panel-card" : "surface-card panel-card recommendation-panel-card"
  }${isLoading ? " recommendation-panel-card-loading" : ""}${
    className ? ` ${className}` : ""
  }${isHidden ? " dashboard-panel-visually-hidden" : ""}`;

  return (
    <section
      aria-label={ariaLabel ?? "recommendation-list"}
      className={sectionClassName}
      aria-busy={isLoading}
    >
      <header className="recommendation-panel-header">
        <p className="recommendation-panel-kicker">빠른 진입점</p>
        <div className="recommendation-panel-title-row">
          <h2>추천</h2>
          <p className="recommendation-panel-helper" aria-live="polite">
            {isLoading ? "추천을 준비하는 중" : "자주 여는 링크"}
          </p>
        </div>
      </header>
      <div className="recommendation-grid">
        <RecommendationColumn
          label="즐겨찾기"
          recommendationCards={cardsByKind.favorites}
          isLoading={isLoading}
          actions={actions}
        />
        <RecommendationColumn
          label="최근"
          recommendationCards={cardsByKind.recent}
          isLoading={isLoading}
          actions={actions}
        />
        <RecommendationColumn
          label="반복"
          recommendationCards={cardsByKind.frequent}
          isLoading={isLoading}
          actions={actions}
        />
      </div>
    </section>
  );
}
