import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defaultExtensionSettings,
  clearPendingBookmarkDraft,
  loadExtensionSettings,
  loadPendingBookmarkDraft,
  parseDefaultTagIdsInput,
  savePendingBookmarkDraft,
  saveExtensionSettings
} from "./storage";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extension storage", () => {
  it("returns default settings when chrome storage is unavailable", async () => {
    const settings = await loadExtensionSettings();

    expect(settings).toEqual(defaultExtensionSettings);
  });

  it("normalizes persisted settings from chrome storage", async () => {
    const getSpy = vi.fn().mockResolvedValue({
      extensionSettings: {
        apiBaseUrl: "https://bookmark.example.com",
        token: "token-123",
        defaultFolderId: "folder-1",
        defaultTagIds: ["tag-1", "", "tag-2"],
        fastSaveMode: "immediate"
      }
    });

    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          get: getSpy
        }
      }
    });

    const settings = await loadExtensionSettings();

    expect(settings).toEqual({
      apiBaseUrl: "https://bookmark.example.com",
      token: "token-123",
      defaultFolderId: "folder-1",
      defaultTagIds: ["tag-1", "tag-2"],
      fastSaveMode: "immediate"
    });
  });

  it("persists normalized settings", async () => {
    const setSpy = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("chrome", {
      storage: {
        sync: {
          set: setSpy
        }
      }
    });

    await saveExtensionSettings({
      apiBaseUrl: "https://bookmark.example.com/",
      token: " token-123 ",
      defaultFolderId: "folder-1",
      defaultTagIds: ["tag-1", "", "tag-2"],
      fastSaveMode: "immediate"
    });

    expect(setSpy).toHaveBeenCalledWith({
      extensionSettings: {
        apiBaseUrl: "https://bookmark.example.com",
        token: "token-123",
        defaultFolderId: "folder-1",
        defaultTagIds: ["tag-1", "tag-2"],
        fastSaveMode: "immediate"
      }
    });
  });

  it("falls back to local storage when sync storage is unavailable", async () => {
    const getSpy = vi.fn().mockResolvedValue({
      extensionSettings: {
        token: "local-token"
      }
    });
    const setSpy = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: getSpy,
          set: setSpy
        }
      }
    });

    expect(await loadExtensionSettings()).toEqual({
      ...defaultExtensionSettings,
      token: "local-token"
    });

    await saveExtensionSettings({
      ...defaultExtensionSettings,
      token: "next-token"
    });

    expect(setSpy).toHaveBeenCalledWith({
      extensionSettings: {
        ...defaultExtensionSettings,
        token: "next-token"
      }
    });
  });

  it("parses comma separated default tag input", () => {
    expect(parseDefaultTagIdsInput("tag-1, tag-2  , ,tag-3")).toEqual([
      "tag-1",
      "tag-2",
      "tag-3"
    ]);
  });

  it("stores and clears a pending bookmark draft", async () => {
    const getSpy = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        extensionPendingBookmarkDraft: {
          source: "selection",
          title: "Example",
          url: "https://example.com/article",
          userContent: "quoted text",
          folderId: "folder-1",
          tagIds: ["tag-1", "", "tag-2"],
          assets: [{ kind: "remote-url", source: "https://example.com/image.png", filename: "image.png" }]
        }
      })
      .mockResolvedValueOnce({});
    const setSpy = vi.fn().mockResolvedValue(undefined);
    const removeSpy = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: getSpy,
          set: setSpy,
          remove: removeSpy
        }
      }
    });

    expect(await loadPendingBookmarkDraft()).toBeNull();

    await savePendingBookmarkDraft({
      source: "selection",
      title: " Example ",
      url: "https://example.com/article",
      userContent: " quoted text ",
      folderId: " folder-1 ",
      tagIds: ["tag-1", "", "tag-2"],
      assets: [{ kind: "remote-url", source: "https://example.com/image.png", filename: "image.png" }]
    });

    expect(setSpy).toHaveBeenCalledWith({
      extensionPendingBookmarkDraft: {
        source: "selection",
        title: "Example",
        url: "https://example.com/article",
        userContent: "quoted text",
        folderId: "folder-1",
        tagIds: ["tag-1", "tag-2"],
        assets: [{ kind: "remote-url", source: "https://example.com/image.png", filename: "image.png" }]
      }
    });

    expect(await loadPendingBookmarkDraft()).toEqual({
      source: "selection",
      title: "Example",
      url: "https://example.com/article",
      userContent: "quoted text",
      folderId: "folder-1",
      tagIds: ["tag-1", "tag-2"],
      assets: [{ kind: "remote-url", source: "https://example.com/image.png", filename: "image.png" }]
    });

    await clearPendingBookmarkDraft();

    expect(removeSpy).toHaveBeenCalledWith("extensionPendingBookmarkDraft");
    expect(await loadPendingBookmarkDraft()).toBeNull();
  });
});
