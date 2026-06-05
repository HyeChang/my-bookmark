import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import type {
  CreateMemoTagRequest,
  MemoAsset,
  MemoFolder,
  MemoRichContent,
  MemoTag
} from "@bookmark/shared";

import {
  LazyMemoRichEditor,
  preloadMemoRichEditorChunk
} from "./memo-rich-editor-chunk";
import "./MemoComposerDialog.css";

export type MemoComposerDraft = {
  title: string;
  folderId: string;
  tagIds: string[];
  memoColor: string;
  isFavorite: boolean;
  isHidden: boolean;
  isLocked: boolean;
  lockPassword: string;
  contentJson: MemoRichContent;
  contentText: string;
};

export type MemoComposerDialogProps = {
  isEditing: boolean;
  isSaving: boolean;
  draft: MemoComposerDraft;
  folders: MemoFolder[];
  tags: MemoTag[];
  lockPasswordRequired?: boolean;
  onClose: () => void;
  onCreateTag?: (input: CreateMemoTagRequest) => Promise<MemoTag>;
  onDraftContentChange: (
    nextValues: Pick<MemoComposerDraft, "contentJson" | "contentText">
  ) => void;
  onDraftChange: (nextValues: Partial<MemoComposerDraft>) => void;
  onDelete?: () => void | Promise<void>;
  onImageUpload: (file: File) => Promise<MemoAsset>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

type MemoFolderOption = {
  folder: MemoFolder;
  label: string;
};

function toggleTagId(tagIds: string[], tagId: string, checked: boolean) {
  if (checked) {
    return tagIds.includes(tagId) ? tagIds : [...tagIds, tagId];
  }

  return tagIds.filter((currentTagId) => currentTagId !== tagId);
}

function compareMemoFolders(left: MemoFolder, right: MemoFolder) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.name.localeCompare(right.name, "ko-KR");
}

function getMemoFolderOptions(folders: MemoFolder[]): MemoFolderOption[] {
  const knownFolderIds = new Set(folders.map((folder) => folder.id));
  const childrenByParentId = new Map<string | null, MemoFolder[]>();

  for (const folder of folders) {
    const parentFolderId =
      folder.parentFolderId && knownFolderIds.has(folder.parentFolderId)
        ? folder.parentFolderId
        : null;
    const siblings = childrenByParentId.get(parentFolderId) ?? [];
    siblings.push(folder);
    childrenByParentId.set(parentFolderId, siblings);
  }

  for (const siblings of childrenByParentId.values()) {
    siblings.sort(compareMemoFolders);
  }

  const options: MemoFolderOption[] = [];
  const visitedFolderIds = new Set<string>();

  function visit(parentFolderId: string | null, parentLabels: string[]) {
    for (const folder of childrenByParentId.get(parentFolderId) ?? []) {
      if (visitedFolderIds.has(folder.id)) {
        continue;
      }

      visitedFolderIds.add(folder.id);
      const labels = [...parentLabels, folder.name];
      options.push({
        folder,
        label: labels.join(" / ")
      });
      visit(folder.id, labels);
    }
  }

  visit(null, []);

  if (visitedFolderIds.size < folders.length) {
    for (const folder of [...folders].sort(compareMemoFolders)) {
      if (!visitedFolderIds.has(folder.id)) {
        visitedFolderIds.add(folder.id);
        options.push({ folder, label: folder.name });
      }
    }
  }

  return options;
}

export function preloadMemoComposerEditorChunk() {
  preloadMemoRichEditorChunk();
}

