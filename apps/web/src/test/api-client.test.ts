import { afterEach, describe, expect, it, vi } from "vitest";

import { requestJson } from "../lib/api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("maps network failures to a local server guidance message", async () => {
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
});
