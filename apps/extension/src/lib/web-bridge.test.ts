import { afterEach, describe, expect, it, vi } from "vitest";
import type { BookmarkExtractPreview } from "@bookmark/shared";

import {
  BOOKMARK_EXTENSION_BRIDGE_SOURCE,
  BOOKMARK_WEB_BRIDGE_SOURCE,
  announceBookmarkExtensionPresence,
  attachBookmarkExtensionPresenceBridge
} from "./web-bridge";

afterEach(() => {
  vi.restoreAllMocks();
});

function createMessageEvent(data: unknown, options: { origin?: string; source?: unknown } = {}) {
  const event = new Event("message") as MessageEvent;
  Object.defineProperty(event, "data", { value: data });
  Object.defineProperty(event, "origin", { value: options.origin ?? "" });
  Object.defineProperty(event, "source", { value: options.source ?? null });
  return event;
}

function createFakeWindow() {
  const fakeWindow = new EventTarget() as Window & {
    location: Pick<Location, "origin">;
    postMessage: ReturnType<typeof vi.fn>;
  };

  fakeWindow.location = {
    origin: "https://bookmark.example"
  } as Pick<Location, "origin">;
  fakeWindow.postMessage = vi.fn();
  return fakeWindow;
}

function createPreview(overrides: Partial<BookmarkExtractPreview> = {}): BookmarkExtractPreview {
  return {
    url: overrides.url ?? "https://example.com/articles/rendered",
    normalizedUrl: overrides.normalizedUrl ?? "https://example.com/articles/rendered",
    sourceTitle: overrides.sourceTitle ?? "렌더링된 제목",
    sourceContent: overrides.sourceContent ?? "렌더링된 본문",
    sourceSummary: overrides.sourceSummary ?? "렌더링된 요약",
    sourceBlocks:
      overrides.sourceBlocks ??
      [
        {
          type: "paragraph",
          text: "렌더링된 본문"
        }
      ],
    renderStatus: overrides.renderStatus ?? "ready",
    renderSource: overrides.renderSource ?? "extension"
  };
}

describe("extension web bridge", () => {
  it("announces extension presence to pages", () => {
    const fakeWindow = createFakeWindow();

    announceBookmarkExtensionPresence(fakeWindow);

    expect(fakeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
        type: "bookmark-extension:ready",
        clientType: "extension"
      },
      "https://bookmark.example"
    );
  });

  it("answers web app pings with a pong message", () => {
    const fakeWindow = createFakeWindow();
    const cleanup = attachBookmarkExtensionPresenceBridge(fakeWindow);

    fakeWindow.dispatchEvent(
      createMessageEvent({
        source: BOOKMARK_WEB_BRIDGE_SOURCE,
        type: "bookmark-extension:ping"
      })
    );

    expect(fakeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
        type: "bookmark-extension:pong",
        clientType: "extension"
      },
      "https://bookmark.example"
    );

    cleanup();
  });

  it("answers same-origin pings when the page source is isolated", () => {
    const fakeWindow = createFakeWindow();
    const cleanup = attachBookmarkExtensionPresenceBridge(fakeWindow);

    fakeWindow.dispatchEvent(
      createMessageEvent(
        {
          source: BOOKMARK_WEB_BRIDGE_SOURCE,
          type: "bookmark-extension:ping"
        },
        {
          origin: "https://bookmark.example",
          source: new EventTarget()
        }
      )
    );

    expect(fakeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
        type: "bookmark-extension:pong",
        clientType: "extension"
      },
      "https://bookmark.example"
    );

    cleanup();
  });

  it("saves web app extension settings and confirms configuration", async () => {
    const fakeWindow = createFakeWindow();
    const configureSettings = vi.fn().mockResolvedValue(undefined);
    const cleanup = attachBookmarkExtensionPresenceBridge(fakeWindow, {
      configureSettings
    });

    fakeWindow.dispatchEvent(
      createMessageEvent({
        source: BOOKMARK_WEB_BRIDGE_SOURCE,
        type: "bookmark-extension:configure",
        requestId: "request-1",
        settings: {
          apiBaseUrl: "https://bookmark.example",
          token: "raw-token"
        }
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(configureSettings).toHaveBeenCalledWith({
      apiBaseUrl: "https://bookmark.example",
      token: "raw-token"
    });
    expect(fakeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
        type: "bookmark-extension:configured",
        requestId: "request-1",
        clientType: "extension"
      },
      "https://bookmark.example"
    );

    cleanup();
  });

  it("extracts a rendered preview for the web app and posts the matching result", async () => {
    const fakeWindow = createFakeWindow();
    const preview = createPreview();
    const extractPreview = vi.fn().mockResolvedValue(preview);
    const cleanup = attachBookmarkExtensionPresenceBridge(fakeWindow, {
      extractPreview
    });

    fakeWindow.dispatchEvent(
      createMessageEvent({
        source: BOOKMARK_WEB_BRIDGE_SOURCE,
        type: "bookmark-extension:extract-preview",
        requestId: "request-1",
        url: "https://example.com/articles/rendered"
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(extractPreview).toHaveBeenCalledWith("https://example.com/articles/rendered");
    expect(fakeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
        type: "bookmark-extension:preview-result",
        requestId: "request-1",
        clientType: "extension",
        preview
      },
      "https://bookmark.example"
    );

    cleanup();
  });

  it("posts a preview failure when rendered extraction fails", async () => {
    const fakeWindow = createFakeWindow();
    const extractPreview = vi.fn().mockRejectedValue(new Error("render_failed"));
    const cleanup = attachBookmarkExtensionPresenceBridge(fakeWindow, {
      extractPreview
    });

    fakeWindow.dispatchEvent(
      createMessageEvent(
        {
          source: BOOKMARK_WEB_BRIDGE_SOURCE,
          type: "bookmark-extension:extract-preview",
          requestId: "request-2",
          url: "https://example.com/fallback"
        },
        {
          origin: "https://bookmark.example",
          source: new EventTarget()
        }
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fakeWindow.postMessage).toHaveBeenCalledWith(
      {
        source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
        type: "bookmark-extension:preview-failed",
        requestId: "request-2",
        clientType: "extension"
      },
      "https://bookmark.example"
    );

    cleanup();
  });
});
