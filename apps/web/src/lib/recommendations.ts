import type {
  Bookmark,
  BookmarkOpenResponse,
  BookmarkRecommendationsResponse
} from "@bookmark/shared";

export type BookmarkRecommendations = {
  favorites: Bookmark[];
  recent: Bookmark[];
  frequent: Bookmark[];
};

export async function loadRecommendations() {
  const res = await fetch("/api/recommendations", {
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to load recommendations");
  }

  const data = (await res.json()) as Partial<BookmarkRecommendationsResponse>;
  return {
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    recent: Array.isArray(data.recent) ? data.recent : [],
    frequent: Array.isArray(data.frequent) ? data.frequent : []
  } satisfies BookmarkRecommendations;
}

export async function recordBookmarkOpen(bookmarkId: string) {
  const res = await fetch(`/api/bookmarks/${bookmarkId}/open`, {
    method: "POST",
    credentials: "include"
  });

  if (!res.ok) {
    throw new Error("Failed to record bookmark open");
  }

  return (await res.json()) as BookmarkOpenResponse;
}
