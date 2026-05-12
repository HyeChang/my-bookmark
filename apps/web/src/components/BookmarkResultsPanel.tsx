import {
  lazy,
  memo,
  Suspense,
  type CSSProperties,
  type FormEvent,
  type RefObject
} from "react";
import type {
  Bookmark,
  BookmarkAsset,
  BookmarkRelativeDateRange,
  BookmarkSearchMode,
  BookmarkSortMode,
  BookmarkTagMode,
  Folder,
  Tag
} from "@bookmark/shared";
import {
  hasTextContent,
  renderHiddenBookmarkIndicator
} from "./bookmark-preview-utils";
import "./ChoiceControls.css";
import "./BookmarkResultsPanel.css";

const LazyBookmarkAdvancedSearchFields = lazy(() => import("./BookmarkAdvancedSearchFields"));

export type BookmarkSearchDraft = {
  query: string;
  mode: BookmarkSearchMode;
  sort: BookmarkSortMode;
  createdWithin: BookmarkRelativeDateRange;
  openedWithin: BookmarkRelativeDateRange;
  favoriteOnly: boolean;
  folderId: string;
  includeDescendantFolders: boolean;
  tagIds: string[];
  tagMode: BookmarkTagMode;
  bookmarkColor: string;
  urlColor: string;
  summaryState: "all" | "with" | "without";
};

export type BookmarkSearchSummaryItem = {
  key: string;
  groupLabel: string;
  valueLabel: string;
  nextSearch: BookmarkSearchDraft;
};

export type BookmarkViewMode = "list" | "card" | "title" | "moodboard";
export type BookmarkPageSize = 20 | 50 | 100;

export type BookmarkDisplaySettings = {
  coverImage: boolean;
  title: boolean;
  description: boolean;
  tags: boolean;
  bookmarkInfo: boolean;
  coverSize: number;
};

type BookmarkDisplaySettingKey = keyof Omit<BookmarkDisplaySettings, "coverSize">;

type BookmarkListRowTagItem = {
  id: string;
  name: string;
  color: string | null;
};

export type BookmarkListRowViewModel = {
  bookmark: Bookmark;
  assets: BookmarkAsset[];
  assetCount: number;
  coverAsset: BookmarkAsset | null;
  folderName: string;
  previewText: string;
  summaryStateLabel: string;
  visibleTagItems: BookmarkListRowTagItem[];
  remainingTagCount: number;
  isTrashed: boolean;
  shouldShowCover: boolean;
  shouldShowListCover: boolean;
  shouldShowTitle: boolean;
  shouldShowDescription: boolean;
  shouldShowTags: boolean;
  shouldShowInfo: boolean;
};

export type BookmarkListRowActionResult = void | Promise<void>;

export type BookmarkListRowActions = {
  onToggleDetail: (bookmark: Bookmark) => BookmarkListRowActionResult;
  onOpen: (bookmark: Bookmark) => BookmarkListRowActionResult;
  onOpenDetailDialog: (bookmark: Bookmark) => BookmarkListRowActionResult;
  onCopyUrl: (bookmark: Bookmark) => BookmarkListRowActionResult;
  onToggleActionMenu: (bookmarkId: string) => BookmarkListRowActionResult;
  onEdit: (bookmark: Bookmark) => BookmarkListRowActionResult;
  onDelete: (bookmark: Bookmark) => BookmarkListRowActionResult;
  onRestore: (bookmark: Bookmark) => BookmarkListRowActionResult;
  onPermanentDelete: (bookmark: Bookmark) => BookmarkListRowActionResult;
};

type BookmarkListRowProps = {
  row: BookmarkListRowViewModel;
  bookmarkViewMode: BookmarkViewMode;
  shouldUseCompactMobileCards: boolean;
  isSelected: boolean;
  isActionMenuOpen: boolean;
  imageLoadingPriority: BookmarkRowImageLoadingPriority;
  actions: BookmarkListRowActions;
};

type BookmarkRowImageLoadingPriority = {
  loading: "eager" | "lazy";
  fetchPriority: "high" | "low";
};

const ABOVE_FOLD_BOOKMARK_IMAGE_COUNT = 4;
const EAGER_BOOKMARK_IMAGE_LOADING_PRIORITY: BookmarkRowImageLoadingPriority = {
  loading: "eager",
  fetchPriority: "high"
};
const LAZY_BOOKMARK_IMAGE_LOADING_PRIORITY: BookmarkRowImageLoadingPriority = {
  loading: "lazy",
  fetchPriority: "low"
};

function getBookmarkRowImageLoadingPriority(index: number): BookmarkRowImageLoadingPriority {
  return index < ABOVE_FOLD_BOOKMARK_IMAGE_COUNT
    ? EAGER_BOOKMARK_IMAGE_LOADING_PRIORITY
    : LAZY_BOOKMARK_IMAGE_LOADING_PRIORITY;
}

type FolderOption = {
  folder: Folder;
  label: string;
};

