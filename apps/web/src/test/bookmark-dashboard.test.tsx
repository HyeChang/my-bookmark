import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  globalThis.localStorage?.clear();
});

function openBookmarkActionMenu(bookmarkListRegion: HTMLElement, bookmarkName: string) {
  fireEvent.click(
    within(bookmarkListRegion).getByRole("button", {
      name: new RegExp(`${bookmarkName} 북마크 더보기`, "i")
    })
  );
}

function openBookmarkDetailActionMenu(detailRegion: HTMLElement) {
  fireEvent.click(
    within(detailRegion).getByRole("button", {
      name: /상세 작업 더보기/i
    })
  );
}

function openFolderOverviewActionMenu(folderOverview: HTMLElement, folderName: string) {
  fireEvent.click(
    within(folderOverview).getByRole("button", {
      name: new RegExp(`${folderName} 폴더 더보기`, "i")
    })
  );
}

function chooseColorOption(container: HTMLElement, label: string, optionLabel: string) {
  fireEvent.click(
    within(container).getByRole("button", {
      name: new RegExp(`^${label}$`, "i")
    })
  );
  fireEvent.click(
    within(container).getByRole("button", {
      name: new RegExp(`${label} ${optionLabel} 선택`, "i")
    })
  );
}

function stubDashboardViewport(width: number) {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("max-width: 720px") ? width <= 720 : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
  window.dispatchEvent(new Event("resize"));
}

