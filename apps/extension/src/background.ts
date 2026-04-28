import { createFileFromImageUrl } from "./lib/capture";
import { saveExtensionBookmark } from "./lib/api";
import { CONTEXT_MENU_IDS, buildPendingBookmarkDraft, getContextMenuDefinitions } from "./lib/context-menus";
import { extractRenderedPreviewInBackground } from "./lib/rendered-preview-session";
import { captureVisibleTabImage, dataUrlToFile } from "./lib/screenshot";
import {
  loadExtensionSettings,
  savePendingBookmarkDraft,
  type PendingBookmarkAsset
} from "./lib/storage";

type ContextMenuClickInfo = {
  menuItemId?: string;
  pageUrl?: string;
  selectionText?: string;
  srcUrl?: string;
  linkUrl?: string;
};

type TabLike = {
  id?: number;
  title?: string;
  url?: string;
  windowId?: number;
};

const chromeApi = (globalThis as { chrome?: any }).chrome;

function getContextMenusApi() {
  return chromeApi?.contextMenus;
}

function getActionApi() {
  return chromeApi?.action;
}

async function removeAllContextMenus() {
  const contextMenus = getContextMenusApi();
  if (!contextMenus?.removeAll) {
    return;
  }

  await contextMenus.removeAll();
}

async function createContextMenus() {
  const contextMenus = getContextMenusApi();
  if (!contextMenus?.create) {
    return;
  }

  await removeAllContextMenus();

  for (const definition of getContextMenuDefinitions()) {
    contextMenus.create(definition);
  }
}

async function showActionBadge(text: string, color: string) {
  const action = getActionApi();
  if (!action?.setBadgeText || !action?.setBadgeBackgroundColor) {
    return;
  }

  await action.setBadgeText({ text });
  await action.setBadgeBackgroundColor({ color });

  globalThis.setTimeout(() => {
    void action.setBadgeText({ text: "" });
  }, 2200);
}

async function openExtensionPopup() {
  const action = getActionApi();
  if (action?.openPopup) {
    try {
      await action.openPopup();
      return;
    } catch {
      // Fall through to a popup tab.
    }
  }

  const tabsApi = chromeApi?.tabs;
  const runtimeApi = chromeApi?.runtime;
  if (tabsApi?.create && runtimeApi?.getURL) {
    await tabsApi.create({
      url: runtimeApi.getURL("src/popup/index.html")
    });
  }
}

async function resolvePendingAsset(asset: PendingBookmarkAsset) {
  if (asset.kind === "remote-url") {
    return createFileFromImageUrl(asset.source);
  }

  return dataUrlToFile(asset.source, asset.filename);
}

async function handleContextMenuSave(info: ContextMenuClickInfo, tab: TabLike) {
  const settings = await loadExtensionSettings();

  if (!settings.apiBaseUrl || !settings.token) {
    if (chromeApi?.runtime?.openOptionsPage) {
      await chromeApi.runtime.openOptionsPage();
    }
    return;
  }

  const menuId = info.menuItemId as string | undefined;
  if (!menuId) {
    return;
  }

  const screenshotDataUrl =
    menuId === CONTEXT_MENU_IDS.screenshot ? await captureVisibleTabImage(tab.windowId) : undefined;
  const draft = buildPendingBookmarkDraft(menuId as keyof typeof CONTEXT_MENU_IDS, info, tab, {
    defaultFolderId: settings.defaultFolderId,
    defaultTagIds: settings.defaultTagIds,
    screenshotDataUrl
  });

  if (settings.fastSaveMode === "popup") {
    await savePendingBookmarkDraft(draft);
    await openExtensionPopup();
    await showActionBadge("NEW", "#0f766e");
    return;
  }

  const files = await Promise.all(draft.assets.map((asset) => resolvePendingAsset(asset)));
  await saveExtensionBookmark(
    settings.apiBaseUrl,
    settings.token,
    {
      url: draft.url,
      folderId: draft.folderId || null,
      tagIds: draft.tagIds,
      userTitle: draft.title || null,
      userContent: draft.userContent || null
    },
    files
  );

  await showActionBadge("OK", "#15803d");
}

if (chromeApi?.runtime?.onInstalled) {
  chromeApi.runtime.onInstalled.addListener(() => {
    void createContextMenus();
  });
}

if (chromeApi?.runtime?.onStartup) {
  chromeApi.runtime.onStartup.addListener(() => {
    void createContextMenus();
  });
}

if (getContextMenusApi()?.onClicked) {
  getContextMenusApi().onClicked.addListener((info: ContextMenuClickInfo, tab: TabLike) => {
    void handleContextMenuSave(info, tab).catch(() => {
      void showActionBadge("ERR", "#b91c1c");
    });
  });
}

if (chromeApi?.runtime?.onMessage) {
  chromeApi.runtime.onMessage.addListener(
    (
      message: { type?: string; url?: string },
      _sender: unknown,
      sendResponse: (value: unknown) => void
    ) => {
      if (message.type !== "bookmark:extract-rendered-preview" || !message.url?.trim()) {
        return false;
      }

      void extractRenderedPreviewInBackground(message.url.trim(), {
        chromeApi
      })
        .then((preview) => {
          sendResponse({
            preview
          });
        })
        .catch((error: unknown) => {
          sendResponse({
            error:
              error instanceof Error
                ? error.message
                : "bookmark_rendered_preview_failed"
          });
        });

      return true;
    }
  );
}