export default function MemoComposerDialog({
  isEditing,
  isSaving,
  draft,
  folders,
  lockPasswordRequired = false,
  tags,
  onClose,
  onCreateTag,
  onDraftContentChange,
  onDraftChange,
  onDelete,
  onImageUpload,
  onSubmit
}: MemoComposerDialogProps) {
  const selectedTagCount = draft.tagIds.length;
  const folderOptions = getMemoFolderOptions(folders);
  const selectedFolderPath = draft.folderId
    ? folderOptions.find(({ folder }) => folder.id === draft.folderId)?.label ??
      "알 수 없는 폴더"
    : "미분류";
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#2563eb");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [tagCreateError, setTagCreateError] = useState<string | null>(null);
  const [isStickyActionsVisible, setIsStickyActionsVisible] = useState(false);
  const [stickySearchElement, setStickySearchElement] = useState<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const workspace = workspaceRef.current;
    const scrollContainers = new Set<HTMLElement>();
    const primaryScrollContainer = workspace?.closest(".result-primary-column") as HTMLElement | null;
    const editorScrollContainer = workspace?.querySelector(".memo-editor-shell") as HTMLElement | null;

    if (primaryScrollContainer) {
      scrollContainers.add(primaryScrollContainer);
    }

    if (editorScrollContainer) {
      scrollContainers.add(editorScrollContainer);
    }

    function updateStickyActionsVisibility() {
      const hasPageScrolled = window.scrollY > 96;
      const hasContainerScrolled = Array.from(scrollContainers).some(
        (scrollContainer) => scrollContainer.scrollTop > 96
      );

      setIsStickyActionsVisible(hasPageScrolled || hasContainerScrolled);
    }

    updateStickyActionsVisibility();
    window.addEventListener("scroll", updateStickyActionsVisibility, { passive: true });
    window.addEventListener("resize", updateStickyActionsVisibility);
    scrollContainers.forEach((scrollContainer) => {
      scrollContainer.addEventListener("scroll", updateStickyActionsVisibility, { passive: true });
    });

    return () => {
      window.removeEventListener("scroll", updateStickyActionsVisibility);
      window.removeEventListener("resize", updateStickyActionsVisibility);
      scrollContainers.forEach((scrollContainer) => {
        scrollContainer.removeEventListener("scroll", updateStickyActionsVisibility);
      });
    };
  }, []);

  async function handleCreateTag() {
    if (!onCreateTag) {
      return;
    }

    const name = newTagName.trim();
    if (!name) {
      setTagCreateError("태그 이름을 입력해주세요.");
      return;
    }

    setIsCreatingTag(true);
    setTagCreateError(null);

    try {
      const createdTag = await onCreateTag({
        name,
        color: newTagColor || null
      });
      onDraftChange({ tagIds: toggleTagId(draft.tagIds, createdTag.id, true) });
      setNewTagName("");
      setNewTagColor(createdTag.color ?? newTagColor);
    } catch (error) {
      setTagCreateError(
        error instanceof Error ? error.message : "태그를 추가하지 못했습니다."
      );
    } finally {
      setIsCreatingTag(false);
    }
  }

  return (
    <section
      ref={workspaceRef}
      aria-label="memo-editor-workspace"
      className="surface-card panel-card memo-composer-workspace"
    >
      <form id="memo-composer-form" className="memo-composer-form" onSubmit={onSubmit}>
        <header className="memo-composer-header">
          <button type="button" className="secondary-button memo-composer-back-button" onClick={onClose}>
            메모 목록
          </button>
          <label className="memo-composer-title-field">
            <span className="memo-composer-title-label">
              {isEditing ? "메모 수정" : "새 메모"}
            </span>
            <input
              value={draft.title}
              aria-label="메모 제목"
              placeholder="메모 제목"
              onChange={(event) => onDraftChange({ title: event.currentTarget.value })}
            />
          </label>
          <div className="memo-composer-header-actions">
            {isEditing && onDelete ? (
              <button
                type="button"
                className="danger-button memo-composer-delete-button"
                aria-label={`${draft.title || "현재"} 메모 삭제`}
                onClick={() => void onDelete()}
              >
                🗑
              </button>
            ) : null}
            <button
              type="submit"
              className="primary-button memo-composer-save-button"
              disabled={isSaving}
            >
              {isSaving ? "저장 중..." : "저장"}
            </button>
          </div>
        </header>

        <div
          role="toolbar"
          aria-label="메모 빠른 저장"
          className="memo-composer-sticky-actions"
          data-visible={isStickyActionsVisible ? "true" : "false"}
        >
          <div className="memo-composer-sticky-search" ref={setStickySearchElement} />
          <button
            type="submit"
            className="primary-button memo-composer-sticky-save-button"
            aria-label="빠른 저장"
            disabled={isSaving}
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>

        <section aria-label="메모 분류" className="memo-composer-classification-row">
          <label className="memo-composer-inline-field memo-composer-folder-field">
            <span>폴더</span>
            <select
              aria-label="메모 폴더"
              value={draft.folderId}
              onChange={(event) => onDraftChange({ folderId: event.currentTarget.value })}
            >
              <option value="">미분류</option>
              {folderOptions.map(({ folder, label }) => (
                <option key={folder.id} value={folder.id}>
                  {label}
                </option>
              ))}
            </select>
            <span className="memo-composer-folder-path">
              현재 위치 {selectedFolderPath}
            </span>
          </label>

          <label className="memo-composer-inline-field memo-composer-color-field">
            <span>색상</span>
            <input
              type="color"
              aria-label="메모 색상"
              value={draft.memoColor || "#ffffff"}
              onChange={(event) => onDraftChange({ memoColor: event.currentTarget.value })}
            />
          </label>

          <label className="memo-composer-checkbox memo-composer-favorite-toggle">
            <input
              type="checkbox"
              checked={draft.isFavorite}
              onChange={(event) => onDraftChange({ isFavorite: event.currentTarget.checked })}
            />
            즐겨찾기
          </label>

          <label className="memo-composer-checkbox memo-composer-hidden-toggle">
            <input
              type="checkbox"
              checked={draft.isHidden}
              onChange={(event) => onDraftChange({ isHidden: event.currentTarget.checked })}
            />
            숨김 메모
          </label>

          <label className="memo-composer-checkbox memo-composer-locked-toggle">
            <input
              type="checkbox"
              checked={draft.isLocked}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                onDraftChange({
                  isLocked: checked,
                  lockPassword: checked ? draft.lockPassword : ""
                });
              }}
            />
            잠금 메모
          </label>

          {draft.isLocked ? (
            <label className="memo-composer-inline-field memo-composer-lock-password-field">
              <span>{lockPasswordRequired ? "비밀번호" : "새 비밀번호"}</span>
              <input
                type="password"
                aria-label="잠금 비밀번호"
                value={draft.lockPassword}
                placeholder={
                  lockPasswordRequired ? "4자 이상 입력" : "변경할 때만 입력"
                }
                minLength={4}
                required={lockPasswordRequired}
                autoComplete="new-password"
                onChange={(event) =>
                  onDraftChange({ lockPassword: event.currentTarget.value })
                }
              />
            </label>
          ) : null}

          <details className="memo-composer-tag-dropdown">
            <summary role="button" aria-label={`태그${selectedTagCount > 0 ? ` ${selectedTagCount}` : ""}`}>
              태그{selectedTagCount > 0 ? ` ${selectedTagCount}` : ""}
            </summary>
            <div className="memo-composer-tag-list">
              {onCreateTag ? (
                <div className="memo-composer-tag-create">
                  <label className="memo-composer-tag-create-name">
                    <span>새 태그</span>
                    <input
                      type="text"
                      aria-label="새 태그 이름"
                      value={newTagName}
                      placeholder="태그 이름"
                      onChange={(event) => setNewTagName(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleCreateTag();
                        }
                      }}
                    />
                  </label>
                  <label className="memo-composer-tag-create-color">
                    <span>색상</span>
                    <input
                      type="color"
                      aria-label="새 태그 색상"
                      value={newTagColor}
                      onChange={(event) => setNewTagColor(event.currentTarget.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary-button memo-composer-tag-create-button"
                    disabled={isCreatingTag}
                    onClick={() => void handleCreateTag()}
                  >
                    {isCreatingTag ? "추가 중..." : "태그 추가"}
                  </button>
                  {tagCreateError ? (
                    <p className="memo-composer-tag-error" role="alert">
                      {tagCreateError}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {tags.length > 0 ? (
                tags.map((tag) => (
                  <label key={tag.id} className="memo-composer-checkbox memo-composer-tag-option">
                    <input
                      type="checkbox"
                      checked={draft.tagIds.includes(tag.id)}
                      onChange={(event) =>
                        onDraftChange({
                          tagIds: toggleTagId(draft.tagIds, tag.id, event.currentTarget.checked)
                        })
                      }
                    />
                    {tag.name}
                  </label>
                ))
              ) : (
                <p className="memo-composer-tag-empty">사용 가능한 태그가 없습니다.</p>
              )}
            </div>
          </details>
        </section>

        <section className="memo-composer-body-section">
          <h3 className="memo-composer-body-heading">본문</h3>
          <Suspense fallback={<div className="memo-editor-shell" aria-hidden="true" />}>
            <LazyMemoRichEditor
              value={draft.contentJson}
              onImageUpload={onImageUpload}
              searchPortalElement={stickySearchElement}
              onChange={(contentJson, contentText) =>
                onDraftContentChange({
                  contentJson,
                  contentText
                })
              }
            />
          </Suspense>
        </section>
      </form>
    </section>
  );
}
