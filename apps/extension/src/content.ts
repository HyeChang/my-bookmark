import { collectImageCandidates, normalizeSelectionText } from "./lib/capture";

const runtime = (globalThis as { chrome?: any }).chrome?.runtime;

if (runtime?.onMessage) {
  runtime.onMessage.addListener((message: { type?: string }, _sender: unknown, sendResponse: (value: unknown) => void) => {
    if (message.type !== "bookmark:capture-context") {
      return false;
    }

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
  });
}
