import {
  memo,
  type CSSProperties,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
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
import "./BookmarkResultsPanel.css";

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
  actions: BookmarkListRowActions;
};

type CheckboxFieldProps = {
  label: ReactNode;
  className?: string;
  inputProps: Omit<InputHTMLAttributes<HTMLInputElement>, "type">;
};

type FolderOption = {
  folder: Folder;
  label: string;
};

type BookmarkResultsPanelProps = {
  activeBookmarkSearchSummaryItems: BookmarkSearchSummaryItem[];
  bookmarkCardCoverSize: number;
  bookmarkListElementRef: RefObject<HTMLUListElement | null>;
  bookmarkListPageSize: BookmarkPageSize;
  bookmarkListRows: BookmarkListRowViewModel[];
  bookmarkPageSizeOptions: BookmarkPageSize[];
  bookmarkSearchDraft: BookmarkSearchDraft;
  bookmarkSearchModeOptions: Array<{ value: BookmarkSearchMode; label: string }>;
  bookmarkSortOptions: Array<{ value: BookmarkSortMode; label: string }>;
  bookmarkViewMode: BookmarkViewMode;
  canVirtualizeBookmarkList: boolean;
  hasActiveAppliedBookmarkSearch: boolean;
  hasMoreVisibleBookmarks: boolean;
  isAdvancedBookmarkSearchOpen: boolean;
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
  renderBookmarkSortControl: () => ReactNode;
  renderBookmarkViewControl: () => ReactNode;
  renderSearchColorSelect: (
    label: string,
    selectedColor: string,
    onSelect: (value: string) => void
  ) => ReactNode;
  setIsAdvancedBookmarkSearchOpen: (updater: (currentState: boolean) => boolean) => void;
  setIsMobileSearchPanelOpen: (updater: (currentState: boolean) => boolean) => void;
  toggleBookmarkSearchTag: (tagId: string, checked: boolean) => void;
  updateBookmarkSearchDraft: (patch: Partial<BookmarkSearchDraft>) => void;
};

