import type { BookmarkExtractPreview } from "@bookmark/shared";

export const BOOKMARK_WEB_BRIDGE_SOURCE = "bookmark-web";
export const BOOKMARK_EXTENSION_BRIDGE_SOURCE = "bookmark-extension";
export const BOOKMARK_EXTENSION_CLIENT_TYPE = "extension";

export type BookmarkExtensionConnectionSettings = {
  apiBaseUrl: string;
  token: string;
};

type BookmarkExtensionPresenceBridgeOptions = {
  configureSettings?: (settings: BookmarkExtensionConnectionSettings) => Promise<void>;
  extractPreview?: (url: string) => Promise<BookmarkExtractPreview>;
};

type BridgeWindow = Pick<
  Window,
  "addEventListener" | "removeEventListener" | "postMessage" | "location"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBookmarkWebPingMessage(value: unknown) {
  return (
    isRecord(value) &&
    value.source === BOOKMARK_WEB_BRIDGE_SOURCE &&
    value.type === "bookmark-extension:ping"
  );
}

function getBookmarkWebConfigurationMessage(value: unknown) {
  if (
    !isRecord(value) ||
    value.source !== BOOKMARK_WEB_BRIDGE_SOURCE ||
    value.type !== "bookmark-extension:configure" ||
    typeof value.requestId !== "string" ||
    !isRecord(value.settings)
  ) {
    return null;
  }

  const apiBaseUrl =
    typeof value.settings.apiBaseUrl === "string" ? value.settings.apiBaseUrl.trim() : "";
  const token = typeof value.settings.token === "string" ? value.settings.token.trim() : "";

  if (!apiBaseUrl || !token) {
    return null;
  }

  return {
    requestId: value.requestId,
    settings: {
      apiBaseUrl,
      token
    }
  };
}

function getBookmarkWebPreviewMessage(value: unknown) {
  if (
    !isRecord(value) ||
    value.source !== BOOKMARK_WEB_BRIDGE_SOURCE ||
    value.type !== "bookmark-extension:extract-preview" ||
    typeof value.requestId !== "string" ||
    typeof value.url !== "string"
  ) {
    return null;
  }

  const url = value.url.trim();
  if (!url) {
    return null;
  }

  return {
    requestId: value.requestId,
    url
  };
}

function getPostMessageTargetOrigin(win: BridgeWindow) {
  return win.location?.origin || "*";
}

function isExpectedBridgeEvent(event: MessageEvent, win: BridgeWindow) {
  const eventOrigin = typeof event.origin === "string" ? event.origin : "";
  const targetOrigin = getPostMessageTargetOrigin(win);

  if (eventOrigin && targetOrigin !== "*" && eventOrigin !== targetOrigin) {
    return false;
  }

  return Boolean(eventOrigin) || !event.source || event.source === win;
}

export function announceBookmarkExtensionPresence(win: BridgeWindow = globalThis.window) {
  win.postMessage(
    {
      source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
      type: "bookmark-extension:ready",
      clientType: BOOKMARK_EXTENSION_CLIENT_TYPE
    },
    getPostMessageTargetOrigin(win)
  );
}

export function attachBookmarkExtensionPresenceBridge(
  win: BridgeWindow = globalThis.window,
  options: BookmarkExtensionPresenceBridgeOptions = {}
) {
  function handleMessage(event: MessageEvent) {
    if (!isExpectedBridgeEvent(event, win)) {
      return;
    }

    if (isBookmarkWebPingMessage(event.data)) {
      win.postMessage(
        {
          source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
          type: "bookmark-extension:pong",
          clientType: BOOKMARK_EXTENSION_CLIENT_TYPE
        },
        getPostMessageTargetOrigin(win)
      );
      return;
    }

    const configurationMessage = getBookmarkWebConfigurationMessage(event.data);
    if (configurationMessage) {
      void Promise.resolve()
        .then(() => options.configureSettings?.(configurationMessage.settings))
        .then(() => {
          win.postMessage(
            {
              source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
              type: "bookmark-extension:configured",
              requestId: configurationMessage.requestId,
              clientType: BOOKMARK_EXTENSION_CLIENT_TYPE
            },
            getPostMessageTargetOrigin(win)
          );
        })
        .catch(() => {
          win.postMessage(
            {
              source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
              type: "bookmark-extension:configure-failed",
              requestId: configurationMessage.requestId,
              clientType: BOOKMARK_EXTENSION_CLIENT_TYPE
            },
            getPostMessageTargetOrigin(win)
          );
        });
      return;
    }

    const previewMessage = getBookmarkWebPreviewMessage(event.data);
    if (!previewMessage) {
      return;
    }

    void Promise.resolve()
      .then(() => {
        if (!options.extractPreview) {
          throw new Error("bookmark_rendered_preview_unavailable");
        }

        return options.extractPreview(previewMessage.url);
      })
      .then((preview) => {
        win.postMessage(
          {
            source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
            type: "bookmark-extension:preview-result",
            requestId: previewMessage.requestId,
            clientType: BOOKMARK_EXTENSION_CLIENT_TYPE,
            preview
          },
          getPostMessageTargetOrigin(win)
        );
      })
      .catch(() => {
        win.postMessage(
          {
            source: BOOKMARK_EXTENSION_BRIDGE_SOURCE,
            type: "bookmark-extension:preview-failed",
            requestId: previewMessage.requestId,
            clientType: BOOKMARK_EXTENSION_CLIENT_TYPE
          },
          getPostMessageTargetOrigin(win)
        );
      });
  }

  win.addEventListener("message", handleMessage);

  return () => {
    win.removeEventListener("message", handleMessage);
  };
}
