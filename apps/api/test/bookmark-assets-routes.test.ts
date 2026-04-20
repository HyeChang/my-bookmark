import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createSessionValue } from "../src/lib/auth/session";
import type {
  BookmarkRecord,
  BookmarkRepository
} from "../src/lib/repositories/bookmarks";

const sessionSecret = "bookmark-asset-test-secret";
const fakeUser = {
  uid: "firebase-user-1",
  email: "keygenerator25@gmail.com",
  name: "Bookmark Tester",
  picture: "https://example.com/avatar.png"
};

function createInMemoryBookmarkRepository(): BookmarkRepository {
  const bookmarks = new Map<string, BookmarkRecord>();

  return {
    async listByUser(userId) {
      return Array.from(bookmarks.values()).filter((bookmark) => bookmark.userId === userId);
    },
    async searchByUser(userId) {
      return Array.from(bookmarks.values()).filter((bookmark) => bookmark.userId === userId);
    },
    async create(input) {
      const now = "2026-04-13T08:00:00.000Z";
      const bookmark: BookmarkRecord = {
        id: `bookmark-${bookmarks.size + 1}`,
        userId: input.userId,
        folderId: input.folderId ?? null,
        tagIds: input.tagIds ?? [],
        url: input.url,
        normalizedUrl: input.normalizedUrl,
        isFavorite: input.isFavorite ?? false,
        isHidden: input.isHidden ?? false,
        bookmarkColor: input.bookmarkColor ?? null,
        urlColor: input.urlColor ?? null,
        sourceTitle: input.sourceTitle ?? null,
        sourceContent: input.sourceContent ?? null,
        sourceSummary: input.sourceSummary ?? null,
        userTitle: input.userTitle ?? null,
        userContent: input.userContent ?? null,
        userSummary: input.userSummary ?? null,
        createdAt: now,
        updatedAt: now,
        displayTitle: input.userTitle ?? input.sourceTitle ?? "",
        displayContent: input.userContent ?? input.sourceContent ?? "",
        displaySummary: input.userSummary ?? input.sourceSummary ?? ""
      };

      bookmarks.set(bookmark.id, bookmark);
      return bookmark;
    },
    async getByUserAndId(userId, bookmarkId) {
      const bookmark = bookmarks.get(bookmarkId);
      if (!bookmark || bookmark.userId !== userId) {
        return null;
      }

      return bookmark;
    },
    async delete(bookmarkId, userId) {
      const bookmark = bookmarks.get(bookmarkId);
      if (!bookmark || bookmark.userId !== userId) {
        return false;
      }

      bookmarks.delete(bookmarkId);
      return true;
    },
    async update(bookmarkId, userId, input) {
      const bookmark = bookmarks.get(bookmarkId);
      if (!bookmark || bookmark.userId !== userId) {
        return null;
      }

      const updated: BookmarkRecord = {
        ...bookmark,
        folderId: input.folderId === undefined ? bookmark.folderId : input.folderId,
        tagIds: input.tagIds === undefined ? bookmark.tagIds : input.tagIds,
        isFavorite: input.isFavorite ?? bookmark.isFavorite,
        isHidden: input.isHidden ?? bookmark.isHidden,
        bookmarkColor:
          input.bookmarkColor === undefined ? bookmark.bookmarkColor : input.bookmarkColor,
        urlColor: input.urlColor === undefined ? bookmark.urlColor : input.urlColor,
        userTitle: input.userTitle === undefined ? bookmark.userTitle : input.userTitle,
        userContent:
          input.userContent === undefined ? bookmark.userContent : input.userContent,
        userSummary:
          input.userSummary === undefined ? bookmark.userSummary : input.userSummary,
        updatedAt: "2026-04-13T09:00:00.000Z"
      };

      updated.displayTitle = updated.userTitle ?? updated.sourceTitle ?? "";
      updated.displayContent = updated.userContent ?? updated.sourceContent ?? "";
      updated.displaySummary = updated.userSummary ?? updated.sourceSummary ?? "";

      bookmarks.set(bookmarkId, updated);
      return updated;
    }
  };
}

