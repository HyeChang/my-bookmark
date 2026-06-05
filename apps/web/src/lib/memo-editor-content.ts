import type { MemoRichContent } from "@bookmark/shared";

type RichContentNode = {
  type?: unknown;
  text?: unknown;
  attrs?: unknown;
  content?: unknown;
};

const blockNodeTypes = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "listItem",
  "taskItem"
]);

export function createEmptyMemoDocument(): MemoRichContent {
  return {
    type: "doc",
    content: []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function normalizeMemoDocument(value: unknown): MemoRichContent {
  if (!isRecord(value) || value.type !== "doc") {
    return createEmptyMemoDocument();
  }

  return {
    type: "doc",
    content: Array.isArray(value.content) ? value.content : []
  };
}

function appendNodeText(node: unknown, lines: string[], inlineParts: string[]) {
  if (!isRecord(node)) {
    return;
  }

  const richNode = node as RichContentNode;
  const nodeType = typeof richNode.type === "string" ? richNode.type : "";
  if (nodeType === "hardBreak") {
    inlineParts.push("\n");
    return;
  }

  if (typeof richNode.text === "string") {
    inlineParts.push(richNode.text);
  }

  const childInlineParts: string[] = [];
  if (Array.isArray(richNode.content)) {
    for (const child of richNode.content) {
      appendNodeText(child, lines, childInlineParts);
    }
  }

  if (blockNodeTypes.has(nodeType)) {
    const line = childInlineParts.join("").trim();
    if (line) {
      lines.push(line);
    }
    return;
  }

  if (childInlineParts.length > 0) {
    inlineParts.push(childInlineParts.join(""));
  }
}

export function extractMemoPlainText(document: unknown) {
  const normalizedDocument = normalizeMemoDocument(document);
  const lines: string[] = [];

  for (const child of normalizedDocument.content ?? []) {
    const inlineParts: string[] = [];
    appendNodeText(child, lines, inlineParts);
    const line = inlineParts.join("").trim();
    if (line) {
      lines.push(line);
    }
  }

  return lines.join("\n");
}

function countTaskItems(node: unknown, progress: { checked: number; total: number }) {
  if (!isRecord(node)) {
    return;
  }

  if (node.type === "taskItem") {
    progress.total += 1;
    const attrs = isRecord(node.attrs) ? node.attrs : {};
    if (attrs.checked === true) {
      progress.checked += 1;
    }
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      countTaskItems(child, progress);
    }
  }
}

export function getMemoTaskProgress(document: unknown) {
  const normalizedDocument = normalizeMemoDocument(document);
  const progress = {
    checked: 0,
    total: 0
  };

  for (const child of normalizedDocument.content ?? []) {
    countTaskItems(child, progress);
  }

  return progress;
}
