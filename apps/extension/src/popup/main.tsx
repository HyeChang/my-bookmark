import React, { useEffect, useMemo, useState, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
import ReactDOM from "react-dom/client";
import type { Folder, Tag } from "@bookmark/shared";

import {
  collectImageCandidates,
  createFileFromImageUrl,
  extractImageFilesFromTransfer,
  loadActiveTabCapture,
  type ExtensionCaptureContext
} from "../lib/capture";
import {
  createExtensionTag,
  loadExtensionFolders,
  loadExtensionTags,
  saveExtensionBookmark
} from "../lib/api";
import { extensionColorPresets } from "../lib/color-presets";
import {
  buildFolderPathLabel,
  collectExpandedFolderIds,
  flattenFolderTreeRows
} from "../lib/folders";
import {
  clearPendingBookmarkDraft,
  defaultExtensionSettings,
  loadExtensionSettings,
  loadPendingBookmarkDraft,
  type ExtensionSettings
} from "../lib/storage";
import { openUrlInNewTab } from "../lib/browser";
import { getInitialPageContent, getPageContentHelperText } from "../lib/page-content";
import { dataUrlToFile } from "../lib/screenshot";

type PopupStatus =
  | { kind: "idle"; message: string | null }
  | { kind: "saving"; message: string }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

const palette = {
  page: "#f3f6fb",
  panel: "#ffffff",
  panelAlt: "#f8fafc",
  border: "#d9e2ec",
  text: "#0f172a",
  muted: "#64748b",
  accent: "#2563eb",
  accentSurface: "#eff6ff",
  accentBorder: "#bfdbfe",
  success: "#166534",
  error: "#b91c1c",
  shadow: "0 16px 36px rgba(15, 23, 42, 0.12)"
};

function PopupApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultExtensionSettings);
  const [capture, setCapture] = useState<ExtensionCaptureContext>({
    title: "",
    url: "",
    selectedText: "",
    imageCandidates: []
  });
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [editableTitle, setEditableTitle] = useState("");
  const [editableUrl, setEditableUrl] = useState("");
  const [editableContent, setEditableContent] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<PopupStatus>({ kind: "idle", message: null });
  const [isAddingCandidate, setIsAddingCandidate] = useState<string | null>(null);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [isTagComposerOpen, setIsTagComposerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  useEffect(() => {
    void (async () => {
      const [nextSettings, nextCapture, pendingDraft] = await Promise.all([
        loadExtensionSettings(),
        loadActiveTabCapture(),
        loadPendingBookmarkDraft()
      ]);

      setSettings(nextSettings);
      setCapture(nextCapture);
      setEditableTitle(pendingDraft?.title || nextCapture.title);
      setEditableUrl(pendingDraft?.url || nextCapture.url);
      setEditableContent(getInitialPageContent(pendingDraft?.userContent, nextCapture.selectedText));
      setSelectedFolderId(pendingDraft?.folderId || "");
      setSelectedTagIds(
        pendingDraft && pendingDraft.tagIds.length > 0 ? pendingDraft.tagIds : nextSettings.defaultTagIds
      );

      if (pendingDraft) {
        const draftFiles: File[] = [];

        for (const asset of pendingDraft.assets) {
          if (asset.kind === "remote-url") {
            draftFiles.push(await createFileFromImageUrl(asset.source));
            continue;
          }

          draftFiles.push(await dataUrlToFile(asset.source, asset.filename));
        }

        setQueuedFiles(draftFiles);
        await clearPendingBookmarkDraft();
      }

      if (nextSettings.apiBaseUrl && nextSettings.token) {
        const [nextFolders, nextTags] = await Promise.all([
          loadExtensionFolders(nextSettings.apiBaseUrl, nextSettings.token).catch(() => []),
          loadExtensionTags(nextSettings.apiBaseUrl, nextSettings.token).catch(() => [])
        ]);
        setFolders(nextFolders);
        setTags(nextTags);
        setExpandedFolderIds(
          collectExpandedFolderIds(nextFolders, pendingDraft?.folderId || nextSettings.defaultFolderId)
        );
      }
    })().catch((error) => {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "확장 팝업을 초기화하지 못했습니다."
      });
    });
  }, []);

  const imageCandidates = useMemo(
    () => collectImageCandidates(capture.imageCandidates),
    [capture.imageCandidates]
  );
  const folderRows = useMemo(
    () => flattenFolderTreeRows(folders, expandedFolderIds),
    [folders, expandedFolderIds]
  );
  const selectedFolderLabel = useMemo(() => {
    if (selectedFolderId) {
      return buildFolderPathLabel(folders, selectedFolderId);
    }

    if (settings.defaultFolderId) {
      const defaultLabel = buildFolderPathLabel(folders, settings.defaultFolderId);
      if (defaultLabel !== "미분류") {
        return `자동 선택 (기본: ${defaultLabel})`;
      }
    }

    return "미분류";
  }, [folders, selectedFolderId, settings.defaultFolderId]);

  function appendQueuedFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setQueuedFiles((currentFiles) => [...currentFiles, ...files]);
  }

  function removeQueuedFile(fileName: string, fileSize: number) {
    setQueuedFiles((currentFiles) =>
      currentFiles.filter((file) => !(file.name === fileName && file.size === fileSize))
    );
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    appendQueuedFiles(Array.from(event.target.files ?? []));
    event.currentTarget.value = "";
  }

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    const files = extractImageFilesFromTransfer(event.clipboardData);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    appendQueuedFiles(files);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    appendQueuedFiles(extractImageFilesFromTransfer(event.dataTransfer));
  }

  function toggleFolderExpanded(folderId: string) {
    setExpandedFolderIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (nextIds.has(folderId)) {
        nextIds.delete(folderId);
      } else {
        nextIds.add(folderId);
      }
      return nextIds;
    });
  }

  async function handleAddImageCandidate(imageUrl: string) {
    try {
      setIsAddingCandidate(imageUrl);
      const file = await createFileFromImageUrl(imageUrl);
      appendQueuedFiles([file]);
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "이미지 후보를 추가하지 못했습니다."
      });
    } finally {
      setIsAddingCandidate(null);
    }
  }

  async function handleCreateTag() {
    if (!settings.apiBaseUrl || !settings.token) {
      setStatus({
        kind: "error",
        message: "옵션 페이지에서 API 주소와 확장 토큰을 먼저 입력해주세요."
      });
      return;
    }

    const trimmedTagName = newTagName.trim();
    if (!trimmedTagName) {
      setStatus({
        kind: "error",
        message: "새 태그 이름을 입력해주세요."
      });
      return;
    }

    try {
      setIsCreatingTag(true);
      const createdTag = await createExtensionTag(settings.apiBaseUrl, settings.token, {
        name: trimmedTagName,
        color: newTagColor || null
      });

      setTags((currentTags) => [createdTag, ...currentTags]);
      setSelectedTagIds((currentIds) =>
        currentIds.includes(createdTag.id) ? currentIds : [...currentIds, createdTag.id]
      );
      setNewTagName("");
      setNewTagColor("");
      setIsTagComposerOpen(false);
      setStatus({
        kind: "success",
        message: `태그 "${createdTag.name}"를 만들고 선택했습니다.`
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "태그를 생성하지 못했습니다."
      });
    } finally {
      setIsCreatingTag(false);
    }
  }

  async function handleSave() {
    if (!settings.apiBaseUrl || !settings.token) {
      setStatus({
        kind: "error",
        message: "옵션 페이지에서 API 주소와 확장 토큰을 먼저 입력해주세요."
      });
      return;
    }

    if (!editableUrl.trim()) {
      setStatus({
        kind: "error",
        message: "저장할 URL이 없습니다."
      });
      return;
    }

    try {
      setStatus({
        kind: "saving",
        message: "북마크를 저장하는 중입니다..."
      });

      await saveExtensionBookmark(
        settings.apiBaseUrl,
        settings.token,
        {
          url: editableUrl.trim(),
          folderId: selectedFolderId || settings.defaultFolderId || null,
          tagIds: selectedTagIds,
          userTitle: editableTitle.trim() || null,
          userContent: editableContent.trim() || null,
          isFavorite,
          isHidden
        },
        queuedFiles,
        folders
      );

      setStatus({
        kind: "success",
        message: "북마크를 저장했습니다."
      });
      setQueuedFiles([]);
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "북마크를 저장하지 못했습니다."
      });
    }
  }

  function openOptionsPage() {
    const chromeApi = (globalThis as { chrome?: any }).chrome;
    if (chromeApi?.runtime?.openOptionsPage) {
      void chromeApi.runtime.openOptionsPage();
    }
  }

  function getMainBookmarkPageUrl() {
    const apiBaseUrl = settings.apiBaseUrl.trim().replace(/\/+$/, "");
    return apiBaseUrl ? `${apiBaseUrl}/` : "";
  }

  function openMainBookmarkPage() {
    const mainPageUrl = getMainBookmarkPageUrl();
    if (!mainPageUrl) {
      setStatus({
        kind: "error",
        message: "설정 페이지에서 API 주소를 먼저 입력해주세요."
      });
      openOptionsPage();
      return;
    }

    void openUrlInNewTab(mainPageUrl);
  }

  const fieldStyle = {
    borderRadius: 12,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    color: palette.text,
    padding: "11px 12px"
  } as const;

  const secondaryButtonStyle = {
    borderRadius: 12,
    border: `1px solid ${palette.border}`,
    background: palette.panel,
    color: palette.text,
    padding: "10px 14px",
    fontWeight: 700
  } as const;

  const checkboxCardStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "11px 12px",
    borderRadius: 12,
    border: `1px solid ${palette.border}`,
    background: palette.panel
  } as const;

  const checkboxInputStyle = {
    width: 16,
    height: 16,
    accentColor: palette.accent,
    margin: 0,
    flex: "0 0 auto"
  } as const;

  return (
    <main
      onPaste={handlePaste}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      style={{
        margin: 0,
        minWidth: 380,
        padding: 16,
        fontFamily: "\"Segoe UI\", sans-serif",
        background: palette.page,
        color: palette.text,
        display: "flex",
        flexDirection: "column",
        gap: 14
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          padding: 14,
          borderRadius: 18,
          background: palette.panel,
          border: `1px solid ${palette.border}`,
          boxShadow: palette.shadow
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 20, lineHeight: 1.2 }}>Bookmark Saver</h1>
          <p style={{ margin: 0, color: palette.muted, lineHeight: 1.4 }}>
            현재 페이지를 빠르게 정리해서 저장합니다.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" onClick={openMainBookmarkPage} style={secondaryButtonStyle}>
            메인 페이지 이동
          </button>
          <button type="button" onClick={openOptionsPage} style={secondaryButtonStyle}>
            설정
          </button>
        </div>
      </header>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontWeight: 700 }}>제목</span>
        <input
          value={editableTitle}
          onChange={(event) => setEditableTitle(event.target.value)}
          style={fieldStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontWeight: 700 }}>URL</span>
        <input
          value={editableUrl}
          onChange={(event) => setEditableUrl(event.target.value)}
          style={fieldStyle}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontWeight: 700 }}>페이지 내용</span>
        <span style={{ color: palette.muted, fontSize: 13, lineHeight: 1.45 }}>
          {getPageContentHelperText(capture.selectedText)}
        </span>
        <textarea
          value={editableContent}
          onChange={(event) => setEditableContent(event.target.value)}
          rows={4}
          placeholder="이 페이지와 함께 저장할 내용을 직접 입력하세요."
          style={{
            ...fieldStyle,
            resize: "vertical"
          }}
        />
      </label>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <label style={checkboxCardStyle}>
          <span style={{ fontWeight: 700 }}>즐겨찾기</span>
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(event) => setIsFavorite(event.target.checked)}
            style={checkboxInputStyle}
          />
        </label>
        <label style={checkboxCardStyle}>
          <span style={{ fontWeight: 700 }}>숨김 북마크</span>
          <input
            type="checkbox"
            checked={isHidden}
            onChange={(event) => setIsHidden(event.target.checked)}
            style={checkboxInputStyle}
          />
        </label>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontWeight: 700 }}>폴더</span>
        <button
          type="button"
          onClick={() => setIsFolderPickerOpen((open) => !open)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderRadius: 14,
            border: `1px solid ${isFolderPickerOpen ? palette.accentBorder : palette.border}`,
            background: palette.panel,
            color: palette.text,
            padding: "12px 14px",
            fontWeight: 600,
            boxShadow: isFolderPickerOpen ? "0 0 0 3px rgba(37, 99, 235, 0.12)" : "none"
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "left"
            }}
          >
            {selectedFolderLabel}
          </span>
          <span aria-hidden="true">{isFolderPickerOpen ? "▴" : "▾"}</span>
        </button>

        {isFolderPickerOpen ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              maxHeight: 240,
              overflowY: "auto",
              borderRadius: 16,
              border: `1px solid ${palette.border}`,
              background: palette.panel,
              padding: 8,
              boxShadow: palette.shadow
            }}
          >
            <button
              type="button"
              onClick={() => {
                setSelectedFolderId("");
                setIsFolderPickerOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                borderRadius: 12,
                border: `1px solid ${selectedFolderId ? "transparent" : palette.accentBorder}`,
                background: selectedFolderId ? "transparent" : palette.accentSurface,
                color: palette.text,
                padding: "10px 12px",
                fontWeight: 600
              }}
            >
              <span>미분류</span>
              {!selectedFolderId ? <span aria-hidden="true">✓</span> : null}
            </button>

            {folderRows.map((row) => {
              const isSelected = row.id === selectedFolderId;
              return (
                <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    aria-label={row.hasChildren ? `${row.name} 펼치기` : `${row.name} 폴더`}
                    onClick={() => (row.hasChildren ? toggleFolderExpanded(row.id) : undefined)}
                    style={{
                      visibility: row.hasChildren ? "visible" : "hidden",
                      width: 20,
                      height: 20,
                      border: "none",
                      background: "transparent",
                      color: palette.muted,
                      padding: 0,
                      marginLeft: row.depth * 16
                    }}
                  >
                    {expandedFolderIds.has(row.id) ? "▾" : "▸"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFolderId(row.id);
                      setExpandedFolderIds((currentIds) => {
                        const nextIds = new Set(currentIds);
                        nextIds.add(row.id);
                        return nextIds;
                      });
                      setIsFolderPickerOpen(false);
                    }}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      borderRadius: 12,
                      border: `1px solid ${isSelected ? palette.accentBorder : "transparent"}`,
                      background: isSelected ? palette.accentSurface : "transparent",
                      color: palette.text,
                      padding: "10px 12px",
                      textAlign: "left"
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {row.name}
                    </span>
                    {isSelected ? <span aria-hidden="true">✓</span> : null}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8
          }}
        >
          <strong>태그</strong>
          <button
            type="button"
            onClick={() => setIsTagComposerOpen((open) => !open)}
            style={{
              borderRadius: 10,
              border: `1px solid ${palette.border}`,
              background: palette.panel,
              color: palette.text,
              padding: "7px 10px",
              fontWeight: 700
            }}
          >
            {isTagComposerOpen ? "닫기" : "+ 새 태그"}
          </button>
        </div>

        {isTagComposerOpen ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 12,
              padding: 12,
              borderRadius: 14,
              border: `1px solid ${palette.border}`,
              background: palette.panelAlt
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>태그 이름</span>
              <input
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
                placeholder="예: Research"
                style={{
                  borderRadius: 12,
                  border: `1px solid ${palette.border}`,
                  background: palette.panel,
                  color: palette.text,
                  padding: "10px 12px"
                }}
              />
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontWeight: 700 }}>태그 색상</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setNewTagColor("")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 999,
                    border: `1px solid ${newTagColor ? palette.border : palette.accentBorder}`,
                    background: newTagColor ? palette.panel : palette.accentSurface,
                    color: palette.text,
                    padding: "7px 10px"
                  }}
                >
                  <span>선택 안 함</span>
                  {!newTagColor ? <span aria-hidden="true">✓</span> : null}
                </button>
                {extensionColorPresets.map((preset) => {
                  const isSelected = preset.value === newTagColor;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setNewTagColor(preset.value)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        borderRadius: 999,
                        border: `1px solid ${isSelected ? palette.accentBorder : palette.border}`,
                        background: isSelected ? palette.accentSurface : palette.panel,
                        color: palette.text,
                        padding: "7px 10px"
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 999,
                          background: preset.value,
                          boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.12)"
                        }}
                      />
                      <span>{preset.label}</span>
                      {isSelected ? <span aria-hidden="true">✓</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => void handleCreateTag()}
                disabled={isCreatingTag}
                style={{
                  borderRadius: 10,
                  border: "none",
                  background: palette.accent,
                  color: "#ffffff",
                  padding: "10px 12px",
                  fontWeight: 700
                }}
              >
                {isCreatingTag ? "생성 중..." : "태그 생성"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsTagComposerOpen(false);
                  setNewTagName("");
                  setNewTagColor("");
                }}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${palette.border}`,
                  background: palette.panel,
                  color: palette.text,
                  padding: "10px 12px",
                  fontWeight: 700
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {tags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <label
                key={tag.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 10px",
                  borderRadius: 999,
                  border: `1px solid ${isSelected ? palette.accentBorder : palette.border}`,
                  background: isSelected ? palette.accentSurface : palette.panel,
                  color: palette.text
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(event) =>
                    setSelectedTagIds((currentIds) =>
                      event.target.checked
                        ? [...currentIds, tag.id]
                        : currentIds.filter((currentId) => currentId !== tag.id)
                    )
                  }
                />
                <span>{tag.name}</span>
              </label>
            );
          })}
          {tags.length === 0 ? <p style={{ margin: 0, color: palette.muted }}>사용 가능한 태그가 없습니다.</p> : null}
        </div>
      </section>

      <section
        aria-label="이미지 붙여넣기 또는 끌어놓기"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 14,
          borderRadius: 16,
          border: `1px dashed ${palette.accentBorder}`,
          background: palette.panelAlt
        }}
      >
        <strong>이미지 붙여넣기 또는 끌어놓기</strong>
        <span style={{ color: palette.muted, fontSize: 13 }}>
          파일 선택, Ctrl+V, 드래그앤드롭을 함께 지원합니다.
        </span>
        <input type="file" accept="image/*" multiple onChange={handleFileInputChange} />
      </section>

      {imageCandidates.length > 0 ? (
        <section>
          <strong style={{ display: "block", marginBottom: 8 }}>페이지 이미지 후보</strong>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {imageCandidates.slice(0, 6).map((imageUrl) => (
              <button
                key={imageUrl}
                type="button"
                disabled={isAddingCandidate === imageUrl}
                onClick={() => void handleAddImageCandidate(imageUrl)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 8,
                  borderRadius: 12,
                  border: `1px solid ${palette.border}`,
                  background: palette.panel,
                  color: palette.text
                }}
              >
                <img
                  src={imageUrl}
                  alt=""
                  style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }}
                />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {isAddingCandidate === imageUrl ? "추가 중..." : imageUrl}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {queuedFiles.length > 0 ? (
        <section>
          <strong style={{ display: "block", marginBottom: 8 }}>첨부 큐</strong>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
            {queuedFiles.map((file) => (
              <li
                key={`${file.name}-${file.size}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${palette.border}`,
                  background: palette.panel
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeQueuedFile(file.name, file.size)}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${palette.border}`,
                    background: palette.panelAlt,
                    color: palette.text,
                    padding: "6px 10px"
                  }}
                >
                  제거
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={status.kind === "saving"}
        style={{
          borderRadius: 14,
          border: "none",
          background: palette.accent,
          color: "#ffffff",
          padding: "12px 16px",
          fontWeight: 800,
          boxShadow: "0 10px 20px rgba(37, 99, 235, 0.24)"
        }}
      >
        {status.kind === "saving" ? "저장 중..." : "북마크 저장"}
      </button>

      {status.message ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <p
            style={{
              margin: 0,
              color:
                status.kind === "error"
                  ? palette.error
                  : status.kind === "success"
                    ? palette.success
                    : palette.muted
            }}
          >
            {status.message}
          </p>
          <button
            type="button"
            onClick={openMainBookmarkPage}
            style={{
              border: "none",
              background: "transparent",
              color: palette.accent,
              fontWeight: 700,
              padding: 0
            }}
          >
            메인 페이지 이동
          </button>
        </div>
      ) : null}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
