import { lazy } from "react";

import { measureAsyncPerformance } from "../lib/performance-marks";

function createMemoRichEditorChunkLoader<TModule>(loadModule: () => Promise<TModule>) {
  let modulePromise: Promise<TModule> | null = null;

  return () => {
    modulePromise ??= loadModule().catch((error) => {
      modulePromise = null;
      throw error;
    });
    return modulePromise;
  };
}

const loadMemoRichEditor = createMemoRichEditorChunkLoader(() =>
  import("./MemoRichEditor")
);

export const LazyMemoRichEditor = lazy(loadMemoRichEditor);

const preloadedMemoRichEditorChunks = new Set<"editor">();

export function preloadMemoRichEditorChunk() {
  if (preloadedMemoRichEditorChunks.has("editor")) {
    return;
  }

  preloadedMemoRichEditorChunks.add("editor");
  void measureAsyncPerformance("memo:rich-editor-preload", () =>
    loadMemoRichEditor()
  ).catch(() => {
    preloadedMemoRichEditorChunks.delete("editor");
  });
}
