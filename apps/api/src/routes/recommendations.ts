import type { BookmarkRecommendationsResponse } from "@bookmark/shared";
import { Hono } from "hono";

import type { AppBindings } from "../env";
import { getAuthenticatedUser } from "../lib/auth/current-user";
import {
  createBookmarkActivityRepository,
  type BookmarkOpenStat,
  type BookmarkActivityRepository
} from "../lib/repositories/bookmark-activity";
import {
  createBookmarkRepository,
  toBookmarkListResponse,
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

type BookmarkRecommendationMetric = {
  bookmark: BookmarkRecord;
  openCount: number;
  lastOpenedAt: string | null;
  contextScore: number;
};

function toRecommendationMetrics(
  bookmarks: BookmarkRecord[],
  openStats: BookmarkOpenStat[]
) {
  const openStatsByBookmarkId = new Map(
    openStats.map((entry) => [entry.bookmarkId, entry] as const)
  );
  const contextBookmark = openStats.length
    ? bookmarks.find((bookmark) => bookmark.id === openStats[0].bookmarkId) ?? null
    : null;

  return bookmarks.map((bookmark) => {
    const stat = openStatsByBookmarkId.get(bookmark.id);
    const sharesFolder =
      Boolean(contextBookmark?.folderId) && contextBookmark?.folderId === bookmark.folderId;
    const sharesTag = Boolean(
      contextBookmark?.tagIds.some((tagId) => bookmark.tagIds.includes(tagId))
    );

    return {
      bookmark,
      openCount: stat?.openCount ?? 0,
      lastOpenedAt: stat?.lastOpenedAt ?? null,
      contextScore: (sharesFolder ? 2 : 0) + (sharesTag ? 1 : 0)
    } satisfies BookmarkRecommendationMetric;
  });
}

function compareRecommendationFallback(
  left: BookmarkRecommendationMetric,
  right: BookmarkRecommendationMetric
) {
  return (
    right.bookmark.updatedAt.localeCompare(left.bookmark.updatedAt) ||
    right.bookmark.createdAt.localeCompare(left.bookmark.createdAt) ||
    left.bookmark.id.localeCompare(right.bookmark.id)
  );
}

function compareFavoriteMetrics(
  left: BookmarkRecommendationMetric,
  right: BookmarkRecommendationMetric
) {
  return (
    right.openCount - left.openCount ||
    (right.lastOpenedAt ?? "").localeCompare(left.lastOpenedAt ?? "") ||
    right.contextScore - left.contextScore ||
    compareRecommendationFallback(left, right)
  );
}

function compareRecentMetrics(
  left: BookmarkRecommendationMetric,
  right: BookmarkRecommendationMetric
) {
  return (
    Number(Boolean(right.lastOpenedAt)) - Number(Boolean(left.lastOpenedAt)) ||
    (right.lastOpenedAt ?? "").localeCompare(left.lastOpenedAt ?? "") ||
    right.contextScore - left.contextScore ||
    Number(right.bookmark.isFavorite) - Number(left.bookmark.isFavorite) ||
    compareRecommendationFallback(left, right)
  );
}

function compareFrequentMetrics(
  left: BookmarkRecommendationMetric,
  right: BookmarkRecommendationMetric
) {
  return (
    right.openCount - left.openCount ||
    right.contextScore - left.contextScore ||
    (right.lastOpenedAt ?? "").localeCompare(left.lastOpenedAt ?? "") ||
    Number(right.bookmark.isFavorite) - Number(left.bookmark.isFavorite) ||
    compareRecommendationFallback(left, right)
  );
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

    if (!bookmarkRepository) {
      return c.json({ error: "recommendation_repository_unavailable" }, 500);
    }

    if (typeof bookmarkRepository.listRecommendationsByUser === "function") {
      const recommendations = await bookmarkRepository.listRecommendationsByUser(user.uid, {
        contentMode: "summary",
        limit: 5
      });

      return c.json<BookmarkRecommendationsResponse>({
        favorites: recommendations.favorites.map(toBookmarkListResponse),
        recent: recommendations.recent.map(toBookmarkListResponse),
        frequent: recommendations.frequent.map(toBookmarkListResponse)
      });
    }

    const bookmarkActivityRepository =
      options.bookmarkActivityRepository ??
      (c.env?.bookmark ? createBookmarkActivityRepository(c.env.bookmark) : null);

    if (!bookmarkActivityRepository) {
      return c.json({ error: "recommendation_repository_unavailable" }, 500);
    }

    const [allBookmarks, openStats] = await Promise.all([
      bookmarkRepository.listByUser(user.uid, {}, { contentMode: "summary" }),
      bookmarkActivityRepository.listOpenStats(user.uid, 100)
    ]);

    const metrics = toRecommendationMetrics(allBookmarks, openStats);

    const favorites = metrics
      .filter((entry) => entry.bookmark.isFavorite)
      .sort(compareFavoriteMetrics)
      .slice(0, 5)
      .map((entry) => entry.bookmark);
    const recent = metrics
      .slice()
      .sort(compareRecentMetrics)
      .slice(0, 5)
      .map((entry) => entry.bookmark);
    const frequent = metrics
      .slice()
      .sort(compareFrequentMetrics)
      .slice(0, 5)
      .map((entry) => entry.bookmark);

    return c.json<BookmarkRecommendationsResponse>({
      favorites: favorites.map(toBookmarkListResponse),
      recent: recent.map(toBookmarkListResponse),
      frequent: frequent.map(toBookmarkListResponse)
    });
  });
}
