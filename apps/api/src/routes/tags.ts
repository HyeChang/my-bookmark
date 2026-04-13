import type {
  CreateTagRequest,
  TagListResponse,
  TagResponse
} from "@bookmark/shared";
import { Hono } from "hono";

import type { AppBindings } from "../env";
import { getAuthenticatedUser } from "../lib/auth/current-user";
import {
  createTagRepository,
  toTagResponse,
  type TagRepository
} from "../lib/repositories/tags";
import { syncAuthenticatedUser } from "../lib/repositories/users";

type TagRouteOptions = {
  tagRepository?: TagRepository;
  sessionSecret?: string;
};

function normalizeTagName(name: string | undefined) {
  return name?.trim() ?? "";
}

export function createTagRoute(options: TagRouteOptions = {}) {
  return new Hono<{ Bindings: AppBindings }>()
    .get("/", async (c) => {
      const user = await getAuthenticatedUser(c, options.sessionSecret);
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
      const user = await getAuthenticatedUser(c, options.sessionSecret);
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
    });
}
