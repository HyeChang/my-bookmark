import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createSessionValue } from "../src/lib/auth/session";

const sessionSecret = "bookmark-test-secret";
const fakeUser = {
  uid: "firebase-user-1",
  email: "keygenerator25@gmail.com",
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
});
