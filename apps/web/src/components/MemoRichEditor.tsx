import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent
} from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import { Bold } from "@tiptap/extension-bold";
import { Document } from "@tiptap/extension-document";
import { HardBreak } from "@tiptap/extension-hard-break";
import { Paragraph } from "@tiptap/extension-paragraph";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Text } from "@tiptap/extension-text";
import { TextStyle } from "@tiptap/extension-text-style";
import Image from "@tiptap/extension-image";
import { Extension, type JSONContent } from "@tiptap/core";
import { history, redo, undo } from "@tiptap/pm/history";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import type { MemoAsset, MemoRichContent } from "@bookmark/shared";
import {
  createEmptyMemoDocument,
  extractMemoPlainText,
  normalizeMemoDocument
} from "../lib/memo-editor-content";
import "./MemoRichEditor.css";

type FontSizeCommandChain = {
  setFontSize: (fontSize: string) => { run: () => boolean };
};

export type MemoRichEditorProps = {
  value: MemoRichContent;
  isDisabled?: boolean;
  onChange: (contentJson: MemoRichContent, contentText: string) => void;
  onImageUpload?: (file: File) => Promise<MemoAsset>;
  searchPortalElement?: HTMLElement | null;
};

const FontSize = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {}
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run()
    };
  }
});

const MemoUndoRedo = Extension.create({
  name: "memoUndoRedo",

  addProseMirrorPlugins() {
    return [history()];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-z": () => undo(this.editor.state, this.editor.view.dispatch),
      "Shift-Mod-z": () => redo(this.editor.state, this.editor.view.dispatch),
      "Mod-y": () => redo(this.editor.state, this.editor.view.dispatch)
    };
  }
});

type MemoSearchMatch = {
  from: number;
  to: number;
};

type MemoSearchHighlightState = {
  query: string;
  activeIndex: number;
};

const supportedTextMarkTypes = new Set(["bold", "textStyle"]);

const MemoTaskItem = TaskItem.extend({
  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement("li");
      const checkboxWrapper = document.createElement("label");
      const checkboxStyler = document.createElement("span");
      const checkbox = document.createElement("input");
      const content = document.createElement("div");

      function setCheckedState(checked: boolean) {
        listItem.dataset.checked = String(checked);
        checkbox.checked = checked;
      }

      function setListItemAttributes(attributes: Record<string, unknown>) {
        Object.entries(attributes).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            listItem.removeAttribute(key);
            return;
          }

          listItem.setAttribute(key, String(value));
        });
      }

      checkboxWrapper.contentEditable = "false";
      checkbox.type = "checkbox";
      checkbox.setAttribute("aria-label", "작업 체크박스");
      checkbox.addEventListener("mousedown", (event) => event.preventDefault());
      checkbox.addEventListener("change", (event) => {
        if (!editor.isEditable || typeof getPos !== "function") {
          checkbox.checked = node.attrs.checked;
          return;
        }

        const position = getPos();
        if (typeof position !== "number") {
          return;
        }

        const currentNode = editor.state.doc.nodeAt(position);
        const checked = (event.currentTarget as HTMLInputElement).checked;

        if (!currentNode) {
          return;
        }

        editor
          .chain()
          .focus(undefined, { scrollIntoView: false })
          .command(({ tr }) => {
            tr.setNodeMarkup(position, undefined, {
              ...currentNode.attrs,
              checked
            });
            return true;
          })
          .run();
      });

      setListItemAttributes(this.options.HTMLAttributes);
      setListItemAttributes(HTMLAttributes);
      setCheckedState(Boolean(node.attrs.checked));

      checkboxWrapper.append(checkbox, checkboxStyler);
      listItem.append(checkboxWrapper, content);

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode: ProseMirrorNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }

          const nextChecked = Boolean(updatedNode.attrs.checked);
          if (checkbox.checked !== nextChecked || listItem.dataset.checked !== String(nextChecked)) {
            setCheckedState(nextChecked);
          }

          return true;
        }
      };
    };
  }
});

