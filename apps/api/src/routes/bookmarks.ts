import type {
  BookmarkOpenResponse,
  BookmarkAssetBatchListResponse,
  BookmarkAssetListResponse,
  BookmarkAssetResponse,
  BookmarkExtractRequest,
  BookmarkExtractResponse,
  BookmarkPreviewResponse,
  BookmarkRelativeDateRange,
  BookmarkSearchMode,
  BookmarkSortMode,
  BookmarkTagMode,
  BookmarkTrashMode,
  BookmarkCountsResponse,
  BookmarkListResponse,
  BookmarkResponse,
  BookmarkPermanentDeleteResponse,
  CreateBookmarkRequest,
  UpdateBookmarkRequest
} from "@bookmark/shared";
import { Hono } from "hono";

import type { AppBindings } from "../env";
import { getAuthenticatedUser } from "../lib/auth/current-user";
import {
  createBookmarkExtractor,
  type BookmarkExtractor
} from "../lib/extract/bookmark-extractor";
import {
  createBookmarkAssetRepository,
  toBookmarkAssetResponse,
  type BookmarkAssetRepository
} from "../lib/repositories/bookmark-assets";
import {
  createBookmarkActivityRepository,
  type BookmarkActivityRepository
} from "../lib/repositories/bookmark-activity";
import {
  aggregateBookmarkCounts,
  createBookmarkRepository,
  normalizeBookmarkUrl,
  toBookmarkListResponse,
  toBookmarkResponse,
  type BookmarkRepository
} from "../lib/repositories/bookmarks";
import {
  createFolderRepository,
  type FolderRepository
} from "../lib/repositories/folders";
import {
  createExtensionTokenRepository,
  type ExtensionTokenRepository
} from "../lib/repositories/extension-tokens";
import { syncAuthenticatedUser } from "../lib/repositories/users";
import {
  createR2BookmarkAssetStorage,
  type BookmarkAssetStorage
} from "../lib/storage/assets";

type BookmarkRouteOptions = {
  bookmarkRepository?: BookmarkRepository;
  bookmarkAssetRepository?: BookmarkAssetRepository;
  bookmarkActivityRepository?: BookmarkActivityRepository;
  assetStorage?: BookmarkAssetStorage;
  bookmarkExtractor?: BookmarkExtractor;
  folderRepository?: FolderRepository;
  extensionTokenRepository?: ExtensionTokenRepository;
  sessionSecret?: string;
};

const bookmarkSearchModes: BookmarkSearchMode[] = ["all", "title", "content", "folder"];
const bookmarkSortModes: BookmarkSortMode[] = [
  "created_desc",
  "created_asc",
  "opened_desc",
  "title_asc",
  "title_desc",
  "site_asc",
  "site_desc"
];
const bookmarkRelativeDateRanges: BookmarkRelativeDateRange[] = ["all", "7d", "30d"];
const bookmarkTagModes: BookmarkTagMode[] = ["and", "or"];
const bookmarkPageSizes = [20, 50, 100] as const;

function normalizeTagQueryValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeBookmarkIdQueryValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function parseBookmarkPageSize(value: string | undefined) {
  if (!value) {
    return null;
  }

  const pageSize = Number(value);
  return bookmarkPageSizes.includes(pageSize as (typeof bookmarkPageSizes)[number])
    ? pageSize
    : null;
}

function parseBookmarkOffset(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const offset = Number(value);
  return Number.isInteger(offset) && offset >= 0 ? offset : null;
}

function resolveDateRangeCutoff(range: BookmarkRelativeDateRange, now: Date) {
  if (range === "all") {
    return null;
  }

  const days = range === "7d" ? 7 : 30;
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

function collectDescendantFolderIds(
  folders: Array<{ id: string; parentFolderId: string | null }>,
  rootFolderId: string
) {
  const descendants = new Set<string>();
  const pendingFolderIds = [rootFolderId];

  while (pendingFolderIds.length > 0) {
    const currentFolderId = pendingFolderIds.pop();
    if (!currentFolderId) {
      continue;
    }

    for (const folder of folders) {
      if (folder.parentFolderId !== currentFolderId || descendants.has(folder.id)) {
        continue;
      }

      descendants.add(folder.id);
      pendingFolderIds.push(folder.id);
    }
  }

  return descendants;
}

function sanitizeFileName(fileName: string) {
  const normalizedFileName = fileName.trim().replace(/\s+/g, "-");
  return normalizedFileName.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80) || "asset";
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "ko", {
    numeric: true,
    sensitivity: "base"
  });
}

