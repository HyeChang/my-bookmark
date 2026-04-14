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

function normalizeParentFolderId(parentFolderId: string | null | undefined) {
  const normalizedParentFolderId = parentFolderId?.trim();
  return normalizedParentFolderId ? normalizedParentFolderId : null;
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

function haveSameIds(leftIds: string[], rightIds: string[]) {
  if (leftIds.length !== rightIds.length) {
    return false;
  }

  const leftIdSet = new Set(leftIds);
  if (leftIdSet.size !== leftIds.length) {
    return false;
  }

  for (const rightId of rightIds) {
    if (!leftIdSet.has(rightId)) {
      return false;
    }
  }

  return true;
}

async function validateParentFolderSelection(
  repository: FolderRepository,
  userId: string,
  currentFolderId: string | null,
  requestedParentFolderId: string | null | undefined
) {
  if (requestedParentFolderId === undefined) {
    return {
      ok: true as const,
      parentFolderId: undefined
    };
  }

  const normalizedParentFolderId = normalizeParentFolderId(requestedParentFolderId);
  if (normalizedParentFolderId === null) {
    return {
      ok: true as const,
      parentFolderId: null
    };
  }

  if (currentFolderId && normalizedParentFolderId === currentFolderId) {
    return {
      ok: false as const,
      error: "invalid_parent_folder_cycle"
    };
  }

  const folders = await repository.listByUser(userId);
  const parentFolder = folders.find((folder) => folder.id === normalizedParentFolderId);
  if (!parentFolder) {
    return {
      ok: false as const,
      error: "invalid_parent_folder_id"
    };
  }

  if (currentFolderId) {
    const descendantFolderIds = collectDescendantFolderIds(folders, currentFolderId);
    if (descendantFolderIds.has(normalizedParentFolderId)) {
      return {
        ok: false as const,
        error: "invalid_parent_folder_cycle"
      };
    }
  }

  return {
    ok: true as const,
    parentFolderId: normalizedParentFolderId
  };
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

      const parentFolderValidation = await validateParentFolderSelection(
        repository,
        user.uid,
        null,
        body?.parentFolderId
      );
      if (!parentFolderValidation.ok) {
        return c.json({ error: parentFolderValidation.error }, 400);
      }

      const folder = await repository.create({
        ...body,
        name,
        parentFolderId: parentFolderValidation.parentFolderId,
        userId: user.uid
      });

      return c.json<FolderResponse>(
        {
          folder: toFolderResponse(folder)
        },
        201
      );
    })
    .post("/reorder", async (c) => {
      const user = await getAuthenticatedUser(c, options.sessionSecret);
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req
        .json<{ parentFolderId?: string | null; folderIds?: string[] }>()
        .catch(() => null);
      const folderIds = Array.isArray(body?.folderIds)
        ? body.folderIds.map((folderId) => folderId.trim()).filter(Boolean)
        : [];
      const parentFolderId = normalizeParentFolderId(body?.parentFolderId);

      const repository =
        options.folderRepository ??
        (c.env?.bookmark ? createFolderRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "folder_repository_unavailable" }, 500);
      }

      const allFolders = await repository.listByUser(user.uid);
      const siblingFolderIds = allFolders
        .filter((folder) => folder.parentFolderId === parentFolderId)
        .map((folder) => folder.id);

      if (folderIds.length === 0 || !haveSameIds(folderIds, siblingFolderIds)) {
        return c.json({ error: "invalid_folder_reorder" }, 400);
      }

      const folders = await repository.reorder(user.uid, {
        parentFolderId,
        folderIds
      });

      return c.json<FolderListResponse>({
        folders: folders.map(toFolderResponse)
      });
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

      if ("parentFolderId" in input) {
        const parentFolderValidation = await validateParentFolderSelection(
          repository,
          user.uid,
          c.req.param("folderId"),
          input.parentFolderId
        );
        if (!parentFolderValidation.ok) {
          return c.json({ error: parentFolderValidation.error }, 400);
        }

        input.parentFolderId = parentFolderValidation.parentFolderId;
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