function getImageFiles(files: Iterable<File> | ArrayLike<File>) {
  return Array.from(files).filter((file) => file.type.startsWith("image/"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getRichNodeContent(node: Record<string, unknown>) {
  return Array.isArray(node.content) ? node.content : [];
}

function getSupportedTextMarks(marks: unknown): JSONContent["marks"] {
  if (!Array.isArray(marks)) {
    return undefined;
  }

  const supportedMarks = marks.flatMap((mark): NonNullable<JSONContent["marks"]> => {
    if (!isRecord(mark) || typeof mark.type !== "string" || !supportedTextMarkTypes.has(mark.type)) {
      return [];
    }

    return [
      {
        type: mark.type,
        attrs: isRecord(mark.attrs) ? mark.attrs : undefined
      }
    ];
  });

  return supportedMarks.length > 0 ? supportedMarks : undefined;
}

function toSupportedInlineContent(content: unknown[]): JSONContent[] {
  return content.flatMap((child): JSONContent[] => {
    if (!isRecord(child) || typeof child.type !== "string") {
      return [];
    }

    if (child.type === "text" && typeof child.text === "string") {
      return [
        {
          type: "text",
          text: child.text,
          marks: getSupportedTextMarks(child.marks)
        }
      ];
    }

    if (child.type === "hardBreak") {
      return [{ type: "hardBreak" }];
    }

    return toSupportedInlineContent(getRichNodeContent(child));
  });
}

function toSupportedImageNode(node: Record<string, unknown>): JSONContent[] {
  const attrs = isRecord(node.attrs) ? node.attrs : {};
  if (typeof attrs.src !== "string" || !attrs.src) {
    return [];
  }

  return [
    {
      type: "image",
      attrs: {
        src: attrs.src,
        alt: typeof attrs.alt === "string" ? attrs.alt : null,
        title: typeof attrs.title === "string" ? attrs.title : null
      }
    }
  ];
}

function toSupportedTaskItemNode(node: Record<string, unknown>): JSONContent {
  const attrs = isRecord(node.attrs) ? node.attrs : {};
  const content = getRichNodeContent(node).flatMap(toSupportedMemoEditorNodes);

  return {
    type: "taskItem",
    attrs: {
      checked: attrs.checked === true
    },
    content: content.length > 0 ? content : [{ type: "paragraph" }]
  };
}

function toSupportedUnsupportedBlockNode(node: Record<string, unknown>) {
  const inlineContent = toSupportedInlineContent(getRichNodeContent(node));
  if (inlineContent.length > 0) {
    return [
      {
        type: "paragraph",
        content: inlineContent
      }
    ];
  }

  return getRichNodeContent(node).flatMap(toSupportedMemoEditorNodes);
}

function toSupportedMemoEditorNodes(node: unknown): JSONContent[] {
  if (!isRecord(node) || typeof node.type !== "string") {
    return [];
  }

  if (node.type === "paragraph") {
    const content = toSupportedInlineContent(getRichNodeContent(node));
    return [
      {
        type: "paragraph",
        content: content.length > 0 ? content : undefined
      }
    ];
  }

  if (node.type === "taskList") {
    const taskItems = getRichNodeContent(node)
      .filter((child) => isRecord(child) && child.type === "taskItem")
      .map((child) => toSupportedTaskItemNode(child as Record<string, unknown>));

    return taskItems.length > 0 ? [{ type: "taskList", content: taskItems }] : [];
  }

  if (node.type === "taskItem") {
    return [toSupportedTaskItemNode(node)];
  }

  if (node.type === "image") {
    return toSupportedImageNode(node);
  }

  if (node.type === "text") {
    return toSupportedUnsupportedBlockNode({
      type: "paragraph",
      content: [node]
    });
  }

  return toSupportedUnsupportedBlockNode(node);
}

function toSupportedMemoEditorContent(content: MemoRichContent): MemoRichContent {
  const normalizedContent = normalizeMemoDocument(content);
  return {
    type: "doc",
    content: (normalizedContent.content ?? []).flatMap(toSupportedMemoEditorNodes)
  };
}

function findMemoSearchMatches(document: ProseMirrorNode, query: string): MemoSearchMatch[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const matches: MemoSearchMatch[] = [];
  document.descendants((node, position) => {
    if (!node.isText || typeof node.text !== "string") {
      return;
    }

    const normalizedText = node.text.toLocaleLowerCase();
    let searchIndex = 0;
    while (searchIndex < normalizedText.length) {
      const foundIndex = normalizedText.indexOf(normalizedQuery, searchIndex);
      if (foundIndex < 0) {
        break;
      }

      matches.push({
        from: position + foundIndex,
        to: position + foundIndex + normalizedQuery.length
      });
      searchIndex = foundIndex + normalizedQuery.length;
    }
  });

  return matches;
}

const memoSearchHighlightPluginKey = new PluginKey<MemoSearchHighlightState>(
  "memoSearchHighlight"
);

const MemoSearchHighlight = Extension.create({
  name: "memoSearchHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<MemoSearchHighlightState>({
        key: memoSearchHighlightPluginKey,
        state: {
          init: () => ({
            activeIndex: 0,
            query: ""
          }),
          apply(transaction, previousState) {
            const metadata = transaction.getMeta(memoSearchHighlightPluginKey) as
              | Partial<MemoSearchHighlightState>
              | undefined;

            if (!metadata) {
              return previousState;
            }

            return {
              activeIndex: metadata.activeIndex ?? previousState.activeIndex,
              query: metadata.query ?? previousState.query
            };
          }
        },
        props: {
          decorations(state) {
            const searchState = memoSearchHighlightPluginKey.getState(state);
            if (!searchState?.query) {
              return DecorationSet.empty;
            }

            const matches = findMemoSearchMatches(state.doc, searchState.query);
            if (matches.length === 0) {
              return DecorationSet.empty;
            }

            const activeIndex = Math.min(searchState.activeIndex, matches.length - 1);
            return DecorationSet.create(
              state.doc,
              matches.map((match, index) =>
                Decoration.inline(match.from, match.to, {
                  class:
                    index === activeIndex
                      ? "memo-editor-search-hit is-active"
                      : "memo-editor-search-hit"
                })
              )
            );
          }
        }
      })
    ];
  }
});

