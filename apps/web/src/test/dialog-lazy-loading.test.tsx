import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const lazyDialogMocks = vi.hoisted(() => ({
  installHelpLoadCount: 0,
  extensionDownloadLoadCount: 0,
  extensionTokenLoadCount: 0,
  bookmarkDetailLoadCount: 0,
  bookmarkComposerLoadCount: 0,
  folderManagerLoadCount: 0,
  tagManagerLoadCount: 0
}));

vi.mock("../components/InstallHelpDialog", () => {
  lazyDialogMocks.installHelpLoadCount += 1;

  return {
    default: ({ onClose }: { onClose: () => void }) => (
      <div role="dialog" aria-label="install-help-dialog">
        <p>lazy install help dialog</p>
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    )
  };
});

vi.mock("../components/ExtensionDownloadDialog", () => {
  lazyDialogMocks.extensionDownloadLoadCount += 1;

  return {
    default: ({
      onClose,
      onUserscriptCodeCopy
    }: {
      onClose: () => void;
      onUserscriptCodeCopy: () => void;
    }) => (
      <div role="dialog" aria-label="extension-download-dialog">
        <p>lazy extension download dialog</p>
        <button type="button" onClick={onUserscriptCodeCopy}>
          스크립트 코드 복사
        </button>
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    )
  };
});

vi.mock("../components/ExtensionTokenDialog", () => {
  lazyDialogMocks.extensionTokenLoadCount += 1;

  return {
    default: ({ onClose }: { onClose: () => void }) => (
      <div role="dialog" aria-label="extension-token-dialog">
        <p>lazy extension token dialog</p>
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    )
  };
});

vi.mock("../components/BookmarkDetailPanel", () => {
  lazyDialogMocks.bookmarkDetailLoadCount += 1;

  return {
    default: ({
      bookmark,
      onClose
    }: {
      bookmark: { displayTitle: string; url: string } | null;
      onClose: () => void;
    }) => (
      <section aria-label="bookmark-detail">
        <p>lazy bookmark detail panel</p>
        <p>{bookmark?.displayTitle || bookmark?.url}</p>
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </section>
    )
  };
});

vi.mock("../components/BookmarkComposerDialog", () => {
  lazyDialogMocks.bookmarkComposerLoadCount += 1;

  return {
    default: ({ onClose }: { onClose: () => void }) => (
      <div role="dialog" aria-label="bookmark-composer-dialog">
        <p>lazy bookmark composer dialog</p>
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    )
  };
});

vi.mock("../components/FolderManagerDialog", () => {
  lazyDialogMocks.folderManagerLoadCount += 1;

  return {
    default: ({ onClose }: { onClose: () => void }) => (
      <div role="dialog" aria-label="folder-manager-dialog">
        <p>lazy folder manager dialog</p>
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    )
  };
});

vi.mock("../components/TagManagerDialog", () => {
  lazyDialogMocks.tagManagerLoadCount += 1;

  return {
    default: ({ onClose }: { onClose: () => void }) => (
      <div role="dialog" aria-label="tag-manager-dialog">
        <p>lazy tag manager dialog</p>
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    )
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  lazyDialogMocks.installHelpLoadCount = 0;
  lazyDialogMocks.extensionDownloadLoadCount = 0;
  lazyDialogMocks.extensionTokenLoadCount = 0;
  lazyDialogMocks.bookmarkDetailLoadCount = 0;
  lazyDialogMocks.bookmarkComposerLoadCount = 0;
  lazyDialogMocks.folderManagerLoadCount = 0;
  lazyDialogMocks.tagManagerLoadCount = 0;
});

function stubAnonymousSession() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.url;

    if (url === "/api/auth/session" && !init?.method) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
  });
}

function createBookmark(overrides: Partial<{
  id: string;
  url: string;
  isFavorite: boolean;
  displayTitle: string;
}> = {}) {
  const id = overrides.id ?? "bookmark-1";
  const url = overrides.url ?? "https://example.com/bookmark";
  const displayTitle = overrides.displayTitle ?? "Lazy detail bookmark";

  return {
    id,
    folderId: null,
    tagIds: [],
    url,
    isFavorite: overrides.isFavorite ?? true,
    isHidden: false,
    isTrashed: false,
    trashedAt: null,
    bookmarkColor: null,
    urlColor: null,
    sourceTitle: null,
    sourceContent: null,
    sourceSummary: null,
    userTitle: displayTitle,
    userContent: null,
    userSummary: null,
    displayTitle,
    displayContent: "",
    displaySummary: "",
    createdAt: "2026-04-13T08:00:00.000Z",
    updatedAt: "2026-04-13T08:00:00.000Z"
  };
}

