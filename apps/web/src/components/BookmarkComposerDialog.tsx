import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode
} from "react";
import type { BookmarkExtractPreview, Folder, Tag } from "@bookmark/shared";

import type { BookmarkExtensionPresenceStatus } from "../lib/extension-presence";
import { ColorSelectField } from "./ColorSelectField";
import { renderColorSwatch } from "./ColorSelectField";
import { FolderIconPicker } from "./FolderIconPicker";
import {
  getBookmarkPreviewArticleBlocks,
  getBookmarkPreviewFieldRows,
  getBookmarkPreviewImageAlt,
  hasBookmarkPreviewCoverImage,
  hasTextContent,
  renderBookmarkPreviewArticle,
  sanitizeExtractedDisplayText
} from "./bookmark-preview-utils";
import "./ChoiceControls.css";
import "./BookmarkPreviewContent.css";
import "./BookmarkComposerDialog.css";

export type BookmarkComposerDraft = {
  url: string;
  folderId: string;
  tagIds: string[];
  bookmarkColor: string;
  urlColor: string;
  userTitle: string;
  userContent: string;
  userSummary: string;
  isFavorite: boolean;
  isHidden: boolean;
};

export type BookmarkComposerTagItem = Pick<Tag, "id" | "name" | "color">;

export type BookmarkComposerQuickFolderDraft = {
  name: string;
  color: string;
  icon: string;
  parentFolderId: string;
};

export type BookmarkComposerQuickTagDraft = {
  name: string;
  color: string;
};

export type BookmarkComposerDialogProps = {
  isEditing: boolean;
  isSaving: boolean;
  draft: BookmarkComposerDraft;
  folderOptions: Array<{ folder: Folder; label: string }>;
  tags: Tag[];
  selectedTagItems: BookmarkComposerTagItem[];
  filteredTags: Tag[];
  tagSearchQuery: string;
  preview: BookmarkExtractPreview | null;
  previewFailure: string | null;
  extensionPresence: BookmarkExtensionPresenceStatus;
  isLoadingPreview: boolean;
  isClassificationOpen: boolean;
  isDisplayOpen: boolean;
  panelHeading: string;
  panelSummary: string;
  panelKicker: string;
  showPanelHeader: boolean;
  isQuickFolderOpen: boolean;
  isQuickTagOpen: boolean;
  isSavingQuickFolder: boolean;
  isSavingQuickTag: boolean;
  quickFolderDraft: BookmarkComposerQuickFolderDraft;
  quickFolderParentOptions: Array<{ folder: Folder; label: string }>;
  quickTagDraft: BookmarkComposerQuickTagDraft;
  pendingAssetSection: ReactNode;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDraftChange: (nextValues: Partial<BookmarkComposerDraft>) => void;
  onUrlChange: (url: string) => void;
  onPreviewLoad: () => void | Promise<void>;
  onOpenPreviewSourceUrl: () => void | Promise<void>;
  onOpenExtensionDownload: () => void;
  onDismissPreviewFallback: () => void;
  onUseUrlOnly: () => void;
  onClearPreview: () => void;
  onClassificationOpenChange: (isOpen: boolean) => void;
  onDisplayOpenChange: (isOpen: boolean) => void;
  onTagSearchQueryChange: (query: string) => void;
  onTagToggle: (tagId: string, checked: boolean) => void;
  onQuickFolderToggle: () => void;
  onQuickFolderDraftChange: (nextValues: Partial<BookmarkComposerQuickFolderDraft>) => void;
  onQuickFolderCreate: () => void | Promise<void>;
  onQuickTagToggle: () => void;
  onQuickTagDraftChange: (nextValues: Partial<BookmarkComposerQuickTagDraft>) => void;
  onQuickTagCreate: () => void | Promise<void>;
  onCancelEdit: () => void;
};

type CheckboxFieldProps = {
  label: ReactNode;
  className?: string;
  inputProps: Omit<InputHTMLAttributes<HTMLInputElement>, "type">;
};

function renderColorPicker(legend: string, selectedColor: string, onSelect: (value: string) => void) {
  return (
    <ColorSelectField
      label={legend}
      selectedColor={selectedColor}
      onSelect={onSelect}
      emptyLabel="선택 안 함"
    />
  );
}

