import type {
  Bookmark,
  BookmarkCounts,
  BookmarkCountsResponse,
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
  BookmarkTrashEmptyResponse,
  CreateBookmarkRequest,
  UpdateBookmarkRequest
} from "@bookmark/shared";
import { requestJson, requestVoid } from "./api";

type LoadBookmarksOptions = {
  all?: boolean;
  query?: string;
  mode?: BookmarkSearchMode;
  sort?: BookmarkSortMode;
  createdWithin?: BookmarkRelativeDateRange;
  openedWithin?: BookmarkRelativeDateRange;
  favoriteOnly?: boolean;
  folderId?: string;
  folderIds?: Array<string | null>;
  includeDescendantFolders?: boolean;
  tagIds?: string[];
  tagMode?: BookmarkTagMode;
  bookmarkColor?: string;
  urlColor?: string;
  summaryState?: "all" | "with" | "without";
  trashMode?: BookmarkTrashMode;
  limit?: number;
  offset?: number;
};

type LoadBookmarkOptions = {
  includeTrashed?: boolean;
};

export type BookmarkPage = {
  bookmarks: Bookmark[];
  pagination: NonNullable<BookmarkListResponse["pagination"]> | null;
};

const emptyBookmarkCountBucket = {
  total: 0,
  visible: 0
};

function normalizeBookmarkCountBucket(value: unknown) {
  if (!value || typeof value !== "object") {
    return { ...emptyBookmarkCountBucket };
  }

  const bucket = value as Partial<{ total: number; visible: number }>;
  return {
    total: Number.isFinite(bucket.total) ? Math.max(0, Math.trunc(bucket.total ?? 0)) : 0,
    visible: Number.isFinite(bucket.visible) ? Math.max(0, Math.trunc(bucket.visible ?? 0)) : 0
  };
}

function normalizeBookmarkCounts(counts: Partial<BookmarkCounts> | undefined): BookmarkCounts {
  const byFolderId: BookmarkCounts["byFolderId"] = {};
  const rawFolderCounts = counts?.byFolderId;

  if (rawFolderCounts && typeof rawFolderCounts === "object") {
    for (const [folderId, bucket] of Object.entries(rawFolderCounts)) {
      byFolderId[folderId] = normalizeBookmarkCountBucket(bucket);
    }
  }

  return {
    active: normalizeBookmarkCountBucket(counts?.active),
    favorite: normalizeBookmarkCountBucket(counts?.favorite),
    trashed: normalizeBookmarkCountBucket(counts?.trashed),
    unfiled: normalizeBookmarkCountBucket(counts?.unfiled),
    byFolderId
  };
}

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

function buildBookmarkListUrl(options: LoadBookmarksOptions = {}) {
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
  if (options.folderIds?.length) {
    for (const folderId of options.folderIds) {
      searchParams.append("folderScope", folderId?.trim() ?? "");
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
  if (options.all) {
    searchParams.set("all", "1");
  } else if (Number.isFinite(options.limit)) {
    const limit = Math.max(1, Math.trunc(options.limit ?? 1));
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    searchParams.set("limit", String(limit));
    searchParams.set("offset", String(offset));
  }

  return searchParams.size > 0 ? `/api/bookmarks?${searchParams.toString()}` : "/api/bookmarks";
}

function normalizeBookmarkPagination(
  pagination: Partial<NonNullable<BookmarkListResponse["pagination"]>> | undefined
) {
  if (
    !pagination ||
    !Number.isFinite(pagination.limit) ||
    !Number.isFinite(pagination.offset) ||
    !Number.isFinite(pagination.total)
  ) {
    return null;
  }

  return {
    limit: Math.max(1, Math.trunc(pagination.limit ?? 1)),
    offset: Math.max(0, Math.trunc(pagination.offset ?? 0)),
    total: Math.max(0, Math.trunc(pagination.total ?? 0)),
    hasMore: pagination.hasMore === true
  };
}

export async function loadBookmarkPage(options: LoadBookmarksOptions = {}): Promise<BookmarkPage> {
  const url = buildBookmarkListUrl(options);
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
  return {
    bookmarks: Array.isArray(data.bookmarks) ? (data.bookmarks as Bookmark[]) : [],
    pagination: normalizeBookmarkPagination(data.pagination)
  };
}

export async function loadBookmarks(options: LoadBookmarksOptions = {}) {
  const page = await loadBookmarkPage({
    ...options,
    all: true,
    limit: undefined,
    offset: undefined
  });
  return page.bookmarks;
}

export async function loadBookmarkCounts() {
  const data = await requestJson<Partial<BookmarkCountsResponse>>(
    "/api/bookmarks/counts",
    {
      credentials: "include"
    },
    {
      fallbackMessage: "북마크 개수를 불러오지 못했습니다.",
      mapErrorCode: mapBookmarkErrorCode
    }
  );

  return normalizeBookmarkCounts(data.counts);
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

export async function emptyBookmarkTrash() {
  const data = await requestJson<BookmarkTrashEmptyResponse>(
    "/api/bookmarks/trash",
    {
      method: "DELETE",
      credentials: "include"
    },
    {
      fallbackMessage: "휴지통을 비우지 못했습니다.",
      mapErrorCode: mapBookmarkErrorCode
    }
  );
  return data;
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
