import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("bookmark dashboard", () => {
  it("shows the bookmark form and stored bookmarks for an authenticated user", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.url;

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

      if (url === "/api/bookmarks" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-1",
                folderId: null,
                url: "https://example.com/post",
                isFavorite: true,
                bookmarkColor: "#f59e0b",
                urlColor: "#0f172a",
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Manual title",
                userContent: "Manual content",
                userSummary: "Manual summary",
                displayTitle: "Manual title",
                displayContent: "Manual content",
                displaySummary: "Manual summary",
                createdAt: "2026-04-13T08:00:00.000Z",
                updatedAt: "2026-04-13T08:00:00.000Z"
              }
            ]
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

    render(<App />);

    expect(await screen.findByLabelText(/url/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /북마크 저장/i })).toBeInTheDocument();
    expect(await screen.findByText(/manual title/i)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/example.com\/post/i)).toBeInTheDocument();
  });

  it("creates a bookmark and appends it to the list", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "/api/auth/session" && !init?.method) {
        return new Response(
          JSON.stringify({
            authenticated: true,
            user: {
              uid: "firebase-user-1",
              email: "keygenerator25@gmail.com"
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

      if (url === "/api/bookmarks" && !init?.method) {
        return new Response(JSON.stringify({ bookmarks: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-2",
              folderId: null,
              url: "https://example.com/new",
              isFavorite: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Created title",
              userContent: "Created content",
              userSummary: "Created summary",
              displayTitle: "Created title",
              displayContent: "Created content",
              displaySummary: "Created summary",
              createdAt: "2026-04-13T08:00:00.000Z",
              updatedAt: "2026-04-13T08:00:00.000Z"
            }
          }),
          {
            status: 201,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    fireEvent.change(await screen.findByLabelText(/url/i), {
      target: {
        value: "https://example.com/new"
      }
    });
    fireEvent.change(screen.getByLabelText(/제목/i), {
      target: {
        value: "Created title"
      }
    });
    fireEvent.change(screen.getByLabelText(/내용/i), {
      target: {
        value: "Created content"
      }
    });
    fireEvent.change(screen.getByLabelText(/요약/i), {
      target: {
        value: "Created summary"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: /북마크 저장/i }));

    await waitFor(() => {
      expect(screen.getByText(/created title/i)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks",
      expect.objectContaining({
        method: "POST"
      })
    );
  });
});
