import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const dashboardMock = vi.hoisted(() => ({
  moduleLoadCount: 0
}));

vi.mock("../components/AuthenticatedDashboardApp", () => {
  dashboardMock.moduleLoadCount += 1;

  return {
    default: () => <section aria-label="mock-dashboard">dashboard chunk</section>
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  dashboardMock.moduleLoadCount = 0;
});

describe("auth gate lazy loading", () => {
  it("does not load the authenticated dashboard chunk for anonymous sessions", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/session" && !init?.method) {
        return new Response(JSON.stringify({ authenticated: false }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    const { default: App } = await import("../App");
    render(<App />);

    expect(await screen.findByRole("button", { name: /google로 로그인/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /mock-dashboard/i })).not.toBeInTheDocument();
    expect(dashboardMock.moduleLoadCount).toBe(0);
  });

  it("loads the authenticated dashboard chunk when the session is active", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/session" && !init?.method) {
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

    const { default: App } = await import("../App");
    render(<App />);

    expect(await screen.findByRole("region", { name: /mock-dashboard/i })).toBeInTheDocument();
    expect(dashboardMock.moduleLoadCount).toBe(1);
  });
});