type BookmarkResultsPanelProps = {
  activeBookmarkSearchSummaryItems: BookmarkSearchSummaryItem[];
  activeBookmarkSort: BookmarkSortMode;
  bookmarkCardCoverSize: number;
  bookmarkCardDisplaySettings: BookmarkDisplaySettings;
  bookmarkListDisplaySettings: BookmarkDisplaySettings;
  bookmarkListElementRef: RefObject<HTMLUListElement | null>;
  bookmarkListPageSize: BookmarkPageSize;
  bookmarkListRows: BookmarkListRowViewModel[];
  bookmarkPageSizeOptions: BookmarkPageSize[];
  bookmarkSearchDraft: BookmarkSearchDraft;
  bookmarkSearchModeOptions: Array<{ value: BookmarkSearchMode; label: string }>;
  bookmarkSortOptions: Array<{ value: BookmarkSortMode; label: string; shortLabel: string }>;
  bookmarkViewMode: BookmarkViewMode;
  bookmarkViewModeOptions: Array<{ value: BookmarkViewMode; label: string; icon: string }>;
  canVirtualizeBookmarkList: boolean;
  hasActiveAppliedBookmarkSearch: boolean;
  hasMoreVisibleBookmarks: boolean;
  isAdvancedBookmarkSearchOpen: boolean;
  isBookmarkSortMenuOpen: boolean;
  isBookmarkViewMenuOpen: boolean;
  isHidden?: boolean;
  isLoadingDashboard: boolean;
  isLoadingMoreBookmarks: boolean;
  isMobileSearchPanelOpen: boolean;
  isMobileSearchViewport: boolean;
  isRailDetailMode: boolean;
  openBookmarkActionMenuId: string | null;
  selectedBookmarkId: string | null;
  shouldShowMobileSearchSummary: boolean;
  shouldUseCompactMobileCards: boolean;
  showHiddenBookmarks: boolean;
  tags: Tag[];
  visibleBookmarkCount: number;
  visibleBookmarkTotalCount: number;
  visibleFolderOptions: FolderOption[];
  visiblePagedBookmarkCount: number;
  bookmarkVirtualBottomSpacerHeight: number;
  bookmarkVirtualTopSpacerHeight: number;
  actions: BookmarkListRowActions;
  applyBookmarkSearch: (search: BookmarkSearchDraft) => BookmarkListRowActionResult;
  handleBookmarkExport: () => BookmarkListRowActionResult;
  handleBookmarkListLoadMore: () => BookmarkListRowActionResult;
  handleBookmarkPageSizeChange: (value: string) => BookmarkListRowActionResult;
  handleBookmarkSearchReset: () => BookmarkListRowActionResult;
  handleBookmarkSearchSubmit: (event: FormEvent<HTMLFormElement>) => BookmarkListRowActionResult;
  handleToggleHiddenBookmarks: () => BookmarkListRowActionResult;
  onBookmarkCoverSizeChange: (value: number) => void;
  onBookmarkDisplaySettingChange: (
    key: BookmarkDisplaySettingKey,
    value: boolean
  ) => void;
  onBookmarkSortMenuOpenChange: (updater: (currentState: boolean) => boolean) => void;
  onBookmarkSortSelect: (sort: BookmarkSortMode) => BookmarkListRowActionResult;
  onBookmarkViewMenuOpenChange: (updater: (currentState: boolean) => boolean) => void;
  onBookmarkViewModeChange: (mode: BookmarkViewMode) => void;
  setIsAdvancedBookmarkSearchOpen: (updater: (currentState: boolean) => boolean) => void;
  setIsMobileSearchPanelOpen: (updater: (currentState: boolean) => boolean) => void;
  toggleBookmarkSearchTag: (tagId: string, checked: boolean) => void;
  updateBookmarkSearchDraft: (patch: Partial<BookmarkSearchDraft>) => void;
};

