import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { createSessionValue } from "../src/lib/auth/session";
import type { ExtensionTokenRepository } from "../src/lib/repositories/extension-tokens";

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

function createInMemoryExtensionTokenRepository(): ExtensionTokenRepository {
  const tokens = new Map<
    string,
    {
      id: string;
      userId: string;
      label: string;
      tokenHash: string;
      createdAt: string;
      updatedAt: string;
      revokedAt: string | null;
    }
  >();

  return {
    async listByUser(userId) {
      return Array.from(tokens.values()).filter(
        (token) => token.userId === userId && token.revokedAt === null
      );
    },
    async create(input) {
      const token = {
        id: `token-${tokens.size + 1}`,
        userId: input.userId,
        label: input.label,
        tokenHash: `hash-${tokens.size + 1}`,
        createdAt: "2026-04-17T10:00:00.000Z",
        updatedAt: "2026-04-17T10:00:00.000Z",
        revokedAt: null
      };

      tokens.set(token.id, token);
      return {
        token,
        rawToken: `bmt_test_token_${tokens.size}`
      };
    },
    async revoke(tokenId, userId) {
      const token = tokens.get(tokenId);
      if (!token || token.userId !== userId || token.revokedAt !== null) {
        return false;
      }

      token.revokedAt = "2026-04-17T11:00:00.000Z";
      token.updatedAt = "2026-04-17T11:00:00.000Z";
      tokens.set(token.id, token);
      return true;
    },
    async findByRawToken() {
      return null;
    }
  };
}

describe("extension token routes", () => {
  it("issues an extension token for an authenticated session", async () => {
    const app = createApp({
      sessionSecret,
      extensionTokenRepository: createInMemoryExtensionTokenRepository()
    });

    const res = await authenticatedRequest(app, "/api/extension-tokens", {
      method: "POST",
      body: JSON.stringify({
        label: "Chrome desktop"
      })
    });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      token: {
        id: expect.any(String),
        label: "Chrome desktop"
      },
      rawToken: expect.any(String)
    });
  });

  it("lists extension tokens without exposing raw token values", async () => {
    const app = createApp({
      sessionSecret,
      extensionTokenRepository: createInMemoryExtensionTokenRepository()
    });

    const createRes = await authenticatedRequest(app, "/api/extension-tokens", {
      method: "POST",
      body: JSON.stringify({
        label: "Chrome desktop"
      })
    });
    expect(createRes.status).toBe(201);

    const res = await authenticatedRequest(app, "/api/extension-tokens");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      tokens: [
        expect.objectContaining({
          id: expect.any(String),
          label: "Chrome desktop"
        })
      ]
    });
  });

  it("revokes an issued extension token", async () => {
    const app = createApp({
      sessionSecret,
      extensionTokenRepository: createInMemoryExtensionTokenRepository()
    });

    const createRes = await authenticatedRequest(app, "/api/extension-tokens", {
      method: "POST",
      body: JSON.stringify({
        label: "Chrome desktop"
      })
    });
    const created = (await createRes.json()) as {
      token: {
        id: string;
      };
    };

    const revokeRes = await authenticatedRequest(
      app,
      `/api/extension-tokens/${created.token.id}`,
      {
        method: "DELETE"
      }
    );

    expect(revokeRes.status).toBe(200);
    await expect(revokeRes.json()).resolves.toEqual({ ok: true });

    const listRes = await authenticatedRequest(app, "/api/extension-tokens");
    await expect(listRes.json()).resolves.toEqual({
      tokens: []
    });
  });
});
