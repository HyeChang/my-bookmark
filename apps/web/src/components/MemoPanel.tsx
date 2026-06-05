import type {
  Memo,
  MemoFolder,
  MemoTag,
  MemoViewMode
} from "@bookmark/shared";
import "./MemoPanel.css";

type MemoPanelActionResult = void | Promise<void>;

type MemoImageLoadingPriority = {
  loading: "eager" | "lazy";
  fetchPriority: "high" | "low";
};

export type MemoPanelProps = {
  activeTagId: string | null;
  folders: MemoFolder[];
  isFavoriteOnly: boolean;
  isLoading: boolean;
  showHiddenMemos: boolean;
  memos: Memo[];
  query: string;
  tags: MemoTag[];
  totalCount: number | null;
  viewMode: MemoViewMode;
  onCreateMemo: () => MemoPanelActionResult;
  onDeleteMemo: (memo: Memo) => MemoPanelActionResult;
  onEditMemo: (memo: Memo) => MemoPanelActionResult;
  onFavoriteOnlyChange: (value: boolean) => void;
  onMemoComposerPreload?: () => void;
  onHiddenMemosToggle: () => MemoPanelActionResult;
  onQueryChange: (query: string) => void;
  onTagFilterChange: (tagId: string | null) => void;
  onViewModeChange: (viewMode: MemoViewMode) => void;
};

const EAGER_MEMO_IMAGE_LOADING_PRIORITY: MemoImageLoadingPriority = {
  loading: "eager",
  fetchPriority: "high"
};

const LAZY_MEMO_IMAGE_LOADING_PRIORITY: MemoImageLoadingPriority = {
  loading: "lazy",
  fetchPriority: "low"
};

const ABOVE_FOLD_MEMO_LIST_IMAGE_COUNT = 4;
const ABOVE_FOLD_MEMO_CARD_IMAGE_COUNT = 2;

function getMemoFolderName(folderId: string | null, foldersById: Map<string, MemoFolder>) {
  if (!folderId) {
    return "미분류";
  }

  return foldersById.get(folderId)?.name ?? "알 수 없는 폴더";
}

function getMemoTagItems(tagIds: string[], tagsById: Map<string, MemoTag>) {
  return tagIds.map((tagId) => ({
    id: tagId,
    name: tagsById.get(tagId)?.name ?? tagId,
    color: tagsById.get(tagId)?.color ?? null
  }));
}

function getMemoAssetImageUrl(memo: Memo) {
  return memo.coverAsset?.thumbnailUrl ?? memo.coverAsset?.contentUrl ?? null;
}

function getMemoImageLoadingPriority(
  index: number,
  mode: MemoViewMode
): MemoImageLoadingPriority {
  const eagerImageCount =
    mode === "card" ? ABOVE_FOLD_MEMO_CARD_IMAGE_COUNT : ABOVE_FOLD_MEMO_LIST_IMAGE_COUNT;

  return index >= 0 && index < eagerImageCount
    ? EAGER_MEMO_IMAGE_LOADING_PRIORITY
    : LAZY_MEMO_IMAGE_LOADING_PRIORITY;
}

function renderMemoTagSummary(memoTags: ReturnType<typeof getMemoTagItems>, maxVisibleTags: number) {
  if (memoTags.length === 0) {
    return <span className="memo-result-tag-empty">태그 없음</span>;
  }

  const visibleTags = memoTags.slice(0, maxVisibleTags);
  const hiddenTags = memoTags.slice(maxVisibleTags);
  const tagLabel = memoTags.map((tag) => tag.name).join(", ");

  return (
    <span className="memo-result-tags" title={tagLabel} aria-label={`태그 ${tagLabel}`}>
      {visibleTags.map((tag) => (
        <span key={tag.id} className="memo-result-tag">
          {tag.color ? (
            <span
              aria-hidden="true"
              className="memo-result-tag-dot"
              style={{ backgroundColor: tag.color }}
            />
          ) : null}
          <span>{tag.name}</span>
        </span>
      ))}
      {hiddenTags.length > 0 ? (
        <span className="memo-result-tag memo-result-tag-more">+{hiddenTags.length}</span>
      ) : null}
    </span>
  );
}

