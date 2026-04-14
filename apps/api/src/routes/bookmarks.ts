import type {
  BookmarkOpenResponse,
  BookmarkAssetListResponse,
  BookmarkAssetResponse,
  BookmarkExtractRequest,
  BookmarkExtractResponse,
  BookmarkSearchMode,
  BookmarkListResponse,
  BookmarkResponse,
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
  createBookmarkRepository,
  normalizeBookmarkUrl,
  toBookmarkResponse,
  type BookmarkRepository
} from "../lib/repositories/bookmarks";
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
  sessionSecret?: string;
};

const bookmarkSearchModes: BookmarkSearchMode[] = ["all", "title", "content", "folder"];

function sanitizeFileName(fileName: string) {
  const normalizedFileName = fileName.trim().replace(/\s+/g, "-");
  return normalizedFileName.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80) || "asset";
}

export function createBookmarkRoute(options: BookmarkRouteOptions = {}) {
  return new Hono<{ Bindings: AppBindings }>()
    .get("/", async (c) => {
      const user = await getAuthenticatedUser(c, options.sessionSecret);
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
      const filters = {
        favoriteOnly: c.req.query("favorite") === "1",
        folderId: c.req.query("folderId")?.trim() || undefined,
        tagId: c.req.query("tagId")?.trim() || undefined,
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

      const bookmarks = query
        ? await repository.searchByUser(user.uid, query, mode, filters)
        : await repository.listByUser(user.uid, filters);

      return c.json<BookmarkListResponse>({
        bookmarks: bookmarks.map(toBookmarkResponse)
      });
    })
    .post("/", async (c) => {
      const user = await getAuthenticatedUser(c, options.sessionSecret);
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
      const user = await getAuthenticatedUser(c, options.sessionSecret);
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
    .get("/:bookmarkId", async (c) => {
      const user = await getAuthenticatedUser(c, options.sessionSecret);
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

      return c.json<BookmarkResponse>({
        bookmark: toBookmarkResponse(bookmark)
      });
    })
    .patch("/:bookmarkId", async (c) => {
      const user = await getAuthenticatedUser(c, options.sessionSecret);
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<UpdateBookmarkRequest>().catch(() => null);
      if (!body) {
        return c.json({ error: "invalid_payload" }, 400);
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

      await bookmarkRepository.delete(bookmark.id, user.uid);

      return c.body(null, 204);
    })
    .post("/:bookmarkId/open", async (c) => {
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
      const user = await getAuthenticatedUser(c, options.sessionSecret);
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

      const object = await assetStorage.get(asset.objectKey);
      if (!object) {
        return c.json({ error: "bookmark_asset_content_not_found" }, 404);
      }

      return new Response(object.body, {
        headers: {
          "content-type": object.contentType
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
