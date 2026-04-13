import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("folder and tag dashboard", () => {
  it("shows existing folders and tags for an authenticated user", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
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

      if (url === "/api/folders" && !init?.method) {
        return new Response(
          JSON.stringify({
            folders: [
              {
                id: "folder-1",
                name: "Reading",
                color: "#f97316",
                icon: "book-open",
                parentFolderId: null,
                sortOrder: 0,
                createdAt: "2026-04-13T10:00:00.000Z",
                updatedAt: "2026-04-13T10:00:00.000Z"
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

      if (url === "/api/tags" && !init?.method) {
        return new Response(
          JSON.stringify({
            tags: [
              {
                id: "tag-1",
                name: "research",
                color: "#2563eb",
                createdAt: "2026-04-13T10:00:00.000Z",
                updatedAt: "2026-04-13T10:00:00.000Z"
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

    expect(await screen.findByLabelText(/저장 폴더/i)).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: /reading/i })).toBeInTheDocument();
    expect(await screen.findByText(/research/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/폴더 이름/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/태그 이름/i)).toBeInTheDocument();
  });

  it("creates a folder and appends it to the folder list and picker", async () => {
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

      if (url === "/api/folders" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            folder: {
              id: "folder-2",
              name: "Articles",
              color: "#0f766e",
              icon: "newspaper",
              parentFolderId: null,
              sortOrder: 0,
              createdAt: "2026-04-13T10:00:00.000Z",
              updatedAt: "2026-04-13T10:00:00.000Z"
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

    fireEvent.change(await screen.findByLabelText(/폴더 이름/i), {
      target: {
        value: "Articles"
      }
    });
    fireEvent.change(screen.getByLabelText(/폴더 색상/i), {
      target: {
        value: "#0f766e"
      }
    });
    fireEvent.change(screen.getByLabelText(/폴더 아이콘/i), {
      target: {
        value: "newspaper"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: /폴더 추가/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/articles/i).length).toBeGreaterThan(0);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/folders",
      expect.objectContaining({
        method: "POST"
      })
    );
  });
});
