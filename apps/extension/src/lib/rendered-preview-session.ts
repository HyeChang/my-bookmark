import type { BookmarkExtractPreview } from "@bookmark/shared";

type TabsApi = {
  create?: (options: { url: string; active: boolean }) => Promise<{ id?: number; status?: string }>;
  sendMessage?: (tabId: number, message: { type: string }) => Promise<BookmarkExtractPreview>;
  remove?: (tabId: number) => Promise<void>;
  onUpdated?: {
    addListener?: (listener: (tabId: number, changeInfo: { status?: string }) => void) => void;
    removeListener?: (listener: (tabId: number, changeInfo: { status?: string }) => void) => void;
  };
};

type ChromeApiLike = {
  tabs?: TabsApi;
};

type ExtractRenderedPreviewSessionOptions = {
  chromeApi?: ChromeApiLike;
  timeoutMs?: number;
};

function getChromeApi(options: ExtractRenderedPreviewSessionOptions) {
  return options.chromeApi ?? (globalThis as { chrome?: ChromeApiLike }).chrome;
}

function createTabCompleteWaiter(tabsApi: TabsApi, timeoutMs: number) {
  if (!tabsApi.onUpdated?.addListener || !tabsApi.onUpdated.removeListener) {
    return {
      setTabId: (_tabId: number) => undefined,
      dispose: () => undefined,
      promise: Promise.resolve()
    };
  }

  let trackedTabId: number | null = null;
  const completedTabIds = new Set<number>();
  let setTabId = (_tabId: number) => undefined;
  let dispose = () => undefined;

  const promise = new Promise<"complete" | "timeout">((resolve) => {
    let isSettled = false;
    const finish = (result: "complete" | "timeout") => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      globalThis.clearTimeout(timer);
      tabsApi.onUpdated?.removeListener?.(listener);
      resolve(result);
    };

    const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (changeInfo.status !== "complete") {
        return;
      }

      if (trackedTabId === null) {
        completedTabIds.add(updatedTabId);
        return;
      }

      if (updatedTabId !== trackedTabId) {
        return;
      }

      finish("complete");
    };

    const timer = globalThis.setTimeout(() => {
      finish("timeout");
    }, timeoutMs);

    tabsApi.onUpdated.addListener(listener);

    setTabId = (nextTabId: number) => {
      trackedTabId = nextTabId;
      if (completedTabIds.has(nextTabId)) {
        finish("complete");
      }
    };

    dispose = () => {
      finish("complete");
    };
  });

  return {
    setTabId,
    dispose,
    promise
  };
}

export function extractRenderedPreviewInBackground(
  url: string,
  options: ExtractRenderedPreviewSessionOptions = {}
) {
  const request = (async () => {
    const tabsApi = getChromeApi(options)?.tabs;
    if (!tabsApi?.create || !tabsApi.sendMessage || !tabsApi.remove) {
      throw new Error("bookmark_rendered_preview_unavailable");
    }

    const tabCompleteWaiter = createTabCompleteWaiter(tabsApi, options.timeoutMs ?? 4_000);
    const createdTab = await tabsApi.create({
      url,
      active: false
    });

    if (typeof createdTab?.id !== "number") {
      throw new Error("bookmark_rendered_preview_unavailable");
    }

    try {
      tabCompleteWaiter.setTabId(createdTab.id);

      if (createdTab.status !== "complete") {
        const tabLoadStatus = await tabCompleteWaiter.promise;
        if (tabLoadStatus === "timeout") {
          throw new Error("bookmark_rendered_preview_timeout");
        }
      } else {
        tabCompleteWaiter.dispose();
      }

      return await tabsApi.sendMessage(createdTab.id, {
        type: "bookmark:extract-rendered-preview"
      });
    } finally {
      await Promise.resolve(tabsApi.remove(createdTab.id)).catch(() => undefined);
    }
  })();

  void request.catch(() => undefined);
  return request;
}
