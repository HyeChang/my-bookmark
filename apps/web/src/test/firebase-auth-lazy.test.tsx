import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
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

vi.mock("../components/AuthenticatedDashboardApp", () => ({
  default: ({ initialUser }: { initialUser?: { email: string } }) => (
    <section aria-label="mock-dashboard">{initialUser?.email}</section>
  )
}));

afterEach(async () => {
  const { resetFirebaseAuthLoaderForTest } = await import("../lib/firebase-auth-loader");
  resetFirebaseAuthLoaderForTest();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  firebaseAuthMock.moduleLoadCount = 0;
  firebaseAuthMock.signInWithGoogle.mockClear();
  firebaseAuthMock.signOutFromGoogle.mockClear();
});

describe("firebase auth lazy loading", () => {
  it("initializes Firebase auth with only the popup dependencies this app uses", () => {
    const firebaseSource = readFileSync("src/lib/firebase.ts", "utf8");

    expect(firebaseSource).toContain("initializeAuth");
    expect(firebaseSource).toContain("inMemoryPersistence");
    expect(firebaseSource).toContain("browserPopupRedirectResolver");
    expect(firebaseSource).not.toContain("getAuth(");
  });

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
    expect(await screen.findByRole("region", { name: /mock-dashboard/i })).toBeInTheDocument();
  });

  it("preloads Firebase auth on login intent without starting sign-in", async () => {
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

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { default: App } = await import("../App");
    render(<App />);

    const loginButton = await screen.findByRole("button", {
      name: /google로 로그인/i
    });
    const authGateSource = readFileSync("src/components/AuthGate.tsx", "utf8");
    const dashboardSource = readFileSync("src/components/AuthenticatedDashboardApp.tsx", "utf8");
    const dashboardHeaderSource = readFileSync("src/components/DashboardHeader.tsx", "utf8");
    expect(authGateSource).toContain("onMouseEnter={() => void preloadFirebaseAuth()}");
    expect(authGateSource).toContain("onFocus={() => void preloadFirebaseAuth()}");
    expect(authGateSource).toContain("onPointerDown={() => void preloadFirebaseAuth()}");
    expect(dashboardSource).toContain("onFirebaseAuthPreload={preloadFirebaseAuth}");
    expect(dashboardHeaderSource).toContain("onMouseEnter={() => void onFirebaseAuthPreload()}");
    expect(dashboardHeaderSource).toContain("onFocus={() => void onFirebaseAuthPreload()}");
    expect(dashboardHeaderSource).toContain("onPointerDown={() => void onFirebaseAuthPreload()}");

    const { preloadFirebaseAuth } = await import("../lib/firebase-auth-loader");
    const preloadedFirebaseAuth = await preloadFirebaseAuth();

    expect(preloadedFirebaseAuth.signInWithGoogle).toBe(firebaseAuthMock.signInWithGoogle);
    expect(firebaseAuthMock.signInWithGoogle).not.toHaveBeenCalled();

    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(firebaseAuthMock.signInWithGoogle).toHaveBeenCalledTimes(1);
    });
  });
});