function createInMemoryAssetRepository() {
  type AssetRecord = {
    id: string;
    bookmarkId: string;
    userId: string;
    assetType: string;
    objectKey: string;
    mimeType: string;
    width: number | null;
    height: number | null;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  };

  const assets = new Map<string, AssetRecord>();

  return {
    async listByBookmark(userId: string, bookmarkId: string) {
      return Array.from(assets.values()).filter(
        (asset) => asset.userId === userId && asset.bookmarkId === bookmarkId
      );
    },
    async getById(userId: string, bookmarkId: string, assetId: string) {
      const asset = assets.get(assetId);
      if (!asset || asset.userId !== userId || asset.bookmarkId !== bookmarkId) {
        return null;
      }

      return asset;
    },
    async create(input: {
      bookmarkId: string;
      userId: string;
      assetType: string;
      objectKey: string;
      mimeType: string;
      width?: number | null;
      height?: number | null;
    }) {
      const now = "2026-04-13T08:00:00.000Z";
      const asset: AssetRecord = {
        id: `asset-${assets.size + 1}`,
        bookmarkId: input.bookmarkId,
        userId: input.userId,
        assetType: input.assetType,
        objectKey: input.objectKey,
        mimeType: input.mimeType,
        width: input.width ?? null,
        height: input.height ?? null,
        sortOrder: assets.size,
        createdAt: now,
        updatedAt: now
      };

      assets.set(asset.id, asset);
      return asset;
    },
    async delete(userId: string, bookmarkId: string, assetId: string) {
      const asset = assets.get(assetId);
      if (!asset || asset.userId !== userId || asset.bookmarkId !== bookmarkId) {
        return false;
      }

      assets.delete(assetId);
      return true;
    }
  };
}

function createInMemoryAssetStorage() {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();

  return {
    async put(objectKey: string, body: ArrayBuffer, contentType: string) {
      objects.set(objectKey, {
        body: new Uint8Array(body),
        contentType
      });
    },
    async get(objectKey: string) {
      return objects.get(objectKey) ?? null;
    },
    async delete(objectKey: string) {
      objects.delete(objectKey);
    }
  };
}

async function authenticatedRequest(
  app: ReturnType<typeof createApp>,
  path: string,
  init?: RequestInit
) {
  const sessionValue = await createSessionValue(fakeUser, sessionSecret);

  return app.request(`http://example.com${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      cookie: `bookmark_session=${sessionValue}`
    }
  });
}

describe("bookmark asset routes", () => {
  it("uploads, lists, and serves bookmark assets for the authenticated user", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      bookmarkAssetRepository: createInMemoryAssetRepository(),
      assetStorage: createInMemoryAssetStorage()
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url: "https://example.com/post",
        userTitle: "Asset title"
      })
    });
    const created = (await createRes.json()) as {
      bookmark: BookmarkRecord;
    };

    const formData = new FormData();
    formData.set(
      "file",
      new File(["fake-image-data"], "capture.png", { type: "image/png" })
    );

    const uploadRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}/assets`,
      {
        method: "POST",
        body: formData
      }
    );

    expect(uploadRes.status).toBe(201);
    const uploaded = (await uploadRes.json()) as {
      asset: {
        id: string;
        bookmarkId: string;
        mimeType: string;
        contentUrl: string;
      };
    };
    expect(uploaded.asset).toMatchObject({
      bookmarkId: created.bookmark.id,
      mimeType: "image/png",
      contentUrl: `/api/bookmarks/${created.bookmark.id}/assets/asset-1/content`
    });

    const listRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}/assets`
    );

    expect(listRes.status).toBe(200);
    await expect(listRes.json()).resolves.toMatchObject({
      assets: [
        {
          id: uploaded.asset.id,
          bookmarkId: created.bookmark.id
        }
      ]
    });

    const contentRes = await authenticatedRequest(app, uploaded.asset.contentUrl);

    expect(contentRes.status).toBe(200);
    expect(contentRes.headers.get("content-type")).toContain("image/png");
    await expect(contentRes.text()).resolves.toBe("fake-image-data");
  });

  it("deletes a bookmark asset for the authenticated user", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkRepository: createInMemoryBookmarkRepository(),
      bookmarkAssetRepository: createInMemoryAssetRepository(),
      assetStorage: createInMemoryAssetStorage()
    } as Parameters<typeof createApp>[0]);

    const createRes = await authenticatedRequest(app, "/api/bookmarks", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url: "https://example.com/delete-asset",
        userTitle: "Delete asset"
      })
    });
    const created = (await createRes.json()) as {
      bookmark: BookmarkRecord;
    };

    const formData = new FormData();
    formData.set(
      "file",
      new File(["delete-image-data"], "delete.png", { type: "image/png" })
    );

    const uploadRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}/assets`,
      {
        method: "POST",
        body: formData
      }
    );
    const uploaded = (await uploadRes.json()) as {
      asset: {
        id: string;
        contentUrl: string;
      };
    };

    const deleteRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}/assets/${uploaded.asset.id}`,
      {
        method: "DELETE"
      }
    );

    expect(deleteRes.status).toBe(204);

    const listRes = await authenticatedRequest(
      app,
      `/api/bookmarks/${created.bookmark.id}/assets`
    );
    await expect(listRes.json()).resolves.toMatchObject({
      assets: []
    });

    const contentRes = await authenticatedRequest(app, uploaded.asset.contentUrl);
    expect(contentRes.status).toBe(404);
  });
});
