import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode
} from "react";
import type { Folder } from "@bookmark/shared";

import { colorPresets, folderIconPresets } from "../lib/folder-presets";
import "./ManagerDialog.css";
import "./FolderManagerDialog.css";

export type FolderManagerDraft = {
  name: string;
  color: string;
  icon: string;
  isHidden: boolean;
  parentFolderId: string;
};

export type FolderReorderPosition = "top" | "up" | "down" | "bottom";

export type FolderManagerDialogProps = {
  isEditing: boolean;
  draft: FolderManagerDraft;
  allFolders: Folder[];
  managerFolders: Folder[];
  parentFolderOptions: Array<{ folder: Folder; label: string }>;
  expandedFolderIds: string[];
  draggingFolderId: string | null;
  openFolderActionMenuId: string | null;
  isSaving: boolean;
  isReordering: boolean;
  panelSummary: string;
  panelKicker: string;
  showPanelHeader: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onDraftChange: (nextValues: Partial<FolderManagerDraft>) => void;
  onCancelEdit: () => void;
  onBeginFolderEdit: (folder: Folder) => void;
  onBeginChildFolderCreate: (folder: Folder) => void;
  onFolderDelete: (folder: Folder) => void | Promise<void>;
  onFolderReorderDrop: (folder: Folder) => void | Promise<void>;
  onFolderReorderToPosition: (
    folder: Folder,
    position: FolderReorderPosition
  ) => void | Promise<void>;
  onFolderMoveDrop: (folder: Folder) => void | Promise<void>;
  onFolderMoveToParent: (folder: Folder, parentFolderId: string | null) => void | Promise<void>;
  onFolderMoveToRootDrop: () => void | Promise<void>;
  onToggleFolderExpansion: (folderId: string) => void;
  onToggleFolderActionMenu: (folderId: string) => void;
  onFolderDragStart: (folderId: string) => void;
  onFolderDragEnd: () => void;
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

function getFolderIconGlyph(icon: string | null | undefined) {
  switch (icon) {
    case "book-open":
      return "▤";
    case "newspaper":
      return "▥";
    case "file-text":
      return "≣";
    case "folder":
      return "□";
    case "link":
      return "↗";
    case "star":
      return "★";
    default:
      return null;
  }
}

function renderFolderLabel(
  label: string,
  color: string | null | undefined,
  icon: string | null | undefined,
  className: string,
  isHidden = false
) {
  const folderIconGlyph = getFolderIconGlyph(icon);

  return (
    <span className={className}>
      {folderIconGlyph ? (
        <span
          aria-hidden="true"
          className="folder-icon-badge"
          style={color ? { color, backgroundColor: `${color}1a` } : undefined}
        >
          {folderIconGlyph}
        </span>
      ) : color ? (
        renderColorSwatch(color)
      ) : null}
      <span className="folder-label-text">{label}</span>
      {isHidden ? (
        <span className="folder-hidden-indicator" aria-hidden="true">
          🔒
        </span>
      ) : null}
    </span>
  );
}

function FolderIconPicker({
  selectedIcon,
  onSelect
}: {
  selectedIcon: string;
  onSelect: (value: string) => void;
}) {
  const selectedPreset = folderIconPresets.find((preset) => preset.value === selectedIcon) ?? null;

  return (
    <fieldset className="picker-fieldset">
      <legend>폴더 아이콘</legend>
      <div className="picker-grid">
        <button
          type="button"
          className={`picker-chip${selectedIcon ? "" : " picker-chip-active"}`}
          aria-label="폴더 아이콘 선택 안 함"
          aria-pressed={!selectedIcon}
          onClick={() => onSelect("")}
        >
          <span className="picker-chip-copy">
            <span>선택 안 함</span>
          </span>
          {!selectedIcon ? (
            <span className="choice-selection-mark" aria-hidden="true">
              ✓
            </span>
          ) : null}
        </button>
        {folderIconPresets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`picker-chip${selectedIcon === preset.value ? " picker-chip-active" : ""}`}
            aria-label={`폴더 아이콘 ${preset.label} 선택`}
            aria-pressed={selectedIcon === preset.value}
            onClick={() => onSelect(preset.value)}
          >
            <span className="picker-chip-copy">
              {getFolderIconGlyph(preset.value) ? (
                <span className="folder-icon-badge picker-chip-icon-badge" aria-hidden="true">
                  {getFolderIconGlyph(preset.value)}
                </span>
              ) : null}
              <span>{preset.label}</span>
            </span>
            {selectedIcon === preset.value ? (
              <span className="choice-selection-mark" aria-hidden="true">
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <p className="picker-selection-summary" aria-live="polite">
        {`선택됨: ${selectedPreset?.label ?? "없음"}`}
      </p>
    </fieldset>
  );
}

function getFoldersByParentId(folders: Folder[]) {
  const foldersByParentId = new Map<string | null, Folder[]>();
  const knownFolderIds = new Set(folders.map((folder) => folder.id));
  const sortedFolders = [...folders].sort(
    (leftFolder, rightFolder) =>
      leftFolder.sortOrder - rightFolder.sortOrder ||
      leftFolder.name.localeCompare(rightFolder.name)
  );

  for (const folder of sortedFolders) {
    const parentKey =
      folder.parentFolderId && knownFolderIds.has(folder.parentFolderId)
        ? folder.parentFolderId
        : null;
    const currentFolders = foldersByParentId.get(parentKey) ?? [];
    currentFolders.push(folder);
    foldersByParentId.set(parentKey, currentFolders);
  }

  return foldersByParentId;
}

function getSiblingFolders(folders: Folder[], parentFolderId: string | null) {
  return folders
    .filter((folder) => folder.parentFolderId === parentFolderId)
    .sort(
      (leftFolder, rightFolder) =>
        leftFolder.sortOrder - rightFolder.sortOrder ||
        leftFolder.name.localeCompare(rightFolder.name)
    );
}

function getFolderDescendantIds(folders: Folder[], rootFolderId: string) {
  const descendants = new Set<string>();
  const pendingFolderIds = [rootFolderId];

  while (pendingFolderIds.length > 0) {
    const currentFolderId = pendingFolderIds.pop();
    if (!currentFolderId) {
      continue;
    }

    for (const folder of folders) {
      if (folder.parentFolderId !== currentFolderId || descendants.has(folder.id)) {
        continue;
      }

      descendants.add(folder.id);
      pendingFolderIds.push(folder.id);
    }
  }

  return descendants;
}

function getFolderMoveParentOptions(folders: Folder[], folderToMove: Folder) {
  const excludedFolderIds = new Set([
    folderToMove.id,
    ...getFolderDescendantIds(folders, folderToMove.id)
  ]);
  const foldersByParentId = getFoldersByParentId(
    folders.filter((folder) => !excludedFolderIds.has(folder.id))
  );
  const options: Array<{ folder: Folder; label: string }> = [];

  function visit(parentFolderId: string | null, depth: number) {
    for (const folder of foldersByParentId.get(parentFolderId) ?? []) {
      options.push({
        folder,
        label: `${"-- ".repeat(depth)}${folder.name}`
      });
      visit(folder.id, depth + 1);
    }
  }

  visit(null, 0);
  return options;
}

function getFolderName(folders: Folder[], folderId: string | null) {
  if (!folderId) {
    return "미분류";
  }

  return folders.find((folder) => folder.id === folderId)?.name ?? folderId;
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

export default function FolderManagerDialog({
  isEditing,
  draft,
  allFolders,
  managerFolders,
  parentFolderOptions,
  expandedFolderIds,
  draggingFolderId,
  openFolderActionMenuId,
  isSaving,
  isReordering,
  panelSummary,
  panelKicker,
  showPanelHeader,
  onClose,
  onSubmit,
  onDraftChange,
  onCancelEdit,
  onBeginFolderEdit,
  onBeginChildFolderCreate,
  onFolderDelete,
  onFolderReorderDrop,
  onFolderReorderToPosition,
  onFolderMoveDrop,
  onFolderMoveToParent,
  onFolderMoveToRootDrop,
  onToggleFolderExpansion,
  onToggleFolderActionMenu,
  onFolderDragStart,
  onFolderDragEnd
}: FolderManagerDialogProps) {
  const folderChildrenByParentId = getFoldersByParentId(managerFolders);
  const [openFolderSortMenuId, setOpenFolderSortMenuId] = useState<string | null>(null);
  const [openFolderMoveMenuId, setOpenFolderMoveMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openFolderSortMenuId && !openFolderMoveMenuId) {
      return undefined;
    }

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-folder-manager-open-menu="true"]')
      ) {
        return;
      }

      setOpenFolderSortMenuId(null);
      setOpenFolderMoveMenuId(null);
    }

    globalThis.document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      globalThis.document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, [openFolderMoveMenuId, openFolderSortMenuId]);

  function toggleFolderSortMenu(folderId: string) {
    setOpenFolderMoveMenuId(null);
    setOpenFolderSortMenuId((currentFolderId) =>
      currentFolderId === folderId ? null : folderId
    );
  }

  function toggleFolderMoveMenu(folderId: string) {
    setOpenFolderSortMenuId(null);
    setOpenFolderMoveMenuId((currentFolderId) =>
      currentFolderId === folderId ? null : folderId
    );
  }

  function closeInlineFolderMenus() {
    setOpenFolderSortMenuId(null);
    setOpenFolderMoveMenuId(null);
  }

  function renderFolderManagerNodes(parentFolderId: string | null, depth = 0): ReactNode {
    return (folderChildrenByParentId.get(parentFolderId) ?? []).map((folder) => {
      const childFolders = folderChildrenByParentId.get(folder.id) ?? [];
      const hasChildren = childFolders.length > 0;
      const isExpanded = hasChildren && expandedFolderIds.includes(folder.id);
      const rowStyle = {
        "--folder-tree-depth": depth
      } as CSSProperties;
      const siblingFolders = getSiblingFolders(managerFolders, folder.parentFolderId);
      const siblingIndex = siblingFolders.findIndex((siblingFolder) => siblingFolder.id === folder.id);
      const isFirstSibling = siblingIndex <= 0;
      const isLastSibling = siblingIndex === -1 || siblingIndex >= siblingFolders.length - 1;
      const isSortMenuOpen = openFolderSortMenuId === folder.id;
      const isMoveMenuOpen = openFolderMoveMenuId === folder.id;
      const moveParentOptions = getFolderMoveParentOptions(managerFolders, folder).filter(
        ({ folder: parentFolder }) => parentFolder.id !== folder.parentFolderId
      );
      const canMoveToRoot = folder.parentFolderId !== null;

      return (
        <li
          key={folder.id}
          className={`folder-tree-item${depth > 0 ? " folder-tree-item-child" : ""}`}
          onDragOver={(event) => {
            if (
              !draggingFolderId ||
              draggingFolderId === folder.id ||
              allFolders.find((currentFolder) => currentFolder.id === draggingFolderId)
                ?.parentFolderId !== folder.parentFolderId
            ) {
              return;
            }

            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            void onFolderReorderDrop(folder);
          }}
        >
          <div className="folder-tree-entry">
            <div className="folder-tree-row" style={rowStyle}>
              {hasChildren ? (
                <button
                  type="button"
                  className="folder-tree-disclosure"
                  aria-label={`${folder.name} 폴더 ${isExpanded ? "접기" : "펼치기"}`}
                  aria-expanded={isExpanded}
                  onClick={() => onToggleFolderExpansion(folder.id)}
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              ) : (
                <span aria-hidden="true" className="folder-tree-disclosure-spacer" />
              )}
              <div className="folder-tree-summary">
                {renderFolderLabel(
                  folder.name,
                  folder.color,
                  folder.icon,
                  "folder-tree-label",
                  folder.isHidden === true
                )}
                {folder.parentFolderId ? (
                  <div className="folder-tree-meta">
                    <p>상위 {getFolderName(allFolders, folder.parentFolderId)}</p>
                  </div>
                ) : null}
              </div>
              <div className="folder-tree-actions">
                <div
                  className="folder-action-menu-shell folder-tree-inline-menu-shell"
                  data-open-menu-shell={isSortMenuOpen ? "true" : undefined}
                  data-folder-manager-open-menu={isSortMenuOpen ? "true" : undefined}
                >
                  <button
                    type="button"
                    className="ghost-button folder-tree-handle"
                    draggable
                    disabled={isReordering}
                    aria-label={`${folder.name} 폴더 드래그 정렬`}
                    aria-haspopup="menu"
                    aria-expanded={isSortMenuOpen}
                    onClick={() => toggleFolderSortMenu(folder.id)}
                    onDragStart={() => {
                      closeInlineFolderMenus();
                      onFolderDragStart(folder.id);
                    }}
                    onDragEnd={() => onFolderDragEnd()}
                  >
                    정렬
                  </button>
                  {isSortMenuOpen ? (
                    <div
                      role="menu"
                      aria-label={`${folder.name} 폴더 정렬 메뉴`}
                      className="folder-action-menu folder-tree-inline-menu"
                    >
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        aria-label={`${folder.name} 폴더 맨 위로 이동`}
                        disabled={isFirstSibling || isReordering}
                        onClick={() => {
                          closeInlineFolderMenus();
                          void onFolderReorderToPosition(folder, "top");
                        }}
                      >
                        맨 위
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        aria-label={`${folder.name} 폴더 한 칸 위로 이동`}
                        disabled={isFirstSibling || isReordering}
                        onClick={() => {
                          closeInlineFolderMenus();
                          void onFolderReorderToPosition(folder, "up");
                        }}
                      >
                        위로
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        aria-label={`${folder.name} 폴더 한 칸 아래로 이동`}
                        disabled={isLastSibling || isReordering}
                        onClick={() => {
                          closeInlineFolderMenus();
                          void onFolderReorderToPosition(folder, "down");
                        }}
                      >
                        아래로
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        aria-label={`${folder.name} 폴더 맨 아래로 이동`}
                        disabled={isLastSibling || isReordering}
                        onClick={() => {
                          closeInlineFolderMenus();
                          void onFolderReorderToPosition(folder, "bottom");
                        }}
                      >
                        맨 아래
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="secondary-button folder-tree-child-create"
                  aria-label={`${folder.name} 하위 폴더 추가`}
                  onClick={() => {
                    closeInlineFolderMenus();
                    onBeginChildFolderCreate(folder);
                  }}
                >
                  + 하위
                </button>
                <div
                  className="folder-action-menu-shell folder-tree-inline-menu-shell"
                  data-open-menu-shell={isMoveMenuOpen ? "true" : undefined}
                  data-folder-manager-open-menu={isMoveMenuOpen ? "true" : undefined}
                >
                  <button
                    type="button"
                    className="ghost-button folder-tree-drop-action"
                    disabled={isReordering}
                    aria-label={`${folder.name} 폴더 이동`}
                    aria-haspopup="menu"
                    aria-expanded={isMoveMenuOpen}
                    onClick={() => toggleFolderMoveMenu(folder.id)}
                    onDragOver={(event) => {
                      event.stopPropagation();
                      if (!draggingFolderId || draggingFolderId === folder.id) {
                        return;
                      }

                      const descendantFolderIds = getFolderDescendantIds(allFolders, draggingFolderId);
                      if (descendantFolderIds.has(folder.id)) {
                        return;
                      }

                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      closeInlineFolderMenus();
                      void onFolderMoveDrop(folder);
                    }}
                  >
                    이동
                  </button>
                  {isMoveMenuOpen ? (
                    <div
                      role="menu"
                      aria-label={`${folder.name} 폴더 이동 메뉴`}
                      className="folder-action-menu folder-tree-inline-menu folder-tree-move-menu"
                    >
                      {canMoveToRoot ? (
                        <button
                          type="button"
                          className="secondary-button folder-action-menu-item"
                          aria-label={`${folder.name} 폴더를 최상위로 이동`}
                          disabled={isReordering}
                          onClick={() => {
                            closeInlineFolderMenus();
                            void onFolderMoveToParent(folder, null);
                          }}
                        >
                          최상위
                        </button>
                      ) : null}
                      {moveParentOptions.map(({ folder: parentFolder, label }) => (
                        <button
                          key={parentFolder.id}
                          type="button"
                          className="secondary-button folder-action-menu-item"
                          aria-label={`${folder.name} 폴더를 ${parentFolder.name} 아래로 이동`}
                          disabled={isReordering}
                          onClick={() => {
                            closeInlineFolderMenus();
                            void onFolderMoveToParent(folder, parentFolder.id);
                          }}
                        >
                          {label} 아래
                        </button>
                      ))}
                      {!canMoveToRoot && moveParentOptions.length === 0 ? (
                        <p className="folder-action-menu-empty">이동할 위치 없음</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div
                  className="folder-action-menu-shell"
                  data-open-menu-shell={openFolderActionMenuId === folder.id ? "true" : undefined}
                >
                  <button
                    type="button"
                    className="ghost-button folder-action-trigger overflow-trigger"
                    aria-label={`${folder.name} 폴더 더보기`}
                    aria-expanded={openFolderActionMenuId === folder.id}
                    onClick={() => {
                      closeInlineFolderMenus();
                      onToggleFolderActionMenu(folder.id);
                    }}
                  >
                    ...
                  </button>
                  {openFolderActionMenuId === folder.id ? (
                    <div
                      role="menu"
                      aria-label={`${folder.name} 폴더 메뉴`}
                      className="folder-action-menu"
                    >
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        aria-label={`${folder.name} 하위 폴더 추가`}
                        onClick={() => onBeginChildFolderCreate(folder)}
                      >
                        추가
                      </button>
                      <button
                        type="button"
                        className="secondary-button folder-action-menu-item"
                        aria-label={`${folder.name} 폴더 수정`}
                        onClick={() => onBeginFolderEdit(folder)}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className="danger-button folder-action-menu-item"
                        aria-label={`${folder.name} 폴더 삭제`}
                        onClick={() => void onFolderDelete(folder)}
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            {hasChildren && isExpanded ? (
              <ul className="folder-tree-children">
                {renderFolderManagerNodes(folder.id, depth + 1)}
              </ul>
            ) : null}
          </div>
        </li>
      );
    });
  }

  return (
    <div className="overlay-backdrop" onClick={() => onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="folder-manager-dialog"
        className="surface-card overlay-dialog-shell"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overlay-dialog-header">
          <div className="overlay-dialog-title">
            <p className="workspace-panel-kicker">구조</p>
            <h2>{isEditing ? "폴더 수정" : "폴더 관리"}</h2>
          </div>
          <button type="button" className="ghost-button" onClick={() => onClose()}>
            닫기
          </button>
        </div>
        <div className="overlay-dialog-panel">
          <section aria-label="folder-manager" className="surface-card panel-card">
            {showPanelHeader ? (
              <WorkspacePanelHeader heading="폴더 관리" summary={panelSummary} kicker={panelKicker} />
            ) : null}
            <div className="manager-workspace">
              <section className="manager-surface manager-editor-surface">
                <div className="manager-section-header">
                  <p className="manager-section-kicker">입력</p>
                  <div>
                    <h3>{isEditing ? "폴더 수정" : "새 폴더"}</h3>
                    <p>{isEditing ? "구조를 정리합니다." : "트리에 추가합니다."}</p>
                  </div>
                </div>
                <form className="stack-form manager-stack-form" onSubmit={(event) => void onSubmit(event)}>
                  <label>
                    폴더 이름
                    <input
                      name="folderName"
                      value={draft.name}
                      onChange={(event) => onDraftChange({ name: event.target.value })}
                      required
                    />
                  </label>
                  {renderCheckboxField({
                    className: "manager-checkbox-row",
                    label: "숨김 폴더",
                    inputProps: {
                      name: "folderIsHidden",
                      checked: draft.isHidden,
                      onChange: (event) => onDraftChange({ isHidden: event.currentTarget.checked })
                    }
                  })}
                  {renderColorPicker("폴더 색상", draft.color, (value) => onDraftChange({ color: value }))}
                  <FolderIconPicker
                    selectedIcon={draft.icon}
                    onSelect={(value) => onDraftChange({ icon: value })}
                  />
                  <label>
                    부모 폴더
                    <select
                      name="folderParentFolderId"
                      value={draft.parentFolderId}
                      onChange={(event) => onDraftChange({ parentFolderId: event.target.value })}
                    >
                      <option value="">상위 없음</option>
                      {parentFolderOptions.map(({ folder, label }) => (
                        <option key={folder.id} value={folder.id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="action-row">
                    <button
                      type="submit"
                      className="primary-button"
                      aria-label={isEditing ? "폴더 수정" : "폴더 추가"}
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
              <section className="manager-surface manager-list-surface">
                <div className="manager-section-header">
                  <p className="manager-section-kicker">폴더 트리</p>
                  <div>
                    <h3>트리</h3>
                    <p>{allFolders.length}개 폴더</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="dropzone-button manager-dropzone"
                  disabled={isReordering}
                  aria-label="루트 이동"
                  onDragOver={(event) => {
                    const draggedFolder = draggingFolderId
                      ? allFolders.find((folder) => folder.id === draggingFolderId)
                      : null;
                    if (!draggedFolder || draggedFolder.parentFolderId === null) {
                      return;
                    }

                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    void onFolderMoveToRootDrop();
                  }}
                >
                  루트 이동
                </button>
                <ul className="folder-tree">{renderFolderManagerNodes(null)}</ul>
              </section>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
