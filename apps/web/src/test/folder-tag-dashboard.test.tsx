import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openDesktopBookmarkComposer() {
  const navigationSidebar = await screen.findByRole("region", {
    name: /navigation-sidebar/i
  });
  fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 북마크$/i }));

  const composerDialog = await screen.findByRole("dialog", {
    name: /bookmark-composer-dialog/i
  });

  return within(composerDialog).getByRole("region", { name: /bookmark-form/i });
}

async function openFolderManagerOverlay() {
  const navigationSidebar = await screen.findByRole("region", {
    name: /navigation-sidebar/i
  });
  fireEvent.click(
    within(navigationSidebar).getByRole("button", { name: /빠른 작업 더보기/i })
  );
  fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^새 폴더$/i }));

  const folderDialog = await screen.findByRole("dialog", {
    name: /folder-manager-dialog/i
  });

  return within(folderDialog).getByRole("region", { name: /folder-manager/i });
}

function openFolderActionMenu(folderManager: HTMLElement, folderName: string) {
  fireEvent.click(
    within(folderManager).getByRole("button", {
      name: new RegExp(`${folderName} 폴더 더보기`, "i")
    })
  );
}

function beginChildFolderCreateFromFolderMenu(folderManager: HTMLElement, folderName: string) {
  openFolderActionMenu(folderManager, folderName);
  const folderMenu = within(folderManager).getByRole("menu", {
    name: new RegExp(`${folderName} 폴더 메뉴`, "i")
  });
  fireEvent.click(
    within(folderMenu).getByRole("button", {
      name: new RegExp(`${folderName} 하위 폴더 추가`, "i")
    })
  );
}

async function openTagManagerOverlay() {
  const navigationSidebar = await screen.findByRole("region", {
    name: /navigation-sidebar/i
  });
  fireEvent.click(
    within(navigationSidebar).getByRole("button", { name: /빠른 작업 더보기/i })
  );
  fireEvent.click(within(navigationSidebar).getByRole("button", { name: /^태그 관리$/i }));

  const tagDialog = await screen.findByRole("dialog", {
    name: /tag-manager-dialog/i
  });

  return within(tagDialog).getByRole("region", { name: /tag-manager/i });
}

