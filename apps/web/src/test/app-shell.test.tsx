import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../components/AuthenticatedDashboardApp", () => ({
  default: ({
    initialUser,
    onSessionEnd
  }: {
    initialUser?: { email: string };
    onSessionEnd?: () => void;
  }) => (
    <main className="app-shell">
      <header className="app-hero">
        <div className="hero-copy">
          <h1>Bookmark</h1>
          <p className="hero-support">개인 링크 보관함</p>
        </div>
        <section className="session-card">
          <strong>{initialUser?.email}</strong>
          <button type="button" onClick={() => onSessionEnd?.()}>
            로그아웃
          </button>
        </section>
      </header>
    </main>
  )
}));

import App from "../App";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("app shell", () => {
  it("shows the bookmark home heading", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ authenticated: false }), {
        status: 401,
        headers: {
          "content-type": "application/json"
        }
      }))
    );

    render(<App />);

    expect(
      screen.getByRole("heading", { name: /bookmark/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /google로 로그인/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("region", { name: /auth-landing/i })
    ).toHaveClass("auth-landing");
    expect(screen.queryByRole("region", { name: /dashboard-workspace/i })).not.toBeInTheDocument();
  });

  it("shows the Google login button when there is no active session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ authenticated: false }), {
        status: 401,
        headers: {
          "content-type": "application/json"
        }
      }))
    );

    render(<App />);

    expect(
      await screen.findByRole("button", { name: /google로 로그인/i })
    ).toBeInTheDocument();
  });

  it("shows the signed-in user when the session exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
    }));

    render(<App />);

    expect(
      await screen.findByText(/keygenerator25@gmail.com/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /로그아웃/i })
    ).toBeInTheDocument();
  });
});
