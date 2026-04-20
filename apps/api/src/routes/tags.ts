import type {
  CreateTagRequest,
  TagListResponse,
  TagResponse,
  UpdateTagRequest
} from "@bookmark/shared";
import { Hono } from "hono";

import type { AppBindings } from "../env";
import { getAuthenticatedUser } from "../lib/auth/current-user";
import {
  createTagRepository,
  toTagResponse,
  type TagRepository
} from "../lib/repositories/tags";
import {
  createExtensionTokenRepository,
  type ExtensionTokenRepository
} from "../lib/repositories/extension-tokens";
import { syncAuthenticatedUser } from "../lib/repositories/users";

type TagRouteOptions = {
  tagRepository?: TagRepository;
  extensionTokenRepository?: ExtensionTokenRepository;
  sessionSecret?: string;
};

function normalizeTagName(name: string | undefined) {
  return name?.trim() ?? "";
}

function resolveExtensionTokenRepository(
  c: { env?: AppBindings },
  options: TagRouteOptions
) {
  return (
    options.extensionTokenRepository ??
    (c.env?.bookmark ? createExtensionTokenRepository(c.env.bookmark) : undefined)
  );
}

export function createTagRoute(options: TagRouteOptions = {}) {
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

      if (!options.tagRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository =
        options.tagRepository ??
        (c.env?.bookmark ? createTagRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "tag_repository_unavailable" }, 500);
      }

      const tags = await repository.listByUser(user.uid);

      return c.json<TagListResponse>({
        tags: tags.map(toTagResponse)
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

      const body = await c.req.json<CreateTagRequest>().catch(() => null);
      const name = normalizeTagName(body?.name);
      if (!name) {
        return c.json({ error: "missing_tag_name" }, 400);
      }

      if (!options.tagRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository =
        options.tagRepository ??
        (c.env?.bookmark ? createTagRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "tag_repository_unavailable" }, 500);
      }

      const tag = await repository.create({
        ...body,
        name,
        userId: user.uid
      });

      return c.json<TagResponse>(
        {
          tag: toTagResponse(tag)
        },
        201
      );
    })
    .patch("/:tagId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<UpdateTagRequest>().catch(() => null);
      if (!body) {
        return c.json({ error: "invalid_payload" }, 400);
      }

      const repository =
        options.tagRepository ??
        (c.env?.bookmark ? createTagRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "tag_repository_unavailable" }, 500);
      }

      const input: UpdateTagRequest = { ...body };
      if ("name" in input) {
        const name = normalizeTagName(input.name);
        if (!name) {
          return c.json({ error: "missing_tag_name" }, 400);
        }

        input.name = name;
      }

      const tag = await repository.update(c.req.param("tagId"), user.uid, input);
      if (!tag) {
        return c.json({ error: "tag_not_found" }, 404);
      }

      return c.json<TagResponse>({
        tag: toTagResponse(tag)
      });
    })
    .delete("/:tagId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const repository =
        options.tagRepository ??
        (c.env?.bookmark ? createTagRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "tag_repository_unavailable" }, 500);
      }

      const deleted = await repository.delete(c.req.param("tagId"), user.uid);
      if (!deleted) {
        return c.json({ error: "tag_not_found" }, 404);
      }

      return c.json({ ok: true as const });
    });
}