function renderMobileVisibilityIconButton(options: {
  ariaLabel: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ghost-button mobile-visibility-icon-button${
        options.isActive ? " mobile-visibility-icon-button-active" : ""
      }`}
      aria-label={options.ariaLabel}
      aria-pressed={options.isActive}
      title={options.ariaLabel}
      onClick={options.onClick}
    >
      <span aria-hidden="true" className="mobile-visibility-icon-glyph">
        {options.isActive ? "🔓" : "🔒"}
      </span>
    </button>
  );
}

function renderSearchModeSegmentedControl(
  options: Array<{ value: BookmarkSearchMode; label: string }>,
  selectedMode: BookmarkSearchMode,
  onSelect: (value: BookmarkSearchMode) => void
) {
  return (
    <div className="search-mode-segmented" role="radiogroup" aria-label="검색 모드">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`search-mode-button${selectedMode === option.value ? " search-mode-button-active" : ""}`}
          aria-pressed={selectedMode === option.value}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function getBookmarkSortLabel(
  options: Array<{ value: BookmarkSortMode; label: string; shortLabel: string }>,
  sort: BookmarkSortMode
) {
  return options.find((option) => option.value === sort)?.label ?? "날짜순으로 ↓";
}

function getBookmarkSortShortLabel(
  options: Array<{ value: BookmarkSortMode; label: string; shortLabel: string }>,
  sort: BookmarkSortMode
) {
  return options.find((option) => option.value === sort)?.shortLabel ?? "날짜 ↓";
}

function getBookmarkViewModeLabel(
  options: Array<{ value: BookmarkViewMode; label: string; icon: string }>,
  mode: BookmarkViewMode
) {
  return options.find((option) => option.value === mode)?.label ?? "리스트";
}

function BookmarkSortControl({
  activeBookmarkSort,
  bookmarkSortOptions,
  isBookmarkSortMenuOpen,
  shouldUseCompactMobileCards,
  onBookmarkSortMenuOpenChange,
  onBookmarkViewMenuOpenChange,
  onBookmarkSortSelect
}: {
  activeBookmarkSort: BookmarkSortMode;
  bookmarkSortOptions: Array<{ value: BookmarkSortMode; label: string; shortLabel: string }>;
  isBookmarkSortMenuOpen: boolean;
  shouldUseCompactMobileCards: boolean;
  onBookmarkSortMenuOpenChange: (updater: (currentState: boolean) => boolean) => void;
  onBookmarkViewMenuOpenChange: (updater: (currentState: boolean) => boolean) => void;
  onBookmarkSortSelect: (sort: BookmarkSortMode) => BookmarkListRowActionResult;
}) {
  const activeSortLabel = getBookmarkSortLabel(bookmarkSortOptions, activeBookmarkSort);
  const activeSortShortLabel = getBookmarkSortShortLabel(
    bookmarkSortOptions,
    activeBookmarkSort
  );
  const triggerLabel = shouldUseCompactMobileCards ? activeSortShortLabel : activeSortLabel;

  return (
    <div
      className="bookmark-sort-menu-shell"
      data-open-menu-shell={isBookmarkSortMenuOpen ? "true" : undefined}
    >
      <button
        type="button"
        className="secondary-button bookmark-sort-trigger"
        aria-label="북마크 정렬"
        aria-expanded={isBookmarkSortMenuOpen}
        onClick={() => {
          onBookmarkViewMenuOpenChange(() => false);
          onBookmarkSortMenuOpenChange((currentState) => !currentState);
        }}
      >
        <span className="bookmark-sort-trigger-label">정렬</span>
        <span className="bookmark-sort-trigger-value">{triggerLabel}</span>
      </button>
      {isBookmarkSortMenuOpen ? (
        <div
          role="menu"
          aria-label="북마크 정렬 메뉴"
          className="folder-action-menu bookmark-sort-menu"
        >
          <p className="bookmark-sort-menu-title">정렬 기준</p>
          {bookmarkSortOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={activeBookmarkSort === option.value}
              className={`secondary-button folder-action-menu-item bookmark-sort-menu-item${
                activeBookmarkSort === option.value ? " bookmark-sort-menu-item-active" : ""
              }`}
              onClick={() => void onBookmarkSortSelect(option.value)}
            >
              <span aria-hidden="true" className="bookmark-sort-menu-mark">
                {activeBookmarkSort === option.value ? "●" : "○"}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BookmarkViewControl({
  bookmarkCardDisplaySettings,
  bookmarkListDisplaySettings,
  bookmarkViewMode,
  bookmarkViewModeOptions,
  isBookmarkViewMenuOpen,
  onBookmarkCoverSizeChange,
  onBookmarkDisplaySettingChange,
  onBookmarkSortMenuOpenChange,
  onBookmarkViewMenuOpenChange,
  onBookmarkViewModeChange
}: {
  bookmarkCardDisplaySettings: BookmarkDisplaySettings;
  bookmarkListDisplaySettings: BookmarkDisplaySettings;
  bookmarkViewMode: BookmarkViewMode;
  bookmarkViewModeOptions: Array<{ value: BookmarkViewMode; label: string; icon: string }>;
  isBookmarkViewMenuOpen: boolean;
  onBookmarkCoverSizeChange: (value: number) => void;
  onBookmarkDisplaySettingChange: (
    key: BookmarkDisplaySettingKey,
    value: boolean
  ) => void;
  onBookmarkSortMenuOpenChange: (updater: (currentState: boolean) => boolean) => void;
  onBookmarkViewMenuOpenChange: (updater: (currentState: boolean) => boolean) => void;
  onBookmarkViewModeChange: (mode: BookmarkViewMode) => void;
}) {
  const activeViewLabel = getBookmarkViewModeLabel(bookmarkViewModeOptions, bookmarkViewMode);
  const shouldShowDisplayControls = bookmarkViewMode !== "title";
  const shouldShowCoverSizeControl =
    bookmarkViewMode === "card" || bookmarkViewMode === "moodboard";
  const activeBookmarkDisplaySettings =
    bookmarkViewMode === "list" ? bookmarkListDisplaySettings : bookmarkCardDisplaySettings;

  return (
    <div
      className="bookmark-view-menu-shell"
      data-open-menu-shell={isBookmarkViewMenuOpen ? "true" : undefined}
    >
      <button
        type="button"
        className="secondary-button bookmark-view-trigger"
        aria-label="보기 설정"
        aria-expanded={isBookmarkViewMenuOpen}
        onClick={() => {
          onBookmarkSortMenuOpenChange(() => false);
          onBookmarkViewMenuOpenChange((currentState) => !currentState);
        }}
      >
        <span aria-hidden="true" className="bookmark-view-trigger-icon">
          ▦
        </span>
        <span className="bookmark-view-trigger-value">{activeViewLabel}</span>
      </button>
      {isBookmarkViewMenuOpen ? (
        <div
          role="menu"
          aria-label="보기 설정 메뉴"
          className="folder-action-menu bookmark-view-menu"
        >
          <section className="bookmark-view-menu-section">
            <p className="bookmark-view-menu-title">보기</p>
            {bookmarkViewModeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={bookmarkViewMode === option.value}
                className={`secondary-button folder-action-menu-item bookmark-view-menu-item${
                  bookmarkViewMode === option.value ? " bookmark-view-menu-item-active" : ""
                }`}
                onClick={() => onBookmarkViewModeChange(option.value)}
              >
                <span aria-hidden="true" className="bookmark-view-menu-mark">
                  {bookmarkViewMode === option.value ? "●" : "○"}
                </span>
                <span aria-hidden="true" className="bookmark-view-menu-icon">
                  {option.icon}
                </span>
                <span>{option.label}</span>
              </button>
            ))}
          </section>
          {shouldShowDisplayControls ? (
            <section className="bookmark-view-menu-section">
              <p className="bookmark-view-menu-title">항목에서 표시</p>
              {[
                ["coverImage", "커버 이미지"],
                ["title", "제목"],
                ["description", "설명"],
                ["tags", "태그"],
                ["bookmarkInfo", "북마크 정보"]
              ].map(([key, label]) => {
                const settingKey = key as BookmarkDisplaySettingKey;
                const isChecked = activeBookmarkDisplaySettings[settingKey];

                return (
                  <button
                    key={key}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isChecked}
                    className={`secondary-button folder-action-menu-item bookmark-view-menu-item${
                      isChecked ? " bookmark-view-menu-item-active" : ""
                    }`}
                    onClick={() => onBookmarkDisplaySettingChange(settingKey, !isChecked)}
                  >
                    <span aria-hidden="true" className="bookmark-view-menu-check">
                      {isChecked ? "✓" : ""}
                    </span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </section>
          ) : null}
          {shouldShowCoverSizeControl ? (
            <section className="bookmark-view-menu-section bookmark-cover-size-section">
              <label className="bookmark-cover-size-label" htmlFor="bookmark-cover-size-input">
                커버 이미지
              </label>
              <input
                id="bookmark-cover-size-input"
                aria-label="커버 이미지 크기"
                className="bookmark-cover-size-slider"
                type="range"
                min="80"
                max="220"
                step="10"
                value={bookmarkCardDisplaySettings.coverSize}
                onChange={(event) => onBookmarkCoverSizeChange(Number(event.target.value))}
              />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BookmarkListRow({
  row,
  bookmarkViewMode,
  shouldUseCompactMobileCards,
  isSelected,
  isActionMenuOpen,
  imageLoadingPriority,
  actions
}: BookmarkListRowProps) {
  const {
    bookmark,
    assetCount,
    coverAsset,
    folderName,
    previewText,
    summaryStateLabel,
    visibleTagItems,
    remainingTagCount,
    isTrashed,
    shouldShowCover,
    shouldShowListCover,
    shouldShowTitle,
    shouldShowDescription,
    shouldShowTags,
    shouldShowInfo
  } = row;
  const rowTitle = bookmark.displayTitle || bookmark.url;

  return (
    <li
      className={`bookmark-card bookmark-list-row bookmark-list-row-view-${bookmarkViewMode}${
        isSelected ? " bookmark-list-row-selected" : ""
      }${shouldShowListCover ? " bookmark-list-row-has-cover" : ""}`}
      style={
        bookmark.bookmarkColor
          ? {
              borderLeftColor: bookmark.bookmarkColor,
              borderLeftWidth: "3px"
            }
          : undefined
      }
    >
      {shouldShowListCover && coverAsset ? (
        <div className="asset-grid bookmark-row-assets bookmark-row-list-thumbnail">
          <img
            src={coverAsset.contentUrl}
            alt="업로드 이미지 1"
            loading={imageLoadingPriority.loading}
            decoding="async"
            fetchPriority={imageLoadingPriority.fetchPriority}
            sizes="(max-width: 720px) 100vw, var(--bookmark-cover-size)"
          />
        </div>
      ) : null}
      <div
        className={`bookmark-row-main${
          shouldUseCompactMobileCards ? "" : " bookmark-row-click-target"
        }`}
        onClick={
          shouldUseCompactMobileCards
            ? undefined
            : () => actions.onToggleDetail(bookmark)
        }
      >
        {shouldShowCover && coverAsset ? (
          <div className="asset-grid bookmark-row-assets">
            <img
              src={coverAsset.contentUrl}
              alt="업로드 이미지 1"
              loading={imageLoadingPriority.loading}
              decoding="async"
              fetchPriority={imageLoadingPriority.fetchPriority}
              sizes="(max-width: 720px) 100vw, var(--bookmark-cover-size)"
            />
          </div>
        ) : null}
        <div className="bookmark-card-header">
          <div className="bookmark-card-title-block">
            {shouldShowTitle ? (
              <div className="bookmark-title-line">
                <strong>{rowTitle}</strong>
                {renderHiddenBookmarkIndicator(bookmark.isHidden === true)}
              </div>
            ) : null}
            {shouldShowInfo && !shouldUseCompactMobileCards ? (
              <p
                className="muted-text bookmark-row-url"
                title={bookmark.url}
                style={bookmark.urlColor ? { color: bookmark.urlColor } : undefined}
              >
                {bookmark.url}
              </p>
            ) : null}
          </div>
        </div>
        {shouldShowDescription && hasTextContent(previewText) ? (
          <p
            className={`bookmark-row-summary${
              shouldUseCompactMobileCards ? " bookmark-card-summary" : ""
            }`}
          >
            {previewText}
          </p>
        ) : shouldShowDescription && shouldUseCompactMobileCards ? (
          <p className="bookmark-row-summary bookmark-card-summary">{bookmark.url}</p>
        ) : null}
      </div>
      {shouldShowInfo || shouldShowTags ? (
        <div
          className={`bookmark-row-meta${
            shouldUseCompactMobileCards ? "" : " bookmark-row-click-target"
          }`}
          onClick={
            shouldUseCompactMobileCards
              ? undefined
              : () => actions.onToggleDetail(bookmark)
          }
        >
          {shouldShowInfo ? (
            <div className="bookmark-row-meta-line bookmark-row-meta-primary">
              <span className="bookmark-row-meta-item">{folderName}</span>
              {bookmark.isFavorite ? (
                <span className="bookmark-row-meta-item">즐겨찾기</span>
              ) : null}
              {isTrashed ? (
                <span className="bookmark-row-meta-item">휴지통</span>
              ) : null}
            </div>
          ) : null}
          {!shouldUseCompactMobileCards ? (
            <div className="bookmark-row-meta-line bookmark-row-meta-secondary">
              {shouldShowInfo ? (
                <span className="bookmark-row-meta-item">{summaryStateLabel}</span>
              ) : null}
              {shouldShowTags
                ? visibleTagItems.map((tag) => (
                    <span
                      key={`${bookmark.id}-${tag.id}`}
                      className="bookmark-row-meta-item"
                    >
                      {tag.name}
                    </span>
                  ))
                : null}
              {shouldShowTags && remainingTagCount > 0 ? (
                <span className="bookmark-row-meta-item">+{remainingTagCount}</span>
              ) : null}
              {shouldShowInfo && assetCount > 0 ? (
                <span className="bookmark-row-meta-item">이미지 {assetCount}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <div
        className={`action-row bookmark-card-actions bookmark-row-actions${
          shouldUseCompactMobileCards ? " bookmark-row-actions-mobile-compact" : ""
        }`}
      >
        {isTrashed ? (
          <>
            <button
              type="button"
              className="primary-button bookmark-row-primary-action"
              aria-label={`${rowTitle} 복구`}
              onClick={() => void actions.onRestore(bookmark)}
            >
              복구
            </button>
            <div className="bookmark-card-secondary-actions">
              <button
                type="button"
                className="danger-button"
                aria-label={`${rowTitle} 영구 삭제`}
                onClick={() => void actions.onPermanentDelete(bookmark)}
              >
                영구 삭제
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="primary-button bookmark-row-primary-action"
              aria-label={`${rowTitle} 열기`}
              onClick={() => void actions.onOpen(bookmark)}
            >
              열기
            </button>
            <div className="bookmark-card-secondary-actions">
              {shouldUseCompactMobileCards ? (
                <button
                  type="button"
                  className="secondary-button bookmark-row-detail-action"
                  aria-label={`${rowTitle} 상세 보기`}
                  onClick={() => void actions.onOpenDetailDialog(bookmark)}
                >
                  상세
                </button>
              ) : null}
              <button
                type="button"
                className="ghost-button folder-action-trigger bookmark-url-copy-button"
                aria-label={`${rowTitle} URL 복사`}
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
                  aria-label={`${rowTitle} 북마크 더보기`}
                  aria-expanded={isActionMenuOpen}
                  onClick={() => actions.onToggleActionMenu(bookmark.id)}
                >
                  ...
                </button>
                {isActionMenuOpen ? (
                  <div
                    role="menu"
                    aria-label={`${rowTitle} 북마크 메뉴`}
                    className="folder-action-menu bookmark-card-action-menu"
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
          </>
        )}
      </div>
    </li>
  );
}

const MemoizedBookmarkListRow = memo(BookmarkListRow);

export default function BookmarkResultsPanel({
  activeBookmarkSearchSummaryItems,
  activeBookmarkSort,
  bookmarkCardCoverSize,
  bookmarkCardDisplaySettings,
  bookmarkListDisplaySettings,
  bookmarkListElementRef,
  bookmarkListPageSize,
  bookmarkListRows,
  bookmarkPageSizeOptions,
  bookmarkSearchDraft,
  bookmarkSearchModeOptions,
  bookmarkSortOptions,
  bookmarkViewMode,
  bookmarkViewModeOptions,
  canVirtualizeBookmarkList,
  hasActiveAppliedBookmarkSearch,
  hasMoreVisibleBookmarks,
  isAdvancedBookmarkSearchOpen,
  isBookmarkSortMenuOpen,
  isBookmarkViewMenuOpen,
  isHidden,
  isLoadingDashboard,
  isLoadingMoreBookmarks,
  isMobileSearchPanelOpen,
  isMobileSearchViewport,
  isRailDetailMode,
  openBookmarkActionMenuId,
  selectedBookmarkId,
  shouldShowMobileSearchSummary,
  shouldUseCompactMobileCards,
  showHiddenBookmarks,
  tags,
  visibleBookmarkCount,
  visibleBookmarkTotalCount,
  visibleFolderOptions,
  visiblePagedBookmarkCount,
  bookmarkVirtualBottomSpacerHeight,
  bookmarkVirtualTopSpacerHeight,
  actions,
  applyBookmarkSearch,
  handleBookmarkExport,
  handleBookmarkListLoadMore,
  handleBookmarkPageSizeChange,
  handleBookmarkSearchReset,
  handleBookmarkSearchSubmit,
  handleToggleHiddenBookmarks,
  onBookmarkCoverSizeChange,
  onBookmarkDisplaySettingChange,
  onBookmarkSortMenuOpenChange,
  onBookmarkSortSelect,
  onBookmarkViewMenuOpenChange,
  onBookmarkViewModeChange,
  setIsAdvancedBookmarkSearchOpen,
  setIsMobileSearchPanelOpen,
  toggleBookmarkSearchTag,
  updateBookmarkSearchDraft
}: BookmarkResultsPanelProps) {
  const shouldShowAdvancedBookmarkSearch = isAdvancedBookmarkSearchOpen;
  const shouldShowSearchPanelBody =
    !isMobileSearchViewport || isMobileSearchPanelOpen;

  return (
    <div className={isHidden ? "dashboard-panel-visually-hidden" : undefined}>
      <section
        aria-label="bookmark-results"
        className={`bookmark-results-stack${isHidden ? " dashboard-panel-visually-hidden" : ""}`}
      >
        <section aria-label="search-panel" className="surface-card panel-card search-panel-card">
          {isMobileSearchViewport ? (
            <div className="search-panel-header">
              <div className="search-panel-heading">
                <p className="search-panel-kicker">탐색 기준</p>
                <div className="search-panel-title-row">
                  <h2>검색과 필터</h2>
                  {shouldShowMobileSearchSummary ? (
                    <span className="search-panel-summary-pill">
                      활성 필터 {activeBookmarkSearchSummaryItems.length}개
                    </span>
                  ) : null}
                </div>
                <p className="search-panel-helper">검색과 조건을 함께 봅니다.</p>
                {shouldShowMobileSearchSummary ? (
                  <p className="search-panel-helper search-panel-helper-mobile">
                    활성 필터 {activeBookmarkSearchSummaryItems.length}개
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="secondary-button search-panel-toggle"
                aria-expanded={isMobileSearchPanelOpen}
                onClick={() =>
                  setIsMobileSearchPanelOpen((currentState) => !currentState)
                }
              >
                {isMobileSearchPanelOpen ? "검색/필터 닫기" : "검색/필터 열기"}
              </button>
            </div>
          ) : null}
          {shouldShowSearchPanelBody ? (
            <form className="search-form" onSubmit={(event) => void handleBookmarkSearchSubmit(event)}>
              {isMobileSearchViewport ? (
                <fieldset className="search-grid search-grid-basic search-grid-surface">
                  <legend>기본 검색</legend>
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
                      {bookmarkSearchModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    정렬
                    <select
                      name="bookmarkSearchSort"
                      value={bookmarkSearchDraft.sort}
                      onChange={(event) =>
                        updateBookmarkSearchDraft({
                          sort: event.target.value as BookmarkSortMode
                        })
                      }
                    >
                      {bookmarkSortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary-button"
                    aria-expanded={shouldShowAdvancedBookmarkSearch}
                    onClick={() =>
                      setIsAdvancedBookmarkSearchOpen((currentState) => !currentState)
                    }
                  >
                    {shouldShowAdvancedBookmarkSearch ? "고급 필터 접기" : "고급 필터 열기"}
                  </button>
                </fieldset>
              ) : (
                <div
                  role="region"
                  aria-label="desktop-search-toolbar"
                  className="search-toolbar search-toolbar-shell"
                >
                  <div className="search-toolbar-field search-toolbar-field-query">
                    <input
                      aria-label="검색어"
                      name="bookmarkSearchQuery"
                      placeholder="링크, 제목, 내용 검색"
                      value={bookmarkSearchDraft.query}
                      onChange={(event) =>
                        updateBookmarkSearchDraft({ query: event.target.value })
                      }
                    />
                  </div>
                  <div className="search-toolbar-mode">
                    {renderSearchModeSegmentedControl(
                      bookmarkSearchModeOptions,
                      bookmarkSearchDraft.mode,
                      (value) => updateBookmarkSearchDraft({ mode: value })
                    )}
                  </div>
                  <div className="search-toolbar-field">
                    <select
                      aria-label="정렬"
                      name="bookmarkSearchSort"
                      value={bookmarkSearchDraft.sort}
                      onChange={(event) =>
                        updateBookmarkSearchDraft({
                          sort: event.target.value as BookmarkSortMode
                        })
                      }
                    >
                      {bookmarkSortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="search-toolbar-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      aria-label={shouldShowAdvancedBookmarkSearch ? "고급 필터 접기" : "고급 필터 열기"}
                      aria-expanded={shouldShowAdvancedBookmarkSearch}
                      onClick={() =>
                        setIsAdvancedBookmarkSearchOpen((currentState) => !currentState)
                      }
                    >
                      필터
                    </button>
                    <button type="submit" className="primary-button" aria-label="검색 실행">
                      검색
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      aria-label="검색 초기화"
                      onClick={() => void handleBookmarkSearchReset()}
                    >
                      초기화
                    </button>
                  </div>
                </div>
              )}
              {shouldShowAdvancedBookmarkSearch ? (
                <Suspense
                  fallback={
                    <fieldset className="search-grid search-grid-advanced search-grid-surface">
                      <legend>필터</legend>
                      <p className="quiet-empty-state">필터를 불러오는 중입니다.</p>
                    </fieldset>
                  }
                >
                  <LazyBookmarkAdvancedSearchFields
                    bookmarkSearchDraft={bookmarkSearchDraft}
                    tags={tags}
                    visibleFolderOptions={visibleFolderOptions}
                    toggleBookmarkSearchTag={toggleBookmarkSearchTag}
                    updateBookmarkSearchDraft={updateBookmarkSearchDraft}
                  />
                </Suspense>
              ) : null}
              {isMobileSearchViewport ? (
                <div className="action-row search-action-row">
                  <button type="submit" className="primary-button">검색 실행</button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void handleBookmarkSearchReset()}
                  >
                    검색 초기화
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}
          {hasActiveAppliedBookmarkSearch && shouldShowSearchPanelBody ? (
            <div className="filter-summary-card">
              <div className="filter-summary-header">
                <p className="filter-summary-kicker">현재 작업 조건</p>
                <p className="filter-summary-count">
                  선택된 필터 {activeBookmarkSearchSummaryItems.length}개
                </p>
              </div>
              <ul aria-label="active-search-filters" className="active-filter-list">
                {activeBookmarkSearchSummaryItems.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      className="chip-button"
                      aria-label={`검색 조건 제거: ${item.groupLabel} - ${item.valueLabel}`}
                      onClick={() => void applyBookmarkSearch(item.nextSearch)}
                    >
                      <span className="chip-button-group">{item.groupLabel}</span>
                      <span className="chip-button-value">{item.valueLabel}</span>
                      <span className="chip-button-remove" aria-hidden="true">
                        ×
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </section>
      <section
        aria-label="bookmark-list"
        className={`surface-card panel-card${isHidden ? " dashboard-panel-visually-hidden" : ""}`}
      >
        <header className="bookmark-list-header">
          <div
            className={`bookmark-list-title-row${
              shouldUseCompactMobileCards ? " mobile-visibility-title-row" : ""
            }`}
          >
            <div className="bookmark-list-heading-copy">
              <h2>저장된 북마크</h2>
            </div>
            <div
              className={`bookmark-list-header-actions${
                shouldUseCompactMobileCards ? " bookmark-list-header-actions-mobile" : ""
              }`}
            >
              <BookmarkSortControl
                activeBookmarkSort={activeBookmarkSort}
                bookmarkSortOptions={bookmarkSortOptions}
                isBookmarkSortMenuOpen={isBookmarkSortMenuOpen}
                shouldUseCompactMobileCards={shouldUseCompactMobileCards}
                onBookmarkSortMenuOpenChange={onBookmarkSortMenuOpenChange}
                onBookmarkViewMenuOpenChange={onBookmarkViewMenuOpenChange}
                onBookmarkSortSelect={onBookmarkSortSelect}
              />
              <BookmarkViewControl
                bookmarkCardDisplaySettings={bookmarkCardDisplaySettings}
                bookmarkListDisplaySettings={bookmarkListDisplaySettings}
                bookmarkViewMode={bookmarkViewMode}
                bookmarkViewModeOptions={bookmarkViewModeOptions}
                isBookmarkViewMenuOpen={isBookmarkViewMenuOpen}
                onBookmarkCoverSizeChange={onBookmarkCoverSizeChange}
                onBookmarkDisplaySettingChange={onBookmarkDisplaySettingChange}
                onBookmarkSortMenuOpenChange={onBookmarkSortMenuOpenChange}
                onBookmarkViewMenuOpenChange={onBookmarkViewMenuOpenChange}
                onBookmarkViewModeChange={onBookmarkViewModeChange}
              />
              <label className="bookmark-page-size-control">
                <span>보기 개수</span>
                <select
                  aria-label="보기 개수"
                  value={bookmarkListPageSize}
                  onChange={(event) => void handleBookmarkPageSizeChange(event.target.value)}
                >
                  {bookmarkPageSizeOptions.map((pageSize) => (
                    <option key={pageSize} value={pageSize}>
                      {pageSize}개
                    </option>
                  ))}
                </select>
              </label>
              {shouldUseCompactMobileCards ? (
                renderMobileVisibilityIconButton({
                  ariaLabel: showHiddenBookmarks ? "숨김 북마크 숨기기" : "숨김 북마크 보기",
                  isActive: showHiddenBookmarks,
                  onClick: () => void handleToggleHiddenBookmarks()
                })
              ) : (
                <>
                  <button
                    type="button"
                    className="ghost-button bookmark-list-hidden-toggle"
                    aria-label={showHiddenBookmarks ? "숨김 북마크 숨기기" : "숨김 북마크 보기"}
                    aria-pressed={showHiddenBookmarks}
                    onClick={() => void handleToggleHiddenBookmarks()}
                  >
                    <span aria-hidden="true" className="bookmark-list-hidden-toggle-icon">
                      {showHiddenBookmarks ? "🔓" : "🔒"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="secondary-button bookmark-list-export-button"
                    aria-label="북마크 내보내기"
                    onClick={() => void handleBookmarkExport()}
                  >
                    내보내기
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
        {isLoadingDashboard ? (
          <div className="bookmark-loading-state" role="status" aria-live="polite">
            <span className="bookmark-loading-spinner" aria-hidden="true" />
            <span>북마크를 불러오는 중입니다.</span>
          </div>
        ) : null}
        {!isLoadingDashboard && visibleBookmarkCount === 0 ? (
          <p className="quiet-empty-state bookmark-list-empty-state">보관한 북마크가 없습니다.</p>
        ) : null}
        <ul
          ref={bookmarkListElementRef}
          className={`bookmark-grid bookmark-list-table bookmark-list-table-view-${bookmarkViewMode}`}
          data-virtualized-bookmark-list={canVirtualizeBookmarkList ? "true" : undefined}
          data-virtualized-bookmark-total={
            canVirtualizeBookmarkList ? visiblePagedBookmarkCount : undefined
          }
          style={
            {
              "--bookmark-cover-size": `${bookmarkCardCoverSize}px`
            } as CSSProperties
          }
        >
          {canVirtualizeBookmarkList && bookmarkVirtualTopSpacerHeight > 0 ? (
            <li
              aria-hidden="true"
              className="bookmark-virtual-spacer"
              style={{ height: `${bookmarkVirtualTopSpacerHeight}px` }}
            />
          ) : null}
          {bookmarkListRows.map((bookmarkRow, index) => {
            const bookmarkId = bookmarkRow.bookmark.id;
            const imageLoadingPriority = getBookmarkRowImageLoadingPriority(index);

            return (
              <MemoizedBookmarkListRow
                key={bookmarkId}
                row={bookmarkRow}
                bookmarkViewMode={bookmarkViewMode}
                shouldUseCompactMobileCards={shouldUseCompactMobileCards}
                isSelected={
                  !shouldUseCompactMobileCards &&
                  isRailDetailMode &&
                  selectedBookmarkId === bookmarkId
                }
                isActionMenuOpen={openBookmarkActionMenuId === bookmarkId}
                imageLoadingPriority={imageLoadingPriority}
                actions={actions}
              />
            );
          })}
          {canVirtualizeBookmarkList && bookmarkVirtualBottomSpacerHeight > 0 ? (
            <li
              aria-hidden="true"
              className="bookmark-virtual-spacer"
              style={{ height: `${bookmarkVirtualBottomSpacerHeight}px` }}
            />
          ) : null}
        </ul>
        {!isLoadingDashboard && visibleBookmarkCount > 0 ? (
          <div className="bookmark-pagination-bar">
            <p className="bookmark-pagination-summary">
              {visiblePagedBookmarkCount} / {visibleBookmarkTotalCount}개 표시
            </p>
            {hasMoreVisibleBookmarks ? (
              <button
                type="button"
                className="secondary-button bookmark-pagination-more-button"
                disabled={isLoadingMoreBookmarks}
                onClick={() => void handleBookmarkListLoadMore()}
              >
                {isLoadingMoreBookmarks ? "불러오는 중" : "더 보기"}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
