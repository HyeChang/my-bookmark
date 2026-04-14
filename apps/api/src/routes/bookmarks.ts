import type {
  BookmarkListResponse,
  BookmarkResponse,
  CreateBookmarkRequest,
  UpdateBookmarkRequest
} from "@bookmark/shared";
import { Hono } from "hono";

import type { AppBindings } from "../env";
import { getAuthenticatedUser } from "../lib/auth/current-user";
import {
  createBookmarkRepository,
  normalizeBookmarkUrl,
  toBookmarkResponse,
  type BookmarkRepository
} from "../lib/repositories/bookmarks";
import { syncAuthenticatedUser } from "../lib/repositories/users";

type BookmarkRouteOptions = {
  bookmarkRepository?: BookmarkRepository;
  sessionSecret?: string;
};

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

      const bookmarks = await repository.listByUser(user.uid);

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

      let bookmark;
      try {
        bookmark = await repository.create({
          ...body,
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
    });
}