function renderMemoImagePreview(
  memo: Memo,
  mode: MemoViewMode,
  imageLoadingPriority: MemoImageLoadingPriority
) {
  if (memo.isLocked) {
    return (
      <span
        aria-label="잠금 메모 이미지 숨김"
        className={`memo-result-image-preview memo-result-image-preview-${mode} memo-result-image-empty memo-result-image-locked`}
      >
        <span aria-hidden="true">🔒</span>
      </span>
    );
  }

  const imageUrl = getMemoAssetImageUrl(memo);
  const label = memo.assetCount > 0 ? `이미지 ${memo.assetCount}개` : "이미지 없음";

  if (!imageUrl) {
    return (
      <span
        aria-label={label}
        className={`memo-result-image-preview memo-result-image-preview-${mode} memo-result-image-empty`}
      >
        {memo.memoColor ? (
          <span
            aria-hidden="true"
            className="memo-result-color"
            style={{ backgroundColor: memo.memoColor }}
          />
        ) : null}
      </span>
    );
  }

  return (
    <span
      aria-label={label}
      className={`memo-result-image-preview memo-result-image-preview-${mode}`}
    >
      <img
        src={imageUrl}
        alt={`${memo.title} 첨부 이미지`}
        loading={imageLoadingPriority.loading}
        decoding="async"
        fetchPriority={imageLoadingPriority.fetchPriority}
        sizes={mode === "card" ? "(max-width: 720px) 100vw, 320px" : "48px"}
      />
    </span>
  );
}

function formatMemoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric"
  }).format(date);
}