function stubAuthenticatedSession(options: {
  favoriteBookmarks?: ReturnType<typeof createBookmark>[];
} = {}) {
  const favoriteBookmarks = options.favoriteBookmarks ?? [];

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

    if (url === "/api/bookmarks/counts" && !init?.method) {
      return new Response(
        JSON.stringify({
          counts: {
            active: { total: 0, visible: 0 },
            favorite: { total: 0, visible: 0 },
            trashed: { total: 0, visible: 0 },
            unfiled: { total: 0, visible: 0 },
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

    if (url === "/api/bookmarks?favorite=1&limit=20&offset=0" && !init?.method) {
      return new Response(JSON.stringify({ bookmarks: favoriteBookmarks }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    if (url.startsWith("/api/bookmarks/assets?") && !init?.method) {
      return new Response(JSON.stringify({ assetsByBookmarkId: {} }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    const detailBookmark = favoriteBookmarks.find(
      (bookmark) => url === `/api/bookmarks/${bookmark.id}` && !init?.method
    );
    if (detailBookmark) {
      return new Response(JSON.stringify({ bookmark: detailBookmark }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    const assetBookmark = favoriteBookmarks.find(
      (bookmark) => url === `/api/bookmarks/${bookmark.id}/assets` && !init?.method
    );
    if (assetBookmark) {
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

    if (url === "/api/extension-tokens" && !init?.method) {
      return new Response(JSON.stringify({ tokens: [] }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    }

    throw new Error(`Unhandled fetch: ${url} ${init?.method ?? "GET"}`);
  });
}

describe("dialog lazy loading", () => {
  it("loads install help dialog code only when the install guide opens", async () => {
    stubAnonymousSession();

    const { default: App } = await import("../App");
    render(<App />);

    const installButton = await screen.findByRole("button", { name: /앱 설치/i });
    expect(lazyDialogMocks.installHelpLoadCount).toBe(0);

    fireEvent.click(installButton);

    expect(await screen.findByText("lazy install help dialog")).toBeInTheDocument();
    expect(lazyDialogMocks.installHelpLoadCount).toBe(1);
  });

  it("loads extension download dialog code only when the extension guide opens", async () => {
    stubAuthenticatedSession();

    const { default: App } = await import("../App");
    render(<App />);

    expect(await screen.findByText("keygenerator25@gmail.com")).toBeInTheDocument();
    expect(lazyDialogMocks.extensionDownloadLoadCount).toBe(0);

    fireEvent.click(
      screen.getByRole("button", { name: /브라우저 확장 다운로드/i })
    );

    expect(await screen.findByText("lazy extension download dialog")).toBeInTheDocument();
    expect(lazyDialogMocks.extensionDownloadLoadCount).toBe(1);
  });

  it("loads extension token dialog code only when token management opens", async () => {
    stubAuthenticatedSession();

    const { default: App } = await import("../App");
    render(<App />);

    expect(await screen.findByText("keygenerator25@gmail.com")).toBeInTheDocument();
    expect(lazyDialogMocks.extensionTokenLoadCount).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: /확장 토큰 관리/i }));

    expect(await screen.findByText("lazy extension token dialog")).toBeInTheDocument();
    expect(lazyDialogMocks.extensionTokenLoadCount).toBe(1);
  });

  it("loads bookmark detail panel code only when detail opens", async () => {
    const bookmark = createBookmark();
    stubAuthenticatedSession({
      favoriteBookmarks: [bookmark]
    });

    const { default: App } = await import("../App");
    render(<App />);

    expect(await screen.findByText("Lazy detail bookmark")).toBeInTheDocument();
    expect(lazyDialogMocks.bookmarkDetailLoadCount).toBe(0);

    fireEvent.click(
      screen.getByRole("button", { name: /Lazy detail bookmark 상세 보기/i })
    );

    expect(await screen.findByText("lazy bookmark detail panel")).toBeInTheDocument();
    expect(lazyDialogMocks.bookmarkDetailLoadCount).toBe(1);
  });

  it("loads bookmark composer dialog code only when creating a bookmark", async () => {
    stubAuthenticatedSession();

    const { default: App } = await import("../App");
    render(<App />);

    expect(await screen.findByText("keygenerator25@gmail.com")).toBeInTheDocument();
    expect(lazyDialogMocks.bookmarkComposerLoadCount).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: /^새 북마크$/i }));

    expect(await screen.findByText("lazy bookmark composer dialog")).toBeInTheDocument();
    expect(lazyDialogMocks.bookmarkComposerLoadCount).toBe(1);
  });

  it("loads folder manager dialog code only when opening folder management", async () => {
    stubAuthenticatedSession();

    const { default: App } = await import("../App");
    render(<App />);

    expect(await screen.findByText("keygenerator25@gmail.com")).toBeInTheDocument();
    expect(lazyDialogMocks.folderManagerLoadCount).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: /빠른 작업 더보기/i }));
    fireEvent.click(screen.getByRole("button", { name: /^새 폴더$/i }));

    expect(await screen.findByText("lazy folder manager dialog")).toBeInTheDocument();
    expect(lazyDialogMocks.folderManagerLoadCount).toBe(1);
  });

  it("loads tag manager dialog code only when opening tag management", async () => {
    stubAuthenticatedSession();

    const { default: App } = await import("../App");
    render(<App />);

    expect(await screen.findByText("keygenerator25@gmail.com")).toBeInTheDocument();
    expect(lazyDialogMocks.tagManagerLoadCount).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: /빠른 작업 더보기/i }));
    fireEvent.click(screen.getByRole("button", { name: /^태그 관리$/i }));

    expect(await screen.findByText("lazy tag manager dialog")).toBeInTheDocument();
    expect(lazyDialogMocks.tagManagerLoadCount).toBe(1);
  });
});
