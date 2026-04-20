import { afterEach, describe, expect, it, vi } from "vitest";
import type { Folder, Tag } from "@bookmark/shared";

import { createExtensionTag, ensureExtensionFolderId, saveExtensionBookmark } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function createFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "폴더",
    color: overrides.color ?? null,
    icon: overrides.icon ?? null,
    isHidden: overrides.isHidden ?? false,
    parentFolderId: overrides.parentFolderId ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString()
  };
}

function createTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "태그",
    color: overrides.color ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString()
  };
}

describe("extension api folder resolution", () => {
  it("returns the preferred folder when it exists", async () => {
    const preferredFolder = createFolder({ id: "folder-1", name: "Projects" });

    expect(
      await ensureExtensionFolderId("https://bookmark.example.com", "token", "folder-1", [
        preferredFolder
      ])
    ).toBe("folder-1");
  });

  it("returns null when no preferred folder is selected", async () => {
    const fetchSpy = vi.fn();

    vi.stubGlobal("fetch", fetchSpy);

    expect(await ensureExtensionFolderId("https://bookmark.example.com", "token", "")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null when the preferred folder no longer exists", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        folders: [
          createFolder({ id: "folder-extension", name: "확장", parentFolderId: null }),
          createFolder({ id: "folder-other", name: "기타", parentFolderId: null })
        ]
      })
    });

    vi.stubGlobal("fetch", fetchSpy);

    expect(
      await ensureExtensionFolderId(
        "https://bookmark.example.com",
        "token",
        "folder-extension"
      )
    ).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("extension api tag creation", () => {
  it("creates a tag through the token-auth tag route", async () => {
    const createdTag = createTag({ id: "tag-1", name: "Research", color: "#1d4ed8" });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag: createdTag
      })
    });

    vi.stubGlobal("fetch", fetchSpy);

    expect(
      await createExtensionTag("https://bookmark.example.com", "token-123", {
        name: "Research",
        color: "#1d4ed8"
      })
    ).toEqual(createdTag);

    expect(fetchSpy).toHaveBeenCalledWith("https://bookmark.example.com/api/tags", {
      method: "POST",
      headers: {
        authorization: "Bearer token-123",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: "Research",
        color: "#1d4ed8"
      })
    });
  });
});

describe("extension bookmark saving", () => {
  it("passes favorite and hidden flags when saving a bookmark", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bookmark: {
            id: "bookmark-1"
          }
        })
      });

    vi.stubGlobal("fetch", fetchSpy);

    await saveExtensionBookmark(
      "https://bookmark.example.com",
      "token-123",
      {
        url: "https://example.com/article",
        folderId: "folder-1",
        tagIds: ["tag-1"],
        userTitle: "Example",
        userContent: "Saved from extension",
        isFavorite: true,
        isHidden: true
      },
      [],
      [createFolder({ id: "folder-1", name: "읽기" })]
    );

    expect(fetchSpy).toHaveBeenCalledWith("https://bookmark.example.com/api/bookmarks", {
      method: "POST",
      headers: {
        authorization: "Bearer token-123",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url: "https://example.com/article",
        folderId: "folder-1",
        tagIds: ["tag-1"],
        userTitle: "Example",
        userContent: "Saved from extension",
        isFavorite: true,
        isHidden: true
      })
    });
  });

  it("saves to unfiled when no folder is selected", async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        bookmark: {
          id: "bookmark-1"
        }
      })
    });

    vi.stubGlobal("fetch", fetchSpy);

    await saveExtensionBookmark(
      "https://bookmark.example.com",
      "token-123",
      {
        url: "https://example.com/article",
        folderId: null,
        tagIds: [],
        userTitle: "Example"
      },
      []
    );

    expect(fetchSpy).toHaveBeenCalledWith("https://bookmark.example.com/api/bookmarks", {
      method: "POST",
      headers: {
        authorization: "Bearer token-123",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url: "https://example.com/article",
        folderId: null,
        tagIds: [],
        userTitle: "Example"
      })
    });
  });
});