describe("bookmark dashboard", () => {
  it("shows polished loading placeholders instead of empty recommendation states while dashboard data loads", async () => {
    const pendingDashboardResponse = new Promise<Response>(() => undefined);

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

      if (
        (url === "/api/bookmarks" ||
          url === "/api/folders" ||
          url === "/api/tags" ||
          url === "/api/recommendations") &&
        !init?.method
      ) {
        return pendingDashboardResponse;
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const recommendationRegion = await screen.findByRole("region", {
      name: /recommendation-list/i
    });
    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });

    expect(recommendationRegion).toHaveAttribute("aria-busy", "true");
    expect(
      within(recommendationRegion).getByText(/^추천을 준비하는 중$/i)
    ).toBeInTheDocument();
    expect(
      recommendationRegion.querySelectorAll(".recommendation-loading-card")
    ).toHaveLength(3);
    expect(within(recommendationRegion).queryByText(/^없음$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/보관한 북마크가 없습니다\./i)).not.toBeInTheDocument();
  });

  it("uses modern empty-state hooks after empty dashboard data loads", async () => {
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
        return new Response(JSON.stringify({ bookmarks: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks?trashed=1" && !init?.method) {
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

    const recommendationRegion = await screen.findByRole("region", {
      name: /recommendation-list/i
    });
    await waitFor(() => {
      expect(recommendationRegion).toHaveAttribute("aria-busy", "false");
    });

    const recommendationEmptyStates = within(recommendationRegion).getAllByText(/^없음$/i);
    expect(recommendationEmptyStates).toHaveLength(3);
    recommendationEmptyStates.forEach((emptyState) => {
      expect(emptyState).toHaveClass("recommendation-empty-state");
    });
    expect(
      screen.getByText(/^보이는 폴더가 없습니다\.$/i)
    ).toHaveClass("folder-overview-empty-state");
    expect(
      within(screen.getByRole("region", { name: /bookmark-list/i })).getByText(
        /^보관한 북마크가 없습니다\.$/i
      )
    ).toHaveClass("bookmark-list-empty-state");
  });

  it("opens on a home page with favorite bookmark cards and returns home from the brand", async () => {
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-favorite-home",
                folderId: null,
                url: "https://example.com/favorite",
                isFavorite: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Favorite home",
                userContent: "Pinned content",
                userSummary: "Pinned summary",
                displayTitle: "Favorite home",
                displayContent: "Pinned content",
                displaySummary: "Pinned summary",
                tagIds: [],
                createdAt: "2026-04-13T08:00:00.000Z",
                updatedAt: "2026-04-13T08:00:00.000Z"
              },
              {
                id: "bookmark-normal-home",
                folderId: null,
                url: "https://example.com/normal",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Normal home",
                userContent: "Regular content",
                userSummary: "Regular summary",
                displayTitle: "Normal home",
                displayContent: "Regular content",
                displaySummary: "Regular summary",
                tagIds: [],
                createdAt: "2026-04-13T09:00:00.000Z",
                updatedAt: "2026-04-13T09:00:00.000Z"
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

      if (url === "/api/bookmarks?trashed=1" && !init?.method) {
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(JSON.stringify({ favorites: [], recent: [], frequent: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const homePage = await screen.findByRole("region", { name: /home-page/i });
    expect(within(homePage).getByRole("heading", { name: /^홈$/i })).toBeInTheDocument();
    expect(within(homePage).getByText(/^Favorite home$/i)).toBeInTheDocument();
    expect(within(homePage).queryByText(/^Normal home$/i)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /bookmark-results/i })).toHaveClass(
      "dashboard-panel-visually-hidden"
    );
    expect(screen.getByRole("region", { name: /bookmark-list/i })).toHaveClass(
      "dashboard-panel-visually-hidden"
    );

    const folderOverview = screen.getByRole("region", { name: /folder-overview/i });
    fireEvent.click(within(folderOverview).getByRole("button", { name: /모든 북마크 보기/i }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /home-page/i })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("region", { name: /bookmark-list/i })).not.toHaveClass(
      "dashboard-panel-visually-hidden"
    );

    fireEvent.click(screen.getByRole("button", { name: /홈으로 이동/i }));
    expect(await screen.findByRole("region", { name: /home-page/i })).toBeInTheDocument();
  });

  it("loads the initial home page from counts and favorite bookmarks without fetching the full bookmark list", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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

      if (url === "/api/bookmarks/counts" && !init?.method) {
        return new Response(
          JSON.stringify({
            counts: {
              active: {
                total: 9,
                visible: 8
              },
              favorite: {
                total: 1,
                visible: 1
              },
              trashed: {
                total: 2,
                visible: 2
              },
              unfiled: {
                total: 3,
                visible: 3
              },
              byFolderId: {
                "folder-reading": {
                  total: 6,
                  visible: 5
                }
              }
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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-home-optimized",
                folderId: "folder-reading",
                url: "https://example.com/home-optimized",
                isFavorite: true,
                isHidden: false,
                isTrashed: false,
                trashedAt: null,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Optimized favorite",
                userContent: null,
                userSummary: null,
                displayTitle: "Optimized favorite",
                displayContent: "",
                displaySummary: "",
                tagIds: [],
                createdAt: "2026-04-13T08:00:00.000Z",
                updatedAt: "2026-04-13T08:00:00.000Z"
              }
            ],
            pagination: {
              limit: 20,
              offset: 0,
              total: 1,
              hasMore: false
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

      if (url === "/api/bookmarks/assets?bookmarkId=bookmark-home-optimized" && !init?.method) {
        return new Response(JSON.stringify({ assetsByBookmarkId: {} }), {
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
                id: "folder-reading",
                name: "Reading",
                color: null,
                icon: null,
                isHidden: false,
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
        return new Response(JSON.stringify({ tags: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks" && !init?.method) {
        throw new Error("Full bookmark inventory should not be fetched for initial home");
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    const homePage = await screen.findByRole("region", { name: /home-page/i });
    expect(within(homePage).getByText(/^Optimized favorite$/i)).toBeInTheDocument();
    expect(within(homePage).getByText(/^즐겨찾기 1개$/i)).toBeInTheDocument();

    const folderOverview = screen.getByRole("region", { name: /folder-overview/i });
    expect(
      within(folderOverview).getByRole("button", { name: /모든 북마크 보기/i })
    ).toHaveTextContent("8");
    expect(within(folderOverview).getByRole("button", { name: /미분류 보기/i })).toHaveTextContent("3");
    expect(within(folderOverview).getByRole("button", { name: /휴지통 보기/i })).toHaveTextContent("2");
    expect(within(folderOverview).getByRole("button", { name: /Reading 폴더 보기/i })).toHaveTextContent("5");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/bookmarks", expect.anything());
  });

  it("keeps home recommendations off until the recommendation toggle is enabled", async () => {
    let recommendationRequestCount = 0;

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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-home-favorite",
                folderId: null,
                url: "https://example.com/home-favorite",
                isFavorite: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Favorite home",
                userContent: "Favorite content",
                userSummary: "Favorite summary",
                displayTitle: "Favorite home",
                displayContent: "Favorite content",
                displaySummary: "Favorite summary",
                tagIds: [],
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

      if (url === "/api/bookmarks?trashed=1" && !init?.method) {
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

      if (url === "/api/recommendations" && !init?.method) {
        recommendationRequestCount += 1;
        return new Response(
          JSON.stringify({
            favorites: [
              {
                id: "bookmark-home-recommendation",
                folderId: null,
                url: "https://example.com/home-recommendation",
                isFavorite: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Home recommendation",
                userContent: "Home recommendation content",
                userSummary: "Home recommendation summary",
                displayTitle: "Home recommendation",
                displayContent: "Home recommendation content",
                displaySummary: "Home recommendation summary",
                tagIds: [],
                createdAt: "2026-04-13T08:00:00.000Z",
                updatedAt: "2026-04-13T08:00:00.000Z"
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

    const homePage = await screen.findByRole("region", { name: /home-page/i });
    const recommendationToggle = within(homePage).getByRole("button", {
      name: /^추천 보기$/i
    });
    expect(recommendationToggle).toHaveAttribute("aria-pressed", "false");
    expect(
      within(homePage).queryByRole("region", { name: /home-recommendation-list/i })
    ).not.toBeInTheDocument();
    expect(within(homePage).queryByText(/^Home recommendation$/i)).not.toBeInTheDocument();
    expect(recommendationRequestCount).toBe(0);

    fireEvent.click(recommendationToggle);

    expect(recommendationToggle).toHaveAttribute("aria-pressed", "true");
    const homeRecommendationRegion = within(homePage).getByRole("region", {
      name: /home-recommendation-list/i
    });
    expect(
      await within(homeRecommendationRegion).findByText(/^Home recommendation$/i)
    ).toBeInTheDocument();
    expect(within(homeRecommendationRegion).getByText(/^추천$/i)).toBeInTheDocument();
    expect(recommendationRequestCount).toBe(1);
  });

  it("shows the home page first on mobile and opens it from the brand mark", async () => {
    stubDashboardViewport(640);

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
                id: "bookmark-mobile-home",
                folderId: null,
                url: "https://example.com/mobile-home",
                isFavorite: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Mobile favorite",
                userContent: "Mobile content",
                userSummary: "Mobile summary",
                displayTitle: "Mobile favorite",
                displayContent: "Mobile content",
                displaySummary: "Mobile summary",
                tagIds: [],
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

      if (url === "/api/bookmarks?trashed=1" && !init?.method) {
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(JSON.stringify({ favorites: [], recent: [], frequent: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const homePage = await screen.findByRole("region", { name: /home-page/i });
    expect(homePage).toHaveClass("home-page");
    expect(within(homePage).getByText(/^Mobile favorite$/i)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /folder-overview/i })).toHaveClass(
      "dashboard-panel-visually-hidden"
    );
    expect(screen.queryByRole("region", { name: /bookmark-list/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^북마크$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /home-page/i })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("tabpanel", { name: /^북마크$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /홈으로 이동/i }));
    expect(await screen.findByRole("region", { name: /home-page/i })).toBeInTheDocument();
  });

  it("shows the bookmark form and stored bookmarks for an authenticated user", async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      clipboard: {
        writeText: clipboardWrite
      }
    });

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

      if (url === "/api/bookmarks?trashed=1" && !init?.method) {
        return new Response(JSON.stringify({ bookmarks: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks/bookmark-1/assets" && !init?.method) {
        return new Response(
          JSON.stringify({
            assets: [
              {
                id: "asset-1",
                bookmarkId: "bookmark-1",
                fileName: "thumb.png",
                mimeType: "image/png",
                size: 1234,
                contentUrl: "https://cdn.example.com/thumb.png",
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

      if (url === "/api/bookmarks/bookmark-hidden" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-hidden",
              folderId: null,
              tagIds: [],
              url: "https://example.com/secret",
              isFavorite: false,
              isHidden: true,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Secret bookmark",
              userContent: "",
              userSummary: "",
              displayTitle: "Secret bookmark",
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

      if (url === "/api/bookmarks/bookmark-hidden/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
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
    const workspace = await screen.findByRole("region", { name: /dashboard-workspace/i });
    const sidebar = await screen.findByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    const mainPanel = await screen.findByRole("region", { name: /dashboard-main/i });
    const navigationSidebar = await screen.findByRole("region", {
      name: /navigation-sidebar/i
    });
    const topBar = navigationSidebar.closest("header");
    let folderOverview = within(sidebar).getByRole("region", {
      name: /folder-overview/i
    });
    const bookmarkResults = within(mainPanel).getByRole("region", {
      name: /bookmark-results/i
    });
    const resultPrimaryColumn = within(mainPanel).getByRole("region", {
      name: /result-primary-column/i
    });
    expect(screen.getByText(/^개인 링크 보관함$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Personal Bookmark Workspace$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/^Save, search, and organize links from anywhere\.$/i)
    ).not.toBeInTheDocument();
    expect(workspace).toContainElement(sidebar);
    expect(workspace).toContainElement(mainPanel);
    expect(mainPanel).toContainElement(resultPrimaryColumn);
    expect(within(mainPanel).queryByRole("region", { name: /bookmark-reading-rail/i })).not.toBeInTheDocument();
    expect(within(mainPanel).queryByRole("region", { name: /bookmark-detail-shell/i })).not.toBeInTheDocument();
    expect(navigationSidebar).toBeInTheDocument();
    expect(topBar).not.toBeNull();
    expect(topBar).toContainElement(navigationSidebar);
    expect(sidebar).not.toContainElement(navigationSidebar);
    expect(folderOverview).toBeInTheDocument();
    expect(bookmarkResults).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /folder-manager/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /tag-manager/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /bookmark-form/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /bookmark-composer-dialog/i })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("region", { name: /folder-manager/i })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("region", { name: /tag-manager/i })).not.toBeInTheDocument();
    const searchPanel = within(mainPanel).getByRole("region", { name: /search-panel/i });
    expect(within(sidebar).queryByText(/^작업 패널$/i)).not.toBeInTheDocument();
    expect(within(mainPanel).queryByText(/^작업 결과$/i)).not.toBeInTheDocument();
    const desktopSearchToolbar = within(searchPanel).getByRole("region", {
      name: /desktop-search-toolbar/i
    });
    expect(desktopSearchToolbar).toBeInTheDocument();
    expect(desktopSearchToolbar).toHaveClass("search-toolbar-shell");
    expect(desktopSearchToolbar).not.toHaveClass("search-grid-surface");
    expect(within(searchPanel).queryByText(/^탐색 기준$/i)).not.toBeInTheDocument();
    expect(within(searchPanel).queryByText(/^기본 검색$/i)).not.toBeInTheDocument();
    expect(within(searchPanel).queryByText(/^검색어$/i)).not.toBeInTheDocument();
    expect(within(searchPanel).queryByText(/^검색 모드$/i)).not.toBeInTheDocument();
    expect(within(searchPanel).queryByText(/^정렬$/i)).not.toBeInTheDocument();
    expect(within(searchPanel).queryByText(/^검색과 필터로 좁힙니다\.$/i)).not.toBeInTheDocument();
    expect(within(searchPanel).getByPlaceholderText(/링크, 제목, 내용 검색/i)).toBeInTheDocument();
    expect(within(searchPanel).getByRole("radiogroup", { name: /검색 모드/i })).toBeInTheDocument();
    expect(
      within(searchPanel).getByRole("button", { name: /^전체$/i })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(searchPanel).getByRole("button", { name: /검색 실행/i })
    ).toHaveTextContent(/^검색$/i);
    expect(
      within(searchPanel).getByRole("button", { name: /고급 필터 열기/i })
    ).toHaveTextContent(/^필터$/i);
    expect(
      within(searchPanel).getByRole("button", { name: /검색 초기화/i })
    ).toHaveTextContent(/^초기화$/i);
    expect(
      within(navigationSidebar).getByText(/^북마크 1개 · 폴더 0개 · 태그 1개$/i)
    ).toBeInTheDocument();
    expect(within(navigationSidebar).getByText(/^빠른 작업$/i)).toBeInTheDocument();
    expect(within(navigationSidebar).queryByText(/^데스크톱$/i)).not.toBeInTheDocument();
    const quickActionsToolbar = within(navigationSidebar).getByRole("toolbar", {
      name: /quick-actions-toolbar/i
    });
    expect(within(quickActionsToolbar).getByRole("button", { name: /^새 북마크$/i })).toBeInTheDocument();
    expect(
      within(quickActionsToolbar)
        .getAllByRole("button")
        .map((button) => button.textContent?.trim())
    ).toEqual(["새 북마크", "..."]);
    fireEvent.click(within(quickActionsToolbar).getByRole("button", { name: /빠른 작업 더보기/i }));
    expect(within(quickActionsToolbar).getByRole("button", { name: /^새 폴더$/i })).toBeInTheDocument();
    expect(within(quickActionsToolbar).getByRole("button", { name: /^태그 관리$/i })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(
      within(quickActionsToolbar).queryByRole("button", { name: /^새 폴더$/i })
    ).not.toBeInTheDocument();
    fireEvent.click(within(quickActionsToolbar).getByRole("button", { name: /빠른 작업 더보기/i }));
    fireEvent.click(within(quickActionsToolbar).getByRole("button", { name: /^태그 관리$/i }));
    const tagManagerDialog = await screen.findByRole("dialog", {
      name: /tag-manager-dialog/i
    });
    expect(tagManagerDialog).toHaveClass("tag-manager-dialog-shell");
    const tagManager = within(tagManagerDialog).getByRole("region", { name: /tag-manager/i });
    expect(tagManager).toHaveClass("tag-manager-panel-readable");
    expect(tagManager.querySelector(".tag-manager-editor-surface")).toBeInTheDocument();
    expect(tagManager.querySelector(".tag-manager-list-surface")).toBeInTheDocument();
    expect(tagManager.querySelector(".tag-list-item-readable")).toBeInTheDocument();
    fireEvent.click(within(tagManagerDialog).getByRole("button", { name: /^닫기$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /tag-manager-dialog/i })).not.toBeInTheDocument();
    });
    const bookmarkListRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-list/i
    });
    const bookmarkListColumns = bookmarkListRegion.querySelector(".bookmark-list-columns");
    const bookmarkListTable = bookmarkListRegion.querySelector(".bookmark-list-table");
    const bookmarkListRow = bookmarkListRegion.querySelector(".bookmark-list-row");
    expect(within(bookmarkListRegion).queryByText(/^보관 목록$/i)).not.toBeInTheDocument();
    expect(bookmarkListColumns).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^북마크$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^메타$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^액션$/i)).not.toBeInTheDocument();
    expect(bookmarkListTable).toBeInTheDocument();
    expect(bookmarkListRow).toBeInTheDocument();
    expect(await within(bookmarkListRegion).findByText(/^Manual title$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^https:\/\/example\.com\/post$/i)).toBeInTheDocument();
    expect(bookmarkListRow?.querySelector(".bookmark-row-main")).toBeInTheDocument();
    expect(bookmarkListRow?.querySelector(".bookmark-row-meta")).toBeInTheDocument();
    expect(bookmarkListRow?.querySelector(".bookmark-row-meta-line")).toBeInTheDocument();
    expect(bookmarkListRow?.querySelector(".bookmark-row-actions")).toBeInTheDocument();
    expect(bookmarkListRow?.querySelector(".meta-pill")).not.toBeInTheDocument();
    const bookmarkRowButtons = within(bookmarkListRow as HTMLElement).getAllByRole("button");
    expect(bookmarkRowButtons).toHaveLength(3);
    expect(
      within(bookmarkListRow as HTMLElement).getByRole("button", { name: /Manual title 열기/i })
    ).toHaveTextContent(/^열기$/i);
    expect(
      within(bookmarkListRow as HTMLElement).getByRole("button", {
        name: /Manual title URL 복사/i
      })
    ).toHaveClass("bookmark-url-copy-button");
    expect(
      within(bookmarkListRow as HTMLElement).getByRole("button", {
        name: /Manual title 북마크 더보기/i
      })
    ).toHaveTextContent(/^\.\.\.$/i);
    fireEvent.click(
      within(bookmarkListRow as HTMLElement).getByRole("button", {
        name: /Manual title URL 복사/i
      })
    );
    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalledWith("https://example.com/post");
    });
    expect(await screen.findByText(/^URL을 복사했습니다\.$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^상태 배지$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^분류$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^표시 설정$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^빠른 조작$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^미분류$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^즐겨찾기$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^직접 요약$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^research$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^북마크 주황$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^URL 네이비$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^색상 2개$/i)).not.toBeInTheDocument();
    const bookmarkUrlLine = within(bookmarkListRow as HTMLElement).getByText(
      /^https:\/\/example\.com\/post$/i
    );
    expect(bookmarkUrlLine).toHaveClass("bookmark-row-url");
    expect(bookmarkUrlLine).toHaveAttribute("title", "https://example.com/post");
    expect(bookmarkUrlLine).toHaveStyle({ color: "#0f172a" });
    expect(
      await within(bookmarkListRegion).findByRole("img", { name: /업로드 이미지 1/i })
    ).toBeInTheDocument();
    openBookmarkActionMenu(bookmarkListRegion, "Manual title");
    const bookmarkMenu = within(bookmarkListRegion).getByRole("menu", {
      name: /Manual title 북마크 메뉴/i
    });
    expect(bookmarkMenu).toHaveClass("bookmark-card-action-menu");
    expect(
      within(bookmarkListRegion).queryByRole("button", { name: /^상세 보기$/i })
    ).not.toBeInTheDocument();
    expect(
      within(bookmarkMenu).getByRole("button", { name: /^수정$/i })
    ).toHaveClass("bookmark-card-action-menu-item");
    expect(
      within(bookmarkMenu).getByRole("button", { name: /^삭제$/i })
    ).toHaveClass("bookmark-card-action-menu-item");
    fireEvent.pointerDown(document.body);
    expect(
      within(bookmarkListRegion).queryByRole("button", { name: /^수정$/i })
    ).not.toBeInTheDocument();
  });

  it("loads full bookmark content before editing a compact list bookmark", async () => {
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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-compact-edit",
                folderId: null,
                tagIds: [],
                url: "https://example.com/compact-edit",
                isFavorite: false,
                isHidden: false,
                isTrashed: false,
                trashedAt: null,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Compact edit",
                userContent: null,
                userSummary: null,
                displayTitle: "Compact edit",
                displayContent: "Compact preview",
                displaySummary: "",
                contentTruncated: true,
                createdAt: "2026-04-27T00:00:00.000Z",
                updatedAt: "2026-04-27T00:00:00.000Z"
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

      if (url === "/api/bookmarks/bookmark-compact-edit" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-compact-edit",
              folderId: null,
              tagIds: [],
              url: "https://example.com/compact-edit",
              isFavorite: false,
              isHidden: false,
              isTrashed: false,
              trashedAt: null,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Compact edit",
              userContent: "Full editable content",
              userSummary: "Full editable summary",
              displayTitle: "Compact edit",
              displayContent: "Full editable content",
              displaySummary: "Full editable summary",
              createdAt: "2026-04-27T00:00:00.000Z",
              updatedAt: "2026-04-27T00:00:00.000Z"
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

      if (
        url === "/api/bookmarks/assets?bookmarkId=bookmark-compact-edit" ||
        url === "/api/bookmarks/bookmark-compact-edit/assets"
      ) {
        return new Response(
          JSON.stringify({
            assetsByBookmarkId: {
              "bookmark-compact-edit": []
            },
            assets: []
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
        return new Response(JSON.stringify({ favorites: [], recent: [], frequent: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    openBookmarkActionMenu(bookmarkListRegion, "Compact edit");
    fireEvent.click(within(bookmarkListRegion).getByRole("button", { name: /^수정$/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    expect(within(composerDialog).getByLabelText(/^내용$/i)).toHaveValue(
      "Full editable content"
    );
    expect(within(composerDialog).getByLabelText(/^요약$/i)).toHaveValue(
      "Full editable summary"
    );
  });

  it("fetches bookmark pages from the server and lets the user increase the page size", async () => {
    const bookmarkFixtures = Array.from({ length: 25 }, (_, index) => {
      const number = index + 1;
      return {
        id: `bookmark-page-${number}`,
        folderId: null,
        tagIds: [],
        url: `https://example.com/page-${number}`,
        isFavorite: false,
        isHidden: false,
        isTrashed: false,
        trashedAt: null,
        bookmarkColor: null,
        urlColor: null,
        sourceTitle: null,
        sourceContent: null,
        sourceSummary: null,
        userTitle: `Paged bookmark ${number}`,
        userContent: null,
        userSummary: null,
        displayTitle: `Paged bookmark ${number}`,
        displayContent: "",
        displaySummary: "",
        contentTruncated: true,
        createdAt: `2026-04-27T00:${String(number).padStart(2, "0")}:00.000Z`,
        updatedAt: `2026-04-27T00:${String(number).padStart(2, "0")}:00.000Z`
      };
    });

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
        return new Response(JSON.stringify({ bookmarks: bookmarkFixtures }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks?limit=20&offset=0" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: bookmarkFixtures.slice(0, 20),
            pagination: {
              limit: 20,
              offset: 0,
              total: bookmarkFixtures.length,
              hasMore: true
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

      if (url === "/api/bookmarks?limit=20&offset=20" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: bookmarkFixtures.slice(20),
            pagination: {
              limit: 20,
              offset: 20,
              total: bookmarkFixtures.length,
              hasMore: false
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

      if (url === "/api/bookmarks?limit=50&offset=0" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: bookmarkFixtures,
            pagination: {
              limit: 50,
              offset: 0,
              total: bookmarkFixtures.length,
              hasMore: false
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
        return new Response(JSON.stringify({ favorites: [], recent: [], frequent: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const sidebar = await screen.findByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    fireEvent.click(
      within(sidebar).getByRole("button", {
        name: /모든 북마크 보기/i
      })
    );

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    const pageSizeSelect = within(bookmarkListRegion).getByLabelText(/^보기 개수$/i);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/bookmarks?limit=20&offset=0",
        expect.objectContaining({
          credentials: "include"
        })
      );
    });
    expect(pageSizeSelect).toHaveValue("20");
    expect(bookmarkListRegion.querySelectorAll(".bookmark-list-row")).toHaveLength(20);
    expect(within(bookmarkListRegion).getByText(/^Paged bookmark 20$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^Paged bookmark 21$/i)).not.toBeInTheDocument();

    fireEvent.click(within(bookmarkListRegion).getByRole("button", { name: /^더 보기$/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/bookmarks?limit=20&offset=20",
        expect.objectContaining({
          credentials: "include"
        })
      );
    });
    await waitFor(() => {
      expect(bookmarkListRegion.querySelectorAll(".bookmark-list-row")).toHaveLength(25);
    });
    expect(within(bookmarkListRegion).getByText(/^Paged bookmark 25$/i)).toBeInTheDocument();

    fireEvent.change(pageSizeSelect, { target: { value: "50" } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/bookmarks?limit=50&offset=0",
        expect.objectContaining({
          credentials: "include"
        })
      );
    });
    await waitFor(() => {
      expect(bookmarkListRegion.querySelectorAll(".bookmark-list-row")).toHaveLength(25);
    });
    expect(within(bookmarkListRegion).getByText(/^Paged bookmark 25$/i)).toBeInTheDocument();
  });

  it("virtualizes large bookmark pages instead of mounting every loaded row", async () => {
    const assetBatchBookmarkIds: string[][] = [];
    const bookmarkFixtures = Array.from({ length: 100 }, (_, index) => {
      const number = index + 1;
      return {
        id: `virtual-bookmark-${number}`,
        folderId: null,
        tagIds: [],
        url: `https://example.com/virtual-${number}`,
        isFavorite: false,
        isHidden: false,
        isTrashed: false,
        trashedAt: null,
        bookmarkColor: null,
        urlColor: null,
        sourceTitle: null,
        sourceContent: null,
        sourceSummary: null,
        userTitle: `Virtual bookmark ${number}`,
        userContent: null,
        userSummary: null,
        displayTitle: `Virtual bookmark ${number}`,
        displayContent: "",
        displaySummary: "",
        contentTruncated: false,
        createdAt: `2026-04-27T01:${String(number).padStart(2, "0")}:00.000Z`,
        updatedAt: `2026-04-27T01:${String(number).padStart(2, "0")}:00.000Z`
      };
    });

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

      if (url === "/api/bookmarks?favorite=1&limit=20&offset=0" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [],
            pagination: {
              limit: 20,
              offset: 0,
              total: 0,
              hasMore: false
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
              active: { total: 100, visible: 100 },
              favorite: { total: 0, visible: 0 },
              trashed: { total: 0, visible: 0 },
              unfiled: { total: 100, visible: 100 },
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

      if (url === "/api/bookmarks?limit=20&offset=0" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: bookmarkFixtures.slice(0, 20),
            pagination: {
              limit: 20,
              offset: 0,
              total: bookmarkFixtures.length,
              hasMore: true
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

      if (url === "/api/bookmarks?limit=100&offset=0" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: bookmarkFixtures,
            pagination: {
              limit: 100,
              offset: 0,
              total: bookmarkFixtures.length,
              hasMore: false
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

      if (url.startsWith("/api/bookmarks/assets?") && !init?.method) {
        const searchParams = new URLSearchParams(url.split("?")[1]);
        assetBatchBookmarkIds.push(searchParams.getAll("bookmarkId"));
        return new Response(
          JSON.stringify({
            assetsByBookmarkId: Object.fromEntries(
              searchParams.getAll("bookmarkId").map((bookmarkId) => [bookmarkId, []])
            )
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
        return new Response(JSON.stringify({ favorites: [], recent: [], frequent: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const sidebar = await screen.findByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    fireEvent.click(
      within(sidebar).getByRole("button", {
        name: /모든 북마크 보기/i
      })
    );

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    const pageSizeSelect = within(bookmarkListRegion).getByLabelText(/^보기 개수$/i);
    fireEvent.change(pageSizeSelect, { target: { value: "100" } });

    const bookmarkListTable = bookmarkListRegion.querySelector(".bookmark-list-table");
    await waitFor(() => {
      expect(bookmarkListTable).toHaveAttribute("data-virtualized-bookmark-list", "true");
    });
    expect(bookmarkListRegion.querySelectorAll(".bookmark-list-row").length).toBeLessThan(100);
    expect(within(bookmarkListRegion).getByText(/^Virtual bookmark 1$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^Virtual bookmark 100$/i)).not.toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => {
        globalThis.setTimeout(resolve, 700);
      });
    });
    const preloadedAssetBookmarkIds = new Set(assetBatchBookmarkIds.flat());
    expect(preloadedAssetBookmarkIds.has("virtual-bookmark-1")).toBe(true);
    expect(preloadedAssetBookmarkIds.has("virtual-bookmark-100")).toBe(false);
  });

  it("customizes bookmark view mode and card display fields", async () => {
    globalThis.localStorage?.setItem(
      "bookmark-view-settings:v1",
      JSON.stringify({
        mode: "card",
        card: {
          coverImage: true,
          title: true,
          description: true,
          tags: true,
          bookmarkInfo: true,
          coverSize: 180
        }
      })
    );

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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-view-settings",
                folderId: null,
                url: "https://example.com/view-settings",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "View settings title",
                userContent: "View settings content",
                userSummary: "View settings summary",
                displayTitle: "View settings title",
                displayContent: "View settings content",
                displaySummary: "View settings summary",
                tagIds: ["tag-view"],
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

      if (url === "/api/bookmarks/bookmark-view-settings/assets" && !init?.method) {
        return new Response(
          JSON.stringify({
            assets: [
              {
                id: "asset-view-settings",
                bookmarkId: "bookmark-view-settings",
                fileName: "cover.png",
                mimeType: "image/png",
                size: 1234,
                contentUrl: "https://cdn.example.com/cover.png",
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
        return new Response(JSON.stringify({ favorites: [], recent: [], frequent: [] }), {
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
                id: "tag-view",
                name: "design",
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
    const bookmarkListTable = bookmarkListRegion.querySelector(".bookmark-list-table");
    expect(bookmarkListTable).toHaveClass("bookmark-list-table-view-list");
    const listThumbnail = await within(bookmarkListRegion).findByRole("img", {
      name: /업로드 이미지 1/i
    });
    expect(listThumbnail.closest(".bookmark-row-list-thumbnail")).toBeInTheDocument();
    expect(listThumbnail.closest(".bookmark-list-row")).toHaveClass("bookmark-list-row-has-cover");
    expect(within(bookmarkListRegion).getByText(/^View settings title$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^View settings summary$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^design$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^미분류$/i)).toBeInTheDocument();

    fireEvent.click(within(bookmarkListRegion).getByRole("button", { name: /보기 설정/i }));
    expect(screen.getByRole("menuitemradio", { name: /^리스트$/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("menuitemcheckbox", { name: /커버 이미지/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("menuitemcheckbox", { name: /제목/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("menuitemcheckbox", { name: /설명/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("menuitemcheckbox", { name: /태그/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("menuitemcheckbox", { name: /북마크 정보/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.queryByLabelText(/커버 이미지 크기/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /태그/i }));
    expect(within(bookmarkListRegion).queryByText(/^design$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /북마크 정보/i }));
    expect(within(bookmarkListRegion).queryByText(/^미분류$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemradio", { name: /^카드$/i }));
    expect(bookmarkListTable).toHaveClass("bookmark-list-table-view-card");
    expect(screen.getByLabelText(/커버 이미지 크기/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^View settings summary$/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/커버 이미지 크기/i), {
      target: {
        value: "180"
      }
    });
    expect(bookmarkListTable).toHaveStyle({ "--bookmark-cover-size": "180px" });

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /설명/i }));
    expect(within(bookmarkListRegion).queryByText(/^View settings summary$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /태그/i }));
    expect(within(bookmarkListRegion).queryByText(/^design$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /북마크 정보/i }));
    expect(within(bookmarkListRegion).queryByText(/^미분류$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /커버 이미지/i }));
    expect(
      within(bookmarkListRegion).queryByRole("img", { name: /업로드 이미지 1/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitemradio", { name: /^제목$/i }));
    expect(bookmarkListTable).toHaveClass("bookmark-list-table-view-title");
  });

  it("opens and closes the bookmark composer from desktop quick entry", async () => {
    const confirmSpy = vi.fn();
    vi.stubGlobal("confirm", confirmSpy);
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
    const navigationSidebar = await screen.findByRole("region", {
      name: /navigation-sidebar/i
    });

    expect(screen.queryByRole("dialog", { name: /bookmark-composer-dialog/i })).not.toBeInTheDocument();

    fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 북마크$/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    expect(within(composerDialog).getByRole("region", { name: /bookmark-form/i })).toBeInTheDocument();
    expect(within(composerDialog).getByText(/^내용\/요약$/i)).toBeInTheDocument();
    expect(within(composerDialog).getByRole("button", { name: /^닫기$/i })).toBeInTheDocument();
    expect(within(composerDialog).getByRole("button", { name: /분류와 상태 열기/i })).toBeInTheDocument();
    expect(within(composerDialog).getByRole("button", { name: /표시와 이미지 열기/i })).toBeInTheDocument();
    expect(within(composerDialog).queryByLabelText(/^즐겨찾기$/i)).not.toBeInTheDocument();
    expect(within(composerDialog).queryByLabelText(/이미지 업로드/i)).not.toBeInTheDocument();

    fireEvent.click(composerDialog.parentElement as HTMLElement);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /bookmark-composer-dialog/i })).not.toBeInTheDocument();
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("queues multiple local images in the bookmark composer before save", async () => {
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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-1",
                folderId: "folder-1",
                tagIds: [],
                url: "https://example.com/reading",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Reading note",
                userContent: "Reading note summary",
                userSummary: "Reading note summary",
                displayTitle: "Reading note",
                displayContent: "Reading note summary",
                displaySummary: "Reading note summary",
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

      if (url === "/api/recommendations" && !init?.method) {
        return new Response(
          JSON.stringify({
            favorites: [
              {
                id: "bookmark-1",
                folderId: "folder-1",
                tagIds: [],
                url: "https://example.com/reading",
                isFavorite: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Reading note",
                userContent: "Reading note summary",
                userSummary: "Reading note summary",
                displayTitle: "Reading note",
                displayContent: "Reading note summary",
                displaySummary: "Reading note summary",
                createdAt: "2026-04-13T08:00:00.000Z",
                updatedAt: "2026-04-13T08:00:00.000Z"
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

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^새 북마크$/i }));

    const dialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /표시와 이미지 열기/i
      })
    );

    const fileInput = within(dialog).getByLabelText(/이미지 업로드/i);
    const firstImage = new File(["image-one"], "capture-1.png", { type: "image/png" });
    const secondImage = new File(["image-two"], "capture-2.png", { type: "image/png" });

    fireEvent.change(fileInput, {
      target: {
        files: [firstImage]
      }
    });

    fireEvent.change(fileInput, {
      target: {
        files: [secondImage]
      }
    });

    expect(within(dialog).getByText("capture-1.png")).toBeInTheDocument();
    expect(within(dialog).getByText("capture-2.png")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "capture-1.png 제거" }));
    expect(within(dialog).queryByText("capture-1.png")).not.toBeInTheDocument();
    expect(within(dialog).getByText("capture-2.png")).toBeInTheDocument();
  });

  it("renders bookmark and search checkboxes with the shared checkbox field layout", async () => {
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

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^새 북마크$/i }));
    const dialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /분류와 상태 열기/i
      })
    );

    const favoriteCheckbox = within(dialog).getByRole("checkbox", { name: /즐겨찾기/i });
    const hiddenCheckbox = within(dialog).getByRole("checkbox", { name: /숨김 북마크/i });

    expect(favoriteCheckbox).toHaveClass("checkbox-field-input");
    expect(favoriteCheckbox.closest("label")).toHaveClass("checkbox-field");
    expect(hiddenCheckbox).toHaveClass("checkbox-field-input");
    expect(hiddenCheckbox.closest("label")).toHaveClass("checkbox-field");

    const searchPanel = screen.getByRole("region", { name: /search-panel/i });
    fireEvent.click(within(searchPanel).getByRole("button", { name: /고급 필터 열기/i }));

    const favoriteOnlyCheckbox = within(searchPanel).getByRole("checkbox", { name: /즐겨찾기만/i });
    expect(favoriteOnlyCheckbox).toHaveClass("checkbox-field-input");
    expect(favoriteOnlyCheckbox.closest("label")).toHaveClass("checkbox-field");
  });

  it("adds dropped images to the bookmark composer queue", async () => {
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

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^새 북마크$/i }));

    const dialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /표시와 이미지 열기/i
      })
    );

    const dropzone = within(dialog).getByLabelText(/이미지 붙여넣기 또는 끌어놓기/i);
    const droppedImage = new File(["drop-image"], "drop-capture.png", { type: "image/png" });

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [droppedImage]
      }
    });

    expect(within(dialog).getByText("drop-capture.png")).toBeInTheDocument();
  });

  it("adds pasted clipboard images to the bookmark composer queue", async () => {
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

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /^새 북마크$/i }));

    const dialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /표시와 이미지 열기/i
      })
    );

    const dropzone = within(dialog).getByLabelText(/이미지 붙여넣기 또는 끌어놓기/i);
    const pastedImage = new File(["paste-image"], "paste-capture.png", { type: "image/png" });

    fireEvent.paste(dropzone, {
      clipboardData: {
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => pastedImage
          }
        ]
      }
    });

    expect(within(dialog).getByText("paste-capture.png")).toBeInTheDocument();
  });

  it("shows extension token management for the authenticated user account", async () => {
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

      if (url === "/api/extension-tokens" && !init?.method) {
        return new Response(
          JSON.stringify({
            tokens: [
              {
                id: "token-1",
                label: "Chrome desktop",
                createdAt: "2026-04-17T10:00:00.000Z",
                updatedAt: "2026-04-17T10:00:00.000Z"
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

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    const sessionCard = await screen.findByText("keygenerator25@gmail.com");
    expect(sessionCard).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /확장 토큰 관리/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /확장 토큰 관리/i }));
    const dialog = await screen.findByRole("dialog", { name: /extension-token-dialog/i });
    expect(dialog).toHaveClass("extension-token-dialog-shell");
    expect(within(dialog).getByText("Chrome desktop")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /토큰 발급/i }).closest("section")).toHaveClass(
      "extension-token-card-readable"
    );
    expect(within(dialog).getByText("Chrome desktop").closest("li")).toHaveClass(
      "extension-token-row-readable"
    );
  });

  it("connects the installed extension from the token manager", async () => {
    const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation((message) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "bookmark-extension:ping"
      ) {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              source: "bookmark-extension",
              type: "bookmark-extension:pong"
            }
          })
        );
      }

      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "bookmark-extension:configure"
      ) {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              source: "bookmark-extension",
              type: "bookmark-extension:configured",
              requestId: (message as { requestId: string }).requestId
            }
          })
        );
      }
    });
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

      if (url === "/api/extension-tokens" && !init?.method) {
        return new Response(JSON.stringify({ tokens: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/extension-tokens" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            token: {
              id: "token-auto",
              label: "자동 연결",
              createdAt: "2026-04-21T08:00:00.000Z",
              updatedAt: "2026-04-21T08:00:00.000Z"
            },
            rawToken: "raw-extension-token"
          }),
          {
            status: 201,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    await screen.findByText("keygenerator25@gmail.com");
    fireEvent.click(screen.getByRole("button", { name: /확장 토큰 관리/i }));

    const dialog = await screen.findByRole("dialog", { name: /extension-token-dialog/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /확장 자동 연결/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(/확장 설정을 저장했습니다/i)).toBeInTheDocument();
    });

    const createCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/extension-tokens" &&
        init?.method === "POST"
    );
    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      label: expect.stringContaining("자동 연결")
    });
    expect(
      postMessageSpy.mock.calls.some(([message]) =>
        Boolean(
          typeof message === "object" &&
            message !== null &&
            "type" in message &&
            message.type === "bookmark-extension:configure" &&
            "settings" in message &&
            (message as { settings: { token: string } }).settings.token === "raw-extension-token"
        )
      )
    ).toBe(true);
  });

  it("shows extension download instructions with zip and Tampermonkey links", async () => {
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

      throw new Error(`Unhandled request: ${url}`);
    });

    render(<App />);

    expect(await screen.findByText("keygenerator25@gmail.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /브라우저 확장 다운로드/i }));

    const dialog = await screen.findByRole("dialog", { name: /extension-download-dialog/i });
    const downloadLink = within(dialog).getByRole("link", { name: /확장 다운로드 \(.zip\)/i });
    const userscriptLink = within(dialog).getByRole("link", { name: /Tampermonkey 스크립트 열기/i });
    const userscriptDownloadLink = within(dialog).getByRole("link", { name: /파일 다운로드/i });

    expect(dialog).toHaveClass("extension-download-dialog-shell");
    expect(within(dialog).getAllByRole("heading", { level: 3 })[0]?.closest("section")).toHaveClass(
      "extension-download-card-readable"
    );
    expect(downloadLink).toHaveAttribute("href", "/downloads/bookmark-saver-extension.zip");
    expect(userscriptLink).toHaveAttribute("href", "/downloads/bookmark-saver.user.js?v=0.1.11");
    expect(userscriptLink).toHaveAttribute("target", "_blank");
    expect(userscriptDownloadLink).toHaveAttribute(
      "href",
      "/downloads/bookmark-saver.user.js?v=0.1.11"
    );
    expect(userscriptDownloadLink).toHaveAttribute("download", "bookmark-saver.user.js");
    expect(within(dialog).getByRole("button", { name: /스크립트 코드 복사/i })).toBeInTheDocument();
    expect(within(dialog).getByText(/chrome:\/\/extensions/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/edge:\/\/extensions/i)).toBeInTheDocument();
  });

  it("asks before closing the bookmark composer from the backdrop when the draft has changes", async () => {
    const confirmSpy = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    vi.stubGlobal("confirm", confirmSpy);
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
              },
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
              },
              {
                id: "bookmark-extension",
                folderId: null,
                tagIds: [],
                url: "https://example.com/extension",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Extension bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Extension bookmark",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              },
              {
                id: "bookmark-extension",
                folderId: null,
                tagIds: [],
                url: "https://example.com/extension",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Extension bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Extension bookmark",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              }
            ],
            ...(url.includes("limit=20")
              ? {
                  pagination: {
                    limit: 20,
                    offset: 0,
                    total: 3,
                    hasMore: false
                  }
                }
              : {})
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

      if (url === "/api/bookmarks/bookmark-hidden" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-hidden",
              folderId: null,
              tagIds: [],
              url: "https://example.com/secret",
              isFavorite: false,
              isHidden: true,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Secret bookmark",
              userContent: "",
              userSummary: "",
              displayTitle: "Secret bookmark",
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

      if (url === "/api/bookmarks/bookmark-hidden/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
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
    const navigationSidebar = await screen.findByRole("region", {
      name: /navigation-sidebar/i
    });

    fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 북마크$/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    fireEvent.change(within(composerDialog).getByLabelText(/^URL$/i), {
      target: {
        value: "https://example.com/draft"
      }
    });

    fireEvent.click(composerDialog.parentElement as HTMLElement);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: /bookmark-composer-dialog/i })).toBeInTheDocument();

    fireEvent.click(composerDialog.parentElement as HTMLElement);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /bookmark-composer-dialog/i })).not.toBeInTheDocument();
    });
    expect(confirmSpy).toHaveBeenCalledTimes(2);
  });

  it("prefills the selected folder when starting a bookmark from the current folder scope", async () => {
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

      if (url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1" && !init?.method) {
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
              },
              {
                id: "folder-2",
                name: "Papers",
                color: "#14b8a6",
                icon: "newspaper",
                parentFolderId: "folder-1",
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
    const sidebar = await screen.findByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    const navigationSidebar = await screen.findByRole("region", {
      name: /navigation-sidebar/i
    });
    let folderOverview = within(sidebar).getByRole("region", {
      name: /folder-overview/i
    });

    fireEvent.click(within(folderOverview).getByRole("button", { name: /Reading 폴더 보기/i }));
    await waitFor(() => {
      expect(
        within(folderOverview).getByRole("button", { name: /Reading 폴더 보기/i })
      ).toHaveAttribute("aria-pressed", "true");
    });

    fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 북마크$/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    expect(within(composerDialog).getByLabelText(/저장 폴더/i)).toHaveValue("folder-1");
  });

  it("exports bookmarks, folders, tags, and asset metadata as a backup json file", async () => {
    const createObjectUrlSpy = vi.fn().mockReturnValue("blob:bookmark-export");
    const revokeObjectUrlSpy = vi.fn();
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: createObjectUrlSpy,
      revokeObjectURL: revokeObjectUrlSpy
    });

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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-1",
                folderId: "folder-1",
                url: "https://example.com/post",
                isFavorite: false,
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

      if (url === "/api/bookmarks/bookmark-1/assets" && !init?.method) {
        return new Response(
          JSON.stringify({
            assets: [
              {
                id: "asset-1",
                bookmarkId: "bookmark-1",
                fileName: "thumb.png",
                mimeType: "image/png",
                size: 1024,
                contentUrl: "https://cdn.example.com/thumb.png",
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
    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });

    fireEvent.click(within(bookmarkListRegion).getByRole("button", { name: /북마크 내보내기/i }));

    await waitFor(() => {
      expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    });
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:bookmark-export");

    const exportBlob = createObjectUrlSpy.mock.calls[0]?.[0] as Blob;
    const exportPayload = JSON.parse(await exportBlob.text());

    expect(exportPayload).toMatchObject({
      bookmarks: [
        expect.objectContaining({
          id: "bookmark-1",
          folderId: "folder-1"
        })
      ],
      folders: [
        expect.objectContaining({
          id: "folder-1",
          name: "Reading"
        })
      ],
      tags: [
        expect.objectContaining({
          id: "tag-1",
          name: "research"
        })
      ],
      bookmarkAssetsByBookmarkId: {
        "bookmark-1": [
          expect.objectContaining({
            id: "asset-1",
            fileName: "thumb.png"
          })
        ]
      }
    });
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
    const navigationSidebar = await screen.findByRole("region", {
      name: /navigation-sidebar/i
    });

    fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 북마크$/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    const bookmarkFormRegion = within(composerDialog).getByRole("region", {
      name: /bookmark-form/i
    });

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
    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /표시와 이미지 열기/i }));
    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/이미지 업로드/i), {
      target: {
        files: [new File(["fake-image-data"], "capture.png", { type: "image/png" })]
      }
    });
    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /분류와 상태 열기/i }));
    const researchTagCheckbox = within(bookmarkFormRegion).getByRole("checkbox", {
      name: /research/i
    });
    const laterTagCheckbox = within(bookmarkFormRegion).getByRole("checkbox", { name: /later/i });
    fireEvent.click(researchTagCheckbox);
    fireEvent.click(laterTagCheckbox);
    expect(researchTagCheckbox.closest("label")).toHaveClass("bookmark-tag-option-selected");
    expect(laterTagCheckbox.closest("label")).toHaveClass("bookmark-tag-option-selected");
    expect(
      laterTagCheckbox.closest("label")?.querySelector(".bookmark-tag-option-label")
    ).toBeInTheDocument();
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /숨김 북마크/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /북마크 저장/i }));

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Created title$/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /bookmark-composer-dialog/i })).not.toBeInTheDocument();
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
      tagIds: ["tag-1", "tag-2"],
      isHidden: true
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
    expect(within(bookmarkListRegion).getByText(/^이미지 1$/i)).toBeInTheDocument();
  });

  it("filters bookmark tags in the composer and shows selected tags separately", async () => {
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

      if (url === "/api/bookmarks?trashed=1" && !init?.method) {
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
                name: "shopping",
                color: "#16a34a",
                createdAt: "2026-04-13T08:00:00.000Z",
                updatedAt: "2026-04-13T08:00:00.000Z"
              },
              {
                id: "tag-3",
                name: "program",
                color: "#7c3aed",
                createdAt: "2026-04-13T08:00:00.000Z",
                updatedAt: "2026-04-13T08:00:00.000Z"
              },
              {
                id: "tag-4",
                name: "download",
                color: "#e11d48",
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

    const navigationSidebar = await screen.findByRole("region", {
      name: /navigation-sidebar/i
    });
    fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 북마크$/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    const bookmarkFormRegion = within(composerDialog).getByRole("region", {
      name: /bookmark-form/i
    });

    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /분류와 상태 열기/i }));

    const tagSearchInput = within(bookmarkFormRegion).getByLabelText(/태그 검색/i);
    fireEvent.change(tagSearchInput, { target: { value: "prog" } });

    expect(within(bookmarkFormRegion).getByRole("checkbox", { name: /^program$/i })).toBeInTheDocument();
    expect(
      within(bookmarkFormRegion).queryByRole("checkbox", { name: /^research$/i })
    ).not.toBeInTheDocument();

    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /^program$/i }));

    expect(within(bookmarkFormRegion).getByText(/^선택된 태그 1개$/i)).toBeInTheDocument();
    expect(
      within(bookmarkFormRegion).getByRole("button", { name: /^program 선택 해제$/i })
    ).toBeInTheDocument();
  });

  it("creates a folder inline from the bookmark form and selects it for the next bookmark", async () => {
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

      if (url === "/api/folders" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            folder: {
              id: "folder-inline-1",
              name: "Articles",
              color: "#0f766e",
              icon: "newspaper",
              parentFolderId: null,
              sortOrder: 0,
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

      if (url === "/api/bookmarks" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-inline-1",
              folderId: "folder-inline-1",
              url: "https://example.com/inline-folder",
              isFavorite: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Inline folder bookmark",
              userContent: null,
              userSummary: null,
              displayTitle: "Inline folder bookmark",
              displayContent: "",
              displaySummary: "",
              tagIds: [],
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
    const navigationSidebar = await screen.findByRole("region", {
      name: /navigation-sidebar/i
    });
    fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 북마크$/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    const bookmarkFormRegion = within(composerDialog).getByRole("region", {
      name: /bookmark-form/i
    });
    fireEvent.click(
      within(bookmarkFormRegion).getByRole("button", { name: /새 폴더 바로 추가/i })
    );

    const quickFolderRegion = within(bookmarkFormRegion).getByRole("region", {
      name: /quick-folder-create/i
    });
    const quickParentSelect = within(quickFolderRegion).getByRole("combobox", {
      name: /부모 폴더/i
    });

    expect(quickParentSelect).toBeDisabled();

    fireEvent.change(within(quickFolderRegion).getByLabelText(/폴더 이름/i), {
      target: { value: "Articles" }
    });
    chooseColorOption(quickFolderRegion, "폴더 색상", "청록");
    fireEvent.click(
      within(quickFolderRegion).getByRole("button", { name: /폴더 아이콘 신문 선택/i })
    );
    fireEvent.click(
      within(quickFolderRegion).getByRole("button", { name: /빠른 폴더 저장/i })
    );

    await waitFor(() => {
      expect(
        (within(bookmarkFormRegion).getByLabelText(/저장 폴더/i) as HTMLSelectElement).value
      ).toBe("folder-inline-1");
    });

    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/^URL$/i), {
      target: { value: "https://example.com/inline-folder" }
    });
    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/제목/i), {
      target: { value: "Inline folder bookmark" }
    });
    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /북마크 저장/i }));

    const createFolderCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/folders" &&
        init?.method === "POST"
    );
    expect(createFolderCall).toBeDefined();
    expect(JSON.parse(String(createFolderCall?.[1]?.body))).toMatchObject({
      name: "Articles",
      color: "#0f766e",
      icon: "newspaper",
      parentFolderId: null
    });

    const createBookmarkCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/bookmarks" &&
        init?.method === "POST"
    );
    expect(createBookmarkCall).toBeDefined();
    expect(JSON.parse(String(createBookmarkCall?.[1]?.body))).toMatchObject({
      url: "https://example.com/inline-folder",
      folderId: "folder-inline-1",
      userTitle: "Inline folder bookmark"
    });
  });

  it("creates a tag inline from the bookmark form and selects it for the next bookmark", async () => {
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

      if (url === "/api/tags" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            tag: {
              id: "tag-inline-1",
              name: "highlight",
              color: "#f59e0b",
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

      if (url === "/api/bookmarks" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-inline-tag-1",
              folderId: null,
              url: "https://example.com/inline-tag",
              isFavorite: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Inline tag bookmark",
              userContent: null,
              userSummary: null,
              displayTitle: "Inline tag bookmark",
              displayContent: "",
              displaySummary: "",
              tagIds: ["tag-inline-1"],
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
    const navigationSidebar = await screen.findByRole("region", {
      name: /navigation-sidebar/i
    });
    fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 북마크$/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    const bookmarkFormRegion = within(composerDialog).getByRole("region", {
      name: /bookmark-form/i
    });

    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /분류와 상태 열기/i }));
    fireEvent.click(
      within(bookmarkFormRegion).getByRole("button", { name: /새 태그 바로 추가/i })
    );

    const quickTagRegion = within(bookmarkFormRegion).getByRole("region", {
      name: /quick-tag-create/i
    });

    fireEvent.change(within(quickTagRegion).getByLabelText(/태그 이름/i), {
      target: { value: "highlight" }
    });
    chooseColorOption(quickTagRegion, "태그 색상", "주황");
    fireEvent.click(
      within(quickTagRegion).getByRole("button", { name: /빠른 태그 저장/i })
    );

    await waitFor(() => {
      expect(
        within(bookmarkFormRegion).getByRole("checkbox", { name: /^highlight$/i })
      ).toBeChecked();
    });

    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/^URL$/i), {
      target: { value: "https://example.com/inline-tag" }
    });
    fireEvent.change(within(bookmarkFormRegion).getByLabelText(/제목/i), {
      target: { value: "Inline tag bookmark" }
    });
    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /북마크 저장/i }));

    const createTagCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/tags" &&
        init?.method === "POST"
    );
    expect(createTagCall).toBeDefined();
    expect(JSON.parse(String(createTagCall?.[1]?.body))).toMatchObject({
      name: "highlight",
      color: "#f59e0b"
    });

    const createBookmarkCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/bookmarks" &&
        init?.method === "POST"
    );
    expect(createBookmarkCall).toBeDefined();
    expect(JSON.parse(String(createBookmarkCall?.[1]?.body))).toMatchObject({
      url: "https://example.com/inline-tag",
      userTitle: "Inline tag bookmark",
      tagIds: ["tag-inline-1"]
    });
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
              sourceSummary: "Preview summary",
              sourceImageUrl: "https://example.com/preview-cover.png",
              sourceBlocks: [
                { type: "heading", text: "Preview section heading" },
                {
                  type: "paragraph",
                  text: "<article data-tiara-id=\"95\"><p>Preview clean paragraph</p></article>"
                },
                {
                  type: "image",
                  url: "https://example.com/preview-inline.png",
                  alt: "Inline preview image"
                }
              ]
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
    const navigationSidebar = await screen.findByRole("region", {
      name: /navigation-sidebar/i
    });
    fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 북마크$/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });

    fireEvent.change(within(composerDialog).getByLabelText(/^URL$/i), {
      target: {
        value: "https://example.com/preview"
      }
    });
    fireEvent.click(within(composerDialog).getByRole("button", { name: /url 메타 불러오기/i }));

    await waitFor(() => {
      expect(within(composerDialog).getByText(/preview title/i)).toBeInTheDocument();
    });
    expect(within(composerDialog).getByText(/^Preview section heading$/i)).toBeInTheDocument();
    expect(within(composerDialog).getByText(/^Preview clean paragraph$/i)).toBeInTheDocument();
    expect(within(composerDialog).queryByText(/data-tiara-id/i)).not.toBeInTheDocument();
    expect(
      within(composerDialog).getByRole("img", { name: /Preview title 미리보기 이미지/i })
    ).toHaveAttribute("src", "https://example.com/preview-cover.png");
    expect(
      within(composerDialog).getByRole("img", { name: /Inline preview image/i })
    ).toHaveAttribute("src", "https://example.com/preview-inline.png");

    fireEvent.click(within(composerDialog).getByRole("button", { name: /북마크 저장/i }));

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
    const createBody = JSON.parse(String(createCall?.[1]?.body));
    expect(createBody).toMatchObject({
      url: "https://example.com/preview",
      sourceTitle: "Preview title",
      sourceContent: "Preview body",
      sourceSummary: "Preview summary"
    });
    expect(createBody).not.toHaveProperty("sourceImageUrl");
    expect(createBody).not.toHaveProperty("sourceBlocks");
  });

  it("replaces js-required composer previews with extension-rendered previews when the extension is installed", async () => {
    const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation((message) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "bookmark-extension:ping"
      ) {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              source: "bookmark-extension",
              type: "bookmark-extension:pong"
            }
          })
        );
      }

      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "bookmark-extension:extract-preview"
      ) {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              source: "bookmark-extension",
              type: "bookmark-extension:preview-result",
              requestId: (message as { requestId: string }).requestId,
              preview: {
                url: "https://example.com/js-preview",
                normalizedUrl: "https://example.com/js-preview",
                sourceTitle: "Extension rendered title",
                sourceContent: "Extension rendered content",
                sourceSummary: "Extension rendered summary",
                renderStatus: "ready",
                renderSource: "extension"
              }
            }
          })
        );
      }
    });

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

      if (url === "/api/bookmarks/extract" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            preview: {
              url: "https://example.com/js-preview",
              normalizedUrl: "https://example.com/js-preview",
              sourceTitle: "Worker metadata title",
              sourceSummary: "Worker metadata summary",
              renderStatus: "js_required",
              renderSource: "worker",
              renderReason: "spa_fallback"
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
    const navigationSidebar = await screen.findByRole("region", {
      name: /navigation-sidebar/i
    });
    fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 북마크$/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });

    fireEvent.change(within(composerDialog).getByLabelText(/^URL$/i), {
      target: {
        value: "https://example.com/js-preview"
      }
    });
    fireEvent.click(within(composerDialog).getByRole("button", { name: /url 메타 불러오기/i }));

    await waitFor(() => {
      expect(within(composerDialog).getByText(/^Extension rendered title$/i)).toBeInTheDocument();
    });
    expect(within(composerDialog).getByText(/^Extension rendered content$/i)).toBeInTheDocument();
    expect(
      within(composerDialog).queryByText(/^Worker metadata title$/i)
    ).not.toBeInTheDocument();
    expect(
      postMessageSpy.mock.calls.some(
        ([message]) =>
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "bookmark-extension:extract-preview" &&
          "url" in message &&
          message.url === "https://example.com/js-preview"
      )
    ).toBe(true);
  });

  it("shows fallback actions when bookmark preview extraction fails", async () => {
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
        return new Response(JSON.stringify({ error: "bookmark_extract_failed" }), {
          status: 502,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);
    const navigationSidebar = await screen.findByRole("region", {
      name: /navigation-sidebar/i
    });
    fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 북마크$/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });

    fireEvent.change(within(composerDialog).getByLabelText(/^URL$/i), {
      target: {
        value: "https://example.com/blocked"
      }
    });
    fireEvent.click(within(composerDialog).getByRole("button", { name: /url 메타 불러오기/i }));

    const fallbackRegion = await within(composerDialog).findByRole("region", {
      name: /bookmark-preview-fallback/i
    });

    expect(within(fallbackRegion).getByText(/자동 추출이 막혔습니다/i)).toBeInTheDocument();
    expect(
      within(fallbackRegion).getByText(/URL 메타 미리보기를 불러오지 못했습니다/i)
    ).toBeInTheDocument();
    expect(
      within(fallbackRegion).getByRole("button", { name: /확장 설치/i })
    ).toBeInTheDocument();
    expect(
      within(fallbackRegion).getByRole("button", { name: /수동 입력 계속/i })
    ).toBeInTheDocument();
    expect(
      within(fallbackRegion).getByRole("button", { name: /URL만 저장/i })
    ).toBeInTheDocument();

    fireEvent.click(within(fallbackRegion).getByRole("button", { name: /확장 설치/i }));

    expect(
      await screen.findByRole("dialog", { name: /extension-download-dialog/i })
    ).toBeInTheDocument();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks/extract",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("submits bookmark search with the selected search mode", async () => {
    const searchFixtures = Array.from({ length: 21 }, (_, index) => {
      const number = index + 1;
      return {
        id: `bookmark-transformer-${number}`,
        folderId: null,
        tagIds: [],
        url: `https://example.com/transformer-${number}`,
        isFavorite: false,
        isHidden: false,
        isTrashed: false,
        trashedAt: null,
        bookmarkColor: null,
        urlColor: null,
        sourceTitle: null,
        sourceContent: null,
        sourceSummary: null,
        userTitle: `Model note ${number}`,
        userContent: "Transformer summary",
        userSummary: null,
        displayTitle: `Model note ${number}`,
        displayContent: "Transformer summary",
        displaySummary: "",
        createdAt: `2026-04-13T08:${String(number).padStart(2, "0")}:00.000Z`,
        updatedAt: `2026-04-13T08:${String(number).padStart(2, "0")}:00.000Z`
      };
    });
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

      if (url === "/api/bookmarks?mode=content&query=transformer&limit=20&offset=0" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: searchFixtures.slice(0, 20),
            pagination: {
              limit: 20,
              offset: 0,
              total: searchFixtures.length,
              hasMore: true
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

      if (url === "/api/bookmarks?mode=content&query=transformer&limit=20&offset=20" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: searchFixtures.slice(20),
            pagination: {
              limit: 20,
              offset: 20,
              total: searchFixtures.length,
              hasMore: false
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
    fireEvent.click(screen.getByRole("button", { name: /^내용$/i }));
    fireEvent.click(screen.getByRole("button", { name: /검색 실행/i }));

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Model note 20$/i)).toBeInTheDocument();
    });
    expect(within(bookmarkListRegion).queryByText(/^Model note 21$/i)).not.toBeInTheDocument();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?mode=content&query=transformer&limit=20&offset=0",
      expect.objectContaining({
        credentials: "include"
      })
    );

    fireEvent.click(within(bookmarkListRegion).getByRole("button", { name: /^더 보기$/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/bookmarks?mode=content&query=transformer&limit=20&offset=20",
        expect.objectContaining({
          credentials: "include"
        })
      );
    });
    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Model note 21$/i)).toBeInTheDocument();
    });
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
          "/api/bookmarks?mode=all&tagMode=or&query=paper&favorite=1&folderId=folder-1&tagId=tag-1&tagId=tag-2&limit=20&offset=0" &&
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
    expect(within(searchPanel).getByText(/^현재 작업 조건$/i)).toBeInTheDocument();
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
      "/api/bookmarks?mode=all&tagMode=or&query=paper&favorite=1&folderId=folder-1&tagId=tag-1&tagId=tag-2&limit=20&offset=0",
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

      if (url === "/api/bookmarks?mode=all&query=paper&favorite=1&limit=20&offset=0" && !init?.method) {
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

      if (url === "/api/bookmarks?mode=all&query=paper&limit=20&offset=0" && !init?.method) {
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
      "/api/bookmarks?mode=all&query=paper&favorite=1&limit=20&offset=0",
      expect.objectContaining({
        credentials: "include"
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?mode=all&query=paper&limit=20&offset=0",
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
        (url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1" ||
          url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1&limit=20&offset=0") &&
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
      "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1&limit=20&offset=0",
      expect.objectContaining({
        credentials: "include"
      })
    );
  });

  it("shows the main folder overview and filters bookmarks from it", async () => {
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-root",
                folderId: "folder-1",
                tagIds: [],
                url: "https://example.com/root",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Root bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Root bookmark",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              },
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
              },
              {
                id: "bookmark-extension",
                folderId: null,
                tagIds: [],
                url: "https://example.com/extension",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Extension bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Extension bookmark",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              }
            ],
            ...(url.includes("limit=20")
              ? {
                  pagination: {
                    limit: 20,
                    offset: 0,
                    total: 3,
                    hasMore: false
                  }
                }
              : {})
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url === "/api/bookmarks/bookmark-1/assets" && !init?.method) {
        return new Response(
          JSON.stringify({
            assets: [
              {
                id: "asset-1",
                bookmarkId: "bookmark-1",
                fileName: "thumb.png",
                mimeType: "image/png",
                size: 1234,
                contentUrl: "https://cdn.example.com/thumb.png",
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

      if (
        (url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1" ||
          url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1&limit=20&offset=0") &&
        !init?.method
      ) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-root",
                folderId: "folder-1",
                tagIds: [],
                url: "https://example.com/root",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Root bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Root bookmark",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              },
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

      if (url === "/api/bookmarks?trashed=1" && !init?.method) {
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

    const mainPanel = await screen.findByRole("region", {
      name: /dashboard-main/i
    });
    const searchPanel = within(mainPanel).getByRole("region", { name: /search-panel/i });
    const bookmarkListRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-list/i
    });
    const sidebar = screen.getByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    let folderOverview = within(sidebar).getByRole("region", {
      name: /folder-overview/i
    });

    expect(within(folderOverview).getByText(/^폴더$/i)).toBeInTheDocument();
    expect(
      within(folderOverview).getByRole("button", { name: /모든 북마크 보기/i })
    ).toHaveTextContent(/3$/i);
    expect(
      within(folderOverview).getByRole("button", { name: /미분류 보기/i })
    ).toHaveTextContent(/1$/i);
    expect(
      within(folderOverview).getByRole("button", { name: /휴지통 보기/i })
    ).toHaveTextContent(/0$/i);
    expect(
      within(folderOverview).getByRole("button", { name: /전체 폴더 보기/i })
    ).toHaveTextContent(/^전체$/i);
    expect(within(folderOverview).getByRole("button", { name: /폴더 전부 펼치기/i })).toBeInTheDocument();
    expect(within(folderOverview).getByRole("button", { name: /폴더 모두 접기/i })).toBeInTheDocument();
    expect(within(folderOverview).getByPlaceholderText(/폴더 찾기/i)).toBeInTheDocument();
    expect(within(folderOverview).getByRole("button", { name: /Reading 폴더 보기/i })).toBeInTheDocument();
    expect(
      within(folderOverview).queryByRole("button", { name: /Papers 폴더 보기/i })
    ).not.toBeInTheDocument();
    expect(folderOverview.querySelector(".folder-overview-state")).not.toBeInTheDocument();
    expect(folderOverview.querySelector(".folder-icon-badge")).toBeInTheDocument();
    expect(
      Array.from(folderOverview.querySelectorAll(".folder-overview-count")).map((element) =>
        element.textContent?.trim()
      )
    ).toEqual(["2"]);
    expect(
      within(folderOverview).getByRole("button", { name: /Reading 폴더 펼치기/i })
    ).toBeInTheDocument();
    expect(
      within(folderOverview)
        .getByRole("button", { name: /Reading 폴더 보기/i })
        .closest(".folder-overview-row")
    ).toHaveAttribute("data-depth", "0");
    expect(within(folderOverview).getByRole("button", { name: /Reading 하위 폴더 추가/i })).toBeInTheDocument();
    expect(within(folderOverview).getByRole("button", { name: /Reading 폴더 더보기/i })).toBeInTheDocument();
    expect(
      within(folderOverview)
        .getByRole("button", { name: /Reading 폴더 더보기/i })
        .closest(".folder-overview-inline-actions")
    ).toHaveClass("folder-overview-inline-actions-visible");

    fireEvent.click(within(folderOverview).getByRole("button", { name: /Reading 폴더 펼치기/i }));
    expect(within(folderOverview).getByRole("button", { name: /Papers 폴더 보기/i })).toBeInTheDocument();
    expect(
      within(folderOverview)
        .getByRole("button", { name: /Papers 폴더 보기/i })
        .closest(".folder-overview-row")
    ).toHaveAttribute("data-depth", "1");
    expect(
      Array.from(folderOverview.querySelectorAll(".folder-overview-count")).map((element) =>
        element.textContent?.trim()
      )
    ).toEqual(["2", "1"]);

    fireEvent.click(within(folderOverview).getByRole("button", { name: /Reading 폴더 접기/i }));
    expect(
      within(folderOverview).queryByRole("button", { name: /Papers 폴더 보기/i })
    ).not.toBeInTheDocument();

    fireEvent.click(within(folderOverview).getByRole("button", { name: /폴더 전부 펼치기/i }));
    expect(within(folderOverview).getByRole("button", { name: /Papers 폴더 보기/i })).toBeInTheDocument();

    fireEvent.click(within(folderOverview).getByRole("button", { name: /폴더 모두 접기/i }));
    expect(
      within(folderOverview).queryByRole("button", { name: /Papers 폴더 보기/i })
    ).not.toBeInTheDocument();

    fireEvent.change(within(folderOverview).getByPlaceholderText(/폴더 찾기/i), {
      target: { value: "Papers" }
    });
    expect(within(folderOverview).getByRole("button", { name: /Papers 폴더 보기/i })).toBeInTheDocument();

    fireEvent.change(within(folderOverview).getByPlaceholderText(/폴더 찾기/i), {
      target: { value: "" }
    });
    fireEvent.click(within(folderOverview).getByRole("button", { name: /미분류 보기/i }));
    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Extension bookmark$/i)).toBeInTheDocument();
    });
    expect(within(bookmarkListRegion).queryByText(/^Root bookmark$/i)).not.toBeInTheDocument();

    fireEvent.click(within(folderOverview).getByRole("button", { name: /휴지통 보기/i }));
    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^보관한 북마크가 없습니다\.$/i)).toBeInTheDocument();
    });

    fireEvent.click(within(folderOverview).getByRole("button", { name: /모든 북마크 보기/i }));
    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Root bookmark$/i)).toBeInTheDocument();
    });

    fireEvent.click(within(folderOverview).getByRole("button", { name: /Reading 폴더 보기/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Child folder result$/i)).toBeInTheDocument();
    });
    folderOverview = within(
      screen.getByRole("complementary", {
        name: /dashboard-sidebar/i
      })
    ).getByRole("region", {
      name: /folder-overview/i
    });
    expect(
      Array.from(folderOverview.querySelectorAll(".folder-overview-count")).map((element) =>
        element.textContent?.trim()
      )
    ).toEqual(["2", "1"]);

    expect(within(searchPanel).getByRole("button", { name: /고급 필터 열기/i })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(within(searchPanel).queryByText(/^기간$/i)).not.toBeInTheDocument();

    fireEvent.click(within(folderOverview).getByRole("button", { name: /Reading 하위 폴더 추가/i }));

    const folderDialog = await screen.findByRole("dialog", {
      name: /folder-manager-dialog/i
    });
    const folderManager = within(folderDialog).getByRole("region", { name: /folder-manager/i });
    expect((within(folderManager).getByLabelText(/부모 폴더/i) as HTMLSelectElement).value).toBe(
      "folder-1"
    );

    fireEvent.click(within(folderDialog).getByRole("button", { name: /^닫기$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /folder-manager-dialog/i })).not.toBeInTheDocument();
    });

    openFolderOverviewActionMenu(folderOverview, "Reading");

    const readingFolderMenu = within(folderOverview).getByRole("menu", {
      name: /Reading 폴더 메뉴/i
    });
    expect(
      within(readingFolderMenu)
        .getAllByRole("button")
        .map((button) => button.textContent?.trim())
    ).toEqual(["추가", "수정", "삭제"]);
    expect(within(readingFolderMenu).getByRole("button", { name: /Reading 하위 폴더 추가/i })).toBeInTheDocument();
    expect(within(readingFolderMenu).getByRole("button", { name: /Reading 폴더 수정/i })).toBeInTheDocument();
    expect(within(readingFolderMenu).getByRole("button", { name: /Reading 폴더 삭제/i })).toBeInTheDocument();

    expect(
      fetchSpy.mock.calls.some(
        ([url, options]) =>
          url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1" &&
          (options as RequestInit | undefined)?.credentials === "include"
      )
    ).toBe(false);
  });

  it("updates folder results without waiting for bookmark asset preloading", async () => {
    const jsonHeaders = {
      "content-type": "application/json"
    };
    const assetRequestCountByUrl = new Map<string, number>();
    let resolveDelayedAssetResponse: (() => void) | null = null;

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "/api/auth/session" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              authenticated: true,
              user: {
                uid: "firebase-user-1",
                email: "keygenerator25@gmail.com"
              }
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/bookmarks" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              bookmarks: [
                {
                  id: "bookmark-root",
                  folderId: "folder-1",
                  tagIds: [],
                  url: "https://example.com/root",
                  isFavorite: false,
                  isHidden: false,
                  bookmarkColor: null,
                  urlColor: null,
                  sourceTitle: null,
                  sourceContent: null,
                  sourceSummary: null,
                  userTitle: "Root bookmark",
                  userContent: "",
                  userSummary: "",
                  displayTitle: "Root bookmark",
                  displayContent: "",
                  displaySummary: "",
                  createdAt: "2026-04-14T03:00:00.000Z",
                  updatedAt: "2026-04-14T03:00:00.000Z"
                },
                {
                  id: "bookmark-child",
                  folderId: "folder-2",
                  tagIds: [],
                  url: "https://example.com/child-folder",
                  isFavorite: false,
                  isHidden: false,
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
                },
                {
                  id: "bookmark-outside",
                  folderId: "folder-3",
                  tagIds: [],
                  url: "https://example.com/outside",
                  isFavorite: false,
                  isHidden: false,
                  bookmarkColor: null,
                  urlColor: null,
                  sourceTitle: null,
                  sourceContent: null,
                  sourceSummary: null,
                  userTitle: "Outside bookmark",
                  userContent: "",
                  userSummary: "",
                  displayTitle: "Outside bookmark",
                  displayContent: "",
                  displaySummary: "",
                  createdAt: "2026-04-14T03:00:00.000Z",
                  updatedAt: "2026-04-14T03:00:00.000Z"
                }
              ]
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              bookmarks: [
                {
                  id: "bookmark-root",
                  folderId: "folder-1",
                  tagIds: [],
                  url: "https://example.com/root",
                  isFavorite: false,
                  isHidden: false,
                  bookmarkColor: null,
                  urlColor: null,
                  sourceTitle: null,
                  sourceContent: null,
                  sourceSummary: null,
                  userTitle: "Root bookmark",
                  userContent: "",
                  userSummary: "",
                  displayTitle: "Root bookmark",
                  displayContent: "",
                  displaySummary: "",
                  createdAt: "2026-04-14T03:00:00.000Z",
                  updatedAt: "2026-04-14T03:00:00.000Z"
                },
                {
                  id: "bookmark-child",
                  folderId: "folder-2",
                  tagIds: [],
                  url: "https://example.com/child-folder",
                  isFavorite: false,
                  isHidden: false,
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
              headers: jsonHeaders
            }
          )
        );
      }

      if (
        (url === "/api/bookmarks/bookmark-root/assets" ||
          url === "/api/bookmarks/bookmark-child/assets" ||
          url === "/api/bookmarks/bookmark-outside/assets") &&
        !init?.method
      ) {
        const nextCount = (assetRequestCountByUrl.get(url) ?? 0) + 1;
        assetRequestCountByUrl.set(url, nextCount);

        if (url === "/api/bookmarks/bookmark-root/assets" && nextCount === 2) {
          return new Promise<Response>((resolve) => {
            resolveDelayedAssetResponse = () => {
              resolve(
                new Response(JSON.stringify({ assets: [] }), {
                  status: 200,
                  headers: jsonHeaders
                })
              );
            };
          });
        }

        return Promise.resolve(
          new Response(JSON.stringify({ assets: [] }), {
            status: 200,
            headers: jsonHeaders
          })
        );
      }

      if (url === "/api/folders" && !init?.method) {
        return Promise.resolve(
          new Response(
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
                  color: "#14b8a6",
                  icon: "newspaper",
                  parentFolderId: "folder-1",
                  sortOrder: 0,
                  createdAt: "2026-04-13T10:00:00.000Z",
                  updatedAt: "2026-04-13T10:00:00.000Z"
                },
                {
                  id: "folder-3",
                  name: "Archive",
                  color: "#1d4ed8",
                  icon: "folder",
                  parentFolderId: null,
                  sortOrder: 1,
                  createdAt: "2026-04-13T10:00:00.000Z",
                  updatedAt: "2026-04-13T10:00:00.000Z"
                }
              ]
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/recommendations" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              favorites: [],
              recent: [],
              frequent: []
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/tags" && !init?.method) {
        return Promise.resolve(
          new Response(JSON.stringify({ tags: [] }), {
            status: 200,
            headers: jsonHeaders
          })
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const sidebar = await screen.findByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    const folderOverview = within(sidebar).getByRole("region", {
      name: /folder-overview/i
    });
    const mainPanel = await screen.findByRole("region", {
      name: /dashboard-main/i
    });
    const bookmarkListRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-list/i
    });

    expect(within(bookmarkListRegion).getByText(/^Outside bookmark$/i)).toBeInTheDocument();

    fireEvent.click(within(folderOverview).getByRole("button", { name: /Reading 폴더 보기/i }));

    await waitFor(
      () => {
        expect(within(bookmarkListRegion).queryByText(/^Outside bookmark$/i)).not.toBeInTheDocument();
      },
      {
        timeout: 150
      }
    );
    expect(within(bookmarkListRegion).getByText(/^Root bookmark$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^Child folder result$/i)).toBeInTheDocument();

    resolveDelayedAssetResponse?.();
  });

  it("supports drag reordering and moving folders from the main folder overview", async () => {
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
                name: "Articles",
                color: "#0f766e",
                icon: "newspaper",
                parentFolderId: null,
                sortOrder: 1,
                createdAt: "2026-04-13T11:00:00.000Z",
                updatedAt: "2026-04-13T11:00:00.000Z"
              },
              {
                id: "folder-3",
                name: "Papers",
                color: "#2563eb",
                icon: "file-text",
                parentFolderId: "folder-1",
                sortOrder: 0,
                createdAt: "2026-04-13T12:00:00.000Z",
                updatedAt: "2026-04-13T12:00:00.000Z"
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

      if (url === "/api/folders/reorder" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            folders: [
              {
                id: "folder-2",
                name: "Articles",
                color: "#0f766e",
                icon: "newspaper",
                parentFolderId: null,
                sortOrder: 0,
                createdAt: "2026-04-13T11:00:00.000Z",
                updatedAt: "2026-04-13T13:00:00.000Z"
              },
              {
                id: "folder-1",
                name: "Reading",
                color: "#f97316",
                icon: "book-open",
                parentFolderId: null,
                sortOrder: 1,
                createdAt: "2026-04-13T10:00:00.000Z",
                updatedAt: "2026-04-13T13:00:00.000Z"
              },
              {
                id: "folder-3",
                name: "Papers",
                color: "#2563eb",
                icon: "file-text",
                parentFolderId: "folder-1",
                sortOrder: 0,
                createdAt: "2026-04-13T12:00:00.000Z",
                updatedAt: "2026-04-13T12:00:00.000Z"
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

      if (url === "/api/folders/folder-3/move" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            folders: [
              {
                id: "folder-2",
                name: "Articles",
                color: "#0f766e",
                icon: "newspaper",
                parentFolderId: null,
                sortOrder: 0,
                createdAt: "2026-04-13T11:00:00.000Z",
                updatedAt: "2026-04-13T13:30:00.000Z"
              },
              {
                id: "folder-1",
                name: "Reading",
                color: "#f97316",
                icon: "book-open",
                parentFolderId: null,
                sortOrder: 1,
                createdAt: "2026-04-13T10:00:00.000Z",
                updatedAt: "2026-04-13T13:00:00.000Z"
              },
              {
                id: "folder-3",
                name: "Papers",
                color: "#2563eb",
                icon: "file-text",
                parentFolderId: "folder-2",
                sortOrder: 0,
                createdAt: "2026-04-13T12:00:00.000Z",
                updatedAt: "2026-04-13T13:30:00.000Z"
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
    const folderOverview = within(sidebar).getByRole("region", {
      name: /folder-overview/i
    });

    const rootDragHandle = within(folderOverview).getByRole("button", {
      name: /reading 폴더 드래그 정렬/i
    });
    const rootTarget = within(folderOverview).getByRole("button", {
      name: /articles 폴더 보기/i
    });

    fireEvent.dragStart(rootDragHandle);
    fireEvent.dragOver(rootTarget);
    fireEvent.drop(rootTarget);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/folders/reorder",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            parentFolderId: null,
            folderIds: ["folder-2", "folder-1"]
          })
        })
      );
    });

    fireEvent.click(within(folderOverview).getByRole("button", { name: /reading 폴더 펼치기/i }));

    const childDragHandle = await within(folderOverview).findByRole("button", {
      name: /papers 폴더 드래그 정렬/i
    });
    const moveTarget = within(folderOverview).getByRole("button", {
      name: /articles 폴더 보기/i
    });

    fireEvent.dragStart(childDragHandle);
    fireEvent.dragOver(moveTarget);
    fireEvent.drop(moveTarget);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/folders/folder-3/move",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            parentFolderId: "folder-2"
          })
        })
      );
    });
  });

  it("filters folder overview results from cached inventory without waiting for the folder request", async () => {
    const jsonHeaders = {
      "content-type": "application/json"
    };
    let resolveDelayedFolderResponse: (() => void) | null = null;

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "/api/auth/session" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              authenticated: true,
              user: {
                uid: "firebase-user-1",
                email: "keygenerator25@gmail.com"
              }
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/bookmarks" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              bookmarks: [
                {
                  id: "bookmark-root",
                  folderId: "folder-1",
                  tagIds: [],
                  url: "https://example.com/root",
                  isFavorite: false,
                  isHidden: false,
                  bookmarkColor: null,
                  urlColor: null,
                  sourceTitle: null,
                  sourceContent: null,
                  sourceSummary: null,
                  userTitle: "Root bookmark",
                  userContent: "",
                  userSummary: "",
                  displayTitle: "Root bookmark",
                  displayContent: "",
                  displaySummary: "",
                  createdAt: "2026-04-14T03:00:00.000Z",
                  updatedAt: "2026-04-14T03:00:00.000Z"
                },
                {
                  id: "bookmark-child",
                  folderId: "folder-2",
                  tagIds: [],
                  url: "https://example.com/child-folder",
                  isFavorite: false,
                  isHidden: false,
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
                  createdAt: "2026-04-14T02:00:00.000Z",
                  updatedAt: "2026-04-14T02:00:00.000Z"
                },
                {
                  id: "bookmark-outside",
                  folderId: "folder-3",
                  tagIds: [],
                  url: "https://example.com/outside",
                  isFavorite: false,
                  isHidden: false,
                  bookmarkColor: null,
                  urlColor: null,
                  sourceTitle: null,
                  sourceContent: null,
                  sourceSummary: null,
                  userTitle: "Outside bookmark",
                  userContent: "",
                  userSummary: "",
                  displayTitle: "Outside bookmark",
                  displayContent: "",
                  displaySummary: "",
                  createdAt: "2026-04-14T01:00:00.000Z",
                  updatedAt: "2026-04-14T01:00:00.000Z"
                }
              ]
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1" && !init?.method) {
        return new Promise<Response>((resolve) => {
          resolveDelayedFolderResponse = () => {
            resolve(
              new Response(
                JSON.stringify({
                  bookmarks: [
                    {
                      id: "bookmark-root",
                      folderId: "folder-1",
                      tagIds: [],
                      url: "https://example.com/root",
                      isFavorite: false,
                      isHidden: false,
                      bookmarkColor: null,
                      urlColor: null,
                      sourceTitle: null,
                      sourceContent: null,
                      sourceSummary: null,
                      userTitle: "Root bookmark",
                      userContent: "",
                      userSummary: "",
                      displayTitle: "Root bookmark",
                      displayContent: "",
                      displaySummary: "",
                      createdAt: "2026-04-14T03:00:00.000Z",
                      updatedAt: "2026-04-14T03:00:00.000Z"
                    },
                    {
                      id: "bookmark-child",
                      folderId: "folder-2",
                      tagIds: [],
                      url: "https://example.com/child-folder",
                      isFavorite: false,
                      isHidden: false,
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
                      createdAt: "2026-04-14T02:00:00.000Z",
                      updatedAt: "2026-04-14T02:00:00.000Z"
                    }
                  ]
                }),
                {
                  status: 200,
                  headers: jsonHeaders
                }
              )
            );
          };
        });
      }

      if (
        (url === "/api/bookmarks/bookmark-root/assets" ||
          url === "/api/bookmarks/bookmark-child/assets" ||
          url === "/api/bookmarks/bookmark-outside/assets") &&
        !init?.method
      ) {
        return Promise.resolve(
          new Response(JSON.stringify({ assets: [] }), {
            status: 200,
            headers: jsonHeaders
          })
        );
      }

      if (url === "/api/folders" && !init?.method) {
        return Promise.resolve(
          new Response(
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
                  color: "#14b8a6",
                  icon: "newspaper",
                  parentFolderId: "folder-1",
                  sortOrder: 0,
                  createdAt: "2026-04-13T10:00:00.000Z",
                  updatedAt: "2026-04-13T10:00:00.000Z"
                },
                {
                  id: "folder-3",
                  name: "Archive",
                  color: "#1d4ed8",
                  icon: "folder",
                  parentFolderId: null,
                  sortOrder: 1,
                  createdAt: "2026-04-13T10:00:00.000Z",
                  updatedAt: "2026-04-13T10:00:00.000Z"
                }
              ]
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/recommendations" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              favorites: [],
              recent: [],
              frequent: []
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/tags" && !init?.method) {
        return Promise.resolve(
          new Response(JSON.stringify({ tags: [] }), {
            status: 200,
            headers: jsonHeaders
          })
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const sidebar = await screen.findByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    const folderOverview = within(sidebar).getByRole("region", {
      name: /folder-overview/i
    });
    const mainPanel = await screen.findByRole("region", {
      name: /dashboard-main/i
    });
    const bookmarkListRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-list/i
    });

    expect(within(bookmarkListRegion).getByText(/^Outside bookmark$/i)).toBeInTheDocument();

    fireEvent.click(within(folderOverview).getByRole("button", { name: /Reading 폴더 보기/i }));

    await waitFor(
      () => {
        expect(within(bookmarkListRegion).queryByText(/^Outside bookmark$/i)).not.toBeInTheDocument();
      },
      {
        timeout: 150
      }
    );
    expect(within(bookmarkListRegion).getByText(/^Root bookmark$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^Child folder result$/i)).toBeInTheDocument();

    resolveDelayedFolderResponse?.();
  });

  it("preserves folder counts for other folders after selecting one folder", async () => {
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
                id: "bookmark-reading",
                folderId: "folder-1",
                tagIds: [],
                url: "https://example.com/reading",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Reading item",
                userContent: "",
                userSummary: "",
                displayTitle: "Reading item",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              },
              {
                id: "bookmark-archive",
                folderId: "folder-2",
                tagIds: [],
                url: "https://example.com/archive",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Archive item",
                userContent: "",
                userSummary: "",
                displayTitle: "Archive item",
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

      if (url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-reading",
                folderId: "folder-1",
                tagIds: [],
                url: "https://example.com/reading",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Reading item",
                userContent: "",
                userSummary: "",
                displayTitle: "Reading item",
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
                name: "Archive",
                color: "#1d4ed8",
                icon: "folder",
                parentFolderId: null,
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

    await screen.findByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    let folderOverview = within(
      screen.getByRole("complementary", {
        name: /dashboard-sidebar/i
      })
    ).getByRole("region", {
      name: /folder-overview/i
    });

    expect(
      Array.from(folderOverview.querySelectorAll(".folder-overview-count")).map((element) =>
        element.textContent?.trim()
      )
    ).toEqual(["1", "1"]);

    fireEvent.click(within(folderOverview).getByRole("button", { name: /Reading 폴더 보기/i }));

    await waitFor(() => {
      expect(
        within(screen.getByRole("complementary", { name: /dashboard-sidebar/i })).getByRole("button", {
          name: /Reading 폴더 보기/i
        })
      ).toHaveAttribute("aria-pressed", "true");
    });
    expect(
      fetchSpy.mock.calls.some(
        ([url, options]) =>
          url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1" &&
          (options as RequestInit | undefined)?.credentials === "include"
      )
    ).toBe(false);
    folderOverview = within(
      screen.getByRole("complementary", {
        name: /dashboard-sidebar/i
      })
    ).getByRole("region", {
      name: /folder-overview/i
    });
    expect(
      Array.from(folderOverview.querySelectorAll(".folder-overview-count")).map((element) =>
        element.textContent?.trim()
      )
    ).toEqual(["1", "1"]);
  });

  it("hides hidden folders and bookmarks until the hidden toggle is enabled", async () => {
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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-visible",
                folderId: "folder-visible",
                tagIds: [],
                url: "https://example.com/visible",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Visible bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Visible bookmark",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              },
              {
                id: "bookmark-hidden",
                folderId: "folder-hidden",
                tagIds: [],
                url: "https://example.com/secret",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Secret bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Secret bookmark",
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

      if (
        (url === "/api/bookmarks?query=secret" ||
          url === "/api/bookmarks?query=secret&limit=20&offset=0") &&
        !init?.method
      ) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-hidden",
                folderId: "folder-hidden",
                tagIds: [],
                url: "https://example.com/secret",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Secret bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Secret bookmark",
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
                id: "folder-visible",
                name: "Visible",
                color: "#f97316",
                icon: "book-open",
                isHidden: false,
                parentFolderId: null,
                sortOrder: 0,
                createdAt: "2026-04-13T10:00:00.000Z",
                updatedAt: "2026-04-13T10:00:00.000Z"
              },
              {
                id: "folder-hidden",
                name: "Private",
                color: "#1d4ed8",
                icon: "folder",
                isHidden: true,
                parentFolderId: null,
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
            recent: [
              {
                id: "bookmark-hidden",
                folderId: "folder-hidden",
                tagIds: [],
                url: "https://example.com/secret",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Secret bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Secret bookmark",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              }
            ],
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

    const sidebar = await screen.findByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    const mainPanel = await screen.findByRole("region", {
      name: /dashboard-main/i
    });
    const folderOverview = within(sidebar).getByRole("region", {
      name: /folder-overview/i
    });
    const bookmarkListRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-list/i
    });
    const searchPanel = within(mainPanel).getByRole("region", {
      name: /search-panel/i
    });
    const recommendationList = within(mainPanel).getByRole("region", {
      name: /recommendation-list/i
    });
    const homePage = screen.getByRole("region", { name: /home-page/i });
    fireEvent.click(within(homePage).getByRole("button", { name: /^추천 보기$/i }));
    await waitFor(() => {
      expect(recommendationList).toHaveAttribute("aria-busy", "true");
    });
    await waitFor(() => {
      expect(recommendationList).toHaveAttribute("aria-busy", "false");
    });

    expect(within(folderOverview).getByRole("button", { name: /숨김 폴더 보기/i })).toBeInTheDocument();
    expect(within(folderOverview).queryByRole("button", { name: /Private 폴더 보기/i })).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^Visible bookmark$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^Secret bookmark$/i)).not.toBeInTheDocument();
    expect(within(recommendationList).queryByText(/^Secret bookmark$/i)).not.toBeInTheDocument();

    fireEvent.change(within(searchPanel).getByPlaceholderText(/링크, 제목, 내용 검색/i), {
      target: { value: "secret" }
    });
    fireEvent.click(within(searchPanel).getByRole("button", { name: /검색 실행/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).queryByText(/^Secret bookmark$/i)).not.toBeInTheDocument();
    });

    fireEvent.click(within(folderOverview).getByRole("button", { name: /숨김 폴더 보기/i }));

    await waitFor(() => {
    expect(within(folderOverview).getByRole("button", { name: /숨김 폴더 숨기기/i })).toBeInTheDocument();
    });
    expect(within(folderOverview).getByRole("button", { name: /Private 폴더 보기/i })).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^Secret bookmark$/i)).toBeInTheDocument();
    expect(within(recommendationList).getByText(/^Secret bookmark$/i)).toBeInTheDocument();
  });

  it("hides hidden bookmarks until the bookmark hidden toggle is enabled", async () => {
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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-visible",
                folderId: null,
                tagIds: [],
                url: "https://example.com/visible",
                isFavorite: false,
                isHidden: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Visible bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Visible bookmark",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              },
              {
                id: "bookmark-hidden",
                folderId: null,
                tagIds: [],
                url: "https://example.com/secret",
                isFavorite: false,
                isHidden: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Secret bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Secret bookmark",
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
                id: "folder-visible",
                name: "Visible",
                color: "#f97316",
                icon: "book-open",
                isHidden: false,
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
            recent: [
              {
                id: "bookmark-hidden",
                folderId: null,
                tagIds: [],
                url: "https://example.com/secret",
                isFavorite: false,
                isHidden: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Secret bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Secret bookmark",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              }
            ],
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

    const sidebar = await screen.findByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    const mainPanel = await screen.findByRole("region", {
      name: /dashboard-main/i
    });
    const bookmarkListRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-list/i
    });
    const searchPanel = within(mainPanel).getByRole("region", {
      name: /search-panel/i
    });
    const recommendationList = within(mainPanel).getByRole("region", {
      name: /recommendation-list/i
    });
    const homePage = screen.getByRole("region", { name: /home-page/i });
    fireEvent.click(within(homePage).getByRole("button", { name: /^추천 보기$/i }));
    await waitFor(() => {
      expect(recommendationList).toHaveAttribute("aria-busy", "true");
    });
    await waitFor(() => {
      expect(recommendationList).toHaveAttribute("aria-busy", "false");
    });

    const hiddenBookmarkToggle = within(bookmarkListRegion).getByRole("button", {
      name: /숨김 북마크 보기/i
    });
    expect(hiddenBookmarkToggle).toBeInTheDocument();
    expect(hiddenBookmarkToggle).toHaveTextContent(/^🔒$/);
    expect(within(bookmarkListRegion).queryByText(/^숨김 북마크 보기$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^Visible bookmark$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^Secret bookmark$/i)).not.toBeInTheDocument();
    expect(within(recommendationList).queryByText(/^Secret bookmark$/i)).not.toBeInTheDocument();

    fireEvent.change(within(searchPanel).getByPlaceholderText(/링크, 제목, 내용 검색/i), {
      target: { value: "secret" }
    });
    fireEvent.click(within(searchPanel).getByRole("button", { name: /검색 실행/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).queryByText(/^Secret bookmark$/i)).not.toBeInTheDocument();
    });

    fireEvent.click(hiddenBookmarkToggle);

    await waitFor(() => {
      expect(
        within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 숨기기/i })
      ).toBeInTheDocument();
    });
    expect(
      within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 숨기기/i })
    ).toHaveTextContent(/^🔓$/);
    expect(within(bookmarkListRegion).queryByText(/^숨김 북마크 숨기기$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^Secret bookmark$/i)).toBeInTheDocument();
    expect(within(recommendationList).getByText(/^Secret bookmark$/i)).toBeInTheDocument();
    const secretBookmarkRow = within(bookmarkListRegion)
      .getByText(/^Secret bookmark$/i)
      .closest(".bookmark-list-row");
    expect(secretBookmarkRow).not.toBeNull();
    expect(within(secretBookmarkRow as HTMLElement).getByText(/^🔒$/)).toBeInTheDocument();
    const secretRecommendationItem = within(recommendationList)
      .getByText(/^Secret bookmark$/i)
      .closest(".recommendation-item");
    expect(secretRecommendationItem).not.toBeNull();
    expect(within(secretRecommendationItem as HTMLElement).getByText(/^🔒$/)).toBeInTheDocument();
  });

  it("keeps hidden bookmarks in hidden folders hidden until both visibility toggles are enabled", async () => {
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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-visible",
                folderId: null,
                tagIds: [],
                url: "https://example.com/visible",
                isFavorite: false,
                isHidden: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Visible bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Visible bookmark",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              },
              {
                id: "bookmark-hidden-visible-folder",
                folderId: "folder-visible",
                tagIds: [],
                url: "https://example.com/secret-visible-folder",
                isFavorite: false,
                isHidden: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Secret in visible folder",
                userContent: "",
                userSummary: "",
                displayTitle: "Secret in visible folder",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              },
              {
                id: "bookmark-hidden-hidden-folder",
                folderId: "folder-hidden",
                tagIds: [],
                url: "https://example.com/secret-hidden-folder",
                isFavorite: false,
                isHidden: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Secret in hidden folder",
                userContent: "",
                userSummary: "",
                displayTitle: "Secret in hidden folder",
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
                id: "folder-visible",
                name: "Visible",
                color: "#f97316",
                icon: "book-open",
                isHidden: false,
                parentFolderId: null,
                sortOrder: 0,
                createdAt: "2026-04-13T10:00:00.000Z",
                updatedAt: "2026-04-13T10:00:00.000Z"
              },
              {
                id: "folder-hidden",
                name: "Private",
                color: "#1d4ed8",
                icon: "folder",
                isHidden: true,
                parentFolderId: null,
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

    const mainPanel = await screen.findByRole("region", {
      name: /dashboard-main/i
    });
    const folderOverview = within(screen.getByRole("complementary", { name: /dashboard-sidebar/i })).getByRole(
      "region",
      {
        name: /folder-overview/i
      }
    );
    const bookmarkListRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-list/i
    });
    expect(within(bookmarkListRegion).getByText(/^Visible bookmark$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^Secret in visible folder$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^Secret in hidden folder$/i)).not.toBeInTheDocument();

    fireEvent.click(
      within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 보기/i })
    );

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 숨기기/i })).toBeInTheDocument();
    });
    expect(within(bookmarkListRegion).getByText(/^Secret in visible folder$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^Secret in hidden folder$/i)).not.toBeInTheDocument();

    fireEvent.click(
      within(folderOverview).getByRole("button", { name: /숨김 폴더 보기/i })
    );

    await waitFor(() => {
      expect(within(folderOverview).getByRole("button", { name: /숨김 폴더 숨기기/i })).toBeInTheDocument();
    });
    expect(within(bookmarkListRegion).getByText(/^Secret in hidden folder$/i)).toBeInTheDocument();
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
    expect(within(searchPanel).getByRole("region", { name: /desktop-search-toolbar/i })).toBeInTheDocument();

    expect(within(searchPanel).queryByLabelText(/즐겨찾기만/i)).not.toBeInTheDocument();
    expect(within(searchPanel).queryByText(/^기간$/i)).not.toBeInTheDocument();

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
    expect(within(searchPanel).getByText(/^필터$/i, { selector: "legend" })).toBeInTheDocument();
    expect(within(searchPanel).queryByText(/^고급 필터$/i)).not.toBeInTheDocument();
    expect(within(searchPanel).getByText(/^기간$/i)).toBeInTheDocument();
    expect(within(searchPanel).getByText(/^분류$/i)).toBeInTheDocument();
    expect(within(searchPanel).getByText(/^상태$/i)).toBeInTheDocument();
    expect(within(searchPanel).getByText(/^폴더$/i, { selector: "span" })).toBeInTheDocument();
    expect(within(searchPanel).getByText(/^하위 포함$/i, { selector: "span" })).toBeInTheDocument();
    expect(within(searchPanel).getByText(/^즐겨찾기$/i, { selector: "span" })).toBeInTheDocument();
    expect(within(searchPanel).getByText(/^요약$/i, { selector: "span" })).toBeInTheDocument();
  });

  it("shows a URL-only bookmark when searching by a URL substring", async () => {
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

      if (url === "/api/bookmarks?mode=all&query=ch&limit=20&offset=0" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-chatgpt",
                folderId: null,
                tagIds: [],
                url: "https://chatgpt.com/",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: null,
                userContent: "",
                userSummary: "",
                displayTitle: "",
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

      if (url === "/api/bookmarks/bookmark-chatgpt/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
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

    const mainPanel = await screen.findByRole("region", { name: /result-primary-column/i });
    const bookmarkListRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-list/i
    });
    const searchPanel = within(mainPanel).getByRole("region", {
      name: /search-panel/i
    });

    fireEvent.change(within(searchPanel).getByPlaceholderText(/링크, 제목, 내용 검색/i), {
      target: { value: "ch" }
    });
    fireEvent.click(within(searchPanel).getByRole("button", { name: /검색 실행/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/bookmarks?mode=all&query=ch&limit=20&offset=0",
        expect.objectContaining({
          credentials: "include"
        })
      );
    });
    await waitFor(() => {
      const matchingRows = within(bookmarkListRegion).getAllByText(/^https:\/\/chatgpt\.com\/$/i);
      expect(matchingRows.length).toBeGreaterThan(0);
    });
  });

  it("starts with a collapsed search panel on mobile and opens it on demand", async () => {
    stubDashboardViewport(640);

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

    fireEvent.click(await screen.findByRole("tab", { name: /^북마크$/i }));

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
    stubDashboardViewport(1024);
  });

  it("shows folder, bookmark, and recommendation tabs on mobile with compact header actions", async () => {
    stubDashboardViewport(640);

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

    const tablist = within(sidebar).getByRole("tablist", { name: /mobile-sidebar-tabs/i });
    const folderPanelButton = within(tablist).getByRole("tab", {
      name: /^폴더$/i
    });
    const bookmarkPanelButton = within(tablist).getByRole("tab", {
      name: /^북마크$/i
    });
    const recommendationPanelButton = within(tablist).getByRole("tab", {
      name: /^추천$/i
    });

    expect(screen.getByRole("button", { name: /^북마크 등록$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^모바일 메뉴$/i })).toBeInTheDocument();
    expect(folderPanelButton).toHaveAttribute("aria-selected", "true");
    expect(bookmarkPanelButton).toHaveAttribute("aria-selected", "false");
    expect(recommendationPanelButton).toHaveAttribute("aria-selected", "false");
    expect(folderPanelButton).toHaveTextContent(/폴더 1개/i);
    expect(bookmarkPanelButton).toHaveTextContent(/북마크 0개/i);
    expect(recommendationPanelButton).toHaveTextContent(/추천 0건/i);

    expect(
      await screen.findByRole("tabpanel", { name: /^폴더$/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /folder-overview/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /bookmark-list/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^모바일 메뉴$/i }));
    const mobileMenu = await screen.findByRole("menu", { name: /모바일 헤더 메뉴/i });
    expect(within(mobileMenu).getByRole("button", { name: /^앱 설치$/i })).toBeInTheDocument();
    expect(within(mobileMenu).getByRole("button", { name: /^새 폴더$/i })).toBeInTheDocument();
    expect(within(mobileMenu).getByRole("button", { name: /^태그 관리$/i })).toBeInTheDocument();
    fireEvent.click(within(mobileMenu).getByRole("button", { name: /^태그 관리$/i }));
    const tagManagerDialog = await screen.findByRole("dialog", {
      name: /tag-manager-dialog/i
    });
    expect(tagManagerDialog).toHaveClass("tag-manager-dialog-shell");
    expect(
      within(tagManagerDialog).getByRole("region", { name: /tag-manager/i })
    ).toHaveClass("tag-manager-panel-readable");
  });

  it("renders mobile sidebar tabs and switches the visible panel", async () => {
    const matchMediaSpy = vi.fn((query: string) => ({
      matches: query.includes("max-width: 720px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
    vi.stubGlobal("matchMedia", matchMediaSpy);
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
                tagIds: [],
                url: "https://example.com/reading",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Reading note",
                userContent: "Reading note summary",
                userSummary: "Reading note summary",
                displayTitle: "Reading note",
                displayContent: "Reading note summary",
                displaySummary: "Reading note summary",
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
            favorites: [
              {
                id: "bookmark-1",
                folderId: "folder-1",
                tagIds: [],
                url: "https://example.com/reading",
                isFavorite: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Reading note",
                userContent: "Reading note summary",
                userSummary: "Reading note summary",
                displayTitle: "Reading note",
                displayContent: "Reading note summary",
                displaySummary: "Reading note summary",
                createdAt: "2026-04-13T08:00:00.000Z",
                updatedAt: "2026-04-13T08:00:00.000Z"
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
    const tablist = within(sidebar).getByRole("tablist", { name: /mobile-sidebar-tabs/i });
    const folderTab = within(tablist).getByRole("tab", { name: /^폴더$/i });
    const bookmarkTab = within(tablist).getByRole("tab", { name: /^북마크$/i });
    const recommendationTab = within(tablist).getByRole("tab", { name: /^추천$/i });

    expect(folderTab).toHaveAttribute("aria-selected", "true");
    expect(bookmarkTab).toHaveAttribute("aria-selected", "false");
    expect(recommendationTab).toHaveAttribute("aria-selected", "false");
    expect(folderTab).toHaveTextContent(/1개/i);
    expect(bookmarkTab).toHaveTextContent(/1개/i);
    expect(recommendationTab).toHaveTextContent(/0건/i);
    expect(await screen.findByRole("tabpanel", { name: /^폴더$/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /bookmark-list/i })).not.toBeInTheDocument();

    fireEvent.click(bookmarkTab);

    expect(folderTab).toHaveAttribute("aria-selected", "false");
    expect(bookmarkTab).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("tabpanel", { name: /^북마크$/i })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: /bookmark-list/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /recommendation-list/i })).not.toBeInTheDocument();

    vi.stubGlobal("innerWidth", 760);
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(
        within(sidebar).getByRole("tablist", {
          name: /mobile-sidebar-tabs/i
        })
      ).toBeInTheDocument();
    });
    const stableMobileTablist = within(sidebar).getByRole("tablist", {
      name: /mobile-sidebar-tabs/i
    });
    const stableRecommendationTab = within(stableMobileTablist).getByRole("tab", {
      name: /^추천$/i
    });
    expect(within(stableMobileTablist).getByRole("tab", { name: /^북마크$/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("button", { name: /^북마크 등록$/i })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: /quick-actions-toolbar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /folder-overview/i })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /bookmark-list/i })).toBeInTheDocument();

    fireEvent.click(stableRecommendationTab);

    expect(stableRecommendationTab).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("tabpanel", { name: /^추천$/i })).toBeInTheDocument();
    const recommendationRegion = await screen.findByRole("region", {
      name: /recommendation-list/i
    });
    expect(await within(recommendationRegion).findByText(/^Reading note$/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(stableRecommendationTab).toHaveTextContent(/1건/i);
    });
    expect(screen.queryByRole("region", { name: /bookmark-list/i })).not.toBeInTheDocument();
  });

  it("shows hidden folder and bookmark toggles on mobile panels", async () => {
    stubDashboardViewport(640);

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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-visible",
                folderId: "folder-visible",
                tagIds: [],
                url: "https://example.com/visible",
                isFavorite: false,
                isHidden: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Visible bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Visible bookmark",
                displayContent: "",
                displaySummary: "",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              },
              {
                id: "bookmark-hidden",
                folderId: "folder-visible",
                tagIds: [],
                url: "https://example.com/secret",
                isFavorite: false,
                isHidden: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Secret bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Secret bookmark",
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
                id: "folder-visible",
                name: "Visible",
                color: "#f97316",
                icon: "book-open",
                isHidden: false,
                parentFolderId: null,
                sortOrder: 0,
                createdAt: "2026-04-13T10:00:00.000Z",
                updatedAt: "2026-04-13T10:00:00.000Z"
              },
              {
                id: "folder-hidden",
                name: "Private",
                color: "#1d4ed8",
                icon: "folder",
                isHidden: true,
                parentFolderId: null,
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

    const folderPanel = await screen.findByRole("tabpanel", { name: /^폴더$/i });
    const folderOverview = within(folderPanel).getByRole("region", {
      name: /folder-overview/i
    });

    const hiddenFolderToggle = within(folderOverview).getByRole("button", {
      name: /숨김 폴더 보기/i
    });

    expect(hiddenFolderToggle).toHaveAttribute("aria-pressed", "false");
    expect(hiddenFolderToggle).toHaveTextContent(/🔒/u);
    expect(
      within(folderOverview).queryByRole("button", { name: /^Private 폴더 보기$/i })
    ).not.toBeInTheDocument();

    fireEvent.click(hiddenFolderToggle);

    await waitFor(() => {
      expect(
        within(folderOverview).getByRole("button", { name: /숨김 폴더 숨기기/i })
      ).toBeInTheDocument();
    });
    const activeFolderToggle = within(folderOverview).getByRole("button", {
      name: /숨김 폴더 숨기기/i
    });
    expect(activeFolderToggle).toHaveAttribute("aria-pressed", "true");
    expect(activeFolderToggle).toHaveTextContent(/🔓/u);
    expect(
      within(folderOverview).getByRole("button", { name: /^Private 폴더 보기$/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^북마크$/i }));

    const bookmarkPanel = await screen.findByRole("tabpanel", { name: /^북마크$/i });
    const bookmarkListRegion = within(bookmarkPanel).getByRole("region", {
      name: /bookmark-list/i
    });

    const hiddenBookmarkToggle = within(bookmarkListRegion).getByRole("button", {
      name: /숨김 북마크 보기/i
    });

    expect(hiddenBookmarkToggle).toHaveAttribute("aria-pressed", "false");
    expect(hiddenBookmarkToggle).toHaveTextContent(/🔒/u);
    expect(within(bookmarkListRegion).queryByText(/^Secret bookmark$/i)).not.toBeInTheDocument();

    fireEvent.click(hiddenBookmarkToggle);

    await waitFor(() => {
      expect(
        within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 숨기기/i })
      ).toBeInTheDocument();
    });
    const activeBookmarkToggle = within(bookmarkListRegion).getByRole("button", {
      name: /숨김 북마크 숨기기/i
    });
    expect(activeBookmarkToggle).toHaveAttribute("aria-pressed", "true");
    expect(activeBookmarkToggle).toHaveTextContent(/🔓/u);
    expect(within(bookmarkListRegion).getByText(/^Secret bookmark$/i)).toBeInTheDocument();
  });

  it("opens folder edit from the mobile folder panel", async () => {
    stubDashboardViewport(640);

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
                id: "folder-visible",
                name: "Visible",
                color: "#f97316",
                icon: "book-open",
                isHidden: false,
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

    const folderPanel = await screen.findByRole("tabpanel", { name: /^폴더$/i });
    const folderOverview = within(folderPanel).getByRole("region", {
      name: /folder-overview/i
    });

    fireEvent.click(within(folderOverview).getByRole("button", { name: /Visible 폴더 수정/i }));

    const folderDialog = await screen.findByRole("dialog", {
      name: /folder-manager-dialog/i
    });
    const folderManager = within(folderDialog).getByRole("region", { name: /folder-manager/i });

    expect(within(folderDialog).getByRole("heading", { name: /^폴더 수정$/i, level: 2 })).toBeInTheDocument();
    expect(within(folderManager).getByLabelText(/폴더 이름/i)).toHaveValue("Visible");
    expect(within(folderManager).getByRole("button", { name: /폴더 수정/i })).toBeInTheDocument();
  });

  it("renders compact bookmark cards on mobile", async () => {
    stubDashboardViewport(640);
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...globalThis.navigator,
      clipboard: {
        writeText: clipboardWrite
      }
    });

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

      if (url === "/api/bookmarks/bookmark-mobile-1" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
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
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url === "/api/bookmarks/bookmark-mobile-1/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
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

    fireEvent.click(await screen.findByRole("tab", { name: /^북마크$/i }));

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    const firstCard = within(bookmarkListRegion).getAllByRole("listitem")[0];

    const emptyHiddenBookmarkToggle = within(bookmarkListRegion).getByRole("button", {
      name: /숨김 북마크 보기/i
    });

    expect(emptyHiddenBookmarkToggle).toBeEnabled();
    expect(emptyHiddenBookmarkToggle).toHaveAttribute("aria-pressed", "false");
    expect(emptyHiddenBookmarkToggle).toHaveTextContent(/🔒/u);

    fireEvent.click(emptyHiddenBookmarkToggle);

    await waitFor(() => {
      expect(
        within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 숨기기/i })
      ).toHaveAttribute("aria-pressed", "true");
    });

    expect(within(bookmarkListRegion).queryByText(/^보관 목록$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^정리된 목록$/i)).not.toBeInTheDocument();
    expect(firstCard.querySelector(".bookmark-row-meta-line")).toBeInTheDocument();
    expect(firstCard.querySelector(".meta-pill")).not.toBeInTheDocument();
    expect(within(firstCard).getByText(/^미분류$/i)).toBeInTheDocument();
    expect(within(firstCard).getByText(/^즐겨찾기$/i)).toBeInTheDocument();
    expect(within(firstCard).queryByText(/^research$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/^Manual summary$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/^https:\/\/example.com\/post$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/^북마크 주황$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/^URL 네이비$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/^상태 배지$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/^빠른 조작$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/^색상$/i)).not.toBeInTheDocument();
    expect(firstCard.querySelector(".bookmark-row-actions")).toHaveClass(
      "bookmark-row-actions-mobile-compact"
    );
    expect(within(firstCard).getByRole("button", { name: /Manual title 열기/i })).toHaveClass(
      "bookmark-row-primary-action"
    );
    const mobileCardButtons = within(firstCard).getAllByRole("button");
    expect(mobileCardButtons).toHaveLength(4);
    expect(within(firstCard).getByRole("button", { name: /Manual title 열기/i })).toHaveTextContent(
      /^열기$/i
    );
    expect(within(firstCard).getByRole("button", { name: /Manual title 상세 보기/i })).toHaveTextContent(
      /^상세$/i
    );
    expect(within(firstCard).getByRole("button", { name: /Manual title URL 복사/i })).toHaveClass(
      "bookmark-url-copy-button"
    );
    expect(
      within(firstCard).getByRole("button", { name: /Manual title 북마크 더보기/i })
    ).toHaveTextContent(/^\.\.\.$/i);
    fireEvent.click(within(firstCard).getByRole("button", { name: /Manual title URL 복사/i }));
    await waitFor(() => {
      expect(clipboardWrite).toHaveBeenCalledWith("https://example.com/post");
    });
    expect(await screen.findByText(/^URL을 복사했습니다\.$/i)).toBeInTheDocument();
    fireEvent.click(within(firstCard).getByRole("button", { name: /Manual title 상세 보기/i }));
    const detailDialog = await screen.findByRole("dialog", { name: /bookmark-detail-dialog/i });
    expect(
      await within(detailDialog).findByText(/^Manual title$/i, { selector: "strong" })
    ).toBeInTheDocument();
    fireEvent.click(within(detailDialog).getByRole("button", { name: /상세 창 닫기/i }));
    fireEvent.click(within(firstCard).getByRole("button", { name: /Manual title 북마크 더보기/i }));
    const bookmarkMenu = within(firstCard).getByRole("menu", {
      name: /Manual title 북마크 메뉴/i
    });
    expect(bookmarkMenu).toHaveClass("bookmark-card-action-menu");
    expect(
      within(bookmarkMenu).queryByRole("button", { name: /^상세 보기$/i })
    ).not.toBeInTheDocument();
    expect(within(bookmarkMenu).getByRole("button", { name: /^수정$/i })).toHaveClass(
      "bookmark-card-action-menu-item"
    );
    expect(within(bookmarkMenu).getByRole("button", { name: /^삭제$/i })).toHaveClass(
      "bookmark-card-action-menu-item"
    );
  });

  it("applies bookmark sorting from the mobile bookmark header", async () => {
    stubDashboardViewport(640);

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
                id: "bookmark-alpha",
                folderId: null,
                tagIds: [],
                url: "https://alpha.example.com/article",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Alpha",
                userContent: null,
                userSummary: null,
                displayTitle: "Alpha",
                displayContent: "",
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

      if (url === "/api/bookmarks?sort=site_desc&limit=20&offset=0" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-zeta",
                folderId: null,
                tagIds: [],
                url: "https://zeta.example.com/article",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Zeta",
                userContent: null,
                userSummary: null,
                displayTitle: "Zeta",
                displayContent: "",
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
        return new Response(JSON.stringify({ favorites: [], recent: [], frequent: [] }), {
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

    fireEvent.click(await screen.findByRole("tab", { name: /^북마크$/i }));

    const bookmarkListRegion = await screen.findByRole("region", {
      name: /bookmark-list/i
    });
    fireEvent.click(within(bookmarkListRegion).getByRole("button", { name: /북마크 정렬/i }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: /사이트.*Z-A/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^Zeta$/i)).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?sort=site_desc&limit=20&offset=0",
      expect.objectContaining({
        credentials: "include"
      })
    );
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
          "/api/bookmarks?mode=all&query=paper&bookmarkColor=%23f59e0b&urlColor=%230f172a&summaryState=with&limit=20&offset=0" &&
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
                bookmarkColor: "#f59e0b",
                urlColor: "#0f172a",
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
    chooseColorOption(document.body, "북마크 색상 필터", "주황");
    chooseColorOption(document.body, "url 색상 필터", "네이비");
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
    expect(
      screen.getByRole("button", { name: /검색 조건 제거: 상태 - 북마크 주황/i })
    ).toHaveTextContent("북마크 주황");
    expect(
      screen.getByRole("button", { name: /검색 조건 제거: 상태 - URL 네이비/i })
    ).toHaveTextContent("URL 네이비");

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks?mode=all&query=paper&bookmarkColor=%23f59e0b&urlColor=%230f172a&summaryState=with&limit=20&offset=0",
      expect.objectContaining({
        credentials: "include"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /검색 초기화/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^북마크 색상 필터$/i })).toHaveTextContent(
        /전체 색상/i
      );
      expect(screen.getByRole("button", { name: /^url 색상 필터$/i })).toHaveTextContent(
        /전체 색상/i
      );
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

      if (url === "/api/bookmarks?sort=opened_desc&limit=20&offset=0" && !init?.method) {
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

    fireEvent.change(await screen.findByRole("combobox", { name: /^정렬$/i }), {
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
      "/api/bookmarks?sort=opened_desc&limit=20&offset=0",
      expect.objectContaining({
        credentials: "include"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /검색 초기화/i }));

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /^정렬$/i })).toHaveValue("created_desc");
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

      if (url === "/api/bookmarks?createdWithin=7d&openedWithin=30d&limit=20&offset=0" && !init?.method) {
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
      "/api/bookmarks?createdWithin=7d&openedWithin=30d&limit=20&offset=0",
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
              url: "https://example.com/updated-post",
              isFavorite: false,
              isHidden: false,
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
    openBookmarkActionMenu(bookmarkListRegion, "Before title");

    fireEvent.click(
      await within(bookmarkListRegion).findByRole("button", {
        name: /^수정$/i
      })
    );

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    expect(composerDialog).toHaveClass("bookmark-composer-dialog-shell");
    const bookmarkFormRegion = within(composerDialog).getByRole("region", {
      name: /bookmark-form/i
    });
    expect(bookmarkFormRegion).toHaveClass("bookmark-composer-panel-readable");

    expect(within(bookmarkFormRegion).getByRole("button", { name: /북마크 수정/i })).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Before title")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Before content")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Before summary")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByRole("checkbox", { name: /숨김 북마크/i })).not.toBeChecked();

    const urlInput = within(bookmarkFormRegion).getByLabelText(/^URL$/i);
    expect(urlInput).toBeEnabled();
    fireEvent.change(urlInput, {
      target: {
        value: "https://example.com/updated-post"
      }
    });
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
    const openDisplaySectionButton = within(bookmarkFormRegion).queryByRole("button", {
      name: /표시와 이미지 열기/i
    });

    if (openDisplaySectionButton) {
      fireEvent.click(openDisplaySectionButton);
    }

    chooseColorOption(bookmarkFormRegion, "북마크 색상", "빨강");
    chooseColorOption(bookmarkFormRegion, "url 색상", "파랑");
    const openClassificationSectionButton = within(bookmarkFormRegion).queryByRole("button", {
      name: /분류와 상태 열기/i
    });

    if (openClassificationSectionButton) {
      fireEvent.click(openClassificationSectionButton);
    }

    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /^즐겨찾기$/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /research/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /later/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /숨김 북마크/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /북마크 수정/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByText(/^After title$/i)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /bookmark-composer-dialog/i })).not.toBeInTheDocument();
    });

    const patchCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/bookmarks/bookmark-1" &&
        init?.method === "PATCH"
    );

    expect(patchCall).toBeDefined();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      url: "https://example.com/updated-post",
      folderId: "folder-1",
      tagIds: ["tag-2"],
      userTitle: "After title",
      userContent: "After content",
      userSummary: "After summary",
      isFavorite: false,
      isHidden: true,
      bookmarkColor: "#dc2626",
      urlColor: "#1d4ed8"
    });
  });

  it("initializes edit mode with hidden bookmarks checked", async () => {
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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-hidden-edit",
                folderId: "folder-1",
                tagIds: [],
                url: "https://example.com/hidden-edit",
                isFavorite: false,
                isHidden: true,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Hidden title",
                userContent: "Hidden content",
                userSummary: "Hidden summary",
                displayTitle: "Hidden title",
                displayContent: "Hidden content",
                displaySummary: "Hidden summary",
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

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    fireEvent.click(
      within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 보기/i })
    );

    openBookmarkActionMenu(bookmarkListRegion, "Hidden title");

    fireEvent.click(
      await within(bookmarkListRegion).findByRole("button", {
        name: /^수정$/i
      })
    );

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    const bookmarkFormRegion = within(composerDialog).getByRole("region", {
      name: /bookmark-form/i
    });
    expect(
      within(bookmarkFormRegion).getByRole("button", { name: /url 메타 불러오기/i })
    ).not.toBeDisabled();

    expect(within(bookmarkFormRegion).getByRole("button", { name: /북마크 수정/i })).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByRole("checkbox", { name: /숨김 북마크/i })).toBeChecked();
    expect(within(bookmarkFormRegion).getByDisplayValue("Hidden title")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Hidden content")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Hidden summary")).toBeInTheDocument();
  });

  it("clears extracted metadata from the edit form before saving", async () => {
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
                id: "bookmark-source-edit",
                folderId: "folder-1",
                tagIds: [],
                url: "https://example.com/source-edit",
                isFavorite: false,
                isHidden: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: "Source edit title",
                sourceContent: "Source edit content",
                sourceSummary: "Source edit summary",
                userTitle: "Source edit manual title",
                userContent: "Source edit manual content",
                userSummary: "Source edit manual summary",
                displayTitle: "Source edit manual title",
                displayContent: "Source edit manual content",
                displaySummary: "Source edit manual summary",
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

      if (url === "/api/bookmarks/bookmark-source-edit" && init?.method === "PATCH") {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-source-edit",
              folderId: "folder-1",
              tagIds: [],
              url: "https://example.com/source-edit",
              isFavorite: false,
              isHidden: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Source edit manual title",
              userContent: "Source edit manual content",
              userSummary: "Source edit manual summary",
              displayTitle: "Source edit manual title",
              displayContent: "Source edit manual content",
              displaySummary: "Source edit manual summary",
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

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    openBookmarkActionMenu(bookmarkListRegion, "Source edit manual title");

    fireEvent.click(
      await within(bookmarkListRegion).findByRole("button", {
        name: /^수정$/i
      })
    );

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    const bookmarkFormRegion = within(composerDialog).getByRole("region", {
      name: /bookmark-form/i
    });

    expect(within(bookmarkFormRegion).getByText(/Source edit title/i)).toBeInTheDocument();
    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /자동 추출 초기화/i }));
    expect(within(bookmarkFormRegion).queryByText(/Source edit title/i)).not.toBeInTheDocument();

    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /북마크 수정/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /bookmark-composer-dialog/i })).not.toBeInTheDocument();
    });

    const patchCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/bookmarks/bookmark-source-edit" &&
        init?.method === "PATCH"
    );

    expect(patchCall).toBeDefined();
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({
      userTitle: "Source edit manual title",
      userContent: "Source edit manual content",
      userSummary: "Source edit manual summary",
      sourceTitle: null,
      sourceContent: null,
      sourceSummary: null
    });
  });

  it("clears bookmark selection immediately when editing a bookmark into hidden while hidden bookmarks are off", async () => {
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
                folderId: null,
                tagIds: [],
                url: "https://example.com/detail",
                isFavorite: false,
                isHidden: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Visible bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Visible bookmark",
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

      if (url === "/api/bookmarks/bookmark-detail" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-detail",
              folderId: null,
              tagIds: [],
              url: "https://example.com/detail",
              isFavorite: false,
              isHidden: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Visible bookmark",
              userContent: "",
              userSummary: "",
              displayTitle: "Visible bookmark",
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

      if (url === "/api/bookmarks/bookmark-detail/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks/bookmark-detail" && init?.method === "PATCH") {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-detail",
              folderId: null,
              tagIds: [],
              url: "https://example.com/detail",
              isFavorite: false,
              isHidden: true,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Visible bookmark",
              userContent: "",
              userSummary: "",
              displayTitle: "Visible bookmark",
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

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const mainPanel = await screen.findByRole("region", {
      name: /dashboard-main/i
    });
    const bookmarkListRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-list/i
    });
    expect(within(mainPanel).queryByRole("region", { name: /bookmark-detail-shell/i })).not.toBeInTheDocument();

    expect(within(bookmarkListRegion).getByText(/^Visible bookmark$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 보기/i })).toBeInTheDocument();
    fireEvent.click(within(bookmarkListRegion).getByText(/^Visible bookmark$/i, { selector: "strong" }));

    let bookmarkDetailRegion = await within(mainPanel).findByRole("region", {
      name: /bookmark-detail-shell/i
    });
    await waitFor(() => {
      expect(within(bookmarkDetailRegion).getByRole("heading", { name: /^북마크 상세$/i })).toBeInTheDocument();
    });
    expect(
      within(bookmarkDetailRegion).getByText(/^Visible bookmark$/i, { selector: "strong" })
    ).toBeInTheDocument();

    fireEvent.click(within(bookmarkDetailRegion).getByRole("button", { name: /상세 작업 더보기/i }));
    fireEvent.click(within(bookmarkDetailRegion).getByRole("button", { name: /수정 시작/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    const bookmarkFormRegion = within(composerDialog).getByRole("region", {
      name: /bookmark-form/i
    });

    const openClassificationSectionButton = within(bookmarkFormRegion).getByRole("button", {
      name: /분류와 상태 열기/i
    });

    fireEvent.click(openClassificationSectionButton);

    expect(within(bookmarkFormRegion).getByRole("checkbox", { name: /숨김 북마크/i })).not.toBeChecked();
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /숨김 북마크/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /북마크 수정/i }));

    await waitFor(() => {
      expect(within(mainPanel).queryByRole("region", { name: /bookmark-detail-shell/i })).not.toBeInTheDocument();
    });
    expect(within(bookmarkListRegion).queryByText(/^Visible bookmark$/i)).not.toBeInTheDocument();

    fireEvent.click(within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 보기/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 숨기기/i })).toBeInTheDocument();
    });

    expect(within(bookmarkListRegion).getByText(/^Visible bookmark$/i)).toBeInTheDocument();
    expect(within(mainPanel).queryByRole("region", { name: /bookmark-detail-shell/i })).not.toBeInTheDocument();

    fireEvent.click(within(bookmarkListRegion).getByText(/^Visible bookmark$/i, { selector: "strong" }));

    bookmarkDetailRegion = await within(mainPanel).findByRole("region", {
      name: /bookmark-detail-shell/i
    });
    await waitFor(() => {
      expect(within(bookmarkDetailRegion).getByRole("heading", { name: /^북마크 상세$/i })).toBeInTheDocument();
    });
  });

  it("clears a selected bookmark immediately after saving it as hidden while hidden bookmarks are off", async () => {
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
                folderId: null,
                tagIds: [],
                url: "https://example.com/detail",
                isFavorite: false,
                isHidden: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: null,
                sourceContent: null,
                sourceSummary: null,
                userTitle: "Visible bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "Visible bookmark",
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

      if (url === "/api/bookmarks/bookmark-detail" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-detail",
              folderId: null,
              tagIds: [],
              url: "https://example.com/detail",
              isFavorite: false,
              isHidden: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Visible bookmark",
              userContent: "",
              userSummary: "",
              displayTitle: "Visible bookmark",
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

      if (url === "/api/bookmarks/bookmark-detail/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks/bookmark-detail" && init?.method === "PATCH") {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-detail",
              folderId: null,
              tagIds: [],
              url: "https://example.com/detail",
              isFavorite: false,
              isHidden: true,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Visible bookmark",
              userContent: "",
              userSummary: "",
              displayTitle: "Visible bookmark",
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

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const mainPanel = await screen.findByRole("region", {
      name: /dashboard-main/i
    });
    const bookmarkListRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-list/i
    });
    expect(within(mainPanel).queryByRole("region", { name: /bookmark-detail-shell/i })).not.toBeInTheDocument();

    fireEvent.click(within(bookmarkListRegion).getByText(/^Visible bookmark$/i, { selector: "strong" }));

    const bookmarkDetailRegion = await within(mainPanel).findByRole("region", {
      name: /bookmark-detail-shell/i
    });
    await waitFor(() => {
      expect(within(bookmarkDetailRegion).getByRole("heading", { name: /^북마크 상세$/i })).toBeInTheDocument();
    });

    fireEvent.click(within(bookmarkDetailRegion).getByRole("button", { name: /상세 작업 더보기/i }));
    fireEvent.click(within(bookmarkDetailRegion).getByRole("button", { name: /수정 시작/i }));

    const composerDialog = await screen.findByRole("dialog", {
      name: /bookmark-composer-dialog/i
    });
    const bookmarkFormRegion = within(composerDialog).getByRole("region", {
      name: /bookmark-form/i
    });

    fireEvent.click(
      within(bookmarkFormRegion).getByRole("button", { name: /분류와 상태 열기/i })
    );
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /숨김 북마크/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("button", { name: /북마크 수정/i }));

    await waitFor(() => {
      expect(within(mainPanel).queryByRole("region", { name: /bookmark-detail-shell/i })).not.toBeInTheDocument();
    });

    fireEvent.click(within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 보기/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 숨기기/i })).toBeInTheDocument();
    });
    expect(within(mainPanel).queryByRole("region", { name: /bookmark-detail-shell/i })).not.toBeInTheDocument();
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
    openBookmarkActionMenu(bookmarkListRegion, "Delete asset title");

    fireEvent.click(
      await within(bookmarkListRegion).findByRole("button", {
        name: /^수정$/i
      })
    );
    const bookmarkFormRegion = await screen.findByRole("region", {
      name: /bookmark-form/i
    });
    const openDisplaySectionButton = within(bookmarkFormRegion).queryByRole("button", {
      name: /표시와 이미지 열기/i
    });

    if (openDisplaySectionButton) {
      fireEvent.click(openDisplaySectionButton);
    }

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

    const homePage = await screen.findByRole("region", { name: /home-page/i });
    fireEvent.click(
      within(homePage).getByRole("button", {
        name: /^추천 보기$/i
      })
    );
    const recommendationRegion = await within(homePage).findByRole("region", {
      name: /home-recommendation-list/i
    });
    expect(
      await within(recommendationRegion).findByText(/^Favorite recommendation$/i)
    ).toBeInTheDocument();

    expect(within(recommendationRegion).getByText(/^빠른 진입점$/i)).toBeInTheDocument();
    expect(
      within(recommendationRegion).queryByText(
        /열람 기록과 즐겨찾기 흐름에서 바로 다시 열 수 있는 링크입니다\./i
      )
    ).not.toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^추천$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^자주 여는 링크$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^즐겨찾기$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^최근$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^반복$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^Recent recommendation$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^Frequent recommendation$/i)).toBeInTheDocument();
    const favoriteRecommendationItem = within(recommendationRegion)
      .getByText(/^Favorite recommendation$/i)
      .closest("li");
    expect(favoriteRecommendationItem).not.toBeNull();
    expect(
      (favoriteRecommendationItem as HTMLElement).querySelector(".meta-pill-accent")
    ).not.toBeInTheDocument();
    expect(
      within(favoriteRecommendationItem as HTMLElement).getByText(/^즐겨찾기 기반 · 미분류$/i)
    ).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^최근 열람 기반 · 미분류$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^반복 열람 기반 · 미분류$/i)).toBeInTheDocument();
    expect(
      within(favoriteRecommendationItem as HTMLElement).getByRole("button", {
        name: /Favorite recommendation 열기/i
      })
    ).toHaveTextContent(/^열기$/i);

    fireEvent.click(
      within(favoriteRecommendationItem as HTMLElement).getByRole("button", {
        name: /Favorite recommendation 열기/i
      })
    );

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
    let detailPreviewRequestCount = 0;
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

      if (url === "/api/bookmarks/bookmark-detail/preview" && !init?.method) {
        detailPreviewRequestCount += 1;
        return new Response(
          JSON.stringify({
            preview: {
              url: "https://example.com/detail",
              normalizedUrl: "https://example.com/detail",
              sourceTitle: `Fresh preview title ${detailPreviewRequestCount}`,
              sourceContent: `Fresh preview content ${detailPreviewRequestCount}`,
              sourceSummary: `Fresh preview summary ${detailPreviewRequestCount}`,
              sourceImageUrl: "https://example.com/detail-preview.png",
              sourceBlocks: [
                { type: "heading", text: `Fresh preview title ${detailPreviewRequestCount}` },
                {
                  type: "paragraph",
                  text: `<article data-tiara-id="95" data-tiara-type="content" data-tiara-action-kind="ViewContent"><p>Fresh preview content ${detailPreviewRequestCount}</p></article>`
                },
                {
                  type: "image",
                  url: "https://example.com/detail-inline.png",
                  alt: "Fresh inline image"
                },
                { type: "paragraph", text: "Fresh preview second paragraph" }
              ]
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

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    const resultPrimaryColumn = screen.getByRole("region", { name: /result-primary-column/i });
    expect(screen.queryByRole("region", { name: /bookmark-reading-rail/i })).not.toBeInTheDocument();
    fireEvent.click(within(bookmarkListRegion).getByText(/^Detail title$/i, { selector: "strong" }));

    const readingRail = await screen.findByRole("region", { name: /bookmark-reading-rail/i });
    expect(readingRail).toBeInTheDocument();
    expect(
      within(bookmarkListRegion)
        .getByText(/^Detail title$/i, { selector: "strong" })
        .closest("li")
    ).toHaveClass("bookmark-list-row-selected");
    let detailRegion = await screen.findByRole("region", { name: /^bookmark-detail$/i });
    expect(within(detailRegion).getByText(/^읽기 중심$/i)).toBeInTheDocument();
    expect(
      within(detailRegion).getByRole("button", { name: /상세 창 닫기/i })
    ).toBeInTheDocument();

    fireEvent.click(within(detailRegion).getByRole("button", { name: /상세 창 닫기/i }));
    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /bookmark-reading-rail/i })).not.toBeInTheDocument();
    });

    fireEvent.click(within(bookmarkListRegion).getByText(/^Detail title$/i, { selector: "strong" }));
    detailRegion = await screen.findByRole("region", { name: /^bookmark-detail$/i });
    expect(
      within(detailRegion).getByText(/^Detail title$/i, { selector: "strong" })
    ).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^https:\/\/example\.com\/detail$/i)).toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^사용자 입력값$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^자동 추출값$/i)).not.toBeInTheDocument();
    expect(
      within(detailRegion).getByRole("tab", { name: /^상세$/i })
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(detailRegion).getByRole("tab", { name: /^미리보기$/i })
    ).toHaveAttribute("aria-selected", "false");
    expect(
      within(detailRegion).getByRole("tab", { name: /^추출 정보$/i })
    ).toHaveAttribute("aria-selected", "false");
    expect(within(detailRegion).getByText(/^직접 정리$/i)).toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^자동 추출$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).getByText(/Detail manual content/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/Detail manual summary/i)).toBeInTheDocument();
    expect(within(detailRegion).queryByText(/Source title/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/Source content/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/Source summary/i)).not.toBeInTheDocument();
    expect(detailRegion.querySelector(".bookmark-detail-meta-line")).toBeInTheDocument();
    expect(detailRegion.querySelector(".meta-pill")).not.toBeInTheDocument();
    expect(within(detailRegion).getByText(/^Reading$/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^직접 요약$/i)).toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^태그 1개$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).getByText(/^research$/i)).toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^북마크 주황$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^URL 네이비$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).getByText(/^이미지 1$/i)).toBeInTheDocument();
    expect(
      within(detailRegion).getByRole("img", { name: /업로드 이미지 1/i })
    ).toBeInTheDocument();

    expect(
      within(detailRegion)
        .getAllByRole("button")
        .map((button) => button.textContent?.trim())
    ).toEqual(["×", "열기", "목록", "..."]);
    expect(within(detailRegion).queryByText(/^핵심 액션$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^정리 작업$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^위험 작업$/i)).not.toBeInTheDocument();

    fireEvent.click(within(detailRegion).getByRole("tab", { name: /^미리보기$/i }));

    await waitFor(() => {
      expect(within(detailRegion).getAllByText(/^Fresh preview title 1$/i).length).toBeGreaterThan(0);
    });
    expect(within(detailRegion).getByText(/^Fresh preview content 1$/i)).toBeInTheDocument();
    expect(
      within(detailRegion).getByRole("img", { name: /Fresh preview title 1 미리보기 이미지/i })
    ).toHaveAttribute("src", "https://example.com/detail-preview.png");
    const previewArticle = detailRegion.querySelector(".bookmark-preview-article");
    expect(previewArticle).toBeInTheDocument();
    expect(
      Array.from(previewArticle?.children ?? []).map((element) => element.tagName)
    ).toEqual(["H4", "P", "FIGURE", "P"]);
    expect(
      within(previewArticle as HTMLElement).getByRole("img", {
        name: /Fresh inline image/i
      })
    ).toHaveAttribute("src", "https://example.com/detail-inline.png");
    expect(within(detailRegion).queryByText(/^저장된 자동 추출$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^Source title$/i)).not.toBeInTheDocument();
    expect(detailPreviewRequestCount).toBe(1);

    const previewFullscreenButton = within(detailRegion).getByRole("button", {
      name: /미리보기 전체화면/i
    });
    expect(previewFullscreenButton).toHaveAttribute("aria-pressed", "false");
    const activeReadingRail = screen.getByRole("region", { name: /bookmark-reading-rail/i });
    fireEvent.click(previewFullscreenButton);
    expect(screen.getByRole("main")).toHaveClass("app-shell-preview-fullscreen");
    expect(resultPrimaryColumn).not.toHaveAttribute("aria-hidden");
    expect(activeReadingRail).toHaveClass("bookmark-reading-rail-preview-fullscreen");
    expect(detailRegion).toHaveClass("bookmark-detail-card-preview-fullscreen");
    expect(detailRegion.closest("[aria-hidden='true']")).toBeNull();
    const previewRestoreButton = within(detailRegion).getByRole("button", {
      name: /미리보기 전체화면 종료/i
    });
    expect(previewRestoreButton).toHaveAttribute("aria-pressed", "true");
    expect(previewRestoreButton).toHaveTextContent(/전체화면 종료/i);
    expect(within(detailRegion).getByText(/^최신 미리보기$/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^Fresh preview content 1$/i)).toBeInTheDocument();
    expect(within(detailRegion).queryByText(/data-tiara-id|data-tiara-type|ViewContent/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByRole("tablist", { name: /bookmark-detail-tabs/i })).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^북마크 상세$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^저장된 자동 추출$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^Source title$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByRole("button", { name: /상세 창 닫기/i })).not.toBeInTheDocument();
    fireEvent.click(previewRestoreButton);
    expect(screen.getByRole("main")).not.toHaveClass("app-shell-preview-fullscreen");
    expect(resultPrimaryColumn).not.toHaveAttribute("aria-hidden");
    expect(activeReadingRail).not.toHaveClass("bookmark-reading-rail-preview-fullscreen");
    expect(detailRegion).not.toHaveClass("bookmark-detail-card-preview-fullscreen");

    fireEvent.click(within(detailRegion).getByRole("tab", { name: /^상세$/i }));
    fireEvent.click(within(detailRegion).getByRole("tab", { name: /^미리보기$/i }));

    await waitFor(() => {
      expect(within(detailRegion).getAllByText(/^Fresh preview title 1$/i).length).toBeGreaterThan(0);
    });
    expect(detailPreviewRequestCount).toBe(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks/bookmark-detail/preview",
      expect.objectContaining({
        credentials: "include"
      })
    );

    fireEvent.click(within(detailRegion).getByRole("tab", { name: /^추출 정보$/i }));
    expect(
      within(detailRegion).getByRole("tab", { name: /^추출 정보$/i })
    ).toHaveAttribute("aria-selected", "true");
    expect(within(detailRegion).getByText(/^저장된 자동 추출$/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^Source title$/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^Source content$/i)).toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^최신 미리보기$/i)).not.toBeInTheDocument();

    openBookmarkDetailActionMenu(detailRegion);
    const detailActionMenu = within(detailRegion).getByRole("menu", {
      name: /상세 작업 메뉴/i
    });
    expect(detailActionMenu).toHaveClass("bookmark-detail-action-menu");
    expect(
      within(detailActionMenu)
        .getAllByRole("button")
        .map((button) => button.textContent?.trim())
    ).toEqual([
      "수정 시작",
      "자동 추출 다시 시도",
      "자동 추출 초기화",
      "사용자 입력 초기화",
      "삭제"
    ]);
    expect(within(detailActionMenu).getByRole("button", { name: /^수정 시작$/i })).toHaveClass(
      "bookmark-detail-action-menu-item"
    );
    expect(
      within(detailActionMenu).getByRole("button", { name: /^자동 추출 다시 시도$/i })
    ).toHaveClass("bookmark-detail-action-menu-item");

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

  it("keeps the detail panel open and shows saved source values when live preview fails", async () => {
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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-preview-fail",
                folderId: null,
                tagIds: [],
                url: "https://example.com/preview-fail",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: "Saved source title",
                sourceContent: "Saved source content",
                sourceSummary: "Saved source summary",
                userTitle: "Preview fail title",
                userContent: "Preview fail manual content",
                userSummary: "",
                displayTitle: "Preview fail title",
                displayContent: "Preview fail manual content",
                displaySummary: "",
                createdAt: "2026-04-20T03:00:00.000Z",
                updatedAt: "2026-04-20T03:00:00.000Z"
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

      if (url === "/api/bookmarks/bookmark-preview-fail" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-preview-fail",
              folderId: null,
              tagIds: [],
              url: "https://example.com/preview-fail",
              isFavorite: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: "Saved source title",
              sourceContent: "Saved source content",
              sourceSummary: "Saved source summary",
              userTitle: "Preview fail title",
              userContent: "Preview fail manual content",
              userSummary: "",
              displayTitle: "Preview fail title",
              displayContent: "Preview fail manual content",
              displaySummary: "",
              createdAt: "2026-04-20T03:00:00.000Z",
              updatedAt: "2026-04-20T03:00:00.000Z"
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

      if (url === "/api/bookmarks/bookmark-preview-fail/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks/bookmark-preview-fail/preview" && !init?.method) {
        return new Response(JSON.stringify({ error: "bookmark_extract_failed" }), {
          status: 502,
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

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    fireEvent.click(
      within(bookmarkListRegion).getByText(/^Preview fail title$/i, { selector: "strong" })
    );

    const detailRegion = await screen.findByRole("region", { name: /^bookmark-detail$/i });
    fireEvent.click(within(detailRegion).getByRole("tab", { name: /^미리보기$/i }));

    await waitFor(() => {
      expect(
        within(detailRegion).getByText(/URL 메타 미리보기를 불러오지 못했습니다\./i)
      ).toBeInTheDocument();
    });
    expect(within(detailRegion).queryByText(/^저장된 자동 추출$/i)).not.toBeInTheDocument();
    fireEvent.click(within(detailRegion).getByRole("tab", { name: /^추출 정보$/i }));
    expect(within(detailRegion).getByText(/^저장된 자동 추출$/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^Saved source title$/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^Saved source content$/i)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /^bookmark-detail$/i })).toBeInTheDocument();
  });

  it("keeps worker preview metadata visible with a notice when extension fallback fails for a js-required detail preview", async () => {
    const postMessageSpy = vi.spyOn(window, "postMessage").mockImplementation((message) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "bookmark-extension:ping"
      ) {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              source: "bookmark-extension",
              type: "bookmark-extension:pong"
            }
          })
        );
      }

      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "bookmark-extension:extract-preview"
      ) {
        window.dispatchEvent(
          new MessageEvent("message", {
            data: {
              source: "bookmark-extension",
              type: "bookmark-extension:preview-failed",
              requestId: (message as { requestId: string }).requestId
            }
          })
        );
      }
    });

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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-js-required-detail",
                folderId: null,
                tagIds: [],
                url: "https://example.com/js-required-detail",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: "Saved worker title",
                sourceContent: "Saved worker content",
                sourceSummary: "Saved worker summary",
                userTitle: "JS required detail bookmark",
                userContent: "",
                userSummary: "",
                displayTitle: "JS required detail bookmark",
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

      if (url === "/api/bookmarks/bookmark-js-required-detail" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-js-required-detail",
              folderId: null,
              tagIds: [],
              url: "https://example.com/js-required-detail",
              isFavorite: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: "Saved worker title",
              sourceContent: "Saved worker content",
              sourceSummary: "Saved worker summary",
              userTitle: "JS required detail bookmark",
              userContent: "",
              userSummary: "",
              displayTitle: "JS required detail bookmark",
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

      if (url === "/api/bookmarks/bookmark-js-required-detail/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks/bookmark-js-required-detail/preview" && !init?.method) {
        return new Response(
          JSON.stringify({
            preview: {
              url: "https://example.com/js-required-detail",
              normalizedUrl: "https://example.com/js-required-detail",
              sourceTitle: "Worker live preview title",
              sourceSummary: "Worker live preview summary",
              renderStatus: "js_required",
              renderSource: "worker",
              renderReason: "spa_fallback"
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

    const folderOverview = await screen.findByRole("region", { name: /folder-overview/i });
    fireEvent.click(within(folderOverview).getByRole("button", { name: /모든 북마크 보기/i }));

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    fireEvent.click(
      within(bookmarkListRegion).getByText(/^JS required detail bookmark$/i, {
        selector: "strong"
      })
    );

    const detailRegion = await screen.findByRole("region", { name: /^bookmark-detail$/i });
    fireEvent.click(within(detailRegion).getByRole("tab", { name: /^미리보기$/i }));

    await waitFor(() => {
      expect(within(detailRegion).getByText(/^Worker live preview title$/i)).toBeInTheDocument();
    });
    expect(within(detailRegion).getByText(/^Worker live preview summary$/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/worker 메타데이터만 표시합니다/i)).toBeInTheDocument();
    expect(
      postMessageSpy.mock.calls.some(
        ([message]) =>
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          message.type === "bookmark-extension:extract-preview" &&
          "url" in message &&
          message.url === "https://example.com/js-required-detail"
      )
    ).toBe(true);
  });

  it("keeps the bookmark menu focused on direct actions without opening a dialog detail", async () => {
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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-dialog-detail",
                folderId: "folder-1",
                tagIds: ["tag-1"],
                url: "https://example.com/dialog-detail",
                isFavorite: false,
                isHidden: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: "Dialog source title",
                sourceContent: "Dialog source content",
                sourceSummary: "Dialog source summary",
                userTitle: "Dialog detail title",
                userContent: "Dialog detail content",
                userSummary: "Dialog detail summary",
                displayTitle: "Dialog detail title",
                displayContent: "Dialog detail content",
                displaySummary: "Dialog detail summary",
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

      if (url === "/api/bookmarks/bookmark-dialog-detail" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-dialog-detail",
              folderId: "folder-1",
              tagIds: ["tag-1"],
              url: "https://example.com/dialog-detail",
              isFavorite: false,
              isHidden: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: "Dialog source title",
              sourceContent: "Dialog source content",
              sourceSummary: "Dialog source summary",
              userTitle: "Dialog detail title",
              userContent: "Dialog detail content",
              userSummary: "Dialog detail summary",
              displayTitle: "Dialog detail title",
              displayContent: "Dialog detail content",
              displaySummary: "Dialog detail summary",
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

      if (url === "/api/bookmarks/bookmark-dialog-detail/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
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

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    expect(screen.queryByRole("region", { name: /bookmark-detail-shell/i })).not.toBeInTheDocument();

    openBookmarkActionMenu(bookmarkListRegion, "Dialog detail title");
    expect(
      within(bookmarkListRegion).queryByRole("button", { name: /^상세 보기$/i })
    ).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).getByRole("button", { name: /^수정$/i })).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByRole("button", { name: /^삭제$/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /bookmark-detail-dialog/i })).not.toBeInTheDocument();

    fireEvent.click(
      within(bookmarkListRegion).getByText(/^Dialog detail title$/i, { selector: "strong" })
    );

    const detailRegion = await screen.findByRole("region", { name: /^bookmark-detail$/i });
    expect(
      within(detailRegion).getByText(/^Dialog detail title$/i, { selector: "strong" })
    ).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^Dialog detail content$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /bookmark-detail-shell/i })
    ).toBeInTheDocument();
  });

  it("opens bookmark detail immediately while detail assets continue loading", async () => {
    const jsonHeaders = {
      "content-type": "application/json"
    };
    let resolveAssetResponse: (() => void) | null = null;

    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string" ? input : input.url;

      if (url === "/api/auth/session" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              authenticated: true,
              user: {
                uid: "firebase-user-1",
                email: "keygenerator25@gmail.com"
              }
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/bookmarks" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              bookmarks: [
                {
                  id: "bookmark-detail-lazy-assets",
                  folderId: "folder-1",
                  tagIds: ["tag-1"],
                  url: "https://example.com/detail-lazy-assets",
                  isFavorite: true,
                  isHidden: false,
                  bookmarkColor: "#f59e0b",
                  urlColor: "#0f172a",
                  sourceTitle: "Source title",
                  sourceContent: "Source content",
                  sourceSummary: "Source summary",
                  userTitle: "Detail lazy title",
                  userContent: "Detail lazy content",
                  userSummary: "Detail lazy summary",
                  displayTitle: "Detail lazy title",
                  displayContent: "Detail lazy content",
                  displaySummary: "Detail lazy summary",
                  createdAt: "2026-04-14T03:00:00.000Z",
                  updatedAt: "2026-04-14T03:00:00.000Z"
                }
              ]
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/bookmarks/bookmark-detail-lazy-assets" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              bookmark: {
                id: "bookmark-detail-lazy-assets",
                folderId: "folder-1",
                tagIds: ["tag-1"],
                url: "https://example.com/detail-lazy-assets",
                isFavorite: true,
                isHidden: false,
                bookmarkColor: "#f59e0b",
                urlColor: "#0f172a",
                sourceTitle: "Source title",
                sourceContent: "Source content",
                sourceSummary: "Source summary",
                userTitle: "Detail lazy title",
                userContent: "Detail lazy content",
                userSummary: "Detail lazy summary",
                displayTitle: "Detail lazy title",
                displayContent: "Detail lazy content",
                displaySummary: "Detail lazy summary",
                createdAt: "2026-04-14T03:00:00.000Z",
                updatedAt: "2026-04-14T03:00:00.000Z"
              }
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/bookmarks/bookmark-detail-lazy-assets/assets" && !init?.method) {
        return new Promise<Response>((resolve) => {
          resolveAssetResponse = () => {
            resolve(
              new Response(
                JSON.stringify({
                  assets: [
                    {
                      id: "asset-detail-lazy-1",
                      bookmarkId: "bookmark-detail-lazy-assets",
                      assetType: "image",
                      mimeType: "image/png",
                      width: null,
                      height: null,
                      sortOrder: 0,
                      contentUrl:
                        "/api/bookmarks/bookmark-detail-lazy-assets/assets/asset-detail-lazy-1/content",
                      createdAt: "2026-04-14T03:00:00.000Z",
                      updatedAt: "2026-04-14T03:00:00.000Z"
                    }
                  ]
                }),
                {
                  status: 200,
                  headers: jsonHeaders
                }
              )
            );
          };
        });
      }

      if (url === "/api/folders" && !init?.method) {
        return Promise.resolve(
          new Response(
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
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/tags" && !init?.method) {
        return Promise.resolve(
          new Response(
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
              headers: jsonHeaders
            }
          )
        );
      }

      if (url === "/api/recommendations" && !init?.method) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              favorites: [],
              recent: [],
              frequent: []
            }),
            {
              status: 200,
              headers: jsonHeaders
            }
          )
        );
      }

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    fireEvent.click(
      within(bookmarkListRegion).getByText(/^Detail lazy title$/i, { selector: "strong" })
    );

    await waitFor(
      () => {
        expect(screen.getByRole("region", { name: /^bookmark-detail$/i })).toBeInTheDocument();
      },
      {
        timeout: 150
      }
    );

    const detailRegion = screen.getByRole("region", { name: /^bookmark-detail$/i });
    expect(
      within(detailRegion).getByText(/^Detail lazy title$/i, { selector: "strong" })
    ).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^Detail lazy content$/i)).toBeInTheDocument();
    expect(within(detailRegion).getAllByText(/이미지를 불러오는 중\.\.\./i).length).toBeGreaterThan(0);

    resolveAssetResponse?.();

    await waitFor(() => {
      expect(
        within(detailRegion).getByRole("img", { name: /업로드 이미지 1/i })
      ).toBeInTheDocument();
    });
    expect(within(detailRegion).queryAllByText(/이미지를 불러오는 중\.\.\./i)).toHaveLength(0);
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

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    fireEvent.click(
      within(bookmarkListRegion).getByText(/^Manual reset title$/i, { selector: "strong" })
    );

    const detailRegion = await screen.findByRole("region", { name: /^bookmark-detail$/i });
    openBookmarkDetailActionMenu(detailRegion);
    fireEvent.click(
      within(detailRegion).getByRole("button", { name: /자동 추출 다시 시도/i })
    );

    await waitFor(() => {
      expect(within(detailRegion).getByText(/Retried source title/i)).toBeInTheDocument();
    });

    openBookmarkDetailActionMenu(detailRegion);
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
    fireEvent.click(within(detailRegion).getByRole("button", { name: /상세 닫기/i }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /^bookmark-detail$/i })).not.toBeInTheDocument();
    });

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

  it("shows manual content ahead of extracted summaries in bookmark cards", async () => {
    globalThis.localStorage?.setItem(
      "bookmark-view-settings:v2",
      JSON.stringify({
        mode: "card",
        card: {
          coverImage: true,
          title: true,
          description: true,
          tags: true,
          bookmarkInfo: true,
          coverSize: 132
        }
      })
    );

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
        return new Response(
          JSON.stringify({
            bookmarks: [
              {
                id: "bookmark-manual-priority",
                folderId: null,
                tagIds: [],
                url: "https://example.com/manual-priority",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: "Source title",
                sourceContent: "Source content",
                sourceSummary: "처음보는 이상한 자동 문구",
                userTitle: "Manual priority title",
                userContent: "직접 정리한 핵심 메모",
                userSummary: null,
                displayTitle: "Manual priority title",
                displayContent: "직접 정리한 핵심 메모",
                displaySummary: "처음보는 이상한 자동 문구",
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

      if (url === "/api/bookmarks/bookmark-manual-priority/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
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

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    const bookmarkCard = within(bookmarkListRegion)
      .getByText(/^Manual priority title$/i, { selector: "strong" })
      .closest("li");

    expect(bookmarkCard).not.toBeNull();
    expect(within(bookmarkCard as HTMLElement).getByText(/^직접 정리한 핵심 메모$/i)).toBeInTheDocument();
    expect(
      within(bookmarkCard as HTMLElement).queryByText(/^처음보는 이상한 자동 문구$/i)
    ).not.toBeInTheDocument();
    expect(within(bookmarkCard as HTMLElement).getByText(/^직접 정리$/i)).toBeInTheDocument();
    expect(within(bookmarkCard as HTMLElement).queryByText(/^자동 요약$/i)).not.toBeInTheDocument();
  });

  it("clears extracted values from the detail panel while keeping manual content", async () => {
    let patchBody: Record<string, unknown> | null = null;

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
                id: "bookmark-source-reset",
                folderId: null,
                tagIds: [],
                url: "https://example.com/source-reset",
                isFavorite: false,
                bookmarkColor: null,
                urlColor: null,
                sourceTitle: "Source reset title",
                sourceContent: "Source reset content",
                sourceSummary: "Source reset summary",
                userTitle: "Manual reset title",
                userContent: "Manual reset content",
                userSummary: null,
                displayTitle: "Manual reset title",
                displayContent: "Manual reset content",
                displaySummary: "Source reset summary",
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

      if (url === "/api/bookmarks/bookmark-source-reset" && !init?.method) {
        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-source-reset",
              folderId: null,
              tagIds: [],
              url: "https://example.com/source-reset",
              isFavorite: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: "Source reset title",
              sourceContent: "Source reset content",
              sourceSummary: "Source reset summary",
              userTitle: "Manual reset title",
              userContent: "Manual reset content",
              userSummary: null,
              displayTitle: "Manual reset title",
              displayContent: "Manual reset content",
              displaySummary: "Source reset summary",
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

      if (url === "/api/bookmarks/bookmark-source-reset/assets" && !init?.method) {
        return new Response(JSON.stringify({ assets: [] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/bookmarks/bookmark-source-reset" && init?.method === "PATCH") {
        patchBody = JSON.parse(String(init.body));

        return new Response(
          JSON.stringify({
            bookmark: {
              id: "bookmark-source-reset",
              folderId: null,
              tagIds: [],
              url: "https://example.com/source-reset",
              isFavorite: false,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Manual reset title",
              userContent: "Manual reset content",
              userSummary: null,
              displayTitle: "Manual reset title",
              displayContent: "Manual reset content",
              displaySummary: "",
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

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    fireEvent.click(
      within(bookmarkListRegion).getByText(/^Manual reset title$/i, { selector: "strong" })
    );

    const detailRegion = await screen.findByRole("region", { name: /^bookmark-detail$/i });
    openBookmarkDetailActionMenu(detailRegion);
    fireEvent.click(
      within(detailRegion).getByRole("button", { name: /자동 추출 초기화/i })
    );

    await waitFor(() => {
      expect(
        within(detailRegion).getByText(/자동 추출값이 없습니다\./i)
      ).toBeInTheDocument();
    });

    fireEvent.click(within(detailRegion).getByRole("tab", { name: /^상세$/i }));

    expect(within(detailRegion).getByText(/^Manual reset content$/i)).toBeInTheDocument();
    expect(
      within(detailRegion).queryByText(/^Source reset summary$/i)
    ).not.toBeInTheDocument();
    expect(patchBody).toEqual({
      sourceTitle: null,
      sourceContent: null,
      sourceSummary: null
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks/bookmark-source-reset",
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

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    fireEvent.click(
      within(bookmarkListRegion).getByText(/^Delete me$/i, { selector: "strong" })
    );

    const detailRegion = await screen.findByRole("region", { name: /^bookmark-detail$/i });
    openBookmarkDetailActionMenu(detailRegion);
    fireEvent.click(within(detailRegion).getByRole("button", { name: /삭제/i }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: /^bookmark-detail$/i })).not.toBeInTheDocument();
    });

    expect(within(bookmarkListRegion).queryByText(/^Delete me$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/보관한 북마크가 없습니다\./i)).toBeInTheDocument();

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/bookmarks/bookmark-delete",
      expect.objectContaining({
        method: "DELETE",
        credentials: "include"
      })
    );
  });
});