function openTagActionMenu(tagManager: HTMLElement, tagName: string) {
  fireEvent.click(
    within(tagManager).getByRole("button", {
      name: new RegExp(`${tagName} 태그 더보기`, "i")
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
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

    expect(screen.queryByRole("region", { name: /folder-manager/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /tag-manager/i })).not.toBeInTheDocument();
    const bookmarkFormRegion = await openDesktopBookmarkComposer();
    expect(await within(bookmarkFormRegion).findByLabelText(/저장 폴더/i)).toBeInTheDocument();
    expect(
      await within(bookmarkFormRegion).findByRole("option", { name: /reading/i })
    ).toBeInTheDocument();
    const tagManagerRegion = await openTagManagerOverlay();
    expect((await within(tagManagerRegion).findAllByText(/research/i)).length).toBeGreaterThan(0);
    expect(within(tagManagerRegion).getByText(/^입력$/i)).toBeInTheDocument();
    expect(within(tagManagerRegion).getByText(/^현재 태그$/i)).toBeInTheDocument();
    const folderManagerRegion = await openFolderManagerOverlay();
    expect(within(folderManagerRegion).getByText(/^입력$/i)).toBeInTheDocument();
    expect(within(folderManagerRegion).getByText(/^폴더 트리$/i)).toBeInTheDocument();
    expect(within(folderManagerRegion).getByText(/^트리$/i)).toBeInTheDocument();
    expect(within(folderManagerRegion).getByLabelText(/폴더 이름/i)).toBeInTheDocument();
    expect(within(folderManagerRegion).getByRole("group", { name: /폴더 색상/i })).toBeInTheDocument();
    expect(within(folderManagerRegion).getByRole("group", { name: /폴더 아이콘/i })).toBeInTheDocument();
    expect(within(folderManagerRegion).getByText(/^새 폴더$/i)).toBeInTheDocument();
    expect(within(tagManagerRegion).getByLabelText(/태그 이름/i)).toBeInTheDocument();
    expect(within(tagManagerRegion).getByRole("group", { name: /태그 색상/i })).toBeInTheDocument();
    expect(within(tagManagerRegion).getByText(/^새 태그$/i)).toBeInTheDocument();
    expect(within(tagManagerRegion).getByText(/^태그 목록$/i)).toBeInTheDocument();
  });

  it("shows folder row actions through a more menu while keeping the drag handle visible", async () => {
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
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

    const folderManager = await openFolderManagerOverlay();
    const folderItem = within(folderManager).getByRole("listitem");

    expect(
      within(folderItem).getByRole("button", { name: /reading 폴더 드래그 정렬/i })
    ).toBeInTheDocument();
    expect(
      within(folderItem).getByRole("button", { name: /reading 폴더 드래그 정렬/i })
    ).toHaveTextContent("정렬");
    expect(
      within(folderItem).getByRole("button", { name: /reading 폴더 더보기/i })
    ).toBeInTheDocument();
    expect(
      within(folderItem).getByRole("button", { name: /reading 폴더 더보기/i })
    ).toHaveTextContent("...");
    expect(
      within(folderItem).queryByRole("button", { name: /reading 하위 폴더 추가/i })
    ).not.toBeInTheDocument();
    expect(
      within(folderItem).getByRole("button", { name: /reading 폴더 이동/i })
    ).toHaveTextContent("이동");
    expect(
      within(folderItem).queryByRole("button", { name: /reading 폴더 수정/i })
    ).not.toBeInTheDocument();
    expect(
      within(folderItem).queryByRole("button", { name: /reading 폴더 삭제/i })
    ).not.toBeInTheDocument();

    openFolderActionMenu(folderManager, "Reading");

    const readingFolderMenu = within(folderItem).getByRole("menu", {
      name: /reading 폴더 메뉴/i
    });
    expect(
      within(readingFolderMenu)
        .getAllByRole("button")
        .map((button) => button.textContent?.trim())
    ).toEqual(["추가", "수정", "삭제"]);
    expect(
      within(readingFolderMenu).getByRole("button", { name: /reading 하위 폴더 추가/i })
    ).toBeInTheDocument();
    expect(
      within(readingFolderMenu).getByRole("button", { name: /reading 폴더 수정/i })
    ).toBeInTheDocument();
    expect(
      within(readingFolderMenu).getByRole("button", { name: /reading 폴더 삭제/i })
    ).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(
      within(folderItem).queryByRole("menu", { name: /reading 폴더 메뉴/i })
    ).not.toBeInTheDocument();
  });

  it("starts child folder creation from the folder tree quick action", async () => {
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
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

    const folderManager = await openFolderManagerOverlay();
    beginChildFolderCreateFromFolderMenu(folderManager, "Reading");

    expect(within(folderManager).getByRole("button", { name: /^폴더 추가$/i })).toHaveTextContent(
      /^추가$/i
    );
    expect(
      (within(folderManager).getByLabelText(/부모 폴더/i) as HTMLSelectElement).value
    ).toBe("folder-1");
  });

  it("renders the folder manager as a collapsible tree with parent disclosure", async () => {
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
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
                color: "#2563eb",
                icon: "file-text",
                parentFolderId: "folder-1",
                sortOrder: 0,
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

    const folderManager = await openFolderManagerOverlay();
    expect(
      within(folderManager).getByRole("button", { name: /reading 폴더 접기/i })
    ).toBeInTheDocument();
    expect(within(folderManager).getByText(/^Papers$/i)).toBeInTheDocument();
  });

  it("keeps child folder creation behind each folder menu in the manager tree", async () => {
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
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

    const folderManager = await openFolderManagerOverlay();
    expect(folderManager.querySelector(".folder-tree-child-create")).not.toBeInTheDocument();
    expect(
      within(folderManager).queryByRole("button", { name: /reading 하위 폴더 추가/i })
    ).not.toBeInTheDocument();

    openFolderActionMenu(folderManager, "Reading");
    const folderMenu = within(folderManager).getByRole("menu", {
      name: /reading 폴더 메뉴/i
    });
    expect(
      within(folderMenu).getByRole("button", { name: /reading 하위 폴더 추가/i })
    ).toBeInTheDocument();
  });

  it("closes the folder manager from the backdrop without confirmation when the child draft is unchanged", async () => {
    const confirmSpy = vi.fn(() => false);
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
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

    const folderManager = await openFolderManagerOverlay();
    beginChildFolderCreateFromFolderMenu(folderManager, "Reading");

    const folderDialog = screen.getByRole("dialog", {
      name: /folder-manager-dialog/i
    });
    fireEvent.click(folderDialog.parentElement as HTMLElement);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /folder-manager-dialog/i })
      ).not.toBeInTheDocument();
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("asks before closing the folder manager from the backdrop when the draft has changes", async () => {
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
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

    const folderManager = await openFolderManagerOverlay();
    fireEvent.change(within(folderManager).getByLabelText(/폴더 이름/i), {
      target: {
        value: "Draft folder"
      }
    });

    const folderDialog = screen.getByRole("dialog", {
      name: /folder-manager-dialog/i
    });
    fireEvent.click(folderDialog.parentElement as HTMLElement);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog", { name: /folder-manager-dialog/i })).toBeInTheDocument();

    fireEvent.click(folderDialog.parentElement as HTMLElement);

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /folder-manager-dialog/i })
      ).not.toBeInTheDocument();
    });
    expect(confirmSpy).toHaveBeenCalledTimes(2);
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
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
    const folderManager = await openFolderManagerOverlay();

    fireEvent.change(within(folderManager).getByLabelText(/폴더 이름/i), {
      target: {
        value: "Articles"
      }
    });
    chooseColorOption(folderManager, "폴더 색상", "청록");
    fireEvent.click(within(folderManager).getByRole("button", { name: /폴더 아이콘 신문 선택/i }));
    expect(within(folderManager).getByText(/^선택됨: 신문$/i)).toBeInTheDocument();
    fireEvent.click(within(folderManager).getByRole("button", { name: /^폴더 추가$/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/articles/i).length).toBeGreaterThan(0);
    });
    expect(folderManager.querySelectorAll(".folder-icon-badge").length).toBeGreaterThan(0);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/folders",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("creates a hidden folder when the hidden option is selected", async () => {
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
              id: "folder-hidden-1",
              name: "Private",
              color: null,
              icon: null,
              isHidden: true,
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
    const folderManager = await openFolderManagerOverlay();

    fireEvent.change(within(folderManager).getByLabelText(/폴더 이름/i), {
      target: {
        value: "Private"
      }
    });
    fireEvent.click(within(folderManager).getByLabelText(/숨김 폴더/i));
    fireEvent.click(within(folderManager).getByRole("button", { name: /^폴더 추가$/i }));

    const createCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        (typeof input === "string" ? input : input.url) === "/api/folders" &&
        init?.method === "POST"
    );

    expect(createCall).toBeDefined();
    expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
      name: "Private",
      isHidden: true
    });
  });

  it("renders the folder hidden checkbox with the shared checkbox field layout", async () => {
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
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
    const folderManager = await openFolderManagerOverlay();
    const hiddenFolderCheckbox = within(folderManager).getByRole("checkbox", { name: /숨김 폴더/i });

    expect(hiddenFolderCheckbox).toHaveClass("checkbox-field-input");
    expect(hiddenFolderCheckbox.closest("label")).toHaveClass("checkbox-field");
  });

  it("creates a child folder with a selected parent folder", async () => {
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
              name: "Papers",
              color: "#0f766e",
              icon: "file-text",
              parentFolderId: "folder-1",
              sortOrder: 1,
              createdAt: "2026-04-13T11:00:00.000Z",
              updatedAt: "2026-04-13T11:00:00.000Z"
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

    const folderManager = await openFolderManagerOverlay();
    fireEvent.change(within(folderManager).getByLabelText(/폴더 이름/i), {
      target: {
        value: "Papers"
      }
    });
    fireEvent.change(within(folderManager).getByLabelText(/부모 폴더/i), {
      target: {
        value: "folder-1"
      }
    });
    fireEvent.click(within(folderManager).getByRole("button", { name: /^폴더 추가$/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/papers/i).length).toBeGreaterThan(0);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/folders",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Papers",
          color: null,
          icon: null,
          isHidden: false,
          parentFolderId: "folder-1"
        })
      })
    );
  });

  it("renders the folder manager as a hierarchical tree and reuses the same order in pickers", async () => {
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
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

    const folderManager = await openFolderManagerOverlay();
    const folderItems = within(folderManager).getAllByRole("listitem");

    expect(within(folderItems[0]).getByText(/^Reading$/i)).toBeInTheDocument();
    expect(within(folderItems[1]).getByText(/Papers$/i)).toBeInTheDocument();
    expect(within(folderItems[1]).getByText(/^상위 Reading$/i)).toBeInTheDocument();
    expect(within(folderItems[1]).queryByText(/^하위$/i)).not.toBeInTheDocument();

    const bookmarkFormRegion = await openDesktopBookmarkComposer();
    const bookmarkFolderOptions = within(bookmarkFormRegion).getAllByRole("option");
    expect(bookmarkFolderOptions.map((option) => option.textContent)).toEqual([
      "폴더 없음",
      "Reading",
      "-- Papers"
    ]);

    const searchPanel = screen.getByRole("region", { name: /search-panel/i });
    fireEvent.click(within(searchPanel).getByRole("button", { name: /고급 필터/i }));
    await within(searchPanel).findByLabelText(/필터 폴더/i);
    const searchFolderOptions = within(searchPanel)
      .getAllByRole("option")
      .filter((option) => option.textContent === "전체 폴더" || option.textContent === "Reading" || option.textContent === "-- Papers");
    expect(searchFolderOptions.map((option) => option.textContent)).toEqual([
      "전체 폴더",
      "Reading",
      "-- Papers"
    ]);
  });

  it("reorders sibling folders by drag and drop and reuses the new order in pickers", async () => {
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

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const folderManager = await openFolderManagerOverlay();
    const dragHandle = within(folderManager).getByRole("button", {
      name: /reading 폴더 드래그 정렬/i
    });
    const targetItem = within(folderManager)
      .getAllByRole("listitem")
      .find((item) => within(item).queryByText(/^Articles$/i));

    expect(targetItem).not.toBeNull();

    fireEvent.dragStart(dragHandle);
    fireEvent.dragOver(targetItem as HTMLElement);
    fireEvent.drop(targetItem as HTMLElement);

    await waitFor(() => {
      const folderItems = within(folderManager).getAllByRole("listitem");
      expect(within(folderItems[0]).getByText(/^Articles$/i)).toBeInTheDocument();
      expect(within(folderItems[1]).getByText(/^Reading$/i)).toBeInTheDocument();
    });

    const bookmarkFormRegion = await openDesktopBookmarkComposer();
    const bookmarkFolderOptions = within(bookmarkFormRegion).getAllByRole("option");
    expect(bookmarkFolderOptions.map((option) => option.textContent)).toEqual([
      "폴더 없음",
      "Articles",
      "Reading",
      "-- Papers"
    ]);

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

  it("moves a sibling folder to the top from the sort action menu", async () => {
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
                parentFolderId: null,
                sortOrder: 2,
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
                id: "folder-3",
                name: "Papers",
                color: "#2563eb",
                icon: "file-text",
                parentFolderId: null,
                sortOrder: 0,
                createdAt: "2026-04-13T12:00:00.000Z",
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
                id: "folder-2",
                name: "Articles",
                color: "#0f766e",
                icon: "newspaper",
                parentFolderId: null,
                sortOrder: 2,
                createdAt: "2026-04-13T11:00:00.000Z",
                updatedAt: "2026-04-13T13:00:00.000Z"
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

    const folderManager = await openFolderManagerOverlay();
    fireEvent.click(
      within(folderManager).getByRole("button", {
        name: /papers 폴더 드래그 정렬/i
      })
    );
    fireEvent.click(
      within(folderManager).getByRole("button", {
        name: /papers 폴더 맨 위로 이동/i
      })
    );

    await waitFor(() => {
      const folderItems = within(folderManager).getAllByRole("listitem");
      expect(within(folderItems[0]).getByText(/^Papers$/i)).toBeInTheDocument();
      expect(within(folderItems[1]).getByText(/^Reading$/i)).toBeInTheDocument();
      expect(within(folderItems[2]).getByText(/^Articles$/i)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/folders/reorder",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          parentFolderId: null,
          folderIds: ["folder-3", "folder-1", "folder-2"]
        })
      })
    );
  });

  it("moves a folder under another folder when dropped on a different parent", async () => {
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

      if (url === "/api/folders/folder-2/move" && init?.method === "POST") {
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
                updatedAt: "2026-04-13T13:00:00.000Z"
              },
              {
                id: "folder-2",
                name: "Articles",
                color: "#0f766e",
                icon: "newspaper",
                parentFolderId: "folder-1",
                sortOrder: 0,
                createdAt: "2026-04-13T11:00:00.000Z",
                updatedAt: "2026-04-13T13:00:00.000Z"
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

    const folderManager = await openFolderManagerOverlay();
    const dragHandle = within(folderManager).getByRole("button", {
      name: /articles 폴더 드래그 정렬/i
    });
    const moveTarget = within(folderManager).getByRole("button", {
      name: /reading 폴더 이동/i
    });

    fireEvent.dragStart(dragHandle);
    fireEvent.dragOver(moveTarget);
    fireEvent.drop(moveTarget);

    await waitFor(() => {
      const folderItems = within(folderManager).getAllByRole("listitem");
      expect(within(folderItems[0]).getByText(/^Reading$/i)).toBeInTheDocument();
      expect(within(folderItems[1]).getByText(/Articles$/i)).toBeInTheDocument();
      expect(within(folderItems[1]).getByText(/^상위 Reading$/i)).toBeInTheDocument();
    });

    const bookmarkFormRegion = await openDesktopBookmarkComposer();
    const bookmarkFolderOptions = within(bookmarkFormRegion).getAllByRole("option");
    expect(bookmarkFolderOptions.map((option) => option.textContent)).toEqual([
      "폴더 없음",
      "Reading",
      "-- Articles"
    ]);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/folders/folder-2/move",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          parentFolderId: "folder-1"
        })
      })
    );
  });

  it("moves a folder under a selected parent from the move button menu", async () => {
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

      if (url === "/api/folders/folder-2/move" && init?.method === "POST") {
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
                updatedAt: "2026-04-13T13:00:00.000Z"
              },
              {
                id: "folder-2",
                name: "Articles",
                color: "#0f766e",
                icon: "newspaper",
                parentFolderId: "folder-1",
                sortOrder: 0,
                createdAt: "2026-04-13T11:00:00.000Z",
                updatedAt: "2026-04-13T13:00:00.000Z"
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

    const folderManager = await openFolderManagerOverlay();
    fireEvent.click(
      within(folderManager).getByRole("button", {
        name: /articles 폴더 이동/i
      })
    );
    fireEvent.click(
      within(folderManager).getByRole("button", {
        name: /articles 폴더를 reading 아래로 이동/i
      })
    );

    await waitFor(() => {
      const folderItems = within(folderManager).getAllByRole("listitem");
      expect(within(folderItems[0]).getByText(/^Reading$/i)).toBeInTheDocument();
      expect(within(folderItems[1]).getByText(/Articles$/i)).toBeInTheDocument();
      expect(within(folderItems[1]).getByText(/^상위 Reading$/i)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/folders/folder-2/move",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          parentFolderId: "folder-1"
        })
      })
    );
  });

  it("moves a child folder to the root drop zone", async () => {
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
                color: "#2563eb",
                icon: "file-text",
                parentFolderId: "folder-1",
                sortOrder: 0,
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

      if (url === "/api/folders/folder-2/move" && init?.method === "POST") {
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
                updatedAt: "2026-04-13T12:00:00.000Z"
              },
              {
                id: "folder-2",
                name: "Papers",
                color: "#2563eb",
                icon: "file-text",
                parentFolderId: null,
                sortOrder: 1,
                createdAt: "2026-04-13T11:00:00.000Z",
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

      throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<App />);

    const folderManager = await openFolderManagerOverlay();
    const dragHandle = within(folderManager).getByRole("button", {
      name: /papers 폴더 드래그 정렬/i
    });
    const rootDropZone = within(folderManager).getByRole("button", {
      name: /루트 이동/i
    });

    fireEvent.dragStart(dragHandle);
    fireEvent.dragOver(rootDropZone);
    fireEvent.drop(rootDropZone);

    await waitFor(() => {
      const folderItems = within(folderManager).getAllByRole("listitem");
      expect(within(folderItems[0]).getByText(/^Reading$/i)).toBeInTheDocument();
      expect(within(folderItems[1]).getByText(/^Papers$/i)).toBeInTheDocument();
      expect(within(folderItems[1]).queryByText(/상위:/i)).not.toBeInTheDocument();
    });

    const bookmarkFormRegion = await openDesktopBookmarkComposer();
    const bookmarkFolderOptions = within(bookmarkFormRegion).getAllByRole("option");
    expect(bookmarkFolderOptions.map((option) => option.textContent)).toEqual([
      "폴더 없음",
      "Reading",
      "Papers"
    ]);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/folders/folder-2/move",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          parentFolderId: null
        })
      })
    );
  });

  it("updates a folder and a tag from the dashboard", async () => {
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

      if (url === "/api/folders/folder-1" && init?.method === "PATCH") {
        return new Response(
          JSON.stringify({
            folder: {
              id: "folder-1",
              name: "Articles",
              color: "#0f766e",
              icon: "newspaper",
              parentFolderId: null,
              sortOrder: 0,
              createdAt: "2026-04-13T10:00:00.000Z",
              updatedAt: "2026-04-13T11:00:00.000Z"
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

      if (url === "/api/tags/tag-1" && init?.method === "PATCH") {
        return new Response(
          JSON.stringify({
            tag: {
              id: "tag-1",
              name: "reference",
              color: "#0f766e",
              createdAt: "2026-04-13T10:00:00.000Z",
              updatedAt: "2026-04-13T11:00:00.000Z"
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

    const folderManager = await openFolderManagerOverlay();
    openFolderActionMenu(folderManager, "Reading");
    fireEvent.click(within(folderManager).getByRole("button", { name: /reading 폴더 수정/i }));
    fireEvent.change(within(folderManager).getByLabelText(/폴더 이름/i), {
      target: { value: "Articles" }
    });
    chooseColorOption(folderManager, "폴더 색상", "청록");
    fireEvent.click(within(folderManager).getByRole("button", { name: /폴더 아이콘 신문 선택/i }));
    const saveFolderButton = within(folderManager).getByRole("button", {
      name: /^폴더 수정$/i
    });
    expect(saveFolderButton).toHaveTextContent(/^저장$/i);
    fireEvent.click(saveFolderButton);

    await waitFor(() => {
      expect(screen.getAllByText(/articles/i).length).toBeGreaterThan(0);
    });

    const tagManager = await openTagManagerOverlay();
    openTagActionMenu(tagManager, "research");
    fireEvent.click(within(tagManager).getByRole("button", { name: /research 태그 수정 시작/i }));
    fireEvent.change(within(tagManager).getByLabelText(/태그 이름/i), {
      target: { value: "reference" }
    });
    chooseColorOption(tagManager, "태그 색상", "청록");
    const saveTagButton = within(tagManager).getByRole("button", {
      name: /^태그 수정$/i
    });
    expect(saveTagButton).toHaveTextContent(/^저장$/i);
    fireEvent.click(saveTagButton);

    await waitFor(() => {
      expect(screen.getAllByText(/reference/i).length).toBeGreaterThan(0);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/folders/folder-1",
      expect.objectContaining({
        method: "PATCH"
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/tags/tag-1",
      expect.objectContaining({
        method: "PATCH"
      })
    );
  });

  it("deletes a folder and tag and clears picker options", async () => {
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

      if ((url === "/api/bookmarks" || url === "/api/bookmarks?limit=20&offset=0") && !init?.method) {
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

      if (url === "/api/folders/folder-1" && init?.method === "DELETE") {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url === "/api/tags/tag-1" && init?.method === "DELETE") {
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

    const folderManager = await openFolderManagerOverlay();
    openFolderActionMenu(folderManager, "Reading");
    fireEvent.click(within(folderManager).getByRole("button", { name: /reading 폴더 삭제/i }));

    await waitFor(() => {
      expect(screen.queryByRole("option", { name: /reading/i })).not.toBeInTheDocument();
    });

    const tagManager = await openTagManagerOverlay();
    openTagActionMenu(tagManager, "research");
    fireEvent.click(within(tagManager).getByRole("button", { name: /research 태그 삭제/i }));

    await waitFor(() => {
      expect(within(tagManager).queryByText(/research/i)).not.toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/folders/folder-1",
      expect.objectContaining({
        method: "DELETE"
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/tags/tag-1",
      expect.objectContaining({
        method: "DELETE"
      })
    );
  });
});
