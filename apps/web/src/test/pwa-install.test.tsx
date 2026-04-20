import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("pwa install", () => {
  it("shows an install action after the browser fires beforeinstallprompt", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "/api/auth/session" && !init?.method) {
        return new Response(
          JSON.stringify({
            authenticated: false
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    const promptSpy = vi.fn().mockResolvedValue(undefined);
    render(<App />);

    await screen.findByRole("button", { name: /google로 로그인/i });

    const installEvent = Object.assign(new Event("beforeinstallprompt"), {
      prompt: promptSpy,
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" })
    });

    globalThis.dispatchEvent(installEvent);

    const installButton = await screen.findByRole("button", { name: /앱 설치/i });
    fireEvent.click(installButton);

    await waitFor(() => {
      expect(promptSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("opens manual install guidance when an install prompt is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "/api/auth/session" && !init?.method) {
        return new Response(
          JSON.stringify({
            authenticated: false
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    const installButton = await screen.findByRole("button", { name: /앱 설치/i });
    fireEvent.click(installButton);

    const dialog = await screen.findByRole("dialog", { name: /install-help-dialog/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/iPhone \/ iPad Safari/i)).toBeInTheDocument();
    expect(within(dialog).getAllByText(/홈 화면에 추가/i).length).toBeGreaterThan(0);
  });
});
