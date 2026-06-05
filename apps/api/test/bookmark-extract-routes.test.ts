import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import { createSessionValue } from "../src/lib/auth/session";
import { createBookmarkExtractor } from "../src/lib/extract/bookmark-extractor";
import type {
  BookmarkRecord,
  BookmarkRepository
} from "../src/lib/repositories/bookmarks";

const sessionSecret = "bookmark-test-secret";
const fakeUser = {
  uid: "firebase-user-1",
  email: "user@example.com",
  name: "Bookmark Tester",
  picture: "https://example.com/avatar.png"
};

async function authenticatedRequest(
  app: ReturnType<typeof createApp>,
  path: string,
  init?: RequestInit
) {
  const sessionValue = await createSessionValue(fakeUser, sessionSecret);

  return app.request(`http://example.com${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
      cookie: `bookmark_session=${sessionValue}`
    }
  });
}

describe("bookmark extract routes", () => {
  it("returns js-required worker previews for SPA fallback pages", async () => {
    const fetchImplementation = vi.fn(async () => {
      return new Response(
        `
          <html>
            <head>
              <title>SPA Article</title>
              <meta name="description" content="SPA description">
              <meta property="og:image" content="/cover.png">
            </head>
            <body>
              <noscript>You need to enable JavaScript to run this app.</noscript>
              <div id="root"></div>
            </body>
          </html>
        `,
        {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8"
          }
        }
      );
    });
    const app = createApp({
      sessionSecret,
      bookmarkExtractor: createBookmarkExtractor(fetchImplementation as typeof fetch)
    });

    const res = await authenticatedRequest(app, "/api/bookmarks/extract", {
      method: "POST",
      body: JSON.stringify({
        url: "https://spa.example/app"
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      preview: {
        url: "https://spa.example/app",
        normalizedUrl: "https://spa.example/app",
        sourceTitle: "SPA Article",
        sourceSummary: "SPA description",
        sourceContent: null,
        sourceImageUrl: "https://spa.example/cover.png",
        renderStatus: "js_required",
        renderSource: "worker",
        renderReason: "spa_fallback"
      }
    });
  });

  it("extracts bookmark preview metadata for the authenticated user", async () => {
    const app = createApp({
      sessionSecret,
      bookmarkExtractor: {
        extract: async (url) => ({
          url: "https://example.com/article",
          normalizedUrl: new URL(url).toString(),
          sourceTitle: "Example title",
          sourceContent: "Example article body",
          sourceSummary: "Example summary"
        })
      }
    });

    const res = await authenticatedRequest(app, "/api/bookmarks/extract", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/article"
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      preview: {
        url: "https://example.com/article",
        normalizedUrl: "https://example.com/article",
        sourceTitle: "Example title",
        sourceContent: "Example article body",
        sourceSummary: "Example summary"
      }
    });
  });

  it("loads a fresh preview for an existing bookmark without updating stored source fields", async () => {
    const bookmark: BookmarkRecord = {
      id: "bookmark-preview",
      userId: fakeUser.uid,
      folderId: null,
      tagIds: [],
      url: "https://example.com/stored",
      normalizedUrl: "https://example.com/stored",
      isFavorite: false,
      isHidden: false,
      isTrashed: false,
      trashedAt: null,
      bookmarkColor: null,
      urlColor: null,
      sourceTitle: "Stored source title",
      sourceContent: "Stored source content",
      sourceSummary: "Stored source summary",
      userTitle: null,
      userContent: null,
      userSummary: null,
      displayTitle: "Stored source title",
      displayContent: "Stored source content",
      displaySummary: "Stored source summary",
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z"
    };
    const update = vi.fn();
    const bookmarkRepository: BookmarkRepository = {
      listByUser: async () => [],
      searchByUser: async () => [],
      create: async () => bookmark,
      getByUserAndId: async (userId, bookmarkId) =>
        userId === fakeUser.uid && bookmarkId === bookmark.id ? bookmark : null,
      delete: async () => false,
      restore: async () => null,
      permanentlyDelete: async () => false,
      update
    };
    const extract = vi.fn(async (url: string) => ({
      url,
      normalizedUrl: new URL(url).toString(),
      sourceTitle: "Fresh preview title",
      sourceContent: "Fresh preview body",
      sourceSummary: "Fresh preview summary"
    }));
    const app = createApp({
      sessionSecret,
      bookmarkRepository,
      bookmarkExtractor: {
        extract
      }
    });

    const res = await authenticatedRequest(app, "/api/bookmarks/bookmark-preview/preview");

    expect(res.status).toBe(200);
    expect(extract).toHaveBeenCalledWith("https://example.com/stored");
    expect(update).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({
      preview: {
        url: "https://example.com/stored",
        normalizedUrl: "https://example.com/stored",
        sourceTitle: "Fresh preview title",
        sourceContent: "Fresh preview body",
        sourceSummary: "Fresh preview summary"
      }
    });
  });
});
