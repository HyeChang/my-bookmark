import { afterEach, describe, expect, it, vi } from "vitest";

import { requestJson } from "../lib/api";
import { extractBookmarkPreview } from "../lib/bookmark-extract";
import { loadBookmarkPreview } from "../lib/bookmarks";
import { createTag } from "../lib/tags";

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
});
