import type { BookmarkRecommendationsResponse } from "@bookmark/shared";
import { Hono } from "hono";

import type { AppBindings } from "../env";
import { getAuthenticatedUser } from "../lib/auth/current-user";
import {
  createBookmarkActivityRepository,
  type BookmarkActivityRepository
} from "../lib/repositories/bookmark-activity";
import {
  createBookmarkRepository,
  toBookmarkResponse,
  type BookmarkRecord,
  type BookmarkRepository
} from "../lib/repositories/bookmarks";

type RecommendationRouteOptions = {
  bookmarkRepository?: BookmarkRepository;
  bookmarkActivityRepository?: BookmarkActivityRepository;
  sessionSecret?: string;
};

function sortBookmarksByUpdatedAtDesc(bookmarks: BookmarkRecord[]) {
  return [...bookmarks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function createRecommendationRoute(
  options: RecommendationRouteOptions = {}
) {
  return new Hono<{ Bindings: AppBindings }>().get("/", async (c) => {
    const user = await getAuthenticatedUser(c, options.sessionSecret);
    if (!user) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const bookmarkRepository =
      options.bookmarkRepository ??
      (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);
    const bookmarkActivityRepository =
      options.bookmarkActivityRepository ??
      (c.env?.bookmark ? createBookmarkActivityRepository(c.env.bookmark) : null);

    if (!bookmarkRepository || !bookmarkActivityRepository) {
      return c.json({ error: "recommendation_repository_unavailable" }, 500);
    }

    const [allBookmarks, recentBookmarkIds, frequentBookmarkIds] = await Promise.all([
      bookmarkRepository.listByUser(user.uid),
      bookmarkActivityRepository.listRecentBookmarkIds(user.uid, 5),
      bookmarkActivityRepository.listFrequentBookmarkIds(user.uid, 5)
    ]);

    const bookmarksById = new Map(
      allBookmarks.map((bookmark) => [bookmark.id, bookmark] as const)
    );

    const favorites = sortBookmarksByUpdatedAtDesc(
      allBookmarks.filter((bookmark) => bookmark.isFavorite)
    ).slice(0, 5);
    const recent = recentBookmarkIds
      .map((bookmarkId) => bookmarksById.get(bookmarkId) ?? null)
      .filter((bookmark): bookmark is BookmarkRecord => bookmark !== null);
    const frequent = frequentBookmarkIds
      .map((bookmarkId) => bookmarksById.get(bookmarkId) ?? null)
      .filter((bookmark): bookmark is BookmarkRecord => bookmark !== null);

    return c.json<BookmarkRecommendationsResponse>({
      favorites: favorites.map(toBookmarkResponse),
      recent: recent.map(toBookmarkResponse),
      frequent: frequent.map(toBookmarkResponse)
    });
  });
}
