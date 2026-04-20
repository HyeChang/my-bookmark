import type {
  Bookmark,
  BookmarkExtractPreview,
  BookmarkPermanentDeleteResponse,
  BookmarkPreviewResponse,
  BookmarkRelativeDateRange,
  BookmarkSearchMode,
  BookmarkSortMode,
  BookmarkTagMode,
  BookmarkTrashMode,
  BookmarkListResponse,
  BookmarkResponse,
  BookmarkRestoreResponse,
  CreateBookmarkRequest,
  UpdateBookmarkRequest
} from "@bookmark/shared";
import { requestJson, requestVoid } from "./api";

type LoadBookmarksOptions = {
  query?: string;
  mode?: BookmarkSearchMode;
  sort?: BookmarkSortMode;
  createdWithin?: BookmarkRelativeDateRange;
  openedWithin?: BookmarkRelativeDateRange;
  favoriteOnly?: boolean;
  folderId?: string;
  includeDescendantFolders?: boolean;
  tagIds?: string[];
  tagMode?: BookmarkTagMode;
  bookmarkColor?: string;
  urlColor?: string;
  summaryState?: "all" | "with" | "without";
  trashMode?: BookmarkTrashMode;
};

type LoadBookmarkOptions = {
  includeTrashed?: boolean;
};

function mapBookmarkErrorCode(errorCode: string) {
  switch (errorCode) {
    case "missing_url":
      return "URL을 입력해주세요.";
    case "invalid_url":
      return "올바른 URL 형식이 아닙니다.";
    case "invalid_tag_ids":
      return "선택한 태그를 다시 확인해주세요.";
    case "bookmark_not_found":
      return "북마크를 찾지 못했습니다.";
    case "bookmark_extract_failed":
      return "URL 메타 미리보기를 불러오지 못했습니다.";
    case "bookmark_extract_unsupported_content_type":
      return "이 URL에서는 미리보기를 가져올 수 없습니다.";
    case "bookmark_reextract_failed":
      return "자동 추출을 다시 수행하지 못했습니다.";
    default:
      return null;
  }
}

export async function loadBookmarks(options: LoadBookmarksOptions = {}) {
  const searchParams = new URLSearchParams();
  const query = options.query?.trim();

  if (query) {
    searchParams.set("mode", options.mode ?? "all");
    if (options.tagMode && options.tagMode !== "and" && options.tagIds?.length) {
      searchParams.set("tagMode", options.tagMode);
    }
    searchParams.set("query", query);
  }
  if (options.sort && options.sort !== "created_desc") {
    searchParams.set("sort", options.sort);
  }
  if (options.createdWithin && options.createdWithin !== "all") {
    searchParams.set("createdWithin", options.createdWithin);
  }
  if (options.openedWithin && options.openedWithin !== "all") {
    searchParams.set("openedWithin", options.openedWithin);
  }
  if (options.favoriteOnly) {
    searchParams.set("favorite", "1");
  }
  if (options.folderId) {
    searchParams.set("folderId", options.folderId);
    if (options.includeDescendantFolders) {
      searchParams.set("includeDescendantFolders", "1");
    }
  }
  if (options.tagIds?.length) {
    if (!query && options.tagMode && options.tagMode !== "and") {
      searchParams.set("tagMode", options.tagMode);
    }
    for (const tagId of options.tagIds) {
      const normalizedTagId = tagId.trim();
      if (normalizedTagId) {
        searchParams.append("tagId", normalizedTagId);
      }
    }
  }
  if (options.bookmarkColor?.trim()) {
    searchParams.set("bookmarkColor", options.bookmarkColor.trim());
  }
  if (options.urlColor?.trim()) {
    searchParams.set("urlColor", options.urlColor.trim());
  }
  if (options.summaryState && options.summaryState !== "all") {
    searchParams.set("summaryState", options.summaryState);
  }
  if (options.trashMode === "trashed") {
    searchParams.set("trashed", "1");
  } else if (options.trashMode === "all") {
    searchParams.set("trashed", "all");
  }

  const url = searchParams.size > 0 ? `/api/bookmarks?${searchParams.toString()}` : "/api/bookmarks";
  const data = await requestJson<Partial<BookmarkListResponse>>(
    url,
    {
      credentials: "include"
    },
    {
      fallbackMessage: "북마크를 불러오지 못했습니다.",
      mapErrorCode: mapBookmarkErrorCode
    }
  );
  return Array.isArray(data.bookmarks) ? (data.bookmarks as Bookmark[]) : [];
}