function toTiptapContent(content: MemoRichContent): JSONContent {
  return toSupportedMemoEditorContent(content) as JSONContent;
}

export default function MemoRichEditor({
  value,
  isDisabled = false,
  onChange,
  onImageUpload,
  searchPortalElement = null
}: MemoRichEditorProps) {
  const normalizedValue = useMemo(() => toSupportedMemoEditorContent(value), [value]);
  const [editorRevision, setEditorRevision] = useState(0);
  const [fontSize, setFontSize] = useState("16px");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestValueRef = useRef(normalizedValue);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      HardBreak,
      MemoUndoRedo,
      TaskList,
      MemoTaskItem.configure({ nested: true }),
      TextStyle,
      FontSize,
      Image.configure({ inline: false }),
      MemoSearchHighlight
    ],
    content: toTiptapContent(normalizedValue),
    editable: !isDisabled,
    editorProps: {
      attributes: {
        "aria-label": "메모 본문",
        class: "memo-editor-content",
        role: "textbox"
      }
    },
    onUpdate: ({ editor: nextEditor }) => {
      const nextContent = normalizeMemoDocument(nextEditor.getJSON());
      const nextContentText = extractMemoPlainText(nextContent);
      latestValueRef.current = nextContent;
      onChange(nextContent, nextContentText);
      setEditorRevision((currentRevision) => currentRevision + 1);
    },
    onSelectionUpdate: () => {
      setEditorRevision((currentRevision) => currentRevision + 1);
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    if (JSON.stringify(latestValueRef.current) === JSON.stringify(normalizedValue)) {
      return;
    }

    latestValueRef.current = normalizedValue;
    editor.commands.setContent(toTiptapContent(normalizedValue));
  }, [editor, normalizedValue]);

  const searchMatches = useMemo(
    () => (editor && isSearchOpen ? findMemoSearchMatches(editor.state.doc, searchQuery) : []),
    [editor, editorRevision, isSearchOpen, searchQuery]
  );
  const matchCount = searchMatches.length;
  const normalizedActiveSearchIndex =
    matchCount === 0 ? 0 : Math.min(activeSearchIndex, matchCount - 1);
  const visibleSearchIndex = matchCount === 0 ? 0 : normalizedActiveSearchIndex + 1;
  const isBoldActive = Boolean(editorRevision >= 0 && editor?.isActive("bold"));

  useEffect(() => {
    if (matchCount === 0 || activeSearchIndex === normalizedActiveSearchIndex) {
      return;
    }

    setActiveSearchIndex(normalizedActiveSearchIndex);
  }, [activeSearchIndex, matchCount, normalizedActiveSearchIndex]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.view.dispatch(
      editor.state.tr.setMeta(memoSearchHighlightPluginKey, {
        activeIndex: normalizedActiveSearchIndex,
        query: isSearchOpen ? searchQuery : ""
      })
    );
  }, [editor, isSearchOpen, normalizedActiveSearchIndex, searchQuery]);

  useEffect(() => {
    if (!editor || !isSearchOpen || matchCount === 0) {
      return;
    }

    const scheduleFrame =
      typeof globalThis.requestAnimationFrame === "function"
        ? globalThis.requestAnimationFrame.bind(globalThis)
        : (callback: FrameRequestCallback) =>
            globalThis.setTimeout(() => callback(performance.now()), 0);
    const cancelFrame =
      typeof globalThis.cancelAnimationFrame === "function"
        ? globalThis.cancelAnimationFrame.bind(globalThis)
        : globalThis.clearTimeout.bind(globalThis);

    const frameId = scheduleFrame(() => {
      editor.view.dom
        .querySelector<HTMLElement>(".memo-editor-search-hit.is-active")
        ?.scrollIntoView({
          block: "center",
          inline: "nearest"
        });
    });

    return () => cancelFrame(frameId);
  }, [editor, isSearchOpen, matchCount, normalizedActiveSearchIndex, searchQuery]);

  async function uploadFiles(files: File[]) {
    if (!onImageUpload || files.length === 0) {
      return;
    }

    setImageUploadError(null);
    setIsUploadingImages(true);

    try {
      for (const file of files) {
        try {
          const asset = await onImageUpload(file);
          editor
            ?.chain()
            .focus()
            .setImage({ src: asset.contentUrl, alt: file.name })
            .run();
        } catch (error) {
          setImageUploadError(
            error instanceof Error ? error.message : "이미지를 업로드하지 못했습니다."
          );
        }
      }
    } finally {
      setIsUploadingImages(false);
    }
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.currentTarget.files ? getImageFiles(event.currentTarget.files) : [];
    void uploadFiles(files);
    event.currentTarget.value = "";
  }

  function handlePaste(event: ReactClipboardEvent<HTMLDivElement>) {
    const files = getImageFiles(event.clipboardData.files);
    if (files.length > 0) {
      event.preventDefault();
      void uploadFiles(files);
    }
  }

  function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
    const files = getImageFiles(event.dataTransfer.files);
    if (files.length > 0) {
      event.preventDefault();
      void uploadFiles(files);
    }
  }

  function moveSearch(delta: number) {
    if (matchCount === 0) {
      setActiveSearchIndex(0);
      return;
    }

    setActiveSearchIndex((currentIndex) => (currentIndex + delta + matchCount) % matchCount);
  }

  const searchControls = isSearchOpen ? (
    <div className="memo-editor-search">
      <input
        type="search"
        aria-label="메모 내 검색"
        value={searchQuery}
        placeholder="메모 내 검색"
        onChange={(event) => {
          setSearchQuery(event.currentTarget.value);
          setActiveSearchIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }

          event.preventDefault();
          moveSearch(event.shiftKey ? -1 : 1);
        }}
      />
      <span aria-live="polite">
        {matchCount === 0 ? "0 / 0" : `${visibleSearchIndex} / ${matchCount}`}
      </span>
      <button
        type="button"
        className="secondary-button"
        disabled={matchCount === 0}
        onClick={() => moveSearch(-1)}
      >
        이전 검색 결과
      </button>
      <button
        type="button"
        className="secondary-button"
        disabled={matchCount === 0}
        onClick={() => moveSearch(1)}
      >
        다음 검색 결과
      </button>
    </div>
  ) : null;

  return (
    <section className="memo-rich-editor" aria-label="memo-rich-editor">
      <div role="toolbar" aria-label="메모 편집 도구" className="memo-editor-toolbar">
        <button
          type="button"
          className="secondary-button"
          aria-label="굵게"
          aria-pressed={isBoldActive}
          disabled={isDisabled}
          onClick={() => {
            editor?.chain().focus().toggleBold().run();
            setEditorRevision((currentRevision) => currentRevision + 1);
          }}
        >
          B
        </button>
        <label className="memo-editor-font-size">
          글씨 크기
          <select
            aria-label="글씨 크기"
            value={fontSize}
            disabled={isDisabled}
            onChange={(event) => {
              const nextFontSize = event.currentTarget.value;
              setFontSize(nextFontSize);
              (
                editor?.chain().focus() as unknown as FontSizeCommandChain | undefined
              )?.setFontSize(nextFontSize).run();
            }}
          >
            <option value="14px">작게</option>
            <option value="16px">기본</option>
            <option value="20px">크게</option>
            <option value="24px">더 크게</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary-button"
          disabled={isDisabled || !onImageUpload || isUploadingImages}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploadingImages ? "업로드 중" : "이미지"}
        </button>
        <button
          type="button"
          className="secondary-button memo-editor-search-toggle"
          aria-expanded={isSearchOpen}
          aria-pressed={isSearchOpen}
          onClick={() => setIsSearchOpen((currentValue) => !currentValue)}
        >
          검색
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="memo-editor-file-input"
          aria-label="이미지 첨부"
          onChange={handleFileInputChange}
        />
      </div>

      {searchControls
        ? searchPortalElement
          ? createPortal(searchControls, searchPortalElement)
          : searchControls
        : null}
      {imageUploadError ? (
        <p className="memo-editor-error" role="alert">
          {imageUploadError}
        </p>
      ) : null}

      <div
        className="memo-editor-shell"
        onPaste={handlePaste}
        onDrop={handleDrop}
      >
        {editor ? <EditorContent editor={editor} /> : null}
      </div>
    </section>
  );
}

export { createEmptyMemoDocument };
