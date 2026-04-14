import type {
  Bookmark,
  BookmarkSearchMode,
  BookmarkListResponse,
  BookmarkResponse,
  CreateBookmarkRequest,
  UpdateBookmarkRequest
} from "@bookmark/shared";

type LoadBookmarksOptions = {
  query?: string;
  mode?: BookmarkSearchMode;
  favoriteOnly?: boolean;
  folderId?: string;
  tagId?: string;
};

export async function loadBookmarks(options: LoadBookmarksOptions = {}) {
  const searchParams = new URLSearchParams();
  const query = options.query?.trim();

  if (query) {
    searchParams.set("mode", options.mode ?? "all");
    searchParams.set("query", query);
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