function renderColorSwatch(color: string, className = "color-swatch") {
  return (
    <span
      className={className}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

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

function renderTagLabel(label: string, color: string | null | undefined, className: string) {
  return (
    <span className={className}>
      {color ? renderColorSwatch(color) : null}
      <span>{label}</span>
    </span>
  );
}

function renderCheckboxField({ label, className, inputProps }: CheckboxFieldProps) {
  const classes = ["checkbox-field", className].filter(Boolean).join(" ");
  const inputClasses = ["checkbox-field-input", inputProps.className].filter(Boolean).join(" ");

  return (
    <label className={classes}>
      <span className="checkbox-field-copy">{label}</span>
      <input {...inputProps} type="checkbox" className={inputClasses} />
    </label>
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

function BookmarkListRow({
  row,
  bookmarkViewMode,
  shouldUseCompactMobileCards,
  isSelected,
  isActionMenuOpen,
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
          <img src={coverAsset.contentUrl} alt="업로드 이미지 1" />
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
            <img src={coverAsset.contentUrl} alt="업로드 이미지 1" />
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
  bookmarkCardCoverSize,
  bookmarkListElementRef,
  bookmarkListPageSize,
  bookmarkListRows,
  bookmarkPageSizeOptions,
  bookmarkSearchDraft,
  bookmarkSearchModeOptions,
  bookmarkSortOptions,
  bookmarkViewMode,
  canVirtualizeBookmarkList,
  hasActiveAppliedBookmarkSearch,
  hasMoreVisibleBookmarks,
  isAdvancedBookmarkSearchOpen,
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
  renderBookmarkSortControl,
  renderBookmarkViewControl,
  renderSearchColorSelect,
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
                <fieldset className="search-grid search-grid-advanced search-grid-surface">
                  <legend>필터</legend>
                  <div className="search-filter-group">
                    <h3>기간</h3>
                    <div className="search-filter-group-grid">
                      <label>
                        최근 추가
                        <select
                          name="bookmarkSearchCreatedWithin"
                          value={bookmarkSearchDraft.createdWithin}
                          onChange={(event) =>
                            updateBookmarkSearchDraft({
                              createdWithin: event.target.value as BookmarkRelativeDateRange
                            })
                          }
                        >
                          <option value="all">전체</option>
                          <option value="7d">최근 7일</option>
                          <option value="30d">최근 30일</option>
                        </select>
                      </label>
                      <label>
                        최근 열람
                        <select
                          name="bookmarkSearchOpenedWithin"
                          value={bookmarkSearchDraft.openedWithin}
                          onChange={(event) =>
                            updateBookmarkSearchDraft({
                              openedWithin: event.target.value as BookmarkRelativeDateRange
                            })
                          }
                        >
                          <option value="all">전체</option>
                          <option value="7d">최근 7일</option>
                          <option value="30d">최근 30일</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="search-filter-group">
                    <h3>분류</h3>
                    <div className="search-filter-group-grid">
                      <label>
                        <span aria-hidden="true">폴더</span>
                        <select
                          aria-label="필터 폴더"
                          name="bookmarkSearchFolderId"
                          value={bookmarkSearchDraft.folderId}
                          onChange={(event) =>
                            updateBookmarkSearchDraft({
                              folderId: event.target.value,
                              includeDescendantFolders: event.target.value
                                ? bookmarkSearchDraft.includeDescendantFolders
                                : false
                            })
                          }
                        >
                          <option value="">전체 폴더</option>
                          {visibleFolderOptions.map(({ folder, label }) => (
                            <option key={folder.id} value={folder.id}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {renderCheckboxField({
                        className: "search-filter-checkbox",
                        label: <span aria-hidden="true">하위 포함</span>,
                        inputProps: {
                          "aria-label": "하위 폴더 포함",
                          name: "bookmarkSearchIncludeDescendantFolders",
                          checked: bookmarkSearchDraft.includeDescendantFolders,
                          onChange: (event) =>
                            updateBookmarkSearchDraft({
                              includeDescendantFolders: event.currentTarget.checked
                            }),
                          disabled: !bookmarkSearchDraft.folderId
                        }
                      })}
                      <label>
                        태그 조건
                        <select
                          name="bookmarkSearchTagMode"
                          value={bookmarkSearchDraft.tagMode}
                          onChange={(event) =>
                            updateBookmarkSearchDraft({
                              tagMode: event.target.value as BookmarkTagMode
                            })
                          }
                        >
                          <option value="and">모두 포함</option>
                          <option value="or">하나라도 포함</option>
                        </select>
                      </label>
                      <fieldset className="tag-fieldset">
                        <legend>필터 태그</legend>
                        {tags.length === 0 ? (
                          <p className="quiet-empty-state">태그가 없습니다.</p>
                        ) : null}
                        <div className="pill-list">
                          {tags.map((tag) => (
                            <label key={tag.id} className="pill-option">
                              <input
                                type="checkbox"
                                name="bookmarkSearchTagIds"
                                checked={bookmarkSearchDraft.tagIds.includes(tag.id)}
                                onChange={(event) =>
                                  toggleBookmarkSearchTag(tag.id, event.target.checked)
                                }
                              />
                              {renderTagLabel(tag.name, tag.color, "tag-option-label")}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  </div>
                  <div className="search-filter-group">
                    <h3>상태</h3>
                    <div className="search-filter-group-grid">
                      {renderCheckboxField({
                        className: "search-filter-checkbox",
                        label: <span aria-hidden="true">즐겨찾기</span>,
                        inputProps: {
                          "aria-label": "즐겨찾기만",
                          name: "bookmarkSearchFavoriteOnly",
                          checked: bookmarkSearchDraft.favoriteOnly,
                          onChange: (event) =>
                            updateBookmarkSearchDraft({
                              favoriteOnly: event.currentTarget.checked
                            })
                        }
                      })}
                      {renderSearchColorSelect(
                        "북마크 색상 필터",
                        bookmarkSearchDraft.bookmarkColor,
                        (value) => updateBookmarkSearchDraft({ bookmarkColor: value })
                      )}
                      {renderSearchColorSelect(
                        "url 색상 필터",
                        bookmarkSearchDraft.urlColor,
                        (value) => updateBookmarkSearchDraft({ urlColor: value })
                      )}
                      <label>
                        <span aria-hidden="true">요약</span>
                        <select
                          aria-label="요약 필터"
                          name="bookmarkSearchSummaryState"
                          value={bookmarkSearchDraft.summaryState}
                          onChange={(event) =>
                            updateBookmarkSearchDraft({
                              summaryState: event.target.value as "all" | "with" | "without"
                            })
                          }
                        >
                          <option value="all">전체 요약</option>
                          <option value="with">요약 있음</option>
                          <option value="without">요약 없음</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </fieldset>
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
              {renderBookmarkSortControl()}
              {renderBookmarkViewControl()}
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
          {bookmarkListRows.map((bookmarkRow) => {
            const bookmarkId = bookmarkRow.bookmark.id;

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
