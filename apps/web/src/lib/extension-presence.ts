import type { BookmarkExtractPreview } from "@bookmark/shared";

export const BOOKMARK_WEB_BRIDGE_SOURCE = "bookmark-web";
export const BOOKMARK_EXTENSION_BRIDGE_SOURCE = "bookmark-extension";

export type BookmarkExtensionPresenceStatus = "installed" | "missing";
export type BookmarkExtensionConfigurationStatus = "configured" | "missing" | "failed";
export type BookmarkExtensionClientType = "extension" | "userscript" | "unknown";

export type BookmarkExtensionConnectionSettings = {
  apiBaseUrl: string;
  token: string;
};

type BookmarkExtensionMessage = {
  source?: string;
  type?: string;
  requestId?: string;
  clientType?: string;
};

export type BookmarkExtensionPresenceDetails = {
  status: BookmarkExtensionPresenceStatus;
  clientTypes: BookmarkExtensionClientType[];
};

export type BookmarkExtensionConfigurationOptions = {
  preferredClientType?: BookmarkExtensionClientType;
};

export type BookmarkExtensionPreviewRequestResult =
  | {
      status: "success";
      preview: BookmarkExtractPreview;
    }
  | {
      status: "failed" | "missing";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBookmarkExtensionPresenceMessage(value: unknown): value is BookmarkExtensionMessage {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.source === BOOKMARK_EXTENSION_BRIDGE_SOURCE &&
    (value.type === "bookmark-extension:ready" || value.type === "bookmark-extension:pong")
  );
}

function getPostMessageTargetOrigin(win: Window) {
  return win.location?.origin || "*";
}

function isExpectedBridgeEvent(event: MessageEvent, win: Window) {
  const eventOrigin = typeof event.origin === "string" ? event.origin : "";
  const targetOrigin = getPostMessageTargetOrigin(win);

  if (eventOrigin && targetOrigin !== "*" && eventOrigin !== targetOrigin) {
    return false;
  }

  return Boolean(eventOrigin) || !event.source || event.source === win;
}

function createBridgeRequestId() {
  return globalThis.crypto?.randomUUID?.() ?? `bridge-${Date.now()}-${Math.random()}`;
}

function normalizeClientType(value: unknown): BookmarkExtensionClientType {
  return value === "extension" || value === "userscript" ? value : "unknown";
}

function isBookmarkExtractPreview(value: unknown): value is BookmarkExtractPreview {
  return (
    isRecord(value) &&
    typeof value.url === "string" &&
    typeof value.normalizedUrl === "string"
  );
}

export function detectBookmarkExtensionPresence(
  timeoutMs = 600,
  win: Window | undefined = globalThis.window
): Promise<BookmarkExtensionPresenceStatus> {
  return detectBookmarkExtensionPresenceDetails(timeoutMs, win).then((details) => details.status);
}

export function detectBookmarkExtensionPresenceDetails(
  timeoutMs = 600,
  win: Window | undefined = globalThis.window
): Promise<BookmarkExtensionPresenceDetails> {
  if (
    !win ||
    typeof win.addEventListener !== "function" ||
    typeof win.removeEventListener !== "function" ||
    typeof win.postMessage !== "function"
  ) {
    return Promise.resolve({
      status: "missing",
      clientTypes: []
    });
  }

  return new Promise((resolve) => {
    let isSettled = false;
    const clientTypes = new Set<BookmarkExtensionClientType>();
    const timer = win.setTimeout(() => finish(), timeoutMs);

    function finish() {
      if (isSettled) {
        return;
      }

      isSettled = true;
      win.clearTimeout(timer);
      win.removeEventListener("message", handleMessage);
      resolve({
        status: clientTypes.size > 0 ? "installed" : "missing",
        clientTypes: Array.from(clientTypes)
      });
    }

    function handleMessage(event: MessageEvent) {
      if (!isExpectedBridgeEvent(event, win)) {
        return;
      }

      if (isBookmarkExtensionPresenceMessage(event.data)) {
        clientTypes.add(normalizeClientType(event.data.clientType));
      }
    }

    win.addEventListener("message", handleMessage);

    try {
      win.postMessage(
        {
          source: BOOKMARK_WEB_BRIDGE_SOURCE,
          type: "bookmark-extension:ping"
        },
        getPostMessageTargetOrigin(win)
      );
    } catch {
      finish();
    }
  });
}

