import { afterEach, describe, expect, it, vi } from "vitest";

import { closeCurrentExtensionView, openUrlInNewTab } from "./browser";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extension browser helpers", () => {
  it("closes the current extension tab when chrome tabs APIs are available", async () => {
    const getCurrentSpy = vi.fn().mockResolvedValue({ id: 42 });
    const removeSpy = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("chrome", {
      tabs: {
        getCurrent: getCurrentSpy,
        remove: removeSpy
      }
    });

    await closeCurrentExtensionView();

    expect(getCurrentSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith(42);
  });

  it("falls back to window.close when the chrome tab APIs are unavailable", async () => {
    const closeSpy = vi.fn();
    vi.stubGlobal("window", {
      close: closeSpy
    });

    await closeCurrentExtensionView();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it("opens a new tab through chrome.tabs.create when available", async () => {
    const createSpy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      tabs: {
        create: createSpy
      }
    });

    await openUrlInNewTab("https://bookmark.example.workers.dev/");

    expect(createSpy).toHaveBeenCalledWith({
      url: "https://bookmark.example.workers.dev/"
    });
  });

  it("falls back to window.open when chrome.tabs.create is unavailable", async () => {
    const openSpy = vi.fn();
    vi.stubGlobal("window", {
      open: openSpy
    });

    await openUrlInNewTab("https://bookmark.example.workers.dev/");

    expect(openSpy).toHaveBeenCalledWith(
      "https://bookmark.example.workers.dev/",
      "_blank",
      "noopener,noreferrer"
    );
  });
});
