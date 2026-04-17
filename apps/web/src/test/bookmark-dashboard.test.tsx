import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
    const topBar = screen.getByRole("banner");
    const workspace = await screen.findByRole("region", { name: /dashboard-workspace/i });
    const sidebar = await screen.findByRole("complementary", {
      name: /dashboard-sidebar/i
    });
    const mainPanel = await screen.findByRole("region", { name: /dashboard-main/i });
    const navigationSidebar = screen.getByRole("region", {
      name: /navigation-sidebar/i
    });
    let folderOverview = within(sidebar).getByRole("region", {
      name: /folder-overview/i
    });
    const bookmarkResults = within(mainPanel).getByRole("region", {
      name: /bookmark-results/i
    });
    const bookmarkDetailRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-detail-shell/i
    });
    const resultPrimaryColumn = within(mainPanel).getByRole("region", {
      name: /result-primary-column/i
    });
    const bookmarkReadingRail = within(mainPanel).getByRole("region", {
      name: /bookmark-reading-rail/i
    });
    expect(screen.getByText(/^개인 링크 보관함$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Personal Bookmark Workspace$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/^Save, search, and organize links from anywhere\.$/i)
    ).not.toBeInTheDocument();
    expect(workspace).toContainElement(sidebar);
    expect(workspace).toContainElement(mainPanel);
    expect(mainPanel).toContainElement(resultPrimaryColumn);
    expect(mainPanel).toContainElement(bookmarkReadingRail);
    expect(navigationSidebar).toBeInTheDocument();
    expect(topBar).toContainElement(navigationSidebar);
    expect(sidebar).not.toContainElement(navigationSidebar);
    expect(folderOverview).toBeInTheDocument();
    expect(bookmarkResults).toBeInTheDocument();
    expect(bookmarkDetailRegion).toBeInTheDocument();
    expect(bookmarkReadingRail).toContainElement(bookmarkDetailRegion);
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
    expect(
      within(bookmarkListRow as HTMLElement)
        .getAllByRole("button")
        .map((button) => button.textContent?.trim())
    ).toEqual(["열기", "..."]);
    expect(within(bookmarkListRegion).queryByText(/^상태 배지$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^분류$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^표시 설정$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^빠른 조작$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).getByText(/^폴더 없음$/i)).toBeInTheDocument();
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
    expect(
      within(bookmarkListRegion).getByRole("button", { name: /^상세 보기$/i })
    ).toBeInTheDocument();
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
    expect(await screen.findByRole("dialog", { name: /extension-token-dialog/i })).toBeInTheDocument();
    expect(screen.getByText("Chrome desktop")).toBeInTheDocument();
  });

  it("shows extension download instructions and a zip link for the authenticated user account", async () => {
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

    expect(downloadLink).toHaveAttribute("href", "/downloads/bookmark-saver-extension.zip");
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
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /research/i }));
    fireEvent.click(within(bookmarkFormRegion).getByRole("checkbox", { name: /later/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /^내용$/i }));
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

      if (url === "/api/bookmarks" && !init?.method) {
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
        url === "/api/bookmarks?folderId=folder-1&includeDescendantFolders=1" &&
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
    expect(within(folderOverview).getByRole("button", { name: /Reading 하위 폴더 추가/i })).toBeInTheDocument();
    expect(within(folderOverview).getByRole("button", { name: /Reading 폴더 더보기/i })).toBeInTheDocument();

    fireEvent.click(within(folderOverview).getByRole("button", { name: /Reading 폴더 펼치기/i }));
    expect(within(folderOverview).getByRole("button", { name: /Papers 폴더 보기/i })).toBeInTheDocument();
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

    expect(within(folderOverview).getByRole("button", { name: /Reading 폴더 수정 시작/i })).toBeInTheDocument();
    expect(within(folderOverview).getByRole("button", { name: /Reading 폴더 삭제/i })).toBeInTheDocument();

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

      if (url === "/api/bookmarks?query=secret" && !init?.method) {
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

      if (url === "/api/bookmarks?mode=all&query=ch" && !init?.method) {
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
        "/api/bookmarks?mode=all&query=ch",
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

  it("shows only the bookmark sidebar panel on mobile and switches panels on demand", async () => {
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
    const bookmarkPanelButton = within(tablist).getByRole("tab", {
      name: /북마크 저장/i
    });
    const folderPanelButton = within(tablist).getByRole("tab", {
      name: /폴더/i
    });
    const tagPanelButton = within(tablist).getByRole("tab", {
      name: /태그/i
    });

    expect(bookmarkPanelButton).toHaveAttribute("aria-selected", "true");
    expect(folderPanelButton).toHaveAttribute("aria-selected", "false");
    expect(tagPanelButton).toHaveAttribute("aria-selected", "false");
    expect(bookmarkPanelButton).toHaveTextContent(/작성 흐름/i);
    expect(folderPanelButton).toHaveTextContent(/^구조/i);
    expect(tagPanelButton).toHaveTextContent(/^분류/i);
    expect(bookmarkPanelButton).toHaveTextContent(/새 북마크/i);
    expect(folderPanelButton).toHaveTextContent(/폴더 1개/i);
    expect(tagPanelButton).toHaveTextContent(/태그 1개/i);

    expect(within(sidebar).getByRole("tabpanel", { name: /북마크 저장/i })).toBeInTheDocument();
    expect(within(sidebar).queryByRole("tabpanel", { name: /폴더/i })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("tabpanel", { name: /태그/i })).not.toBeInTheDocument();

    fireEvent.click(folderPanelButton);

    expect(
      await within(sidebar).findByRole("tabpanel", { name: /폴더/i })
    ).toBeInTheDocument();
    expect(within(sidebar).queryByRole("tabpanel", { name: /북마크 저장/i })).not.toBeInTheDocument();
    expect(await within(sidebar).findByLabelText(/폴더 이름/i)).toBeInTheDocument();
  });

  it("renders mobile sidebar tabs and switches the visible panel", async () => {
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
    const bookmarkTab = within(tablist).getByRole("tab", { name: /북마크/i });
    const folderTab = within(tablist).getByRole("tab", { name: /폴더/i });
    const tagTab = within(tablist).getByRole("tab", { name: /태그/i });

    expect(bookmarkTab).toHaveAttribute("aria-selected", "true");
    expect(folderTab).toHaveAttribute("aria-selected", "false");
    expect(tagTab).toHaveAttribute("aria-selected", "false");
    expect(bookmarkTab).toHaveTextContent(/작성 흐름/i);
    expect(folderTab).toHaveTextContent(/^구조/i);
    expect(tagTab).toHaveTextContent(/^분류/i);
    expect(bookmarkTab).toHaveTextContent(/새 북마크/i);
    expect(folderTab).toHaveTextContent(/1개/i);
    expect(tagTab).toHaveTextContent(/1개/i);
    expect(within(sidebar).getByRole("tabpanel", { name: /북마크 저장/i })).toBeInTheDocument();
    expect(within(sidebar).queryByRole("tabpanel", { name: /폴더/i })).not.toBeInTheDocument();

    fireEvent.click(folderTab);

    expect(folderTab).toHaveAttribute("aria-selected", "true");
    expect(bookmarkTab).toHaveAttribute("aria-selected", "false");
    expect(await within(sidebar).findByRole("tabpanel", { name: /폴더/i })).toBeInTheDocument();
    expect(within(sidebar).queryByRole("tabpanel", { name: /북마크 저장/i })).not.toBeInTheDocument();
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

    expect(within(bookmarkListRegion).queryByText(/^보관 목록$/i)).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^정리된 목록$/i)).not.toBeInTheDocument();
    expect(firstCard.querySelector(".bookmark-row-meta-line")).toBeInTheDocument();
    expect(firstCard.querySelector(".meta-pill")).not.toBeInTheDocument();
    expect(within(firstCard).getByText(/^폴더 없음$/i)).toBeInTheDocument();
    expect(within(firstCard).getByText(/^즐겨찾기$/i)).toBeInTheDocument();
    expect(within(firstCard).getByText(/^research$/i)).toBeInTheDocument();
    expect(within(firstCard).queryByText(/^북마크 주황$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/^URL 네이비$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/^상태 배지$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/^빠른 조작$/i)).not.toBeInTheDocument();
    expect(within(firstCard).queryByText(/^색상$/i)).not.toBeInTheDocument();
    expect(
      within(firstCard)
        .getAllByRole("button")
        .map((button) => button.textContent?.trim())
    ).toEqual(["열기", "보기", "편집", "삭제"]);
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
          "/api/bookmarks?mode=all&query=paper&bookmarkColor=%23f59e0b&urlColor=%230f172a&summaryState=with" &&
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
      "/api/bookmarks?mode=all&query=paper&bookmarkColor=%23f59e0b&urlColor=%230f172a&summaryState=with",
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
    const bookmarkFormRegion = within(composerDialog).getByRole("region", {
      name: /bookmark-form/i
    });

    expect(within(bookmarkFormRegion).getByRole("button", { name: /북마크 수정/i })).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Before title")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Before content")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Before summary")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByRole("checkbox", { name: /숨김 북마크/i })).not.toBeChecked();

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

    expect(within(bookmarkFormRegion).getByRole("button", { name: /북마크 수정/i })).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByRole("checkbox", { name: /숨김 북마크/i })).toBeChecked();
    expect(within(bookmarkFormRegion).getByDisplayValue("Hidden title")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Hidden content")).toBeInTheDocument();
    expect(within(bookmarkFormRegion).getByDisplayValue("Hidden summary")).toBeInTheDocument();
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
    const bookmarkDetailRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-detail-shell/i
    });

    expect(within(bookmarkListRegion).getByText(/^Visible bookmark$/i)).toBeInTheDocument();
    expect(within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 보기/i })).toBeInTheDocument();
    fireEvent.click(within(bookmarkListRegion).getByText(/^Visible bookmark$/i, { selector: "strong" }));

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
      expect(within(bookmarkDetailRegion).getByText(/^상세 북마크를 선택하세요$/i)).toBeInTheDocument();
    });
    expect(within(bookmarkDetailRegion).queryByRole("heading", { name: /^북마크 상세$/i })).not.toBeInTheDocument();
    expect(within(bookmarkListRegion).queryByText(/^Visible bookmark$/i)).not.toBeInTheDocument();

    fireEvent.click(within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 보기/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 숨기기/i })).toBeInTheDocument();
    });

    expect(within(bookmarkListRegion).getByText(/^Visible bookmark$/i)).toBeInTheDocument();
    expect(within(bookmarkDetailRegion).getByText(/^상세 북마크를 선택하세요$/i)).toBeInTheDocument();

    fireEvent.click(within(bookmarkListRegion).getByText(/^Visible bookmark$/i, { selector: "strong" }));

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
    const bookmarkDetailRegion = within(mainPanel).getByRole("region", {
      name: /bookmark-detail-shell/i
    });

    fireEvent.click(within(bookmarkListRegion).getByText(/^Visible bookmark$/i, { selector: "strong" }));

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
      expect(within(bookmarkDetailRegion).getByText(/^상세 북마크를 선택하세요$/i)).toBeInTheDocument();
    });

    fireEvent.click(within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 보기/i }));

    await waitFor(() => {
      expect(within(bookmarkListRegion).getByRole("button", { name: /숨김 북마크 숨기기/i })).toBeInTheDocument();
    });
    expect(within(bookmarkDetailRegion).getByText(/^상세 북마크를 선택하세요$/i)).toBeInTheDocument();
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

    const recommendationRegion = await screen.findByRole("region", {
      name: /recommendation-list/i
    });

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
    expect(
      await within(recommendationRegion).findByText(/^Favorite recommendation$/i)
    ).toBeInTheDocument();
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
      within(favoriteRecommendationItem as HTMLElement).getByText(/^즐겨찾기 기반 · 폴더 없음$/i)
    ).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^최근 열람 기반 · 폴더 없음$/i)).toBeInTheDocument();
    expect(within(recommendationRegion).getByText(/^반복 열람 기반 · 폴더 없음$/i)).toBeInTheDocument();
    expect(
      within(favoriteRecommendationItem as HTMLElement).getByRole("button", {
        name: /Favorite recommendation 열기/i
      })
    ).toHaveTextContent(/^열기$/i);

    fireEvent.click(screen.getByRole("button", { name: /Favorite recommendation 열기/i }));

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

    const bookmarkListRegion = await screen.findByRole("region", { name: /bookmark-list/i });
    fireEvent.click(within(bookmarkListRegion).getByText(/^Detail title$/i, { selector: "strong" }));

    const detailRegion = await screen.findByRole("region", { name: /^bookmark-detail$/i });
    expect(within(detailRegion).getByText(/^읽기 중심$/i)).toBeInTheDocument();
    expect(
      within(detailRegion).getByText(/^Detail title$/i, { selector: "strong" })
    ).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^https:\/\/example\.com\/detail$/i)).toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^사용자 입력값$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^자동 추출값$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).getByText(/^직접 정리$/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/^자동 추출$/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/Detail manual content/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/Detail manual summary/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/Source title/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/Source content/i)).toBeInTheDocument();
    expect(within(detailRegion).getByText(/Source summary/i)).toBeInTheDocument();
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
    ).toEqual(["열기", "목록", "..."]);
    expect(within(detailRegion).queryByText(/^핵심 액션$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^정리 작업$/i)).not.toBeInTheDocument();
    expect(within(detailRegion).queryByText(/^위험 작업$/i)).not.toBeInTheDocument();

    openBookmarkDetailActionMenu(detailRegion);

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
    openBookmarkActionMenu(bookmarkListRegion, "Manual reset title");
    fireEvent.click(
      within(bookmarkListRegion).getByRole("button", { name: /^상세 보기$/i })
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
    openBookmarkActionMenu(bookmarkListRegion, "Manual reset title");
    fireEvent.click(
      within(bookmarkListRegion).getByRole("button", { name: /^상세 보기$/i })
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
    openBookmarkActionMenu(bookmarkListRegion, "Delete me");
    fireEvent.click(
      within(bookmarkListRegion).getByRole("button", { name: /^상세 보기$/i })
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
