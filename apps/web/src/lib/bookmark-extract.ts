import type {
  BookmarkExtractRequest,
  BookmarkExtractPreview,
  BookmarkExtractResponse
} from "@bookmark/shared";
import { requestJson } from "./api";

function mapExtractErrorCode(errorCode: string) {
  switch (errorCode) {
    case "missing_url":
      return "URL을 입력해주세요.";
    case "invalid_url":
      return "올바른 URL 형식이 아닙니다.";
    case "bookmark_extract_unsupported_content_type":
      return "이 URL에서는 메타 정보를 가져올 수 없습니다.";
    case "bookmark_extract_failed":
      return "URL 메타 미리보기를 불러오지 못했습니다.";
    default:
      return null;
  }
}

export async function extractBookmarkPreview(url: string) {
  const payload: BookmarkExtractRequest = {
    url
  };

  const data = await requestJson<BookmarkExtractResponse>(
    "/api/bookmarks/extract",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    },
    {
      fallbackMessage: "URL 메타 미리보기를 불러오지 못했습니다.",
      mapErrorCode: mapExtractErrorCode
    }
  );
  return data.preview as BookmarkExtractPreview;
}
