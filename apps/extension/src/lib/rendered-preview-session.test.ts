import { afterEach, describe, expect, it, vi } from "vitest";
import type { BookmarkExtractPreview } from "@bookmark/shared";

import { extractRenderedPreviewInBackground } from "./rendered-preview-session";

type OnUpdatedListener = (tabId: number, changeInfo: { status?: string }) => void;

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

function createChromeApi() {
  let onUpdatedListener: OnUpdatedListener | null = null;

  return {
    chromeApi: {
      tabs: {
        create: vi.fn(),
        sendMessage: vi.fn(),
        remove: vi.fn(),
        onUpdated: {
          addListener: vi.fn((listener: OnUpdatedListener) => {
            onUpdatedListener = listener;
          }),
          removeListener: vi.fn((listener: OnUpdatedListener) => {
            if (onUpdatedListener === listener) {
              onUpdatedListener = null;
            }
          })
        }
      }
    },
    dispatchUpdated(tabId: number, changeInfo: { status?: string }) {
      onUpdatedListener?.(tabId, changeInfo);
    }
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("rendered preview background sessions", () => {
  it("opens an inactive tab, waits for completion, extracts the preview, and closes the tab", async () => {
    const preview = createPreview();
    const { chromeApi, dispatchUpdated } = createChromeApi();

    chromeApi.tabs.create.mockResolvedValue({
      id: 77,
      status: "loading"
    });
    chromeApi.tabs.sendMessage.mockResolvedValue(preview);
    chromeApi.tabs.remove.mockResolvedValue(undefined);

    const request = extractRenderedPreviewInBackground("https://example.com/articles/rendered", {
      chromeApi,
      timeoutMs: 1_000
    });

    expect(chromeApi.tabs.create).toHaveBeenCalledWith({
      url: "https://example.com/articles/rendered",
      active: false
    });
    expect(chromeApi.tabs.sendMessage).not.toHaveBeenCalled();

    dispatchUpdated(77, { status: "complete" });

    await expect(request).resolves.toEqual(preview);
    expect(chromeApi.tabs.sendMessage).toHaveBeenCalledWith(77, {
      type: "bookmark:extract-rendered-preview"
    });
    expect(chromeApi.tabs.remove).toHaveBeenCalledWith(77);
    expect(chromeApi.tabs.onUpdated.removeListener).toHaveBeenCalledTimes(1);
  });

  it("times out and closes the temporary tab when the page never finishes loading", async () => {
    vi.useFakeTimers();
    const { chromeApi } = createChromeApi();

    chromeApi.tabs.create.mockResolvedValue({
      id: 91,
      status: "loading"
    });
    chromeApi.tabs.remove.mockResolvedValue(undefined);

    const request = extractRenderedPreviewInBackground("https://example.com/slow", {
      chromeApi,
      timeoutMs: 500
    });

    await vi.advanceTimersByTimeAsync(500);

    await expect(request).rejects.toThrow("bookmark_rendered_preview_timeout");
    expect(chromeApi.tabs.sendMessage).not.toHaveBeenCalled();
    expect(chromeApi.tabs.remove).toHaveBeenCalledWith(91);
    expect(chromeApi.tabs.onUpdated.removeListener).toHaveBeenCalledTimes(1);
  });
});