function QuickFolderCreateSection({
  isOpen,
  draft,
  parentOptions,
  isSaving,
  onToggle,
  onDraftChange,
  onCreate
}: {
  isOpen: boolean;
  draft: BookmarkComposerQuickFolderDraft;
  parentOptions: Array<{ folder: Folder; label: string }>;
  isSaving: boolean;
  onToggle: () => void;
  onDraftChange: (nextValues: Partial<BookmarkComposerQuickFolderDraft>) => void;
  onCreate: () => void | Promise<void>;
}) {
  return (
    <div className="inline-folder-create">
      <button type="button" className="secondary-button" onClick={onToggle}>
        {isOpen ? "새 폴더 바로 추가 닫기" : "새 폴더 바로 추가"}
      </button>
      {isOpen ? (
        <section aria-label="quick-folder-create" className="inline-folder-create-panel">
          <label>
            폴더 이름
            <input
              name="quickFolderName"
              value={draft.name}
              onChange={(event) => onDraftChange({ name: event.target.value })}
            />
          </label>
          {renderColorPicker("폴더 색상", draft.color, (value) =>
            onDraftChange({ color: value })
          )}
          <FolderIconPicker
            selectedIcon={draft.icon}
            onSelect={(value) => onDraftChange({ icon: value })}
          />
          <label>
            부모 폴더
            <select
              name="quickFolderParentFolderId"
              value={draft.parentFolderId}
              disabled={parentOptions.length === 0}
              onChange={(event) => onDraftChange({ parentFolderId: event.target.value })}
            >
              <option value="">상위 없음</option>
              {parentOptions.map(({ folder, label }) => (
                <option key={folder.id} value={folder.id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {parentOptions.length === 0 ? (
            <p className="field-note">폴더가 없어 최상위 폴더로 생성됩니다.</p>
          ) : null}
          <div className="action-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => void onCreate()}
              disabled={isSaving}
            >
              {isSaving ? "저장 중..." : "빠른 폴더 저장"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function QuickTagCreateSection({
  isOpen,
  draft,
  isSaving,
  onToggle,
  onDraftChange,
  onCreate
}: {
  isOpen: boolean;
  draft: BookmarkComposerQuickTagDraft;
  isSaving: boolean;
  onToggle: () => void;
  onDraftChange: (nextValues: Partial<BookmarkComposerQuickTagDraft>) => void;
  onCreate: () => void | Promise<void>;
}) {
  return (
    <div className="inline-folder-create">
      <button type="button" className="secondary-button" onClick={onToggle}>
        {isOpen ? "새 태그 바로 추가 닫기" : "새 태그 바로 추가"}
      </button>
      {isOpen ? (
        <section aria-label="quick-tag-create" className="inline-folder-create-panel">
          <label>
            태그 이름
            <input
              name="quickTagName"
              value={draft.name}
              onChange={(event) => onDraftChange({ name: event.target.value })}
            />
          </label>
          {renderColorPicker("태그 색상", draft.color, (value) =>
            onDraftChange({ color: value })
          )}
          <div className="action-row">
            <button
              type="button"
              className="primary-button"
              onClick={() => void onCreate()}
              disabled={isSaving}
            >
              {isSaving ? "저장 중..." : "빠른 태그 저장"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
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

function renderTagLabel(label: string, color: string | null | undefined, className: string) {
  return (
    <span className={className}>
      {color ? renderColorSwatch(color) : null}
      <span>{label}</span>
    </span>
  );
}

function WorkspacePanelHeader({
  heading,
  summary,
  kicker
}: {
  heading: string;
  summary: string;
  kicker: string;
}) {
  return (
    <header className="workspace-panel-header">
      <p className="workspace-panel-kicker">{kicker}</p>
      <div className="workspace-panel-heading-row">
        <h2>{heading}</h2>
        <span className="workspace-panel-summary">{summary}</span>
      </div>
    </header>
  );
}

export default function BookmarkComposerDialog({
  isEditing,
  isSaving,
  draft,
  folderOptions,
  tags,
  selectedTagItems,
  filteredTags,
  tagSearchQuery,
  preview,
  previewFailure,
  extensionPresence,
  isLoadingPreview,
  isClassificationOpen,
  isDisplayOpen,
  panelHeading,
  panelSummary,
  panelKicker,
  showPanelHeader,
  isQuickFolderOpen,
  isQuickTagOpen,
  isSavingQuickFolder,
  isSavingQuickTag,
  quickFolderDraft,
  quickFolderParentOptions,
  quickTagDraft,
  pendingAssetSection,
  onClose,
  onSubmit,
  onDraftChange,
  onUrlChange,
  onPreviewLoad,
  onOpenPreviewSourceUrl,
  onOpenExtensionDownload,
  onDismissPreviewFallback,
  onUseUrlOnly,
  onClearPreview,
  onClassificationOpenChange,
  onDisplayOpenChange,
  onTagSearchQueryChange,
  onTagToggle,
  onQuickFolderToggle,
  onQuickFolderDraftChange,
  onQuickFolderCreate,
  onQuickTagToggle,
  onQuickTagDraftChange,
  onQuickTagCreate,
  onCancelEdit
}: BookmarkComposerDialogProps) {
  const previewBlocks = getBookmarkPreviewArticleBlocks(preview);
  const previewRows = getBookmarkPreviewFieldRows(preview);

  return (
    <div className="overlay-backdrop" onClick={() => onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="bookmark-composer-dialog"
        className="surface-card overlay-dialog-shell bookmark-composer-dialog-shell"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overlay-dialog-header">
          <div className="overlay-dialog-title">
            <p className="workspace-panel-kicker">작성</p>
            <h2>{isEditing ? "북마크 수정" : "새 북마크"}</h2>
          </div>
          <button type="button" className="ghost-button" onClick={() => onClose()}>
            닫기
          </button>
        </div>
        <div className="overlay-dialog-panel">
          <section
            aria-label="bookmark-form"
            className="surface-card panel-card bookmark-composer-panel-readable"
          >
            {showPanelHeader ? (
              <WorkspacePanelHeader heading={panelHeading} summary={panelSummary} kicker={panelKicker} />
            ) : null}
            <form className="stack-form bookmark-composer-form" onSubmit={(event) => void onSubmit(event)}>
              <div className="bookmark-composer-grid">
                <section className="bookmark-composer-section">
                  <div className="bookmark-composer-section-header">
                    <h3>기본 정보</h3>
                    <p>URL, 폴더, 제목을 먼저 정리합니다.</p>
                  </div>
                  <label>
                    URL
                    <input
                      name="url"
                      type="url"
                      value={draft.url}
                      onChange={(event) => onUrlChange(event.target.value)}
                      required
                    />
                  </label>
                  <button type="button" onClick={() => void onPreviewLoad()} disabled={isLoadingPreview}>
                    {isLoadingPreview ? "불러오는 중..." : "URL 메타 불러오기"}
                  </button>
                  {previewFailure ? (
                    <section
                      aria-label="bookmark-preview-fallback"
                      className="bookmark-preview-fallback-card"
                      aria-live="polite"
                    >
                      <div className="bookmark-preview-fallback-header">
                        <span className="bookmark-preview-fallback-icon" aria-hidden="true">
                          !
                        </span>
                        <div className="bookmark-preview-fallback-copy">
                          <h3>자동 추출이 막혔습니다</h3>
                          <p>{previewFailure}</p>
                          {extensionPresence === "installed" ? (
                            <p>
                              확장 프로그램이 감지되었습니다. 원본 페이지를 새 탭으로 열고 확장
                              팝업에서 저장하면 로그인 뒤 렌더링된 본문이나 선택 텍스트를 가져올 수
                              있습니다.
                            </p>
                          ) : (
                            <p>
                              확장을 설치하지 않은 브라우저에서는 서버 추출만 사용할 수 있습니다.
                              막힌 페이지는 확장으로 저장하거나, 아래 필드에 직접 입력하거나, URL만
                              저장할 수 있습니다.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="bookmark-preview-fallback-actions">
                        {extensionPresence === "installed" ? (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => void onOpenPreviewSourceUrl()}
                          >
                            원본 페이지 열기
                          </button>
                        ) : (
                          <button type="button" className="secondary-button" onClick={() => onOpenExtensionDownload()}>
                            확장 설치
                          </button>
                        )}
                        <button type="button" className="ghost-button" onClick={() => onDismissPreviewFallback()}>
                          수동 입력 계속
                        </button>
                        <button type="button" className="ghost-button" onClick={() => onUseUrlOnly()}>
                          URL만 저장
                        </button>
                      </div>
                    </section>
                  ) : null}
                  {preview ? (
                    <section aria-label="bookmark-preview" className="bookmark-preview-card">
                      <h3>자동 추출 미리보기</h3>
                      {hasBookmarkPreviewCoverImage(preview) && preview.sourceImageUrl ? (
                        <img
                          className="bookmark-preview-image"
                          src={preview.sourceImageUrl}
                          alt={getBookmarkPreviewImageAlt(preview)}
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                          sizes="(max-width: 720px) 100vw, 640px"
                        />
                      ) : null}
                      {previewBlocks.length > 0 ? (
                        <>
                          {hasTextContent(preview.sourceTitle) ? (
                            <p className="bookmark-preview-title">
                              {sanitizeExtractedDisplayText(preview.sourceTitle)}
                            </p>
                          ) : null}
                          {hasTextContent(preview.sourceSummary) ? (
                            <p className="bookmark-preview-summary">
                              {sanitizeExtractedDisplayText(preview.sourceSummary)}
                            </p>
                          ) : null}
                          {renderBookmarkPreviewArticle(preview)}
                        </>
                      ) : (
                        previewRows.map((row) => (
                          <div key={row.label} className="detail-row bookmark-preview-row">
                            <p className="detail-row-label">{row.label}</p>
                            <p className="detail-row-value">{row.value}</p>
                          </div>
                        ))
                      )}
                      <button
                        type="button"
                        className="ghost-button bookmark-preview-clear-button"
                        onClick={() => onClearPreview()}
                      >
                        자동 추출 초기화
                      </button>
                    </section>
                  ) : null}
                  <label>
                    저장 폴더
                    <select
                      name="folderId"
                      value={draft.folderId}
                      onChange={(event) => onDraftChange({ folderId: event.target.value })}
                    >
                      <option value="">폴더 없음</option>
                      {folderOptions.map(({ folder, label }) => (
                        <option key={folder.id} value={folder.id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <QuickFolderCreateSection
                    isOpen={isQuickFolderOpen}
                    draft={quickFolderDraft}
                    parentOptions={quickFolderParentOptions}
                    isSaving={isSavingQuickFolder}
                    onToggle={onQuickFolderToggle}
                    onDraftChange={onQuickFolderDraftChange}
                    onCreate={onQuickFolderCreate}
                  />
                  <label>
                    제목
                    <input
                      name="userTitle"
                      value={draft.userTitle}
                      onChange={(event) => onDraftChange({ userTitle: event.target.value })}
                    />
                  </label>
                </section>

                <section className="bookmark-composer-section">
                  <div className="bookmark-composer-section-header">
                    <h3>내용/요약</h3>
                    <p>읽기 전 핵심 설명을 정리합니다.</p>
                  </div>
                  <label>
                    내용
                    <textarea
                      name="userContent"
                      value={draft.userContent}
                      onChange={(event) => onDraftChange({ userContent: event.target.value })}
                    />
                  </label>
                  <label>
                    요약
                    <textarea
                      name="userSummary"
                      value={draft.userSummary}
                      onChange={(event) => onDraftChange({ userSummary: event.target.value })}
                    />
                  </label>
                </section>

                <section className="bookmark-composer-section bookmark-composer-disclosure">
                  <button
                    type="button"
                    className="ghost-button bookmark-composer-disclosure-trigger"
                    aria-label={isClassificationOpen ? "분류와 상태 닫기" : "분류와 상태 열기"}
                    aria-expanded={isClassificationOpen}
                    onClick={() => onClassificationOpenChange(!isClassificationOpen)}
                  >
                    <span>분류와 상태</span>
                    <span aria-hidden="true">{isClassificationOpen ? "닫기" : "열기"}</span>
                  </button>
                  {isClassificationOpen ? (
                    <div className="bookmark-composer-disclosure-body">
                      <fieldset className="tag-fieldset">
                        <legend>태그 선택</legend>
                        {selectedTagItems.length > 0 ? (
                          <div className="bookmark-tag-selected-section">
                            <p className="bookmark-tag-selected-summary">
                              선택된 태그 {selectedTagItems.length}개
                            </p>
                            <div className="meta-pill-list bookmark-tag-selected-list">
                              {selectedTagItems.map((tag) => (
                                <button
                                  key={`selected-${tag.id}`}
                                  type="button"
                                  className="bookmark-tag-selected-chip"
                                  aria-label={`${tag.name} 선택 해제`}
                                  onClick={() => onTagToggle(tag.id, false)}
                                >
                                  {renderTagLabel(
                                    tag.name,
                                    tag.color,
                                    "tag-option-label bookmark-tag-option-label"
                                  )}
                                  <span className="bookmark-tag-selected-chip-remove" aria-hidden="true">
                                    ×
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {tags.length > 0 ? (
                          <>
                            <label className="bookmark-tag-search-field">
                              <span>태그 검색</span>
                              <input
                                type="search"
                                name="bookmarkTagSearch"
                                value={tagSearchQuery}
                                placeholder="태그 이름으로 찾기"
                                onChange={(event) => onTagSearchQueryChange(event.target.value)}
                              />
                            </label>
                            <p className="bookmark-tag-search-summary" aria-live="polite">
                              검색 결과 {filteredTags.length}개
                            </p>
                          </>
                        ) : null}
                        {tags.length === 0 ? <p className="quiet-empty-state">태그가 없습니다.</p> : null}
                        {tags.length > 0 && filteredTags.length === 0 ? (
                          <p className="quiet-empty-state bookmark-tag-empty-state">검색 결과가 없습니다.</p>
                        ) : null}
                        {filteredTags.length > 0 ? (
                          <div className="pill-list bookmark-tag-list bookmark-tag-list-scroll">
                            {filteredTags.map((tag) => {
                              const isSelected = draft.tagIds.includes(tag.id);

                              return (
                                <label
                                  key={tag.id}
                                  className={`pill-option bookmark-tag-option${
                                    isSelected ? " bookmark-tag-option-selected" : ""
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    name="tagIds"
                                    value={tag.id}
                                    checked={isSelected}
                                    onChange={(event) => onTagToggle(tag.id, event.target.checked)}
                                  />
                                  {renderTagLabel(
                                    tag.name,
                                    tag.color,
                                    "tag-option-label bookmark-tag-option-label"
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        ) : null}
                      </fieldset>
                      <QuickTagCreateSection
                        isOpen={isQuickTagOpen}
                        draft={quickTagDraft}
                        isSaving={isSavingQuickTag}
                        onToggle={onQuickTagToggle}
                        onDraftChange={onQuickTagDraftChange}
                        onCreate={onQuickTagCreate}
                      />
                      {renderCheckboxField({
                        label: "즐겨찾기",
                        inputProps: {
                          name: "isFavorite",
                          checked: draft.isFavorite,
                          onChange: (event) => onDraftChange({ isFavorite: event.currentTarget.checked })
                        }
                      })}
                      {renderCheckboxField({
                        label: "숨김 북마크",
                        inputProps: {
                          name: "isHidden",
                          checked: draft.isHidden,
                          onChange: (event) => onDraftChange({ isHidden: event.currentTarget.checked })
                        }
                      })}
                    </div>
                  ) : null}
                </section>

                <section className="bookmark-composer-section bookmark-composer-disclosure">
                  <button
                    type="button"
                    className="ghost-button bookmark-composer-disclosure-trigger"
                    aria-label={isDisplayOpen ? "표시와 이미지 닫기" : "표시와 이미지 열기"}
                    aria-expanded={isDisplayOpen}
                    onClick={() => onDisplayOpenChange(!isDisplayOpen)}
                  >
                    <span>표시와 이미지</span>
                    <span aria-hidden="true">{isDisplayOpen ? "닫기" : "열기"}</span>
                  </button>
                  {isDisplayOpen ? (
                    <div className="bookmark-composer-disclosure-body">
                      {renderColorPicker("북마크 색상", draft.bookmarkColor, (value) =>
                        onDraftChange({ bookmarkColor: value })
                      )}
                      {renderColorPicker("url 색상", draft.urlColor, (value) =>
                        onDraftChange({ urlColor: value })
                      )}
                      {pendingAssetSection}
                    </div>
                  ) : null}
                </section>
              </div>
              <div className="action-row bookmark-composer-footer">
                <button type="submit" className="primary-button" disabled={isSaving}>
                  {isSaving ? (isEditing ? "수정 중..." : "저장 중...") : isEditing ? "북마크 수정" : "북마크 저장"}
                </button>
                {isEditing ? (
                  <button type="button" className="secondary-button" onClick={() => onCancelEdit()}>
                    수정 취소
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        </div>
      </section>
    </div>
  );
}
