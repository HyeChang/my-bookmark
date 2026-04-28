import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode
} from "react";
import type { BookmarkExtractPreview, BookmarkExtractPreviewBlock, Folder, Tag } from "@bookmark/shared";

import { colorPresets } from "../lib/folder-presets";
import type { BookmarkExtensionPresenceStatus } from "../lib/extension-presence";

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
  quickFolderCreateSection: ReactNode;
  quickTagCreateSection: ReactNode;
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
  onCancelEdit: () => void;
};

type ColorSelectFieldProps = {
  label: string;
  selectedColor: string;
  onSelect: (value: string) => void;
  emptyLabel: string;
};

type CheckboxFieldProps = {
  label: ReactNode;
  className?: string;
  inputProps: Omit<InputHTMLAttributes<HTMLInputElement>, "type">;
};

function getColorPreset(color: string | null | undefined) {
  if (!color) {
    return null;
  }

  const normalizedColor = color.toLowerCase();
  return colorPresets.find((preset) => preset.value.toLowerCase() === normalizedColor) ?? null;
}

function renderColorSwatch(color: string, className = "color-swatch") {
  return <span className={className} style={{ backgroundColor: color }} aria-hidden="true" />;
}

function ColorSelectField({ label, selectedColor, onSelect, emptyLabel }: ColorSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fieldsetRef = useRef<HTMLFieldSetElement | null>(null);
  const selectedPreset = getColorPreset(selectedColor);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!fieldsetRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    globalThis.document.addEventListener("mousedown", handlePointerDown);
    globalThis.document.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.document.removeEventListener("mousedown", handlePointerDown);
      globalThis.document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleColorSelect(nextColor: string) {
    onSelect(nextColor);
    setIsOpen(false);
  }

  return (
    <fieldset ref={fieldsetRef} className="picker-fieldset color-select-fieldset">
      <legend>{label}</legend>
      <div className="color-select">
        <button
          type="button"
          className={`color-select-trigger${isOpen ? " color-select-trigger-open" : ""}`}
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((currentState) => !currentState)}
        >
          <span className="color-select-trigger-value">
            {selectedPreset ? (
              renderColorSwatch(selectedPreset.value, "picker-color-swatch")
            ) : (
              <span className="color-select-empty-swatch" aria-hidden="true" />
            )}
            <span>{selectedPreset?.label ?? emptyLabel}</span>
          </span>
          <span className="color-select-trigger-chevron" aria-hidden="true">
            ▾
          </span>
        </button>
        {isOpen ? (
          <div role="dialog" aria-label={`${label} 선택`} className="color-select-popover">
            <div className="color-select-options">
              <button
                type="button"
                className={`color-select-option${selectedPreset ? "" : " color-select-option-active"}`}
                aria-label={`${label} ${emptyLabel} 선택`}
                aria-pressed={!selectedPreset}
                onClick={() => handleColorSelect("")}
              >
                <span className="color-select-option-copy">
                  <span className="color-select-empty-swatch" aria-hidden="true" />
                  <span>{emptyLabel}</span>
                </span>
                {!selectedPreset ? (
                  <span className="choice-selection-mark" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
              {colorPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`color-select-option${
                    selectedPreset?.value === preset.value ? " color-select-option-active" : ""
                  }`}
                  aria-label={`${label} ${preset.label} 선택`}
                  aria-pressed={selectedPreset?.value === preset.value}
                  onClick={() => handleColorSelect(preset.value)}
                >
                  <span className="color-select-option-copy">
                    {renderColorSwatch(preset.value, "picker-color-swatch")}
                    <span>{preset.label}</span>
                  </span>
                  {selectedPreset?.value === preset.value ? (
                    <span className="choice-selection-mark" aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}

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

function hasTextContent(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function decodeHtmlEntitiesForDisplay(value: string) {
  if (!/[&]/.test(value)) {
    return value;
  }

  const ownerDocument = globalThis.document;
  if (ownerDocument) {
    const textarea = ownerDocument.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function normalizeDisplayWhitespace(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeExtractedDisplayText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const decodedValue = decodeHtmlEntitiesForDisplay(value);
  return normalizeDisplayWhitespace(
    decodeHtmlEntitiesForDisplay(
      decodedValue
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<li\b[^>]*>/gi, "\n- ")
        .replace(/<\/li>/gi, "\n")
        .replace(
          /<\/?(?:address|article|aside|blockquote|dd|details|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi,
          "\n\n"
        )
        .replace(/<[^>]+>/g, " ")
        .replace(/\b[a-z][\w:-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, " ")
    )
  );
}

function getBookmarkPreviewArticleBlocks(preview: BookmarkExtractPreview | null) {
  return (preview?.sourceBlocks ?? [])
    .map((block) => {
      if (block.type === "image") {
        return {
          ...block,
          alt: sanitizeExtractedDisplayText(block.alt) || null
        };
      }

      return {
        ...block,
        text: sanitizeExtractedDisplayText(block.text)
      };
    })
    .filter((block) => {
      if (block.type === "image") {
        return hasTextContent(block.url);
      }

      return hasTextContent(block.text);
    });
}

function getBookmarkPreviewFieldRows(preview: BookmarkExtractPreview | null) {
  if (!preview) {
    return [];
  }

  const hasArticleBlocks = getBookmarkPreviewArticleBlocks(preview).length > 0;
  if (hasArticleBlocks) {
    return [];
  }

  return [
    { label: "제목", value: preview.sourceTitle },
    { label: "내용", value: preview.sourceContent },
    { label: "요약", value: preview.sourceSummary }
  ]
    .map((row) => ({
      ...row,
      value: sanitizeExtractedDisplayText(row.value)
    }))
    .filter((row) => hasTextContent(row.value));
}

function getBookmarkPreviewImageAlt(preview: BookmarkExtractPreview) {
  return `${sanitizeExtractedDisplayText(preview.sourceTitle) || preview.normalizedUrl || preview.url} 미리보기 이미지`;
}

function getBookmarkPreviewArticleImageAlt(
  preview: BookmarkExtractPreview,
  block: Extract<BookmarkExtractPreviewBlock, { type: "image" }>,
  index: number
) {
  return (
    block.alt ??
    `${sanitizeExtractedDisplayText(preview.sourceTitle) || preview.normalizedUrl || preview.url} 본문 이미지 ${index + 1}`
  );
}

function hasBookmarkPreviewCoverImage(preview: BookmarkExtractPreview | null) {
  if (!preview?.sourceImageUrl) {
    return false;
  }

  return !getBookmarkPreviewArticleBlocks(preview).some(
    (block) => block.type === "image" && block.url === preview.sourceImageUrl
  );
}

function renderBookmarkPreviewArticle(preview: BookmarkExtractPreview) {
  const blocks = getBookmarkPreviewArticleBlocks(preview);
  if (blocks.length === 0) {
    return null;
  }

  let imageIndex = 0;
  return (
    <section className="bookmark-preview-article" aria-label="미리보기 본문">
      {blocks.map((block, index) => {
        const key =
          block.type === "image"
            ? `${block.type}-${block.url}-${index}`
            : `${block.type}-${block.text.slice(0, 32)}-${index}`;

        if (block.type === "image") {
          const currentImageIndex = imageIndex;
          imageIndex += 1;
          return (
            <figure key={key} className="bookmark-preview-article-figure">
              <img
                className="bookmark-preview-article-image"
                src={block.url}
                alt={getBookmarkPreviewArticleImageAlt(preview, block, currentImageIndex)}
                loading="lazy"
              />
              {block.alt ? <figcaption>{block.alt}</figcaption> : null}
            </figure>
          );
        }

        if (block.type === "heading") {
          return (
            <h4 key={key} className="bookmark-preview-article-heading">
              {block.text}
            </h4>
          );
        }

        if (block.type === "list-item") {
          return (
            <p key={key} className="bookmark-preview-article-list-item">
              <span aria-hidden="true">•</span>
              <span>{block.text}</span>
            </p>
          );
        }

        return (
          <p key={key} className="bookmark-preview-article-paragraph">
            {block.text}
          </p>
        );
      })}
    </section>
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
  quickFolderCreateSection,
  quickTagCreateSection,
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
                  {quickFolderCreateSection}
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
                      {quickTagCreateSection}
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
