import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
                tagIds: ["tag-1"],
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

      if (url === "/api/folders" && !init?.method) {
        return new Response(JSON.stringify({ folders: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/tags" && !init?.method) {
        return new Response(
          JSON.stringify({
            tags: [
              {
                id: "tag-1",
                name: "research",
                color: "#2563eb",
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
    const bookmarkFormRegion = await screen.findByRole("region", { name: /bookmark-form/i });

    expect(
      await within(bookmarkFormRegion).findByLabelText(/^URL$/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /북마크 저장/i })).toBeInTheDocument();
    expect(await screen.findByText(/manual title/i)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/example.com\/post/i)).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: /bookmark-list/i })).getByText(/research/i)
    ).toBeInTheDocument();
  });

  it("creates a bookmark with selected tags and appends it to the list", async () => {
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
        return new Response(
          JSON.stringify({
            tags: [
              {
                id: "tag-1",
                name: "research",
                color: "#2563eb",
                createdAt: "2026-04-13T08:00:00.000Z",
                updatedAt: "2026-04-13T08:00:00.000Z"
              },
              {
                id: "tag-2",
                name: "later",
                color: "#16a34a",
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
              tagIds: ["tag-1", "tag-2"],
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

      if (url === "/api/bookmarks/bookmark-2/assets" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            asset: {
              id: "asset-1",
              bookmarkId: "bookmark-2",
              assetType: "image",
              mimeType: "image/png",
              width: null,
              height: null,
              sortOrder: 0,
              contentUrl: "/api/bookmarks/bookmark-2/assets/asset-1/content",
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
    const bookmarkFormRegion = await screen.findByRole("region", { name: /bookmark-form/i });

    fireEvent.change(
      await within(bookmarkFormRegion).findByLabelText(/^URL$/i),
      {
        target: {
          value: "https://example.com/new"
        }
      }
    );
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
    fireEvent.change(screen.getByLabelText(/이미지 업로드/i), {
      target: {
        files: [new File(["fake-image-data"], "capture.png", { type: "image/png" })]
      }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /research/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /later/i }));
    fireEvent.click(screen.getByRole("button", { name: /북마크 저장/i }));

    await waitFor(() => {
      expect(screen.getByText(/created title/i)).toBeInTheDocument();
    });

    const createCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/bookmarks" &&
        init?.method === "POST"
    );

    expect(createCall).toBeDefined();
    expect(createCall?.[1]).toMatchObject({
      method: "POST"
    });
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      url: "https://example.com/new",
      userTitle: "Created title",
      userContent: "Created content",
      userSummary: "Created summary",
      tagIds: ["tag-1", "tag-2"]
    });
    const uploadCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/bookmarks/bookmark-2/assets" &&
        init?.method === "POST"
    );
    expect(uploadCall).toBeDefined();
    expect(screen.getByRole("img", { name: /업로드 이미지 1/i })).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: /bookmark-list/i })).getByText(/research/i)
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: /bookmark-list/i })).getByText(/later/i)
    ).toBeInTheDocument();
  });

  it("loads bookmark preview metadata and submits extracted source fields", async () => {
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

      if (url === "/api/bookmarks/extract" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            preview: {
              url: "https://example.com/preview",
              normalizedUrl: "https://example.com/preview",
              sourceTitle: "Preview title",
              sourceContent: "Preview body",
              sourceSummary: "Preview summary"
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

      if (url === "/api/bookmarks" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-preview",
              folderId: null,
              tagIds: [],
              url: "https://example.com/preview",
              isFavorite: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: "Preview title",
              sourceContent: "Preview body",
              sourceSummary: "Preview summary",
              userTitle: null,
              userContent: null,
              userSummary: null,
              displayTitle: "Preview title",
              displayContent: "Preview body",
              displaySummary: "Preview summary",
              createdAt: "2026-04-14T03:00:00.000Z",
              updatedAt: "2026-04-14T03:00:00.000Z"
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

    fireEvent.change(await screen.findByLabelText(/^URL$/i), {
      target: {
        value: "https://example.com/preview"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: /url 메타 불러오기/i }));

    await waitFor(() => {
      expect(screen.getByText(/preview title/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /북마크 저장/i }));

    await waitFor(() => {
      expect(screen.getByText(/https:\/\/example.com\/preview/i)).toBeInTheDocument();
    });

    const extractCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/bookmarks/extract" &&
        init?.method === "POST"
    );
    expect(extractCall).toBeDefined();
    expect(JSON.parse(String(extractCall?.[1]?.body))).toMatchObject({
      url: "https://example.com/preview"
    });

    const createCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/bookmarks" &&
        init?.method === "POST"
    );
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      url: "https://example.com/preview",
      sourceTitle: "Preview title",
      sourceContent: "Preview body",
      sourceSummary: "Preview summary"
    });
  });

  it("submits bookmark search with the selected search mode", async () => {
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

      if (url === "/api/bookmarks?mode=content&query=transformer" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-3",
                folderId: null,
                tagIds: [],
                url: "https://example.com/transformer",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Model note",
                userContent: "Transformer summary",
                userSummary: null,
                displayTitle: "Model note",
                displayContent: "Transformer summary",
                displaySummary: "",
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

    render(<App />);

    fireEvent.change(await screen.findByLabelText(/검색어/i), {
      target: {
        value: "transformer"
      }
    });
    fireEvent.change(screen.getByLabelText(/검색 모드/i), {
      target: {
        value: "content"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: /검색 실행/i }));

    await waitFor(() => {
      expect(screen.getByText(/model note/i)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?mode=content&query=transformer",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("loads a bookmark into edit mode and patches the updated values", async () => {
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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-1",
                folderId: "folder-1",
                tagIds: ["tag-1"],
                url: "https://example.com/post",
                isFavorite: true,
                bookmarkColor: "#f59e0b",
                urlColor: "#0f172a",
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Before title",
                userContent: "Before content",
                userSummary: "Before summary",
                displayTitle: "Before title",
                displayContent: "Before content",
                displaySummary: "Before summary",
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
                createdAt: "2026-04-13T08:00:00.000Z",
                updatedAt: "2026-04-13T08:00:00.000Z"
              },
              {
                id: "tag-2",
                name: "later",
                color: "#16a34a",
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

      if (url === "/api/bookmarks/bookmark-1" && init?.method === "PATCH") {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-1",
              folderId: "folder-1",
              tagIds: ["tag-2"],
              url: "https://example.com/post",
              isFavorite: false,
              bookmarkColor: "#dc2626",
              urlColor: "#1d4ed8",
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "After title",
              userContent: "After content",
              userSummary: "After summary",
              displayTitle: "After title",
              displayContent: "After content",
              displaySummary: "After summary",
              createdAt: "2026-04-13T08:00:00.000Z",
              updatedAt: "2026-04-13T09:00:00.000Z"
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

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /수정/i }));

    expect(screen.getByRole("button", { name: /북마크 수정/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Before title")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Before content")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Before summary")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/제목/i), {
      target: {
        value: "After title"
      }
    });
    fireEvent.change(screen.getByLabelText(/내용/i), {
      target: {
        value: "After content"
      }
    });
    fireEvent.change(screen.getByLabelText(/요약/i), {
      target: {
        value: "After summary"
      }
    });
    fireEvent.change(screen.getByLabelText(/북마크 색상/i), {
      target: {
        value: "#dc2626"
      }
    });
    fireEvent.change(screen.getByLabelText(/url 색상/i), {
      target: {
        value: "#1d4ed8"
      }
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /즐겨찾기/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /research/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /later/i }));
    fireEvent.click(screen.getByRole("button", { name: /북마크 수정/i }));

    await waitFor(() => {
      expect(screen.getByText(/after title/i)).toBeInTheDocument();
    });

    const patchCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/bookmarks/bookmark-1" &&
        init?.method === "PATCH"
    );

    expect(patchCall).toBeDefined();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      folderId: "folder-1",
      tagIds: ["tag-2"],
      userTitle: "After title",
      userContent: "After content",
      userSummary: "After summary",
      isFavorite: false,
      bookmarkColor: "#dc2626",
      urlColor: "#1d4ed8"
    });
  });

  it("deletes an uploaded asset while editing a bookmark", async () => {
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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-asset-delete",
                folderId: null,
                tagIds: [],
                url: "https://example.com/delete",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Delete asset title",
                userContent: null,
                userSummary: null,
                displayTitle: "Delete asset title",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
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

      if (url === "/api/bookmarks/bookmark-asset-delete/assets" && !init?.method) {
        return new Response(
          JSON.stringify({
            assets: [
              {
                id: "asset-delete-1",
                bookmarkId: "bookmark-asset-delete",
                assetType: "image",
                mimeType: "image/png",
                width: null,
                height: null,
                sortOrder: 0,
                contentUrl: "/api/bookmarks/bookmark-asset-delete/assets/asset-delete-1/content",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
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

      if (
        url === "/api/bookmarks/bookmark-asset-delete/assets/asset-delete-1" &&
        init?.method === "DELETE"
      ) {
        return new Response(null, {
          status: 204
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /수정/i }));
    const bookmarkFormRegion = await screen.findByRole("region", {
      name: /bookmark-form/i
    });

    await waitFor(() => {
      expect(
        within(bookmarkFormRegion).getByRole("img", { name: /업로드 이미지 1/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      within(bookmarkFormRegion).getByRole("button", { name: /이미지 삭제 1/i })
    );

    await waitFor(() => {
      expect(
        within(bookmarkFormRegion).queryByRole("img", { name: /업로드 이미지 1/i })
      ).not.toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks/bookmark-asset-delete/assets/asset-delete-1",
      expect.objectContaining({
        method: "DELETE",
        credentials: "include"
      })
    );
  });
});
