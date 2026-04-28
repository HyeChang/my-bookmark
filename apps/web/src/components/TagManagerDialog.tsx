import {
  useEffect,
  useRef,
  useState,
  type FormEvent
} from "react";
import type { Tag } from "@bookmark/shared";

import { colorPresets } from "../lib/folder-presets";
import "./TagManagerDialog.css";

export type TagManagerDraft = {
  name: string;
  color: string;
};

export type TagManagerDialogProps = {
  isEditing: boolean;
  draft: TagManagerDraft;
  tags: Tag[];
  openTagActionMenuId: string | null;
  isSaving: boolean;
  panelSummary: string;
  panelKicker: string;
  showPanelHeader: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDraftChange: (nextValues: Partial<TagManagerDraft>) => void;
  onCancelEdit: () => void;
  onToggleTagActionMenu: (tagId: string) => void;
  onBeginTagEdit: (tag: Tag) => void;
  onTagDelete: (tag: Tag) => void | Promise<void>;
};

type ColorSelectFieldProps = {
  label: string;
  selectedColor: string;
  onSelect: (value: string) => void;
  emptyLabel: string;
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

export default function TagManagerDialog({
  isEditing,
  draft,
  tags,
  openTagActionMenuId,
  isSaving,
  panelSummary,
  panelKicker,
  showPanelHeader,
  onClose,
  onSubmit,
  onDraftChange,
  onCancelEdit,
  onToggleTagActionMenu,
  onBeginTagEdit,
  onTagDelete
}: TagManagerDialogProps) {
  return (
    <div className="overlay-backdrop" onClick={() => onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="tag-manager-dialog"
        className="surface-card overlay-dialog-shell tag-manager-dialog-shell"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overlay-dialog-header">
          <div className="overlay-dialog-title">
            <p className="workspace-panel-kicker">분류</p>
            <h2>{isEditing ? "태그 수정" : "태그 관리"}</h2>
          </div>
          <button type="button" className="ghost-button" onClick={() => onClose()}>
            닫기
          </button>
        </div>
        <div className="overlay-dialog-panel">
          <section
            aria-label="tag-manager"
            className="surface-card panel-card tag-manager-panel-readable"
          >
            {showPanelHeader ? (
              <WorkspacePanelHeader heading="태그 관리" summary={panelSummary} kicker={panelKicker} />
            ) : null}
            <div className="manager-workspace">
              <section className="manager-surface manager-editor-surface tag-manager-editor-surface">
                <div className="manager-section-header">
                  <p className="manager-section-kicker">입력</p>
                  <div>
                    <h3>{isEditing ? "태그 수정" : "새 태그"}</h3>
                    <p>{isEditing ? "이름과 색을 정리합니다." : "바로 쓸 태그를 추가합니다."}</p>
                  </div>
                </div>
                <form className="stack-form manager-stack-form" onSubmit={(event) => void onSubmit(event)}>
                  <label>
                    태그 이름
                    <input
                      name="tagName"
                      value={draft.name}
                      onChange={(event) => onDraftChange({ name: event.target.value })}
                      required
                    />
                  </label>
                  {renderColorPicker("태그 색상", draft.color, (value) =>
                    onDraftChange({ color: value })
                  )}
                  <div className="action-row">
                    <button
                      type="submit"
                      className="primary-button"
                      aria-label={isEditing ? "태그 수정" : "태그 추가"}
                      disabled={isSaving}
                    >
                      {isSaving ? "저장 중..." : isEditing ? "저장" : "추가"}
                    </button>
                    {isEditing ? (
                      <button
                        type="button"
                        className="secondary-button"
                        aria-label="수정 취소"
                        onClick={() => onCancelEdit()}
                      >
                        취소
                      </button>
                    ) : null}
                  </div>
                </form>
              </section>
              <section className="manager-surface manager-list-surface tag-manager-list-surface">
                <div className="manager-section-header">
                  <p className="manager-section-kicker">현재 태그</p>
                  <div>
                    <h3>태그 목록</h3>
                    <p>지금 쓰는 태그를 빠르게 정리합니다.</p>
                  </div>
                </div>
                <ul className="tag-list">
                  {tags.map((tag) => (
                    <li key={tag.id} className="tag-list-item tag-list-item-readable">
                      {renderTagLabel(tag.name, tag.color, "tag-list-name")}
                      <div
                        className="folder-action-menu-shell"
                        data-open-menu-shell={openTagActionMenuId === tag.id ? "true" : undefined}
                      >
                        <button
                          type="button"
                          className="ghost-button folder-action-trigger"
                          aria-label={`${tag.name} 태그 더보기`}
                          aria-expanded={openTagActionMenuId === tag.id}
                          onClick={() => onToggleTagActionMenu(tag.id)}
                        >
                          더보기
                        </button>
                        {openTagActionMenuId === tag.id ? (
                          <div
                            role="menu"
                            aria-label={`${tag.name} 태그 메뉴`}
                            className="folder-action-menu"
                          >
                            <button
                              type="button"
                              className="secondary-button folder-action-menu-item"
                              onClick={() => onBeginTagEdit(tag)}
                            >
                              {tag.name} 태그 수정 시작
                            </button>
                            <button
                              type="button"
                              className="danger-button folder-action-menu-item"
                              onClick={() => void onTagDelete(tag)}
                            >
                              {tag.name} 태그 삭제
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