function getBookmarkTitleForSort(bookmark: { displayTitle: string; url: string }) {
  return bookmark.displayTitle.trim() || bookmark.url;
}

function getBookmarkSiteForSort(bookmark: { url: string }) {
  try {
    return new URL(bookmark.url).hostname.replace(/^www\./i, "");
  } catch {
    return bookmark.url;
  }
}

function resolveExtensionTokenRepository(
  c: { env?: AppBindings },
  options: BookmarkRouteOptions
) {
  return (
    options.extensionTokenRepository ??
    (c.env?.bookmark ? createExtensionTokenRepository(c.env.bookmark) : undefined)
  );
}

export function createBookmarkRoute(options: BookmarkRouteOptions = {}) {
  return new Hono<{ Bindings: AppBindings }>()
    .get("/", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      if (!options.bookmarkRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "bookmark_repository_unavailable" }, 500);
      }

      const query = c.req.query("query")?.trim() ?? "";
      const requestedMode = c.req.query("mode");
      const mode = (requestedMode ?? "all") as BookmarkSearchMode;
      const requestedSort = c.req.query("sort");
      const sort = (requestedSort ?? "created_desc") as BookmarkSortMode;
      const requestedLimit = c.req.query("limit")?.trim();
      const requestedOffset = c.req.query("offset")?.trim();
      const pageSize = parseBookmarkPageSize(requestedLimit);
      const pageOffset = parseBookmarkOffset(requestedOffset);
      const requestedCreatedWithin = c.req.query("createdWithin");
      const createdWithin = (requestedCreatedWithin ?? "all") as BookmarkRelativeDateRange;
      const requestedOpenedWithin = c.req.query("openedWithin");
      const openedWithin = (requestedOpenedWithin ?? "all") as BookmarkRelativeDateRange;
      const requestedTrashed = c.req.query("trashed")?.trim();
      const trashMode: BookmarkTrashMode =
        requestedTrashed === "1"
          ? "trashed"
          : requestedTrashed === "all"
            ? "all"
            : "active";
      const requestedTagMode = c.req.query("tagMode");
      const tagMode = (requestedTagMode ?? "and") as BookmarkTagMode;
      const requestedFolderId = c.req.query("folderId")?.trim() || undefined;
      const includeDescendantFolders =
        Boolean(requestedFolderId) && c.req.query("includeDescendantFolders") === "1";
      const tagIds = normalizeTagQueryValues(new URL(c.req.url).searchParams.getAll("tagId"));
      let folderIds: string[] | undefined;

      if (requestedFolderId && includeDescendantFolders) {
        const folderRepository =
          options.folderRepository ??
          (c.env?.bookmark ? createFolderRepository(c.env.bookmark) : null);

        if (!folderRepository) {
          return c.json({ error: "folder_repository_unavailable" }, 500);
        }

        const folders = await folderRepository.listByUser(user.uid);
        folderIds = [
          requestedFolderId,
          ...collectDescendantFolderIds(folders, requestedFolderId)
        ];
      }

      const filters = {
        favoriteOnly: c.req.query("favorite") === "1",
        folderId: folderIds ? undefined : requestedFolderId,
        folderIds,
        tagIds: tagIds.length > 0 ? tagIds : undefined,
        tagMode: tagIds.length > 0 ? tagMode : undefined,
        trashMode,
        bookmarkColor: c.req.query("bookmarkColor")?.trim() || undefined,
        urlColor: c.req.query("urlColor")?.trim() || undefined,
        summaryState: (() => {
          const value = c.req.query("summaryState")?.trim();
          return value === "with" || value === "without" ? value : undefined;
        })()
      };

      if (requestedMode && !bookmarkSearchModes.includes(mode)) {
        return c.json({ error: "invalid_search_mode" }, 400);
      }

      if (requestedSort && !bookmarkSortModes.includes(sort)) {
        return c.json({ error: "invalid_sort_mode" }, 400);
      }

      if (requestedLimit && pageSize === null) {
        return c.json({ error: "invalid_page_size" }, 400);
      }

      if (pageOffset === null) {
        return c.json({ error: "invalid_page_offset" }, 400);
      }

      if (requestedTagMode && !bookmarkTagModes.includes(tagMode)) {
        return c.json({ error: "invalid_tag_mode" }, 400);
      }

      if (
        requestedCreatedWithin &&
        !bookmarkRelativeDateRanges.includes(createdWithin)
      ) {
        return c.json({ error: "invalid_created_within" }, 400);
      }

      if (requestedOpenedWithin && !bookmarkRelativeDateRanges.includes(openedWithin)) {
        return c.json({ error: "invalid_opened_within" }, 400);
      }

      if (
        pageSize !== null &&
        createdWithin === "all" &&
        openedWithin === "all" &&
        typeof repository.pageByUser === "function"
      ) {
        const page = await repository.pageByUser(user.uid, filters, {
          contentMode: "summary",
          pagination: {
            limit: pageSize,
            offset: pageOffset
          },
          ...(query
            ? {
                search: {
                  query,
                  mode
                }
              }
            : {}),
          sort
        });

        return c.json<BookmarkListResponse>({
          bookmarks: page.bookmarks.map(toBookmarkListResponse),
          pagination: {
            limit: pageSize,
            offset: pageOffset,
            total: page.total,
            hasMore: pageOffset + pageSize < page.total
          }
        });
      }

      let bookmarks = query
        ? await repository.searchByUser(user.uid, query, mode, filters, {
            contentMode: "summary"
          })
        : await repository.listByUser(user.uid, filters, {
            contentMode: "summary"
          });

      const needsOpenStats = sort === "opened_desc" || openedWithin !== "all";
      let openStatsByBookmarkId = new Map<string, BookmarkActivityRepository extends never ? never : Awaited<ReturnType<BookmarkActivityRepository["listOpenStats"]>>[number]>();

      if (needsOpenStats) {
        const bookmarkActivityRepository =
          options.bookmarkActivityRepository ??
          (c.env?.bookmark ? createBookmarkActivityRepository(c.env.bookmark) : null);

        if (!bookmarkActivityRepository) {
          return c.json({ error: "bookmark_activity_repository_unavailable" }, 500);
        }

        const openStats = await bookmarkActivityRepository.listOpenStats(
          user.uid,
          Math.max(bookmarks.length, 50)
        );
        openStatsByBookmarkId = new Map(
          openStats.map((entry) => [entry.bookmarkId, entry])
        );
      }

      const now = new Date();
      const createdCutoff = resolveDateRangeCutoff(createdWithin, now);
      const openedCutoff = resolveDateRangeCutoff(openedWithin, now);

      if (createdCutoff !== null || openedCutoff !== null) {
        bookmarks = bookmarks.filter((bookmark) => {
          if (createdCutoff !== null) {
            const createdAt = Date.parse(bookmark.createdAt);
            if (Number.isNaN(createdAt) || createdAt < createdCutoff) {
              return false;
            }
          }

          if (openedCutoff !== null) {
            const openStat = openStatsByBookmarkId.get(bookmark.id);
            if (!openStat) {
              return false;
            }

            const lastOpenedAt = Date.parse(openStat.lastOpenedAt);
            if (Number.isNaN(lastOpenedAt) || lastOpenedAt < openedCutoff) {
              return false;
            }
          }

          return true;
        });
      }

      if (sort === "opened_desc") {
        bookmarks.sort((left, right) => {
          const leftStat = openStatsByBookmarkId.get(left.id);
          const rightStat = openStatsByBookmarkId.get(right.id);

          if (leftStat && !rightStat) {
            return -1;
          }

          if (!leftStat && rightStat) {
            return 1;
          }

          if (leftStat && rightStat) {
            return (
              rightStat.lastOpenedAt.localeCompare(leftStat.lastOpenedAt) ||
              rightStat.openCount - leftStat.openCount ||
              right.createdAt.localeCompare(left.createdAt)
            );
          }

          return right.createdAt.localeCompare(left.createdAt);
        });
      } else if (sort === "created_asc") {
        bookmarks.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      } else if (sort === "created_desc") {
        bookmarks.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      } else if (sort === "title_asc" || sort === "title_desc") {
        bookmarks.sort((left, right) => {
          const comparedTitle = compareText(
            getBookmarkTitleForSort(left),
            getBookmarkTitleForSort(right)
          );
          return sort === "title_asc" ? comparedTitle : -comparedTitle;
        });
      } else if (sort === "site_asc" || sort === "site_desc") {
        bookmarks.sort((left, right) => {
          const comparedSite =
            compareText(getBookmarkSiteForSort(left), getBookmarkSiteForSort(right)) ||
            compareText(getBookmarkTitleForSort(left), getBookmarkTitleForSort(right));
          return sort === "site_asc" ? comparedSite : -comparedSite;
        });
      }

      const totalBookmarks = bookmarks.length;
      const pagedBookmarks =
        pageSize === null ? bookmarks : bookmarks.slice(pageOffset, pageOffset + pageSize);

      return c.json<BookmarkListResponse>({
        bookmarks: pagedBookmarks.map(toBookmarkListResponse),
        ...(pageSize === null
          ? {}
          : {
              pagination: {
                limit: pageSize,
                offset: pageOffset,
                total: totalBookmarks,
                hasMore: pageOffset + pageSize < totalBookmarks
              }
            })
      });
    })
    .post("/", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<CreateBookmarkRequest>().catch(() => null);
      if (!body?.url) {
        return c.json({ error: "missing_url" }, 400);
      }

      let normalizedUrl: string;
      try {
        normalizedUrl = normalizeBookmarkUrl(body.url);
      } catch {
        return c.json({ error: "invalid_url" }, 400);
      }

      if (!options.bookmarkRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "bookmark_repository_unavailable" }, 500);
      }

      const shouldExtractSourceValues =
        !body.sourceTitle && !body.sourceContent && !body.sourceSummary;
      const extractedPreview = shouldExtractSourceValues
        ? await (options.bookmarkExtractor ?? createBookmarkExtractor())
            .extract(normalizedUrl)
            .catch(() => null)
        : null;

      let bookmark;
      try {
        bookmark = await repository.create({
          ...body,
          sourceTitle: body.sourceTitle ?? extractedPreview?.sourceTitle ?? null,
          sourceContent: body.sourceContent ?? extractedPreview?.sourceContent ?? null,
          sourceSummary: body.sourceSummary ?? extractedPreview?.sourceSummary ?? null,
          userId: user.uid,
          normalizedUrl
        });
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_tag_ids") {
          return c.json({ error: "invalid_tag_ids" }, 400);
        }

        throw error;
      }

      return c.json<BookmarkResponse>(
        {
          bookmark: toBookmarkResponse(bookmark)
        },
        201
      );
    })
    .post("/extract", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<BookmarkExtractRequest>().catch(() => null);
      if (!body?.url) {
        return c.json({ error: "missing_url" }, 400);
      }

      const extractor = options.bookmarkExtractor ?? createBookmarkExtractor();

      try {
        const preview = await extractor.extract(body.url);
        return c.json<BookmarkExtractResponse>({
          preview
        });
      } catch (error) {
        if (error instanceof TypeError) {
          return c.json({ error: "invalid_url" }, 400);
        }

        if (
          error instanceof Error &&
          error.message === "bookmark_extract_unsupported_content_type"
        ) {
          return c.json({ error: "bookmark_extract_unsupported_content_type" }, 422);
        }

        return c.json({ error: "bookmark_extract_failed" }, 502);
      }
    })
    .get("/counts", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      if (!options.bookmarkRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "bookmark_repository_unavailable" }, 500);
      }

      const counts = repository.countByUser
        ? await repository.countByUser(user.uid)
        : aggregateBookmarkCounts(
            await repository.listByUser(user.uid, { trashMode: "all" })
          );

      return c.json<BookmarkCountsResponse>({
        counts
      });
    })
    .get("/assets", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const assetRepository =
        options.bookmarkAssetRepository ??
        (c.env?.bookmark ? createBookmarkAssetRepository(c.env.bookmark) : null);

      if (!assetRepository) {
        return c.json({ error: "bookmark_asset_repository_unavailable" }, 500);
      }

      const bookmarkIds = normalizeBookmarkIdQueryValues(
        new URL(c.req.url).searchParams.getAll("bookmarkId")
      );
      const assetsByBookmarkId = Object.fromEntries(
        bookmarkIds.map((bookmarkId) => [bookmarkId, [] as ReturnType<typeof toBookmarkAssetResponse>[]])
      );

      if (bookmarkIds.length === 0) {
        return c.json<BookmarkAssetBatchListResponse>({
          assetsByBookmarkId
        });
      }

      const assets = assetRepository.listByBookmarks
        ? await assetRepository.listByBookmarks(user.uid, bookmarkIds)
        : (
            await Promise.all(
              bookmarkIds.map((bookmarkId) =>
                assetRepository.listByBookmark(user.uid, bookmarkId)
              )
            )
          ).flat();

      const requestedBookmarkIds = new Set(bookmarkIds);
      for (const asset of assets) {
        if (!requestedBookmarkIds.has(asset.bookmarkId)) {
          continue;
        }

        assetsByBookmarkId[asset.bookmarkId].push(
          toBookmarkAssetResponse(asset, {
            bookmarkId: asset.bookmarkId
          })
        );
      }

      return c.json<BookmarkAssetBatchListResponse>({
        assetsByBookmarkId
      });
    })
    .get("/:bookmarkId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const repository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "bookmark_repository_unavailable" }, 500);
      }

      const bookmark = await repository.getByUserAndId(
        user.uid,
        c.req.param("bookmarkId")
      );

      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      if (bookmark.isTrashed && c.req.query("trashed") !== "1") {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      return c.json<BookmarkResponse>({
        bookmark: toBookmarkResponse(bookmark)
      });
    })
    .get("/:bookmarkId/preview", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const bookmarkRepository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);
      const bookmarkExtractor = options.bookmarkExtractor ?? createBookmarkExtractor();

      if (!bookmarkRepository) {
        return c.json({ error: "bookmark_repository_unavailable" }, 500);
      }

      const bookmark = await bookmarkRepository.getByUserAndId(
        user.uid,
        c.req.param("bookmarkId")
      );
      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      try {
        const preview = await bookmarkExtractor.extract(bookmark.url);
        return c.json<BookmarkPreviewResponse>({
          preview
        });
      } catch (error) {
        if (error instanceof TypeError) {
          return c.json({ error: "invalid_url" }, 400);
        }

        if (
          error instanceof Error &&
          error.message === "bookmark_extract_unsupported_content_type"
        ) {
          return c.json({ error: "bookmark_extract_unsupported_content_type" }, 422);
        }

        return c.json({ error: "bookmark_extract_failed" }, 502);
      }
    })
    .patch("/:bookmarkId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<UpdateBookmarkRequest>().catch(() => null);
      if (!body) {
        return c.json({ error: "invalid_payload" }, 400);
      }
      if ("url" in body && body.url !== undefined) {
        try {
          normalizeBookmarkUrl(body.url);
        } catch {
          return c.json({ error: "invalid_url" }, 400);
        }
      }

      const repository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "bookmark_repository_unavailable" }, 500);
      }

      let bookmark;
      try {
        bookmark = await repository.update(c.req.param("bookmarkId"), user.uid, body);
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_tag_ids") {
          return c.json({ error: "invalid_tag_ids" }, 400);
        }

        throw error;
      }

      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      return c.json<BookmarkResponse>({
        bookmark: toBookmarkResponse(bookmark)
      });
    })
    .delete("/:bookmarkId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const bookmarkRepository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);

      if (!bookmarkRepository) {
        return c.json({ error: "bookmark_repository_unavailable" }, 500);
      }

      const bookmark = await bookmarkRepository.getByUserAndId(
        user.uid,
        c.req.param("bookmarkId")
      );
      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      await bookmarkRepository.delete(bookmark.id, user.uid);

      return c.body(null, 204);
    })
    .post("/:bookmarkId/restore", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const bookmarkRepository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);

      if (!bookmarkRepository) {
        return c.json({ error: "bookmark_repository_unavailable" }, 500);
      }

      const bookmark = await bookmarkRepository.restore(c.req.param("bookmarkId"), user.uid);
      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      return c.json<BookmarkResponse>({
        bookmark: toBookmarkResponse(bookmark)
      });
    })
    .delete("/:bookmarkId/permanent", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const bookmarkRepository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);
      const assetRepository =
        options.bookmarkAssetRepository ??
        (c.env?.bookmark ? createBookmarkAssetRepository(c.env.bookmark) : null);
      const assetStorage =
        options.assetStorage ??
        (c.env?.bookmark_assets ? createR2BookmarkAssetStorage(c.env.bookmark_assets) : null);

      if (!bookmarkRepository) {
        return c.json({ error: "bookmark_repository_unavailable" }, 500);
      }

      const bookmark = await bookmarkRepository.getByUserAndId(
        user.uid,
        c.req.param("bookmarkId")
      );
      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      const assets = assetRepository
        ? await assetRepository.listByBookmark(user.uid, bookmark.id)
        : [];

      if (assets.length > 0 && !assetStorage) {
        return c.json({ error: "bookmark_asset_repository_unavailable" }, 500);
      }

      if (assetStorage) {
        for (const asset of assets) {
          await assetStorage.delete(asset.objectKey);
        }
      }

      const deleted = await bookmarkRepository.permanentlyDelete(bookmark.id, user.uid);
      if (!deleted) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      return c.json<BookmarkPermanentDeleteResponse>({ ok: true });
    })
    .post("/:bookmarkId/open", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
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
        return c.json({ error: "bookmark_activity_repository_unavailable" }, 500);
      }

      const bookmark = await bookmarkRepository.getByUserAndId(
        user.uid,
        c.req.param("bookmarkId")
      );
      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      await bookmarkActivityRepository.recordOpen(user.uid, bookmark.id);

      return c.json<BookmarkOpenResponse>({
        ok: true
      });
    })
    .post("/:bookmarkId/reextract", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const bookmarkRepository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);
      const bookmarkExtractor = options.bookmarkExtractor ?? createBookmarkExtractor();

      if (!bookmarkRepository) {
        return c.json({ error: "bookmark_repository_unavailable" }, 500);
      }

      const bookmark = await bookmarkRepository.getByUserAndId(
        user.uid,
        c.req.param("bookmarkId")
      );
      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      try {
        const preview = await bookmarkExtractor.extract(bookmark.url);
        const updatedBookmark = await bookmarkRepository.update(bookmark.id, user.uid, {
          sourceTitle: preview.sourceTitle,
          sourceContent: preview.sourceContent,
          sourceSummary: preview.sourceSummary
        });

        if (!updatedBookmark) {
          return c.json({ error: "bookmark_not_found" }, 404);
        }

        return c.json<BookmarkResponse>({
          bookmark: toBookmarkResponse(updatedBookmark)
        });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "bookmark_extract_unsupported_content_type"
        ) {
          return c.json({ error: "bookmark_extract_unsupported_content_type" }, 422);
        }

        return c.json({ error: "bookmark_reextract_failed" }, 502);
      }
    })
    .get("/:bookmarkId/assets", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const bookmarkRepository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);
      const assetRepository =
        options.bookmarkAssetRepository ??
        (c.env?.bookmark ? createBookmarkAssetRepository(c.env.bookmark) : null);

      if (!bookmarkRepository || !assetRepository) {
        return c.json({ error: "bookmark_asset_repository_unavailable" }, 500);
      }

      const bookmark = await bookmarkRepository.getByUserAndId(
        user.uid,
        c.req.param("bookmarkId")
      );
      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      const assets = await assetRepository.listByBookmark(user.uid, bookmark.id);
      return c.json<BookmarkAssetListResponse>({
        assets: assets.map((asset) =>
          toBookmarkAssetResponse(asset, {
            bookmarkId: bookmark.id
          })
        )
      });
    })
    .post("/:bookmarkId/assets", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const bookmarkRepository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);
      const assetRepository =
        options.bookmarkAssetRepository ??
        (c.env?.bookmark ? createBookmarkAssetRepository(c.env.bookmark) : null);
      const assetStorage =
        options.assetStorage ??
        (c.env?.bookmark_assets ? createR2BookmarkAssetStorage(c.env.bookmark_assets) : null);

      if (!bookmarkRepository || !assetRepository || !assetStorage) {
        return c.json({ error: "bookmark_asset_repository_unavailable" }, 500);
      }

      const bookmark = await bookmarkRepository.getByUserAndId(
        user.uid,
        c.req.param("bookmarkId")
      );
      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      const formData = await c.req.formData().catch(() => null);
      const file = formData?.get("file");
      if (!(file instanceof File)) {
        return c.json({ error: "missing_file" }, 400);
      }

      if (file.size === 0) {
        return c.json({ error: "empty_file" }, 400);
      }

      if (!file.type.startsWith("image/")) {
        return c.json({ error: "unsupported_file_type" }, 400);
      }

      const assetType = formData?.get("assetType") === "capture" ? "capture" : "image";
      const objectKey = `${user.uid}/${bookmark.id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

      await assetStorage.put(objectKey, await file.arrayBuffer(), file.type);

      const asset = await assetRepository.create({
        bookmarkId: bookmark.id,
        userId: user.uid,
        assetType,
        objectKey,
        mimeType: file.type
      });

      return c.json<BookmarkAssetResponse>(
        {
          asset: toBookmarkAssetResponse(asset, {
            bookmarkId: bookmark.id
          })
        },
        201
      );
    })
    .get("/:bookmarkId/assets/:assetId/content", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const bookmarkRepository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);
      const assetRepository =
        options.bookmarkAssetRepository ??
        (c.env?.bookmark ? createBookmarkAssetRepository(c.env.bookmark) : null);
      const assetStorage =
        options.assetStorage ??
        (c.env?.bookmark_assets ? createR2BookmarkAssetStorage(c.env.bookmark_assets) : null);

      if (!bookmarkRepository || !assetRepository || !assetStorage) {
        return c.json({ error: "bookmark_asset_repository_unavailable" }, 500);
      }

      const bookmark = await bookmarkRepository.getByUserAndId(
        user.uid,
        c.req.param("bookmarkId")
      );
      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      const asset = await assetRepository.getById(
        user.uid,
        bookmark.id,
        c.req.param("assetId")
      );
      if (!asset) {
        return c.json({ error: "bookmark_asset_not_found" }, 404);
      }

      const object = await assetStorage.get(asset.objectKey);
      if (!object) {
        return c.json({ error: "bookmark_asset_content_not_found" }, 404);
      }

      return new Response(object.body, {
        headers: {
          "content-type": object.contentType,
          "cache-control": "private, max-age=604800, immutable"
        }
      });
    })
    .delete("/:bookmarkId/assets/:assetId", async (c) => {
      const user = await getAuthenticatedUser(c, options.sessionSecret);
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const bookmarkRepository =
        options.bookmarkRepository ??
        (c.env?.bookmark ? createBookmarkRepository(c.env.bookmark) : null);
      const assetRepository =
        options.bookmarkAssetRepository ??
        (c.env?.bookmark ? createBookmarkAssetRepository(c.env.bookmark) : null);
      const assetStorage =
        options.assetStorage ??
        (c.env?.bookmark_assets ? createR2BookmarkAssetStorage(c.env.bookmark_assets) : null);

      if (!bookmarkRepository || !assetRepository || !assetStorage) {
        return c.json({ error: "bookmark_asset_repository_unavailable" }, 500);
      }

      const bookmark = await bookmarkRepository.getByUserAndId(
        user.uid,
        c.req.param("bookmarkId")
      );
      if (!bookmark) {
        return c.json({ error: "bookmark_not_found" }, 404);
      }

      const asset = await assetRepository.getById(
        user.uid,
        bookmark.id,
        c.req.param("assetId")
      );
      if (!asset) {
        return c.json({ error: "bookmark_asset_not_found" }, 404);
      }

      await assetRepository.delete(user.uid, bookmark.id, asset.id);
      await assetStorage.delete(asset.objectKey);

      return c.body(null, 204);
    });
}
