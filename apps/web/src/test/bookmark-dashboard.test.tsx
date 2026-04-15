import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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
    const sidebar = await screen.findByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    const mainPanel = await screen.findByRole("region", { name: /dashboard-main/i });
    const bookmarkFormRegion = within(sidebar).getByRole("region", {
      name: /bookmark-form/i
    });
    expect(within(sidebar).getByRole("region", { name: /folder-manager/i })).toBeInTheDocument();
    expect(within(sidebar).getByRole("region", { name: /tag-manager/i })).toBeInTheDocument();
    const searchPanel = within(mainPanel).getByRole("region", { name: /search-panel/i });

    expect(
      await within(bookmarkFormRegion).findByLabelText(/^URL$/i)
    ).toBeInTheDocument();
    expect(within(searchPanel).getByText(/^기본 검색$/i)).toBeInTheDocument();
    expect(within(searchPanel).getByRole("button", { name: /검색 실행/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /북마크 저장/i })).toBeInTheDocument();
    const bookmarkListRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-list/i
    });
    expect(await within(bookmarkListRegion).findByText(/^Manual title$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^https:\/\/example\.com\/post$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getAllByText(/^research$/i).length).toBeGreaterThan(0);
    expect(within(bookmarkListRegion).getByText(/^수동 요약$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^태그 1개$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/북마크 색상 #f59e0b/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/url 색상 #0f172a/i)).toBeInTheDocument();
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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
    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/제목/i), {
      target: {
        value: "Created title"
      }
    });
    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/내용/i), {
      target: {
        value: "Created content"
      }
    });
    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/^요약$/i), {
      target: {
        value: "Created summary"
      }
    });
    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/이미지 업로드/i), {
      target: {
        files: [new File(["fake-image-data"], "capture.png", { type: "image/png" })]
      }
    });
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /research/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /later/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /북마크 저장/i }));

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Created title$/i)).toBeInTheDocument();
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
    expect(within(bookmarkListRegion).getByRole("img", { name: /업로드 이미지 1/i })).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^research$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^later$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^이미지 1장$/i)).toBeInTheDocument();
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Model note$/i)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?mode=content&query=transformer",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("submits bookmark search with favorite, folder, and multiple tag filters and resets them", async () => {
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

      if (
        url ===
          "/api/bookmarks?mode=all&tagMode=or&query=paper&favorite=1&folderId=folder-1&tagId=tag-1&tagId=tag-2" &&
        !init?.method
      ) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-filtered",
                folderId: "folder-1",
                tagIds: ["tag-1", "tag-2"],
                url: "https://example.com/paper",
                isFavorite: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Filtered paper",
                userContent: "Research paper note",
                userSummary: "",
                displayTitle: "Filtered paper",
                displayContent: "Research paper note",
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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
                name: "video",
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

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    const searchPanel = screen.getByRole("region", { name: /search-panel/i });

    fireEvent.change(await within(searchPanel).findByLabelText(/검색어/i), {
      target: {
        value: "paper"
      }
    });
    fireEvent.click(within(searchPanel).getByRole("button", { name: /고급 필터 열기/i }));
    fireEvent.click(within(searchPanel).getByLabelText(/즐겨찾기만/i));
    fireEvent.change(within(searchPanel).getByLabelText(/필터 폴더/i), {
      target: {
        value: "folder-1"
      }
    });
    fireEvent.change(within(searchPanel).getByLabelText(/태그 조건/i), {
      target: {
        value: "or"
      }
    });
    fireEvent.click(within(searchPanel).getByRole("checkbox", { name: /^research$/i }));
    fireEvent.click(within(searchPanel).getByRole("checkbox", { name: /^video$/i }));
    fireEvent.click(within(searchPanel).getByRole("button", { name: /검색 실행/i }));
    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Filtered paper$/i)).toBeInTheDocument();
    });
    expect(within(searchPanel).getByText(/선택된 필터 6개/i)).toBeInTheDocument();
    expect(
      within(searchPanel).getByRole("button", {
        name: /검색 조건 제거: 검색어 - paper/i
      })
    ).toHaveTextContent("검색어");
    expect(
      within(searchPanel).getByRole("button", {
        name: /검색 조건 제거: 분류 - 태그 research/i
      })
    ).toHaveTextContent("분류");
    expect(
      within(searchPanel).getByRole("button", {
        name: /검색 조건 제거: 분류 - 태그 video/i
      })
    ).toHaveTextContent("분류");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?mode=all&tagMode=or&query=paper&favorite=1&folderId=folder-1&tagId=tag-1&tagId=tag-2",
      expect.objectContaining({
        credentials: "include"
      })
    );

    fireEvent.click(within(searchPanel).getByRole("button", { name: /검색 초기화/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/bookmarks",
        expect.objectContaining({
          credentials: "include"
        })
      );
    });

    await waitFor(() => {
      expect(within(searchPanel).getByLabelText(/검색어/i)).toHaveValue("");
      expect(within(searchPanel).getByLabelText(/즐겨찾기만/i)).not.toBeChecked();
      expect(within(searchPanel).getByLabelText(/필터 폴더/i)).toHaveValue("");
      expect(within(searchPanel).getByLabelText(/태그 조건/i)).toHaveValue("and");
      expect(within(searchPanel).getByRole("checkbox", { name: /^research$/i })).not.toBeChecked();
      expect(within(searchPanel).getByRole("checkbox", { name: /^video$/i })).not.toBeChecked();
    });
  });

  it("removes an applied search filter chip and reloads bookmarks", async () => {
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

      if (url === "/api/bookmarks?mode=all&query=paper&favorite=1" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-filtered",
                folderId: null,
                tagIds: [],
                url: "https://example.com/paper-favorite",
                isFavorite: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Filtered favorite",
                userContent: null,
                userSummary: null,
                displayTitle: "Filtered favorite",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T01:00:00.000Z",
                updatedAt: "2026-04-14T01:00:00.000Z"
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

      if (url === "/api/bookmarks?mode=all&query=paper" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-unfiltered",
                folderId: null,
                tagIds: [],
                url: "https://example.com/paper",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Filter removed",
                userContent: null,
                userSummary: null,
                displayTitle: "Filter removed",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T02:00:00.000Z",
                updatedAt: "2026-04-14T02:00:00.000Z"
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    const searchPanel = screen.getByRole("region", { name: /search-panel/i });

    fireEvent.change(await within(searchPanel).findByLabelText(/검색어/i), {
      target: {
        value: "paper"
      }
    });
    fireEvent.click(within(searchPanel).getByRole("button", { name: /고급 필터/i }));
    fireEvent.click(within(searchPanel).getByLabelText(/즐겨찾기만/i));
    fireEvent.click(within(searchPanel).getByRole("button", { name: /검색 실행/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Filtered favorite$/i)).toBeInTheDocument();
    });

    fireEvent.click(
      within(searchPanel).getByRole("button", {
        name: /검색 조건 제거: 상태 - 즐겨찾기만/i
      })
    );

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Filter removed$/i)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?mode=all&query=paper&favorite=1",
      expect.objectContaining({
        credentials: "include"
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?mode=all&query=paper",
      expect.objectContaining({
        credentials: "include"
      })
    );
    expect(
      within(searchPanel).queryByRole("button", {
        name: /검색 조건 제거: 상태 - 즐겨찾기만/i
      })
    ).not.toBeInTheDocument();
  });

  it("includes descendant folders in bookmark search when requested", async () => {
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

      if (
        url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1" &&
        !init?.method
      ) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-child",
                folderId: "folder-2",
                tagIds: [],
                url: "https://example.com/child-folder",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Child folder result",
                userContent: "",
                userSummary: "",
                displayTitle: "Child folder result",
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
              },
              {
                id: "folder-2",
                name: "Papers",
                color: "#0f766e",
                icon: "file-text",
                parentFolderId: "folder-1",
                sortOrder: 1,
                createdAt: "2026-04-13T11:00:00.000Z",
                updatedAt: "2026-04-13T11:00:00.000Z"
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    const searchPanel = screen.getByRole("region", { name: /search-panel/i });

    fireEvent.click(within(searchPanel).getByRole("button", { name: /고급 필터/i }));
    fireEvent.change(within(searchPanel).getByLabelText(/필터 폴더/i), {
      target: {
        value: "folder-1"
      }
    });
    fireEvent.click(within(searchPanel).getByLabelText(/하위 폴더 포함/i));
    fireEvent.click(within(searchPanel).getByRole("button", { name: /검색 실행/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Child folder result$/i)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("toggles the advanced filter section", async () => {
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
        return new Response(JSON.stringify({ folders: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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

    const searchPanel = await screen.findByRole("region", { name: /search-panel/i });

    expect(within(searchPanel).queryByLabelText(/즐겨찾기만/i)).not.toBeInTheDocument();

    expect(
      within(searchPanel).getByRole("button", { name: /고급 필터 열기/i })
    ).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(within(searchPanel).getByRole("button", { name: /고급 필터 열기/i }));

    expect(within(searchPanel).getByLabelText(/즐겨찾기만/i)).toBeInTheDocument();
    expect(within(searchPanel).getByLabelText(/태그 조건/i)).toBeInTheDocument();
    expect(within(searchPanel).getByRole("button", { name: /고급 필터 접기/i })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(within(searchPanel).getByText(/^기간$/i)).toBeInTheDocument();
    expect(within(searchPanel).getByText(/^분류$/i)).toBeInTheDocument();
    expect(within(searchPanel).getByText(/^상태$/i)).toBeInTheDocument();
  });

  it("starts with a collapsed search panel on mobile and opens it on demand", async () => {
    vi.stubGlobal(
      "innerWidth",
      640
    );
    window.dispatchEvent(new Event("resize"));

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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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

    const searchPanel = await screen.findByRole("region", { name: /search-panel/i });

    expect(within(searchPanel).queryByLabelText(/검색어/i)).not.toBeInTheDocument();
    expect(within(searchPanel).getByRole("button", { name: /검색\/필터 열기/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    fireEvent.click(within(searchPanel).getByRole("button", { name: /검색\/필터 열기/i }));

    expect(await within(searchPanel).findByLabelText(/검색어/i)).toBeInTheDocument();
    expect(
      within(searchPanel).getByRole("button", { name: /검색\/필터 닫기/i })
    ).toHaveAttribute("aria-expanded", "true");

    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.stubGlobal("innerWidth", 1024);
    window.dispatchEvent(new Event("resize"));
  });

  it("renders compact bookmark cards on mobile", async () => {
    vi.stubGlobal("innerWidth", 640);
    window.dispatchEvent(new Event("resize"));

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
                id: "bookmark-mobile-1",
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    const firstCard = within(bookmarkListRegion).getAllByRole("listitem")[0];

    expect(within(firstCard).getByText(/^태그 1개$/i)).toBeInTheDocument();
    expect(within(firstCard).getByText(/^색상 설정됨$/i)).toBeInTheDocument();
    expect(within(firstCard).queryByText(/^research$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/북마크 색상 #f59e0b/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/url 색상 #0f172a/i)).not.toBeInTheDocument();
    expect(
      within(firstCard)
        .getAllByRole("button")
        .map((button) => button.textContent?.trim())
    ).toEqual(["열기 Manual title", "상세 보기", "수정", "삭제"]);
  });

  it("submits bookmark search with color and summary filters and resets them", async () => {
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

      if (
        url ===
          "/api/bookmarks?mode=all&query=paper&bookmarkColor=%23ffaa00&urlColor=%23112233&summaryState=with" &&
        !init?.method
      ) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-colored",
                folderId: null,
                tagIds: [],
                url: "https://example.com/highlighted",
                isFavorite: false,
                bookmarkColor: "#FFAA00",
                urlColor: "#112233",
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Highlighted paper",
                userContent: "Color matched note",
                userSummary: "Summary exists",
                displayTitle: "Highlighted paper",
                displayContent: "Color matched note",
                displaySummary: "Summary exists",
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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
        value: "paper"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: /고급 필터/i }));
    fireEvent.change(screen.getByLabelText(/북마크 색상 필터/i), {
      target: {
        value: "#ffaa00"
      }
    });
    fireEvent.change(screen.getByLabelText(/url 색상 필터/i), {
      target: {
        value: "#112233"
      }
    });
    fireEvent.change(screen.getByLabelText(/요약 필터/i), {
      target: {
        value: "with"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: /검색 실행/i }));

    const bookmarkListRegion = screen.getByRole("region", { name: /bookmark-list/i });
    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Highlighted paper$/i)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?mode=all&query=paper&bookmarkColor=%23ffaa00&urlColor=%23112233&summaryState=with",
      expect.objectContaining({
        credentials: "include"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /검색 초기화/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/북마크 색상 필터/i)).toHaveValue("");
      expect(screen.getByLabelText(/url 색상 필터/i)).toHaveValue("");
      expect(screen.getByLabelText(/요약 필터/i)).toHaveValue("all");
    });
  });

  it("submits bookmark search with opened sort and resets it", async () => {
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

      if (url === "/api/bookmarks?sort=opened_desc" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-recent-open",
                folderId: null,
                tagIds: [],
                url: "https://example.com/opened",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Recently opened",
                userContent: null,
                userSummary: null,
                displayTitle: "Recently opened",
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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

    fireEvent.change(await screen.findByLabelText(/정렬/i), {
      target: {
        value: "opened_desc"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: /검색 실행/i }));

    const bookmarkListRegion = screen.getByRole("region", { name: /bookmark-list/i });
    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Recently opened$/i)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?sort=opened_desc",
      expect.objectContaining({
        credentials: "include"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /검색 초기화/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/정렬/i)).toHaveValue("created_desc");
    });
  });

  it("submits bookmark search with created and opened date filters and resets them", async () => {
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

      if (url === "/api/bookmarks?createdWithin=7d&openedWithin=30d" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-period-filtered",
                folderId: null,
                tagIds: [],
                url: "https://example.com/period-filtered",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Period filtered",
                userContent: "Recent bookmark",
                userSummary: "",
                displayTitle: "Period filtered",
                displayContent: "Recent bookmark",
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    const searchPanel = screen.getByRole("region", { name: /search-panel/i });

    fireEvent.click(within(searchPanel).getByRole("button", { name: /고급 필터/i }));
    fireEvent.change(await within(searchPanel).findByLabelText(/최근 추가/i), {
      target: {
        value: "7d"
      }
    });
    fireEvent.change(within(searchPanel).getByLabelText(/최근 열람/i), {
      target: {
        value: "30d"
      }
    });
    fireEvent.click(within(searchPanel).getByRole("button", { name: /검색 실행/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Period filtered$/i)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?createdWithin=7d&openedWithin=30d",
      expect.objectContaining({
        credentials: "include"
      })
    );

    fireEvent.click(within(searchPanel).getByRole("button", { name: /검색 초기화/i }));

    await waitFor(() => {
      expect(within(searchPanel).getByLabelText(/최근 추가/i)).toHaveValue("all");
      expect(within(searchPanel).getByLabelText(/최근 열람/i)).toHaveValue("all");
    });
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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
    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });

    fireEvent.click(
      await within(bookmarkListRegion).findByRole("button", { name: /^수정$/i })
    );

    const bookmarkFormRegion = await screen.findByRole("region", {
      name: /bookmark-form/i
    });

    expect(within(bookmarkFormRegion).getByRole("button", { name: /북마크 수정/i })).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Before title")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Before content")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Before summary")).toBeInTheDocument();

    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/제목/i), {
      target: {
        value: "After title"
      }
    });
    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/내용/i), {
      target: {
        value: "After content"
      }
    });
    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/요약/i), {
      target: {
        value: "After summary"
      }
    });
    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/북마크 색상/i), {
      target: {
        value: "#dc2626"
      }
    });
    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/url 색상/i), {
      target: {
        value: "#1d4ed8"
      }
    });
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /^즐겨찾기$/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /research/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /later/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /북마크 수정/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^After title$/i)).toBeInTheDocument();
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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
    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });

    fireEvent.click(
      await within(bookmarkListRegion).findByRole("button", { name: /^수정$/i })
    );
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

  it("shows recommendation sections and records opens from the dashboard", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
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
                id: "bookmark-list-open",
                folderId: null,
                tagIds: [],
                url: "https://example.com/list-open",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "List open link",
                userContent: null,
                userSummary: null,
                displayTitle: "List open link",
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [
              {
                id: "bookmark-favorite",
                folderId: null,
                tagIds: [],
                url: "https://example.com/favorite",
                isFavorite: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Favorite recommendation",
                userContent: null,
                userSummary: null,
                displayTitle: "Favorite recommendation",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              }
            ],
            recent: [
              {
                id: "bookmark-recent",
                folderId: null,
                tagIds: [],
                url: "https://example.com/recent",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Recent recommendation",
                userContent: null,
                userSummary: null,
                displayTitle: "Recent recommendation",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              }
            ],
            frequent: [
              {
                id: "bookmark-frequent",
                folderId: null,
                tagIds: [],
                url: "https://example.com/frequent",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Frequent recommendation",
                userContent: null,
                userSummary: null,
                displayTitle: "Frequent recommendation",
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

      if (url === "/api/bookmarks/bookmark-favorite/open" && init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const recommendationRegion = await screen.findByRole("region", {
      name: /recommendation-list/i
    });

    expect(
      await within(recommendationRegion).findByText(/^Favorite recommendation$/i)
    ).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^Recent recommendation$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^Frequent recommendation$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^즐겨찾기 기반$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^최근 열람 기반$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^반복 열람 기반$/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /열기 favorite recommendation/i }));

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        "https://example.com/favorite",
        "_blank",
        "noopener,noreferrer"
      );
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks/bookmark-favorite/open",
      expect.objectContaining({
        method: "POST",
        credentials: "include"
      })
    );
  });

  it("opens a bookmark detail panel and starts editing from the detail view", async () => {
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
                id: "bookmark-detail",
                folderId: "folder-1",
                tagIds: ["tag-1"],
                url: "https://example.com/detail",
                isFavorite: true,
                bookmarkColor: "#f59e0b",
                urlColor: "#0f172a",
                sourceTitle: "Source title",
                sourceContent: "Source content",
                sourceSummary: "Source summary",
                userTitle: "Detail title",
                userContent: "Detail manual content",
                userSummary: "Detail manual summary",
                displayTitle: "Detail title",
                displayContent: "Detail manual content",
                displaySummary: "Detail manual summary",
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

      if (url === "/api/bookmarks/bookmark-detail" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-detail",
              folderId: "folder-1",
              tagIds: ["tag-1"],
              url: "https://example.com/detail",
              isFavorite: true,
              bookmarkColor: "#f59e0b",
              urlColor: "#0f172a",
              sourceTitle: "Source title",
              sourceContent: "Source content",
              sourceSummary: "Source summary",
              userTitle: "Detail title",
              userContent: "Detail manual content",
              userSummary: "Detail manual summary",
              displayTitle: "Detail title",
              displayContent: "Detail manual content",
              displaySummary: "Detail manual summary",
              createdAt: "2026-04-14T03:00:00.000Z",
              updatedAt: "2026-04-14T03:00:00.000Z"
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

      if (url === "/api/bookmarks/bookmark-detail/assets" && !init?.method) {
        return new Response(
          JSON.stringify({
            assets: [
              {
                id: "asset-detail-1",
                bookmarkId: "bookmark-detail",
                assetType: "image",
                mimeType: "image/png",
                width: null,
                height: null,
                sortOrder: 0,
                contentUrl: "/api/bookmarks/bookmark-detail/assets/asset-detail-1/content",
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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

    fireEvent.click(await screen.findByRole("button", { name: /상세 보기/i }));

    const detailRegion = await screen.findByRole("region", { name: /bookmark-detail/i });
    expect(
      within(detailRegion).getByText(/^Detail title$/i, { selector: "strong" })
    ).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^https:\/\/example\.com\/detail$/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/Detail manual content/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/Detail manual summary/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/Source title/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/Source content/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/Source summary/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/폴더:\s*Reading/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/태그:\s*research/i)).toBeInTheDocument();
    expect(
      within(detailRegion).getByRole("img", { name: /업로드 이미지 1/i })
    ).toBeInTheDocument();

    expect(
      within(detailRegion)
        .getAllByRole("button")
        .map((button) => button.textContent?.trim())
    ).toEqual([
      "열기 Detail title",
      "수정 시작",
      "자동 추출 다시 시도",
      "사용자 입력 초기화",
      "닫기",
      "삭제"
    ]);

    fireEvent.click(within(detailRegion).getByRole("button", { name: /수정 시작/i }));

    expect(screen.getByRole("button", { name: /북마크 수정/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Detail title")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Detail manual content")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Detail manual summary")).toBeInTheDocument();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks/bookmark-detail",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("reextracts source values and resets manual values from the detail panel", async () => {
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
                id: "bookmark-reset",
                folderId: null,
                tagIds: [],
                url: "https://example.com/reset",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: "Old source title",
                sourceContent: "Old source content",
                sourceSummary: "Old source summary",
                userTitle: "Manual reset title",
                userContent: "Manual reset content",
                userSummary: "Manual reset summary",
                displayTitle: "Manual reset title",
                displayContent: "Manual reset content",
                displaySummary: "Manual reset summary",
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

      if (url === "/api/bookmarks/bookmark-reset" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-reset",
              folderId: null,
              tagIds: [],
              url: "https://example.com/reset",
              isFavorite: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: "Old source title",
              sourceContent: "Old source content",
              sourceSummary: "Old source summary",
              userTitle: "Manual reset title",
              userContent: "Manual reset content",
              userSummary: "Manual reset summary",
              displayTitle: "Manual reset title",
              displayContent: "Manual reset content",
              displaySummary: "Manual reset summary",
              createdAt: "2026-04-14T03:00:00.000Z",
              updatedAt: "2026-04-14T03:00:00.000Z"
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

      if (url === "/api/bookmarks/bookmark-reset/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks/bookmark-reset/reextract" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-reset",
              folderId: null,
              tagIds: [],
              url: "https://example.com/reset",
              isFavorite: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: "Retried source title",
              sourceContent: "Retried source content",
              sourceSummary: "Retried source summary",
              userTitle: "Manual reset title",
              userContent: "Manual reset content",
              userSummary: "Manual reset summary",
              displayTitle: "Manual reset title",
              displayContent: "Manual reset content",
              displaySummary: "Manual reset summary",
              createdAt: "2026-04-14T03:00:00.000Z",
              updatedAt: "2026-04-14T04:00:00.000Z"
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

      if (url === "/api/bookmarks/bookmark-reset" && init?.method === "PATCH") {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-reset",
              folderId: null,
              tagIds: [],
              url: "https://example.com/reset",
              isFavorite: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: "Retried source title",
              sourceContent: "Retried source content",
              sourceSummary: "Retried source summary",
              userTitle: null,
              userContent: null,
              userSummary: null,
              displayTitle: "Retried source title",
              displayContent: "Retried source content",
              displaySummary: "Retried source summary",
              createdAt: "2026-04-14T03:00:00.000Z",
              updatedAt: "2026-04-14T05:00:00.000Z"
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [],
            recent: [],
            frequent: []
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

    fireEvent.click(await screen.findByRole("button", { name: /상세 보기/i }));

    const detailRegion = await screen.findByRole("region", { name: /bookmark-detail/i });
    fireEvent.click(
      within(detailRegion).getByRole("button", { name: /자동 추출 다시 시도/i })
    );

    await waitFor(() => {
      expect(within(detailRegion).getByText(/Retried source title/i)).toBeInTheDocument();
    });

    fireEvent.click(
      within(detailRegion).getByRole("button", { name: /사용자 입력 초기화/i })
    );

    await waitFor(() => {
      expect(
        within(detailRegion).getByText(/사용자 입력값이 없습니다\./i)
      ).toBeInTheDocument();
    });

    expect(
      within(detailRegion).getByText(/^Retried source title$/i, { selector: "strong" })
    ).toBeInTheDocument();
    fireEvent.click(within(detailRegion).getByRole("button", { name: /^닫기$/i }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /bookmark-detail/i })).not.toBeInTheDocument();
    });

    const bookmarkListRegion = screen.getByRole("region", { name: /bookmark-list/i });
    expect(
      within(bookmarkListRegion).getByText(/^Retried source title$/i, { selector: "strong" })
    ).toBeInTheDocument();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks/bookmark-reset/reextract",
      expect.objectContaining({
        method: "POST",
        credentials: "include"
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks/bookmark-reset",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include"
      })
    );
  });

  it("deletes a bookmark from the detail panel and removes it from the dashboard", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
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
                id: "bookmark-delete",
                folderId: null,
                tagIds: [],
                url: "https://example.com/delete-bookmark",
                isFavorite: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Delete me",
                userContent: null,
                userSummary: null,
                displayTitle: "Delete me",
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

      if (url === "/api/bookmarks/bookmark-delete" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-delete",
              folderId: null,
              tagIds: [],
              url: "https://example.com/delete-bookmark",
              isFavorite: true,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Delete me",
              userContent: null,
              userSummary: null,
              displayTitle: "Delete me",
              displayContent: "",
              displaySummary: "",
              createdAt: "2026-04-14T03:00:00.000Z",
              updatedAt: "2026-04-14T03:00:00.000Z"
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

      if (url === "/api/bookmarks/bookmark-delete/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks/bookmark-delete" && init?.method === "DELETE") {
        return new Response(null, { status: 204 });
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [
              {
                id: "bookmark-delete",
                folderId: null,
                tagIds: [],
                url: "https://example.com/delete-bookmark",
                isFavorite: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Delete me",
                userContent: null,
                userSummary: null,
                displayTitle: "Delete me",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              }
            ],
            recent: [],
            frequent: []
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

    fireEvent.click(await screen.findByRole("button", { name: /상세 보기/i }));

    const detailRegion = await screen.findByRole("region", { name: /bookmark-detail/i });
    fireEvent.click(within(detailRegion).getByRole("button", { name: /삭제/i }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /bookmark-detail/i })).not.toBeInTheDocument();
    });

    const bookmarkListRegion = screen.getByRole("region", { name: /bookmark-list/i });
    expect(within(bookmarkListRegion).queryByText(/^Delete me$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/아직 저장된 북마크가 없습니다\./i)).toBeInTheDocument();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks/bookmark-delete",
      expect.objectContaining({
        method: "DELETE",
        credentials: "include"
      })
    );
  });
});