export function configureBookmarkExtensionSettings(
  settings: BookmarkExtensionConnectionSettings,
  timeoutMs = 900,
  win: Window | undefined = globalThis.window,
  options: BookmarkExtensionConfigurationOptions = {}
): Promise<BookmarkExtensionConfigurationStatus> {
  if (
    !win ||
    typeof win.addEventListener !== "function" ||
    typeof win.removeEventListener !== "function" ||
    typeof win.postMessage !== "function"
  ) {
    return Promise.resolve("missing");
  }

  return new Promise((resolve) => {
    let isSettled = false;
    let hasConfiguredFallback = false;
    const requestId = createBridgeRequestId();
    const timer = win.setTimeout(() => {
      finish(hasConfiguredFallback && !options.preferredClientType ? "configured" : "missing");
    }, timeoutMs);

    function finish(status: BookmarkExtensionConfigurationStatus) {
      if (isSettled) {
        return;
      }

      isSettled = true;
      win.clearTimeout(timer);
      win.removeEventListener("message", handleMessage);
      resolve(status);
    }

    function handleMessage(event: MessageEvent) {
      if (!isExpectedBridgeEvent(event, win)) {
        return;
      }

      if (!isRecord(event.data)) {
        return;
      }

      if (
        event.data.source !== BOOKMARK_EXTENSION_BRIDGE_SOURCE ||
        event.data.requestId !== requestId
      ) {
        return;
      }

      const clientType = normalizeClientType(event.data.clientType);
      const isPreferredClient =
        !options.preferredClientType || clientType === options.preferredClientType;

      if (event.data.type === "bookmark-extension:configured") {
        if (!isPreferredClient) {
          hasConfiguredFallback = true;
          return;
        }

        finish("configured");
      } else if (event.data.type === "bookmark-extension:configure-failed") {
        if (!isPreferredClient) {
          return;
        }

        finish("failed");
      }
    }

    win.addEventListener("message", handleMessage);

    try {
      win.postMessage(
        {
          source: BOOKMARK_WEB_BRIDGE_SOURCE,
          type: "bookmark-extension:configure",
          requestId,
          settings
        },
        getPostMessageTargetOrigin(win)
      );
    } catch {
      finish("failed");
    }
  });
}

export function requestBookmarkExtensionPreview(
  url: string,
  timeoutMs = 1_500,
  win: Window | undefined = globalThis.window
): Promise<BookmarkExtensionPreviewRequestResult> {
  if (
    !win ||
    typeof win.addEventListener !== "function" ||
    typeof win.removeEventListener !== "function" ||
    typeof win.postMessage !== "function"
  ) {
    return Promise.resolve({
      status: "missing"
    });
  }

  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    return Promise.resolve({
      status: "failed"
    });
  }

  return new Promise((resolve) => {
    let isSettled = false;
    const requestId = createBridgeRequestId();
    const timer = win.setTimeout(() => {
      finish({
        status: "missing"
      });
    }, timeoutMs);

    function finish(result: BookmarkExtensionPreviewRequestResult) {
      if (isSettled) {
        return;
      }

      isSettled = true;
      win.clearTimeout(timer);
      win.removeEventListener("message", handleMessage);
      resolve(result);
    }

    function handleMessage(event: MessageEvent) {
      if (!isExpectedBridgeEvent(event, win) || !isRecord(event.data)) {
        return;
      }

      if (
        event.data.source !== BOOKMARK_EXTENSION_BRIDGE_SOURCE ||
        event.data.requestId !== requestId
      ) {
        return;
      }

      if (
        event.data.type === "bookmark-extension:preview-result" &&
        isBookmarkExtractPreview(event.data.preview)
      ) {
        finish({
          status: "success",
          preview: event.data.preview
        });
        return;
      }

      if (event.data.type === "bookmark-extension:preview-failed") {
        finish({
          status: "failed"
        });
      }
    }

    win.addEventListener("message", handleMessage);

    try {
      win.postMessage(
        {
          source: BOOKMARK_WEB_BRIDGE_SOURCE,
          type: "bookmark-extension:extract-preview",
          requestId,
          url: normalizedUrl
        },
        getPostMessageTargetOrigin(win)
      );
    } catch {
      finish({
        status: "failed"
      });
    }
  });
}
