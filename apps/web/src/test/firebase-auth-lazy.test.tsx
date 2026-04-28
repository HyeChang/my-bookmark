import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const firebaseAuthMock = vi.hoisted(() => ({
  moduleLoadCount: 0,
  signInWithGoogle: vi.fn(async () => "firebase-id-token"),
  signOutFromGoogle: vi.fn(async () => undefined)
}));

vi.mock("../lib/firebase", () => {
  firebaseAuthMock.moduleLoadCount += 1;

  return {
    signInWithGoogle: firebaseAuthMock.signInWithGoogle,
    signOutFromGoogle: firebaseAuthMock.signOutFromGoogle
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  firebaseAuthMock.moduleLoadCount = 0;
  firebaseAuthMock.signInWithGoogle.mockClear();
  firebaseAuthMock.signOutFromGoogle.mockClear();
});

describe("firebase auth lazy loading", () => {
  it("loads Firebase auth only when Google login starts", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/session" && !init?.method) {
        return new Response(JSON.stringify({ authenticated: false }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/auth/session" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            authenticated: true,
            user: {
              uid: "firebase-user-1",
              email: "keygenerator25@gmail.com",
              name: "Bookmark Tester"
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url === "/api/bookmarks/counts" && !init?.method) {
        return new Response(
          JSON.stringify({
            counts: {
              active: { total: 0, visible: 0 },
              favorite: { total: 0, visible: 0 },
              trashed: { total: 0, visible: 0 },
              unfiled: { total: 0, visible: 0 },
              byFolderId: {}
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url === "/api/bookmarks?favorite=1&limit=20&offset=0" && !init?.method) {
        return new Response(JSON.stringify({ bookmarks: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/folders" && !init?.method) {
        return new Response(JSON.stringify({ folders: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/tags" && !init?.method) {
        return new Response(JSON.stringify({ tags: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: App } = await import("../App");
    render(<App />);

    const loginButton = await screen.findByRole("button", {
      name: /google로 로그인/i
    });
    expect(firebaseAuthMock.moduleLoadCount).toBe(0);

    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(firebaseAuthMock.signInWithGoogle).toHaveBeenCalledTimes(1);
    });
    expect(firebaseAuthMock.moduleLoadCount).toBe(1);
  });
});
