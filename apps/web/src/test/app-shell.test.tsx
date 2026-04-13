import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("app shell", () => {
  it("shows the bookmark home heading", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), {
        status: 401,
        headers: {
          "content-type": "application/json"
        }
      })
    );

    render(<App />);

    expect(
      screen.getByRole("heading", { name: /bookmark/i })
    ).toBeInTheDocument();
  });

  it("shows the Google login button when there is no active session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), {
        status: 401,
        headers: {
          "content-type": "application/json"
        }
      })
    );

    render(<App />);

    expect(
      await screen.findByRole("button", { name: /google로 로그인/i })
    ).toBeInTheDocument();
  });

  it("shows the signed-in user when the session exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
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
      )
    );

    render(<App />);

    expect(
      await screen.findByText(/keygenerator25@gmail.com/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /로그아웃/i })
    ).toBeInTheDocument();
  });
});