export default function MemoPanel({
  activeTagId,
  folders,
  isFavoriteOnly,
  isLoading,
  showHiddenMemos,
  memos,
  query,
  tags,
  totalCount,
  viewMode,
  onCreateMemo,
  onDeleteMemo,
  onEditMemo,
  onFavoriteOnlyChange,
  onMemoComposerPreload,
  onHiddenMemosToggle,
  onQueryChange,
  onTagFilterChange,
  onViewModeChange
}: MemoPanelProps) {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder] as const));
  const tagsById = new Map(tags.map((tag) => [tag.id, tag] as const));
  const hiddenMemoToggleLabel = showHiddenMemos ? "숨김 메모 숨기기" : "숨김 메모 보기";

  return (
    <section
      aria-label="memo-workspace"
      aria-busy={isLoading}
      className="surface-card panel-card memo-panel"
    >
      <header className="memo-panel-header">
        <div className="memo-panel-title-block">
          <p className="bookmark-list-kicker">메모</p>
          <div className="memo-panel-title-row">
            <h2>메모</h2>
            <span className="memo-panel-count">
              {totalCount ?? memos.length}개
            </span>
          </div>
        </div>
        <div className="memo-panel-actions">
          <button
            type="button"
            className="ghost-button memo-hidden-toggle"
            aria-label={hiddenMemoToggleLabel}
            aria-pressed={showHiddenMemos}
            title={hiddenMemoToggleLabel}
            onClick={() => void onHiddenMemosToggle()}
          >
            <span aria-hidden="true">{showHiddenMemos ? "🔓" : "🔒"}</span>
          </button>
          <button
            type="button"
            className="primary-button memo-create-button"
            onFocus={onMemoComposerPreload}
            onMouseEnter={onMemoComposerPreload}
            onPointerDown={onMemoComposerPreload}
            onClick={() => void onCreateMemo()}
          >
            새 메모
          </button>
        </div>
      </header>

      <div className="memo-toolbar">
        <label className="memo-search-field">
          <span>검색</span>
          <input
            type="search"
            aria-label="메모 검색"
            value={query}
            placeholder="제목 또는 본문 검색"
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
        </label>
        <div className="memo-segmented-control" aria-label="보기 방식">
          <button
            type="button"
            aria-pressed={viewMode === "list"}
            onClick={() => onViewModeChange("list")}
          >
            리스트
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "card"}
            onClick={() => onViewModeChange("card")}
          >
            카드
          </button>
        </div>
        <button
          type="button"
          className="secondary-button memo-favorite-filter"
          aria-pressed={isFavoriteOnly}
          onClick={() => onFavoriteOnlyChange(!isFavoriteOnly)}
        >
          즐겨찾기만
        </button>
      </div>

      <div className="memo-filter-layout">
        <section
          role="group"
          aria-label="태그 필터"
          className="memo-filter-section memo-tag-filter-section"
        >
          <div className="memo-filter-heading-row">
            <h3>태그</h3>
            <span>{tags.length}개</span>
          </div>
          <div className="memo-tag-chip-list">
            <button
              type="button"
              className="memo-tag-chip"
              aria-pressed={activeTagId === null}
              onClick={() => onTagFilterChange(null)}
            >
              전체
            </button>
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="memo-tag-chip"
                aria-pressed={activeTagId === tag.id}
                onClick={() => onTagFilterChange(tag.id)}
              >
                {tag.color ? (
                  <span
                    aria-hidden="true"
                    className="memo-filter-swatch"
                    style={{ backgroundColor: tag.color }}
                  />
                ) : null}
                <span>{tag.name}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {memos.length === 0 ? (
        <p className="quiet-empty-state memo-empty-state">
          {isLoading ? "메모를 불러오는 중입니다." : "표시할 메모가 없습니다."}
        </p>
      ) : (
        <ul
          aria-label="memo-result-list"
          className={`memo-result-list memo-result-list-${viewMode}`}
        >
          {memos.map((memo, index) => {
            const memoTags = getMemoTagItems(memo.tagIds, tagsById);
            const folderName = getMemoFolderName(memo.folderId, foldersById);
            const updatedDate = formatMemoDate(memo.updatedAt);
            const createdDate = formatMemoDate(memo.createdAt);
            const imageLoadingPriority = getMemoImageLoadingPriority(index, viewMode);

            return (
              <li key={memo.id} className="memo-result-item">
                <article className={`memo-result-card memo-result-card-${viewMode}`}>
                  <button
                    type="button"
                    className="memo-result-open-button"
                    aria-label={`${memo.title} 메모 편집`}
                    onFocus={onMemoComposerPreload}
                    onMouseEnter={onMemoComposerPreload}
                    onPointerDown={onMemoComposerPreload}
                    onClick={() => void onEditMemo(memo)}
                  >
                    <div className="memo-result-main">
                      {renderMemoImagePreview(memo, viewMode, imageLoadingPriority)}
                      <div className="memo-result-title-row">
                        {memo.memoColor ? (
                          <span
                            aria-hidden="true"
                            className="memo-result-color"
                            style={{ backgroundColor: memo.memoColor }}
                          />
                        ) : null}
                        <strong>{memo.title}</strong>
                        {memo.isFavorite ? (
                          <span className="memo-favorite-badge">즐겨찾기</span>
                        ) : null}
                        {memo.isHidden ? (
                          <span className="memo-hidden-badge">숨김</span>
                        ) : null}
                        {memo.isLocked ? (
                          <span className="memo-locked-badge">잠금</span>
                        ) : null}
                      </div>
                      <p className="memo-result-content">
                        {memo.isLocked
                          ? "잠금 메모입니다."
                          : memo.contentText || "본문이 없습니다."}
                      </p>
                      <div className="memo-result-meta">
                        {renderMemoTagSummary(memoTags, viewMode === "card" ? 2 : 1)}
                        <span className="memo-result-folder">{folderName}</span>
                        <span className="memo-result-date">수정 {updatedDate}</span>
                        <span className="memo-result-date">등록 {createdDate}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="danger-button memo-result-delete-button"
                    aria-label={`${memo.title} 메모 삭제`}
                    onClick={() => void onDeleteMemo(memo)}
                  >
                    🗑
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
