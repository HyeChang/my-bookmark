import type {
  Bookmark,
  BookmarkListResponse,
  BookmarkResponse,
  CreateBookmarkRequest
} from "@bookmark/shared";

export async function loadBookmarks() {
  const res = await fetch("/api/bookmarks", {
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to load bookmarks");
  }

  const data = (await res.json()) as Partial<BookmarkListResponse>;
  return Array.isArray(data.bookmarks) ? (data.bookmarks as Bookmark[]) : [];
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
