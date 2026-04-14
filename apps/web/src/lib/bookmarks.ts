import type {
  Bookmark,
  BookmarkRelativeDateRange,
  BookmarkSearchMode,
  BookmarkSortMode,
  BookmarkListResponse,
  BookmarkResponse,
  CreateBookmarkRequest,
  UpdateBookmarkRequest
} from "@bookmark/shared";

type LoadBookmarksOptions = {
  query?: string;
  mode?: BookmarkSearchMode;
  sort?: BookmarkSortMode;
  createdWithin?: BookmarkRelativeDateRange;
  openedWithin?: BookmarkRelativeDateRange;
  favoriteOnly?: boolean;
  folderId?: string;
  tagId?: string;
  bookmarkColor?: string;
  urlColor?: string;
  summaryState?: "all" | "with" | "without";
};

export async function loadBookmarks(options: LoadBookmarksOptions = {}) {
  const searchParams = new URLSearchParams();
  const query = options.query?.trim();

  if (query) {
    searchParams.set("mode", options.mode ?? "all");
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
  }
  if (options.tagId) {
    searchParams.set("tagId", options.tagId);
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

  const url = searchParams.size > 0 ? `/api/bookmarks?${searchParams.toString()}` : "/api/bookmarks";
  const res = await fetch(url, {
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to load bookmarks");
  }

  const data = (await res.json()) as Partial<BookmarkListResponse>;
  return Array.isArray(data.bookmarks) ? (data.bookmarks as Bookmark[]) : [];
}

export async function loadBookmark(bookmarkId: string) {
  const res = await fetch(`/api/bookmarks/${bookmarkId}`, {
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to load bookmark detail");
  }

  const data = (await res.json()) as BookmarkResponse;
  return data.bookmark;
}

export async function reextractBookmark(bookmarkId: string) {
  const res = await fetch(`/api/bookmarks/${bookmarkId}/reextract`, {
    method: "POST",
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to reextract bookmark");
  }

  const data = (await res.json()) as BookmarkResponse;
  return data.bookmark;
}

export async function deleteBookmark(bookmarkId: string) {
  const res = await fetch(`/api/bookmarks/${bookmarkId}`, {
    method: "DELETE",
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to delete bookmark");
  }
}

export async function createBookmark(input: CreateBookmarkRequest) {
  const res = await fetch("/api/bookmarks", {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!res.ok) {
    throw new Error("Failed to create bookmark");
  }

  const data = (await res.json()) as BookmarkResponse;
  return data.bookmark;
}

export async function updateBookmark(bookmarkId: string, input: UpdateBookmarkRequest) {
  const res = await fetch(`/api/bookmarks/${bookmarkId}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!res.ok) {
    throw new Error("Failed to update bookmark");
  }

  const data = (await res.json()) as BookmarkResponse;
  return data.bookmark;
}
