import type {
  CreateFolderRequest,
  FolderListResponse,
  FolderResponse,
  UpdateFolderRequest
} from "@bookmark/shared";
import { Hono } from "hono";

import type { AppBindings } from "../env";
import { getAuthenticatedUser } from "../lib/auth/current-user";
import {
  createFolderRepository,
  toFolderResponse,
  type FolderRepository
} from "../lib/repositories/folders";
import { syncAuthenticatedUser } from "../lib/repositories/users";

type FolderRouteOptions = {
  folderRepository?: FolderRepository;
  sessionSecret?: string;
};

function normalizeFolderName(name: string | undefined) {
  return name?.trim() ?? "";
}

export function createFolderRoute(options: FolderRouteOptions = {}) {
  return new Hono<{ Bindings: AppBindings }>()
    .get("/", async (c) => {
      const user = await getAuthenticatedUser(c, options.sessionSecret);
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      if (!options.folderRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository =
        options.folderRepository ??
        (c.env?.bookmark ? createFolderRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "folder_repository_unavailable" }, 500);
      }

      const folders = await repository.listByUser(user.uid);

      return c.json<FolderListResponse>({
        folders: folders.map(toFolderResponse)
      });
    })
    .post("/", async (c) => {
      const user = await getAuthenticatedUser(c, options.sessionSecret);
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<CreateFolderRequest>().catch(() => null);
      const name = normalizeFolderName(body?.name);
      if (!name) {
        return c.json({ error: "missing_folder_name" }, 400);
      }

      if (!options.folderRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository =
        options.folderRepository ??
        (c.env?.bookmark ? createFolderRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "folder_repository_unavailable" }, 500);
      }

      const folder = await repository.create({
        ...body,
        name,
        userId: user.uid
      });

      return c.json<FolderResponse>(
        {
          folder: toFolderResponse(folder)
        },
        201
      );
    })
    .patch("/:folderId", async (c) => {
      const user = await getAuthenticatedUser(c, options.sessionSecret);
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<UpdateFolderRequest>().catch(() => null);
      if (!body) {
        return c.json({ error: "invalid_payload" }, 400);
      }

      const repository =
        options.folderRepository ??
        (c.env?.bookmark ? createFolderRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "folder_repository_unavailable" }, 500);
      }

      const input: UpdateFolderRequest = { ...body };
      if ("name" in input) {
        const name = normalizeFolderName(input.name);
        if (!name) {
          return c.json({ error: "missing_folder_name" }, 400);
        }

        input.name = name;
      }

      const folder = await repository.update(c.req.param("folderId"), user.uid, input);

      if (!folder) {
        return c.json({ error: "folder_not_found" }, 404);
      }

      return c.json<FolderResponse>({
        folder: toFolderResponse(folder)
      });
    })
    .delete("/:folderId", async (c) => {
      const user = await getAuthenticatedUser(c, options.sessionSecret);
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const repository =
        options.folderRepository ??
        (c.env?.bookmark ? createFolderRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "folder_repository_unavailable" }, 500);
      }

      const deleted = await repository.delete(c.req.param("folderId"), user.uid);
      if (!deleted) {
        return c.json({ error: "folder_not_found" }, 404);
      }

      return c.json({ ok: true as const });
    });
}
