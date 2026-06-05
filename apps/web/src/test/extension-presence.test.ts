import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BOOKMARK_EXTENSION_BRIDGE_SOURCE,
  BOOKMARK_WEB_BRIDGE_SOURCE,
  configureBookmarkExtensionSettings,
  detectBookmarkExtensionPresence,
  requestBookmarkExtensionPreview
} from "../lib/extension-presence";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function dispatchBridgeMessage(data: unknown, options: { origin?: string; source?: unknown } = {}) {
  const event = new Event("message") as MessageEvent;
  Object.defineProperty(event, "data", { value: data });
  Object.defineProperty(event, "origin", { value: options.origin ?? "" });
  Object.defineProperty(event, "source", { value: options.source ?? null });
  window.dispatchEvent(event);
}

describe("bookmark extension presence detection", () => {
  it("pings the page bridge and resolves installed when the extension answers", async () => {
    vi.useFakeTimers();
    const postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => undefined);

    const detection = detectBookmarkExtensionPresence(1000);

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        source: BOOKMARK_WEB_BRIDGE_SOURCE,
        type: "bookmark-extension:ping"
      },
      window.location.origin
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
          type: "bookmark-extension:pong",
          clientType: "userscript"
        }
      })
    );

    await vi.advanceTimersByTimeAsync(1000);

    await expect(detection).resolves.toBe("installed");
  });

  it("resolves missing when the extension does not respond before the timeout", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "postMessage").mockImplementation(() => undefined);

    const detection = detectBookmarkExtensionPresence(250);

    await vi.advanceTimersByTimeAsync(250);

    await expect(detection).resolves.toBe("missing");
  });

  it("accepts same-origin bridge responses when the content script source is isolated", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "postMessage").mockImplementation(() => undefined);

    const detection = detectBookmarkExtensionPresence(1000);

    dispatchBridgeMessage(
      {
        source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
        type: "bookmark-extension:pong",
        clientType: "userscript"
      },
      {
        origin: window.location.origin,
        source: new EventTarget()
      }
    );

    await vi.advanceTimersByTimeAsync(1000);

    await expect(detection).resolves.toBe("installed");
  });

  it("sends extension settings and resolves configured when the extension saves them", async () => {
    vi.useFakeTimers();
    const postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => undefined);

    const connection = configureBookmarkExtensionSettings(
      {
        apiBaseUrl: "https://bookmark.example",
        token: "raw-token"
      },
      1000
    );

    const [message, targetOrigin] = postMessageSpy.mock.calls[0] ?? [];
    expect(message).toMatchObject({
      source: BOOKMARK_WEB_BRIDGE_SOURCE,
      type: "bookmark-extension:configure",
      settings: {
        apiBaseUrl: "https://bookmark.example",
        token: "raw-token"
      }
    });
    expect(message).toHaveProperty("requestId");
    expect(targetOrigin).toBe(window.location.origin);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
          type: "bookmark-extension:configured",
          requestId: (message as { requestId: string }).requestId
        }
      })
    );

    await expect(connection).resolves.toBe("configured");
  });

  it("accepts same-origin configuration responses when the content script source is isolated", async () => {
    vi.useFakeTimers();
    const postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => undefined);

    const connection = configureBookmarkExtensionSettings(
      {
        apiBaseUrl: "https://bookmark.example",
        token: "raw-token"
      },
      1000
    );

    const [message] = postMessageSpy.mock.calls[0] ?? [];

    dispatchBridgeMessage(
      {
        source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
        type: "bookmark-extension:configured",
        requestId: (message as { requestId: string }).requestId,
        clientType: "userscript"
      },
      {
        origin: window.location.origin,
        source: new EventTarget()
      }
    );

    await vi.advanceTimersByTimeAsync(1000);

    await expect(connection).resolves.toBe("configured");
  });

  it("waits for the preferred userscript configuration response", async () => {
    vi.useFakeTimers();
    const postMessageSpy = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => undefined);

    const connection = configureBookmarkExtensionSettings(
      {
        apiBaseUrl: "https://bookmark.example",
        token: "raw-token"
      },
      1000,
      window,
      {
        preferredClientType: "userscript"
      }
    );

    const [message] = postMessageSpy.mock.calls[0] ?? [];
    const requestId = (message as { requestId: string }).requestId;

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
          type: "bookmark-extension:configured",
          requestId,
          clientType: "extension"
        }
      })
    );

    await vi.advanceTimersByTimeAsync(500);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
          type: "bookmark-extension:configured",
          requestId,
          clientType: "userscript"
        }
      })
    );

    await expect(connection).resolves.toBe("configured");
  });

  it("requests extension-rendered previews and resolves with the preview payload", async () => {
    vi.useFakeTimers();
    const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);

    const extraction = requestBookmarkExtensionPreview("https://example.com/js-page", 1000);

    const [message, targetOrigin] = postMessageSpy.mock.calls[0] ?? [];
    expect(message).toMatchObject({
      source: BOOKMARK_WEB_BRIDGE_SOURCE,
      type: "bookmark-extension:extract-preview",
      url: "https://example.com/js-page"
    });
    expect(message).toHaveProperty("requestId");
    expect(targetOrigin).toBe(window.location.origin);

    dispatchBridgeMessage(
      {
        source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
        type: "bookmark-extension:preview-result",
        requestId: (message as { requestId: string }).requestId,
        preview: {
          url: "https://example.com/js-page",
          normalizedUrl: "https://example.com/js-page",
          sourceTitle: "Rendered preview title",
          sourceSummary: "Rendered preview summary",
          renderStatus: "ready",
          renderSource: "extension"
        }
      },
      {
        origin: window.location.origin,
        source: new EventTarget()
      }
    );

    await expect(extraction).resolves.toEqual({
      status: "success",
      preview: expect.objectContaining({
        sourceTitle: "Rendered preview title",
        renderSource: "extension"
      })
    });
  });

  it("resolves failed when the extension cannot render a preview", async () => {
    vi.useFakeTimers();
    const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation(() => undefined);

    const extraction = requestBookmarkExtensionPreview("https://example.com/js-page", 1000);

    const [message] = postMessageSpy.mock.calls[0] ?? [];

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
          type: "bookmark-extension:preview-failed",
          requestId: (message as { requestId: string }).requestId
        }
      })
    );

    await expect(extraction).resolves.toEqual({
      status: "failed"
    });
  });
});