export async function loadBookmark(bookmarkId: string, options: LoadBookmarkOptions = {}) {
  const searchParams = new URLSearchParams();
  if (options.includeTrashed) {
    searchParams.set("trashed", "1");
  }
  const url = searchParams.size > 0
    ? `/api/bookmarks/${bookmarkId}?${searchParams.toString()}`
    : `/api/bookmarks/${bookmarkId}`;
  const data = await requestJson<BookmarkResponse>(
    url,
    {
      credentials: "include"
    },
    {
      fallbackMessage: "북마크 상세 정보를 불러오지 못했습니다.",
      mapErrorCode: mapBookmarkErrorCode
    }
  );
  return data.bookmark;
}

export async function loadBookmarkPreview(bookmarkId: string) {
  const data = await requestJson<BookmarkPreviewResponse>(
    `/api/bookmarks/${bookmarkId}/preview`,
    {
      credentials: "include"
    },
    {
      fallbackMessage: "미리보기를 불러오지 못했습니다.",
      mapErrorCode: mapBookmarkErrorCode
    }
  );
  return data.preview as BookmarkExtractPreview;
}

export async function restoreBookmark(bookmarkId: string) {
  const data = await requestJson<BookmarkRestoreResponse>(
    `/api/bookmarks/${bookmarkId}/restore`,
    {
      method: "POST",
      credentials: "include"
    },
    {
      fallbackMessage: "휴지통에서 북마크를 복구하지 못했습니다.",
      mapErrorCode: mapBookmarkErrorCode
    }
  );
  return data.bookmark;
}

export async function permanentlyDeleteBookmark(bookmarkId: string) {
  await requestJson<BookmarkPermanentDeleteResponse>(
    `/api/bookmarks/${bookmarkId}/permanent`,
    {
      method: "DELETE",
      credentials: "include"
    },
    {
      fallbackMessage: "북마크를 영구 삭제하지 못했습니다.",
      mapErrorCode: mapBookmarkErrorCode
    }
  );
}

export async function reextractBookmark(bookmarkId: string) {
  const data = await requestJson<BookmarkResponse>(
    `/api/bookmarks/${bookmarkId}/reextract`,
    {
      method: "POST",
      credentials: "include"
    },
    {
      fallbackMessage: "자동 추출을 다시 수행하지 못했습니다.",
      mapErrorCode: mapBookmarkErrorCode
    }
  );
  return data.bookmark;
}

export async function deleteBookmark(bookmarkId: string) {
  await requestVoid(
    `/api/bookmarks/${bookmarkId}`,
    {
      method: "DELETE",
      credentials: "include"
    },
    {
      fallbackMessage: "북마크를 삭제하지 못했습니다.",
      mapErrorCode: mapBookmarkErrorCode
    }
  );
}

export async function createBookmark(input: CreateBookmarkRequest) {
  const data = await requestJson<BookmarkResponse>(
    "/api/bookmarks",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "북마크를 저장하지 못했습니다.",
      mapErrorCode: mapBookmarkErrorCode
    }
  );
  return data.bookmark;
}

export async function updateBookmark(bookmarkId: string, input: UpdateBookmarkRequest) {
  const data = await requestJson<BookmarkResponse>(
    `/api/bookmarks/${bookmarkId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    },
    {
      fallbackMessage: "북마크를 수정하지 못했습니다.",
      mapErrorCode: mapBookmarkErrorCode
    }
  );
  return data.bookmark;
}
