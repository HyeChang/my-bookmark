import { afterEach, describe, expect, it, vi } from "vitest";

import { requestJson } from "../lib/api";
import { loadBookmarkAssetsByBookmarks, uploadBookmarkAsset } from "../lib/bookmark-assets";
import { createBookmarkAssetThumbnail } from "../lib/bookmark-asset-thumbnails";
import { extractBookmarkPreview } from "../lib/bookmark-extract";
import { loadBookmarkCounts, loadBookmarkPage, loadBookmarkPreview } from "../lib/bookmarks";
import { createTag } from "../lib/tags";

vi.mock("../lib/bookmark-asset-thumbnails", () => ({
  createBookmarkAssetThumbnail: vi.fn()
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("maps network failures to a local server guidance message in local development", async () => {
    vi.stubGlobal("location", { hostname: "localhost" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    await expect(
      requestJson("/api/folders", {
        credentials: "include"
      }, {
        fallbackMessage: "폴더를 불러오지 못했습니다."
      })
    ).rejects.toThrow("로컬 서버에 연결하지 못했습니다. 실행 중인지 확인해주세요.");
  });

  it("maps network failures to a deployed server guidance message outside localhost", async () => {
    vi.stubGlobal("location", { hostname: "bookmark.keygenerator25.workers.dev" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    );

    await expect(
      requestJson("/api/folders", {
        credentials: "include"
      }, {
        fallbackMessage: "폴더를 불러오지 못했습니다."
      })
    ).rejects.toThrow("서버에 연결하지 못했습니다. 네트워크 상태 또는 배포 주소를 확인해주세요.");
  });

  it("maps json error codes to a specific action message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "missing_url" }), {
          status: 400,
          headers: {
            "content-type": "application/json"
          }
        })
      )
    );

    await expect(
      requestJson("/api/bookmarks", {
        method: "POST",
        credentials: "include"
      }, {
        fallbackMessage: "북마크를 저장하지 못했습니다.",
        mapErrorCode: (errorCode) =>
          errorCode === "missing_url" ? "URL을 입력해주세요." : null
      })
    ).rejects.toThrow("URL을 입력해주세요.");
  });

  it("maps tag validation errors to a specific action message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "missing_tag_name" }), {
          status: 400,
          headers: {
            "content-type": "application/json"
          }
        })
      )
    );

    await expect(
      createTag({
        name: "",
        color: "#2563eb"
      })
    ).rejects.toThrow("태그 이름을 입력해주세요.");
  });

  it("maps extract validation errors to a specific action message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "invalid_url" }), {
          status: 400,
          headers: {
            "content-type": "application/json"
          }
        })
      )
    );

    await expect(extractBookmarkPreview("not-a-valid-url")).rejects.toThrow(
      "올바른 URL 형식이 아닙니다."
    );
  });

  it("loads a fresh bookmark preview through the bookmark detail preview endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          preview: {
            url: "https://example.com/current",
            normalizedUrl: "https://example.com/current",
            sourceTitle: "Current title",
            sourceContent: "Current content",
            sourceSummary: "Current summary"
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
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadBookmarkPreview("bookmark-preview")).resolves.toMatchObject({
      sourceTitle: "Current title",
      sourceContent: "Current content",
      sourceSummary: "Current summary"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bookmarks/bookmark-preview/preview",
      {
        credentials: "include"
      }
    );
  });

  it("loads bookmark pages with server pagination metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          bookmarks: [
            {
              id: "bookmark-page-21",
              folderId: null,
              tagIds: [],
              url: "https://example.com/page-21",
              isFavorite: false,
              isHidden: false,
              isTrashed: false,
              trashedAt: null,
              bookmarkColor: null,
              urlColor: null,
              sourceTitle: null,
              sourceContent: null,
              sourceSummary: null,
              userTitle: "Paged bookmark 21",
              userContent: null,
              userSummary: null,
              displayTitle: "Paged bookmark 21",
              displayContent: "",
              displaySummary: "",
              createdAt: "2026-04-27T00:21:00.000Z",
              updatedAt: "2026-04-27T00:21:00.000Z"
            }
          ],
          pagination: {
            limit: 20,
            offset: 20,
            total: 45,
            hasMore: true
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
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadBookmarkPage({
        sort: "title_asc",
        limit: 20,
        offset: 20
      })
    ).resolves.toMatchObject({
      bookmarks: [
        {
          id: "bookmark-page-21",
          displayTitle: "Paged bookmark 21"
        }
      ],
      pagination: {
        limit: 20,
        offset: 20,
        total: 45,
        hasMore: true
      }
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bookmarks?sort=title_asc&limit=20&offset=20",
      {
        credentials: "include"
      }
    );
  });

  it("loads bookmark count summaries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          counts: {
            active: {
              total: 12,
              visible: 10
            },
            favorite: {
              total: 3,
              visible: 2
            },
            trashed: {
              total: 1,
              visible: 1
            },
            unfiled: {
              total: 4,
              visible: 4
            },
            byFolderId: {
              "folder-1": {
                total: 8,
                visible: 6
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
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadBookmarkCounts()).resolves.toEqual({
      active: {
        total: 12,
        visible: 10
      },
      favorite: {
        total: 3,
        visible: 2
      },
      trashed: {
        total: 1,
        visible: 1
      },
      unfiled: {
        total: 4,
        visible: 4
      },
      byFolderId: {
        "folder-1": {
          total: 8,
          visible: 6
        }
      }
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/bookmarks/counts", {
      credentials: "include"
    });
  });

  it("loads assets for multiple bookmarks with one batch request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          assetsByBookmarkId: {
            "bookmark-1": [
              {
                id: "asset-1",
                bookmarkId: "bookmark-1",
                assetType: "image",
                mimeType: "image/png",
                width: null,
                height: null,
                sortOrder: 0,
                contentUrl: "/api/bookmarks/bookmark-1/assets/asset-1/content",
                createdAt: "2026-04-13T08:00:00.000Z",
                updatedAt: "2026-04-13T08:00:00.000Z"
              }
            ],
            "bookmark-2": []
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
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadBookmarkAssetsByBookmarks(["bookmark-1", "bookmark-2"])
    ).resolves.toMatchObject({
      "bookmark-1": [
        {
          id: "asset-1",
          bookmarkId: "bookmark-1"
        }
      ],
      "bookmark-2": []
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bookmarks/assets?bookmarkId=bookmark-1&bookmarkId=bookmark-2",
      {
        credentials: "include"
      }
    );
  });

  it("uploads a generated bookmark asset thumbnail with the original image", async () => {
    vi.mocked(createBookmarkAssetThumbnail).mockResolvedValue(
      new File(["thumbnail"], "cover-thumb.webp", { type: "image/webp" })
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          asset: {
            id: "asset-1",
            bookmarkId: "bookmark-1",
            assetType: "image",
            mimeType: "image/png",
            width: null,
            height: null,
            sortOrder: 0,
            contentUrl: "/api/bookmarks/bookmark-1/assets/asset-1/content",
            thumbnailUrl: "/api/bookmarks/bookmark-1/assets/asset-1/thumbnail",
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
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["original"], "cover.png", { type: "image/png" });

    await expect(uploadBookmarkAsset("bookmark-1", file)).resolves.toMatchObject({
      id: "asset-1",
      thumbnailUrl: "/api/bookmarks/bookmark-1/assets/asset-1/thumbnail"
    });

    expect(createBookmarkAssetThumbnail).toHaveBeenCalledWith(file);
    const requestBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(requestBody).toBeInstanceOf(FormData);
    expect((requestBody as FormData).get("file")).toBe(file);
    const thumbnail = (requestBody as FormData).get("thumbnail");
    expect(thumbnail).toBeInstanceOf(File);
    expect((thumbnail as File).name).toBe("cover-thumb.webp");
  });
});
