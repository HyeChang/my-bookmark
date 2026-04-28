import { collectImageCandidates, normalizeSelectionText } from "./lib/capture";
import { extractRenderedPreviewFromDocument } from "./lib/rendered-preview";
import { loadExtensionSettings, saveExtensionSettings } from "./lib/storage";
import {
  announceBookmarkExtensionPresence,
  attachBookmarkExtensionPresenceBridge
} from "./lib/web-bridge";

const runtime = (globalThis as { chrome?: any }).chrome?.runtime;
const contentWindow = globalThis.window;

if (contentWindow) {
  announceBookmarkExtensionPresence(contentWindow);
  attachBookmarkExtensionPresenceBridge(contentWindow, {
    configureSettings: async (settings) => {
      const currentSettings = await loadExtensionSettings();
      await saveExtensionSettings({
        ...currentSettings,
        apiBaseUrl: settings.apiBaseUrl,
        token: settings.token
      });
    },
    extractPreview: async (url) => {
      if (!runtime?.sendMessage) {
        throw new Error("bookmark_rendered_preview_unavailable");
      }

      const response = await runtime.sendMessage({
        type: "bookmark:extract-rendered-preview",
        url
      });

      if (response?.preview) {
        return response.preview;
      }

      throw new Error(
        typeof response?.error === "string"
          ? response.error
          : "bookmark_rendered_preview_failed"
      );
    }
  });
}

if (runtime?.onMessage) {
  runtime.onMessage.addListener((message: { type?: string }, _sender: unknown, sendResponse: (value: unknown) => void) => {
    if (message.type === "bookmark:capture-context") {
      const selectedText = normalizeSelectionText(globalThis.getSelection?.()?.toString() ?? "");
      const imageCandidates = collectImageCandidates(
        Array.from(document.images).map((image) => image.currentSrc || image.src)
      );

      sendResponse({
        title: document.title,
        url: globalThis.location.href,
        selectedText,
        imageCandidates
      });

      return false;
    }

    if (message.type !== "bookmark:extract-rendered-preview") {
      return false;
    }

    sendResponse({
      preview: extractRenderedPreviewFromDocument(document, globalThis.location.href)
    });

    return false;
  });
}
