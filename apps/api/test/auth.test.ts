import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

const fakeUser = {
  uid: "firebase-user-1",
  email: "user@example.com",
  name: "Bookmark Tester",
  picture: "https://example.com/avatar.png"
};

describe("auth session routes", () => {
  it("rejects session creation when idToken is missing", async () => {
    const app = createApp({
      verifyIdToken: async () => fakeUser
    });

    const res = await app.request("http://example.com/api/auth/session", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "missing_id_token"
    });
  });

  it("creates a session cookie from a verified firebase token", async () => {
    const app = createApp({
      verifyIdToken: async (idToken) => {
        expect(idToken).toBe("firebase-id-token");
        return fakeUser;
      }
    });

    const res = await app.request("http://example.com/api/auth/session", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        idToken: "firebase-id-token"
      })
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("bookmark_session=");
    await expect(res.json()).resolves.toEqual({
      authenticated: true,
      user: fakeUser
    });
  });

  it("returns the authenticated user from the session cookie", async () => {
    const app = createApp({
      verifyIdToken: async () => fakeUser
    });

    const sessionRes = await app.request("http://example.com/api/auth/session", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        idToken: "firebase-id-token"
      })
    });

    const cookie = sessionRes.headers.get("set-cookie");
    expect(cookie).toBeTruthy();

    const res = await app.request("http://example.com/api/auth/session", {
      headers: {
        cookie: cookie!
      }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      authenticated: true,
      user: fakeUser
    });
  });

  it("clears the session cookie on logout", async () => {
    const app = createApp({
      verifyIdToken: async () => fakeUser
    });

    const sessionRes = await app.request("http://example.com/api/auth/session", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        idToken: "firebase-id-token"
      })
    });

    const cookie = sessionRes.headers.get("set-cookie");
    expect(cookie).toBeTruthy();

    const res = await app.request("http://example.com/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: cookie!
      }
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
