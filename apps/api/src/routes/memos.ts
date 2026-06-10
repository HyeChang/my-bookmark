import type {
  CreateMemoFolderRequest,
  CreateMemoRequest,
  CreateMemoTagRequest,
  MemoAssetListResponse,
  MemoAssetResponse,
  MemoCountsResponse,
  MemoDeleteResponse,
  MemoFolderDeleteResponse,
  MemoFolderListResponse,
  MemoFolderResponse,
  MemoListResponse,
  MemoLockPasswordRequest,
  MemoLockResponse,
  MemoLockStatusResponse,
  MemoRichContent,
  MemoResponse,
  MemoSortMode,
  MemoTagDeleteResponse,
  MemoTagListResponse,
  MemoTagResponse,
  MoveMemoFolderRequest,
  ReorderMemoFoldersRequest,
  UpdateMemoFolderRequest,
  UpdateMemoRequest,
  UpdateMemoTagRequest
} from "@bookmark/shared";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import type { AppBindings } from "../env";
import { getAuthenticatedUser } from "../lib/auth/current-user";
import type { AuthenticatedUser } from "../lib/auth/types";
import {
  createExtensionTokenRepository,
  type ExtensionTokenRepository
} from "../lib/repositories/extension-tokens";
import {
  createMemoAssetRepository,
  toMemoAssetResponse,
  type MemoAssetRepository
} from "../lib/repositories/memo-assets";
import {
  createMemoFolderRepository,
  toMemoFolderResponse,
  type MemoFolderRepository
} from "../lib/repositories/memo-folders";
import {
  createMemoLockRepository,
  type MemoLockRepository,
  type MemoLockSession
} from "../lib/repositories/memo-locks";
import {
  createMemoTagRepository,
  toMemoTagResponse,
  type MemoTagRepository
} from "../lib/repositories/memo-tags";
import {
  aggregateMemoCounts,
  createMemoRepository,
  createEmptyMemoContent,
  summarizeMemoContentText,
  toMemoResponse,
  type MemoListFilters,
  type MemoRepository
} from "../lib/repositories/memos";
import { syncAuthenticatedUser } from "../lib/repositories/users";
import {
  createR2BookmarkAssetStorage,
  type BookmarkAssetStorage
} from "../lib/storage/assets";

type MemoRouteOptions = {
  memoRepository?: MemoRepository;
  memoFolderRepository?: MemoFolderRepository;
  memoLockRepository?: MemoLockRepository;
  memoTagRepository?: MemoTagRepository;
  memoAssetRepository?: MemoAssetRepository;
  assetStorage?: BookmarkAssetStorage;
  extensionTokenRepository?: ExtensionTokenRepository;
  sessionSecret?: string;
};

type MemoRouteContext = Context<{ Bindings: AppBindings }>;

const memoSortModes: MemoSortMode[] = [
  "updated_desc",
  "updated_asc",
  "title_asc",
  "title_desc"
];
const memoPageSizes = [20, 50, 100] as const;
const MEMO_QUERY_MAX_CHARS = 200;
const MEMO_ASSET_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MEMO_ASSET_CONTENT_CACHE_CONTROL = "private, max-age=604800, immutable";
const MEMO_ASSET_THUMBNAIL_CACHE_CONTROL = "private, max-age=2592000, immutable";
const MEMO_LOCK_COOKIE_NAME = "memo_lock";
const MEMO_LOCK_MIN_PASSWORD_LENGTH = 4;
const MEMO_LOCK_TTL_MS = 30 * 60 * 1000;

function normalizeTitle(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "Untitled";
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableId(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue || normalizedValue === "null") {
    return null;
  }

  return normalizedValue;
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

function normalizeTagIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((tagId): tagId is string => typeof tagId === "string")
        .map((tagId) => tagId.trim())
        .filter(Boolean)
    )
  );
}

function isMemoRichContent(value: unknown): value is MemoRichContent {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === "doc"
  );
}

function parseMemoPageSize(value: string | undefined) {
  if (!value) {
    return 20;
  }

  const pageSize = Number(value);
  return memoPageSizes.includes(pageSize as (typeof memoPageSizes)[number])
    ? pageSize
    : null;
}

function parseMemoOffset(value: string | undefined) {
  if (!value) {
    return 0;
  }

  const offset = Number(value);
  return Number.isInteger(offset) && offset >= 0 ? offset : null;
}

function normalizeQuery(value: string | undefined) {
  return (value?.trim() ?? "").slice(0, MEMO_QUERY_MAX_CHARS);
}

function sanitizeFileName(fileName: string) {
  const normalizedFileName = fileName.trim().replace(/\s+/g, "-");
  return normalizedFileName.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80) || "asset";
}

function getMemoAssetThumbnailObjectKey(objectKey: string) {
  return `${objectKey}.thumbnail`;
}

async function getStoredMemoAssetObject(
  assetStorage: BookmarkAssetStorage,
  objectKey: string,
  options?: { fallbackObjectKey?: string }
) {
  const object = await assetStorage.get(objectKey);
  if (object || !options?.fallbackObjectKey) {
    return object;
  }

  return assetStorage.get(options.fallbackObjectKey);
}

function resolveExtensionTokenRepository(
  c: { env?: AppBindings },
  options: MemoRouteOptions
) {
  return (
    options.extensionTokenRepository ??
    (c.env?.bookmark ? createExtensionTokenRepository(c.env.bookmark) : undefined)
  );
}

function resolveMemoRepository(c: { env?: AppBindings }, options: MemoRouteOptions) {
  return options.memoRepository ?? (c.env?.bookmark ? createMemoRepository(c.env.bookmark) : null);
}

function resolveMemoFolderRepository(
  c: { env?: AppBindings },
  options: MemoRouteOptions
) {
  return (
    options.memoFolderRepository ??
    (c.env?.bookmark ? createMemoFolderRepository(c.env.bookmark) : null)
  );
}

function resolveMemoLockRepository(c: { env?: AppBindings }, options: MemoRouteOptions) {
  return (
    options.memoLockRepository ??
    (c.env?.bookmark ? createMemoLockRepository(c.env.bookmark) : null)
  );
}

function resolveMemoTagRepository(c: { env?: AppBindings }, options: MemoRouteOptions) {
  return (
    options.memoTagRepository ??
    (c.env?.bookmark ? createMemoTagRepository(c.env.bookmark) : null)
  );
}

function resolveMemoAssetRepository(c: { env?: AppBindings }, options: MemoRouteOptions) {
  return (
    options.memoAssetRepository ??
    (c.env?.bookmark ? createMemoAssetRepository(c.env.bookmark) : null)
  );
}

function resolveAssetStorage(c: { env?: AppBindings }, options: MemoRouteOptions) {
  return (
    options.assetStorage ??
    (c.env?.bookmark_assets ? createR2BookmarkAssetStorage(c.env.bookmark_assets) : null)
  );
}

async function syncMemoLockAuthenticatedUser(
  c: MemoRouteContext,
  options: MemoRouteOptions,
  user: AuthenticatedUser
) {
  if (!options.memoLockRepository && c.env?.bookmark) {
    await syncAuthenticatedUser(c.env.bookmark, user);
  }
}

function normalizeMemoLockPassword(value: unknown) {
  return typeof value === "string" ? value : "";
}

function isMemoLockPasswordValid(password: string) {
  return password.length >= MEMO_LOCK_MIN_PASSWORD_LENGTH;
}

function parseMemoLockCookie(value: string | undefined) {
  if (!value) {
    return null;
  }

  const [sessionId, rawToken] = value.split(".");
  if (!sessionId || !rawToken) {
    return null;
  }

  return {
    sessionId,
    rawToken
  };
}

function setMemoLockCookie(
  c: MemoRouteContext,
  session: MemoLockSession
) {
  setCookie(c, MEMO_LOCK_COOKIE_NAME, `${session.id}.${session.rawToken}`, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/api/memos",
    maxAge: Math.max(1, Math.floor(MEMO_LOCK_TTL_MS / 1000)),
    expires: new Date(session.expiresAt)
  });
}

function clearMemoLockCookie(
  c: MemoRouteContext
) {
  deleteCookie(c, MEMO_LOCK_COOKIE_NAME, {
    path: "/api/memos"
  });
}

async function isMemoUnlocked(
  c: MemoRouteContext,
  userId: string,
  repository: MemoLockRepository | null,
  memoId?: string
) {
  if (!repository) {
    return false;
  }

  const cookie = parseMemoLockCookie(getCookie(c, MEMO_LOCK_COOKIE_NAME));
  if (!cookie) {
    return false;
  }

  if (memoId) {
    return repository.verifyMemoUnlockSession(
      userId,
      memoId,
      cookie.sessionId,
      cookie.rawToken
    );
  }

  return repository.verifyUnlockSession(userId, cookie.sessionId, cookie.rawToken);
}

async function requireVisibleMemo(
  c: MemoRouteContext,
  repository: MemoRepository,
  lockRepository: MemoLockRepository | null,
  userId: string,
  memoId: string
) {
  const memo = await repository.getByUserAndId(userId, memoId, {
    includeHidden: true,
    includeLocked: true
  });
  if (!memo) {
    return null;
  }

  if (memo.isLocked && !(await isMemoUnlocked(c, userId, lockRepository, memo.id))) {
    return null;
  }

  return memo;
}

function toMemoListResponse(
  memo: Parameters<typeof toMemoResponse>[0],
  canRevealLocked: boolean
) {
  const response = toMemoResponse(memo);
  if (!response.isLocked || canRevealLocked) {
    return {
      ...response,
      contentJson: createEmptyMemoContent(),
      contentText: summarizeMemoContentText(response.contentText)
    };
  }

  return {
    ...response,
    contentJson: createEmptyMemoContent(),
    contentText: "",
    assetCount: 0,
    coverAsset: null
  };
}

async function aggregateMemoCountsByPaging(repository: MemoRepository, userId: string) {
  const memos: Array<Parameters<typeof aggregateMemoCounts>[0][number]> = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const page = await repository.pageByUser(
      userId,
      {
        includeHidden: true,
        includeLocked: true
      },
      {
        contentMode: "summary",
        pagination: {
          limit,
          offset
        }
      }
    );

    memos.push(...page.memos);
    offset += limit;

    if (page.memos.length === 0 || offset >= page.total) {
      break;
    }
  }

  return aggregateMemoCounts(memos);
}

export function createMemoRoute(options: MemoRouteOptions = {}) {
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

      if (!options.memoRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository = resolveMemoRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_repository_unavailable" }, 500);
      }
      const lockRepository = resolveMemoLockRepository(c, options);

      const requestedLimit = c.req.query("limit")?.trim();
      const requestedOffset = c.req.query("offset")?.trim();
      const pageSize = parseMemoPageSize(requestedLimit);
      const pageOffset = parseMemoOffset(requestedOffset);
      const requestedSort = c.req.query("sort");
      const sort = (requestedSort ?? "updated_desc") as MemoSortMode;

      if (requestedLimit && pageSize === null) {
        return c.json({ error: "invalid_page_size" }, 400);
      }

      if (pageOffset === null) {
        return c.json({ error: "invalid_page_offset" }, 400);
      }

      if (requestedSort && !memoSortModes.includes(sort)) {
        return c.json({ error: "invalid_sort_mode" }, 400);
      }

      const searchParams = new URL(c.req.url).searchParams;
      const hasFolderIdFilter = searchParams.has("folderId");
      const requestedFolderId = hasFolderIdFilter
        ? normalizeNullableId(searchParams.get("folderId"))
        : undefined;
      const includeDescendantFolders =
        typeof requestedFolderId === "string" &&
        (c.req.query("includeDescendantFolders") === "1" ||
          c.req.query("includeDescendantFolders") === "true");
      let folderIds: Array<string | null> | undefined;
      if (typeof requestedFolderId === "string" && includeDescendantFolders) {
        const folderRepository = resolveMemoFolderRepository(c, options);
        if (!folderRepository) {
          return c.json({ error: "memo_folder_repository_unavailable" }, 500);
        }

        folderIds = [
          requestedFolderId,
          ...(await folderRepository.listDescendantIds(user.uid, requestedFolderId))
        ];
      }

      const filters: MemoListFilters = {};
      const query = normalizeQuery(c.req.query("query"));
      const requestedTagId = c.req.query("tagId")?.trim();
      if (query) {
        filters.query = query;
      }
      if (folderIds) {
        filters.folderIds = folderIds;
      } else if (hasFolderIdFilter) {
        filters.folderId = requestedFolderId;
      }
      if (requestedTagId) {
        filters.tagId = requestedTagId;
      }
      if (c.req.query("favorite") === "1") {
        filters.favorite = true;
      } else if (c.req.query("favorite") === "0") {
        filters.favorite = false;
      }
      if (
        c.req.query("includeHidden") === "1" ||
        c.req.query("includeHidden") === "true"
      ) {
        filters.includeHidden = true;
      }
      if (!query) {
        filters.includeLocked = true;
        filters.redactLocked = true;
      }

      const page = await repository.pageByUser(user.uid, filters, {
        contentMode: "summary",
        pagination: {
          limit: pageSize ?? 20,
          offset: pageOffset
        },
        sort
      });

      return c.json<MemoListResponse>({
        memos: page.memos.map((memo) => toMemoListResponse(memo, false)),
        pagination: {
          limit: pageSize ?? 20,
          offset: pageOffset,
          total: page.total,
          hasMore: pageOffset + (pageSize ?? 20) < page.total
        }
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

      const body = await c.req.json<CreateMemoRequest>().catch(() => null);
      if (!body || !isMemoRichContent(body.contentJson)) {
        return c.json({ error: "invalid_content_json" }, 400);
      }
      if (typeof body.contentText !== "string") {
        return c.json({ error: "invalid_content_text" }, 400);
      }

      if (!options.memoRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository = resolveMemoRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_repository_unavailable" }, 500);
      }
      const isHidden = body.isHidden === true;
      const isLocked = body.isLocked === true;
      const lockPassword = normalizeMemoLockPassword(body.lockPassword);
      if (isLocked) {
        const lockRepository = resolveMemoLockRepository(c, options);
        if (!lockRepository) {
          return c.json({ error: "memo_lock_repository_unavailable" }, 500);
        }
        if (!isMemoLockPasswordValid(lockPassword)) {
          return c.json({ error: "invalid_memo_lock_password" }, 400);
        }
      }

      try {
        const memo = await repository.create({
          ...body,
          userId: user.uid,
          folderId: normalizeNullableId(body.folderId) ?? null,
          tagIds: normalizeTagIds(body.tagIds),
          title: normalizeTitle(body.title),
          contentJson: body.contentJson,
          contentText: body.contentText,
          isFavorite: body.isFavorite === true,
          isHidden,
          isLocked,
          memoColor: body.memoColor ?? null
        });
        if (isLocked) {
          const lockRepository = resolveMemoLockRepository(c, options);
          if (!lockRepository) {
            return c.json({ error: "memo_lock_repository_unavailable" }, 500);
          }
          await lockRepository.setMemoPassword(user.uid, memo.id, lockPassword);
        }

        return c.json<MemoResponse>({ memo: toMemoResponse(memo) }, 201);
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_folder_id") {
          return c.json({ error: "invalid_folder_id" }, 400);
        }
        if (error instanceof Error && error.message === "invalid_tag_ids") {
          return c.json({ error: "invalid_tag_ids" }, 400);
        }

        throw error;
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

      if (!options.memoRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository = resolveMemoRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_repository_unavailable" }, 500);
      }

      const counts = repository.countByUser
        ? await repository.countByUser(user.uid)
        : await aggregateMemoCountsByPaging(repository, user.uid);

      return c.json<MemoCountsResponse>({
        counts
      });
    })
    .get("/folders", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      if (!options.memoFolderRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository = resolveMemoFolderRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_folder_repository_unavailable" }, 500);
      }

      const folders = await repository.listByUser(user.uid);
      return c.json<MemoFolderListResponse>({
        folders: folders.map(toMemoFolderResponse)
      });
    })
    .post("/folders", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<CreateMemoFolderRequest>().catch(() => null);
      const name = normalizeOptionalText(body?.name);
      if (!name) {
        return c.json({ error: "missing_folder_name" }, 400);
      }

      if (!options.memoFolderRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository = resolveMemoFolderRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_folder_repository_unavailable" }, 500);
      }

      try {
        const folder = await repository.create({
          ...body,
          userId: user.uid,
          name,
          parentFolderId: normalizeNullableId(body?.parentFolderId) ?? null,
          color: body?.color ?? null,
          icon: body?.icon ?? null,
          isHidden: body?.isHidden === true
        });

        return c.json<MemoFolderResponse>(
          { folder: toMemoFolderResponse(folder) },
          201
        );
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_parent_folder_id") {
          return c.json({ error: "invalid_parent_folder_id" }, 400);
        }

        throw error;
      }
    })
    .post("/folders/reorder", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<ReorderMemoFoldersRequest>().catch(() => null);
      const folderIds = Array.isArray(body?.folderIds)
        ? body.folderIds.map((folderId) => folderId.trim()).filter(Boolean)
        : [];
      const parentFolderId = normalizeNullableId(body?.parentFolderId) ?? null;

      const repository = resolveMemoFolderRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_folder_repository_unavailable" }, 500);
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

      return c.json<MemoFolderListResponse>({
        folders: folders.map(toMemoFolderResponse)
      });
    })
    .post("/folders/:folderId/move", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<MoveMemoFolderRequest>().catch(() => null);
      const repository = resolveMemoFolderRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_folder_repository_unavailable" }, 500);
      }

      try {
        const folders = await repository.move(c.req.param("folderId"), user.uid, {
          parentFolderId: normalizeNullableId(body?.parentFolderId) ?? null
        });
        if (!folders) {
          return c.json({ error: "memo_folder_not_found" }, 404);
        }

        return c.json<MemoFolderListResponse>({
          folders: folders.map(toMemoFolderResponse)
        });
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_parent_folder_id") {
          return c.json({ error: "invalid_parent_folder_id" }, 400);
        }

        throw error;
      }
    })
    .patch("/folders/:folderId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<UpdateMemoFolderRequest>().catch(() => null);
      if (!body) {
        return c.json({ error: "invalid_payload" }, 400);
      }

      const repository = resolveMemoFolderRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_folder_repository_unavailable" }, 500);
      }

      const input: UpdateMemoFolderRequest = { ...body };
      if ("name" in input) {
        const name = normalizeOptionalText(input.name);
        if (!name) {
          return c.json({ error: "missing_folder_name" }, 400);
        }

        input.name = name;
      }
      if ("parentFolderId" in input) {
        input.parentFolderId = normalizeNullableId(input.parentFolderId) ?? null;
      }
      if ("isHidden" in input) {
        input.isHidden = input.isHidden === true;
      }

      try {
        const folder = await repository.update(
          c.req.param("folderId"),
          user.uid,
          input
        );
        if (!folder) {
          return c.json({ error: "memo_folder_not_found" }, 404);
        }

        return c.json<MemoFolderResponse>({ folder: toMemoFolderResponse(folder) });
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_parent_folder_id") {
          return c.json({ error: "invalid_parent_folder_id" }, 400);
        }

        throw error;
      }
    })
    .delete("/folders/:folderId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const repository = resolveMemoFolderRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_folder_repository_unavailable" }, 500);
      }

      const deleted = await repository.delete(c.req.param("folderId"), user.uid);
      if (!deleted) {
        return c.json({ error: "memo_folder_not_found" }, 404);
      }

      return c.json<MemoFolderDeleteResponse>({ ok: true });
    })
    .get("/tags", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      if (!options.memoTagRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository = resolveMemoTagRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_tag_repository_unavailable" }, 500);
      }

      const tags = await repository.listByUser(user.uid);
      return c.json<MemoTagListResponse>({
        tags: tags.map(toMemoTagResponse)
      });
    })
    .post("/tags", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<CreateMemoTagRequest>().catch(() => null);
      const name = normalizeOptionalText(body?.name);
      if (!name) {
        return c.json({ error: "missing_tag_name" }, 400);
      }

      if (!options.memoTagRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository = resolveMemoTagRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_tag_repository_unavailable" }, 500);
      }

      const tag = await repository.create({
        ...body,
        userId: user.uid,
        name,
        color: body?.color ?? null
      });

      return c.json<MemoTagResponse>({ tag: toMemoTagResponse(tag) }, 201);
    })
    .patch("/tags/:tagId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<UpdateMemoTagRequest>().catch(() => null);
      if (!body) {
        return c.json({ error: "invalid_payload" }, 400);
      }

      const repository = resolveMemoTagRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_tag_repository_unavailable" }, 500);
      }

      const input: UpdateMemoTagRequest = { ...body };
      if ("name" in input) {
        const name = normalizeOptionalText(input.name);
        if (!name) {
          return c.json({ error: "missing_tag_name" }, 400);
        }

        input.name = name;
      }

      const tag = await repository.update(c.req.param("tagId"), user.uid, input);
      if (!tag) {
        return c.json({ error: "memo_tag_not_found" }, 404);
      }

      return c.json<MemoTagResponse>({ tag: toMemoTagResponse(tag) });
    })
    .delete("/tags/:tagId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const repository = resolveMemoTagRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_tag_repository_unavailable" }, 500);
      }

      const deleted = await repository.delete(c.req.param("tagId"), user.uid);
      if (!deleted) {
        return c.json({ error: "memo_tag_not_found" }, 404);
      }

      return c.json<MemoTagDeleteResponse>({ ok: true });
    })
    .get("/lock/status", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      await syncMemoLockAuthenticatedUser(c, options, user);

      const lockRepository = resolveMemoLockRepository(c, options);
      if (!lockRepository) {
        return c.json({ error: "memo_lock_repository_unavailable" }, 500);
      }

      await lockRepository.revokeExpiredSessions(user.uid);
      const status = await lockRepository.getStatus(user.uid);
      const isUnlocked = await isMemoUnlocked(c, user.uid, lockRepository);

      return c.json<MemoLockStatusResponse>({
        isConfigured: status.isConfigured,
        isUnlocked
      });
    })
    .post("/lock/setup", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<MemoLockPasswordRequest>().catch(() => null);
      const password = normalizeMemoLockPassword(body?.password);
      if (!isMemoLockPasswordValid(password)) {
        return c.json({ error: "invalid_memo_lock_password" }, 400);
      }

      await syncMemoLockAuthenticatedUser(c, options, user);

      const lockRepository = resolveMemoLockRepository(c, options);
      if (!lockRepository) {
        return c.json({ error: "memo_lock_repository_unavailable" }, 500);
      }

      const setting = await lockRepository.setupPassword(user.uid, password);
      if (!setting) {
        return c.json({ error: "memo_lock_already_configured" }, 409);
      }

      const session = await lockRepository.createUnlockSession(user.uid, MEMO_LOCK_TTL_MS);
      setMemoLockCookie(c, session);

      return c.json<MemoLockResponse>({
        ok: true,
        status: {
          isConfigured: true,
          isUnlocked: true
        }
      });
    })
    .post("/lock/unlock", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<MemoLockPasswordRequest>().catch(() => null);
      const password = normalizeMemoLockPassword(body?.password);
      if (!password) {
        return c.json({ error: "invalid_memo_lock_password" }, 400);
      }

      await syncMemoLockAuthenticatedUser(c, options, user);

      const lockRepository = resolveMemoLockRepository(c, options);
      if (!lockRepository) {
        return c.json({ error: "memo_lock_repository_unavailable" }, 500);
      }

      const isPasswordValid = await lockRepository.verifyPassword(user.uid, password);
      if (!isPasswordValid) {
        clearMemoLockCookie(c);
        return c.json({ error: "invalid_memo_lock_password" }, 401);
      }

      const session = await lockRepository.createUnlockSession(user.uid, MEMO_LOCK_TTL_MS);
      setMemoLockCookie(c, session);

      return c.json<MemoLockResponse>({
        ok: true,
        status: {
          isConfigured: true,
          isUnlocked: true
        }
      });
    })
    .post("/lock/lock", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      await syncMemoLockAuthenticatedUser(c, options, user);

      const lockRepository = resolveMemoLockRepository(c, options);
      if (!lockRepository) {
        return c.json({ error: "memo_lock_repository_unavailable" }, 500);
      }

      const cookie = parseMemoLockCookie(getCookie(c, MEMO_LOCK_COOKIE_NAME));
      if (cookie) {
        await lockRepository.revokeUnlockSession(user.uid, cookie.sessionId);
      }
      clearMemoLockCookie(c);
      const status = await lockRepository.getStatus(user.uid);

      return c.json<MemoLockResponse>({
        ok: true,
        status: {
          isConfigured: status.isConfigured,
          isUnlocked: false
        }
      });
    })
    .post("/:memoId/lock/unlock", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<MemoLockPasswordRequest>().catch(() => null);
      const password = normalizeMemoLockPassword(body?.password);
      if (!password) {
        return c.json({ error: "invalid_memo_lock_password" }, 400);
      }

      await syncMemoLockAuthenticatedUser(c, options, user);

      const repository = resolveMemoRepository(c, options);
      const lockRepository = resolveMemoLockRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_repository_unavailable" }, 500);
      }
      if (!lockRepository) {
        return c.json({ error: "memo_lock_repository_unavailable" }, 500);
      }

      const memo = await repository.getByUserAndId(user.uid, c.req.param("memoId"), {
        includeHidden: true,
        includeLocked: true
      });
      if (!memo || !memo.isLocked) {
        return c.json({ error: "memo_not_found" }, 404);
      }

      const isPasswordValid = await lockRepository.verifyMemoPassword(
        user.uid,
        memo.id,
        password
      );
      if (!isPasswordValid) {
        clearMemoLockCookie(c);
        return c.json({ error: "invalid_memo_lock_password" }, 401);
      }

      const session = await lockRepository.createMemoUnlockSession(
        user.uid,
        memo.id,
        MEMO_LOCK_TTL_MS
      );
      setMemoLockCookie(c, session);

      return c.json<MemoLockResponse>({
        ok: true,
        status: {
          isConfigured: true,
          isUnlocked: true
        }
      });
    })
    .post("/:memoId/lock/lock", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const lockRepository = resolveMemoLockRepository(c, options);
      if (!lockRepository) {
        return c.json({ error: "memo_lock_repository_unavailable" }, 500);
      }

      const memoId = c.req.param("memoId");
      const cookie = parseMemoLockCookie(getCookie(c, MEMO_LOCK_COOKIE_NAME));
      if (cookie) {
        await lockRepository.revokeMemoUnlockSession(user.uid, memoId, cookie.sessionId);
      }
      clearMemoLockCookie(c);

      return c.json<MemoLockResponse>({
        ok: true,
        status: {
          isConfigured: true,
          isUnlocked: false
        }
      });
    })
    .get("/:memoId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const repository = resolveMemoRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_repository_unavailable" }, 500);
      }

      const memo = await requireVisibleMemo(
        c,
        repository,
        resolveMemoLockRepository(c, options),
        user.uid,
        c.req.param("memoId")
      );
      if (!memo) {
        return c.json({ error: "memo_not_found" }, 404);
      }

      return c.json<MemoResponse>({ memo: toMemoResponse(memo) });
    })
    .patch("/:memoId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<UpdateMemoRequest>().catch(() => null);
      if (!body) {
        return c.json({ error: "invalid_payload" }, 400);
      }
      if ("contentJson" in body && !isMemoRichContent(body.contentJson)) {
        return c.json({ error: "invalid_content_json" }, 400);
      }
      if ("contentText" in body && typeof body.contentText !== "string") {
        return c.json({ error: "invalid_content_text" }, 400);
      }

      const repository = resolveMemoRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_repository_unavailable" }, 500);
      }
      const lockRepository = resolveMemoLockRepository(c, options);
      const existingMemo = await requireVisibleMemo(
        c,
        repository,
        lockRepository,
        user.uid,
        c.req.param("memoId")
      );
      if (!existingMemo) {
        return c.json({ error: "memo_not_found" }, 404);
      }

      const input: UpdateMemoRequest = { ...body };
      if ("title" in input) {
        input.title = normalizeTitle(input.title);
      }
      if ("folderId" in input) {
        input.folderId = normalizeNullableId(input.folderId) ?? null;
      }
      if ("tagIds" in input) {
        input.tagIds = normalizeTagIds(input.tagIds);
      }
      if ("isHidden" in input) {
        input.isHidden = input.isHidden === true;
      }
      if ("isLocked" in input) {
        input.isLocked = input.isLocked === true;
      }
      const nextIsLocked =
        "isLocked" in input ? input.isLocked === true : existingMemo.isLocked;
      const lockPassword = normalizeMemoLockPassword(body.lockPassword);
      if (input.isLocked === true) {
        if (!lockRepository) {
          return c.json({ error: "memo_lock_repository_unavailable" }, 500);
        }
        const status = await lockRepository.getMemoStatus(user.uid, existingMemo.id);
        if (!status.isConfigured && !isMemoLockPasswordValid(lockPassword)) {
          return c.json({ error: "invalid_memo_lock_password" }, 400);
        }
      }
      if (nextIsLocked && lockPassword && !isMemoLockPasswordValid(lockPassword)) {
        return c.json({ error: "invalid_memo_lock_password" }, 400);
      }

      try {
        const memo = await repository.update(c.req.param("memoId"), user.uid, input);
        if (!memo) {
          return c.json({ error: "memo_not_found" }, 404);
        }
        if (lockRepository) {
          if (nextIsLocked) {
            if (lockPassword) {
              await lockRepository.setMemoPassword(user.uid, memo.id, lockPassword);
            }
            await lockRepository.revokeMemoUnlockSessions(user.uid, memo.id);
          } else if (existingMemo.isLocked) {
            await lockRepository.deleteMemoPassword(user.uid, memo.id);
          }
        }

        return c.json<MemoResponse>({ memo: toMemoResponse(memo) });
      } catch (error) {
        if (error instanceof Error && error.message === "invalid_folder_id") {
          return c.json({ error: "invalid_folder_id" }, 400);
        }
        if (error instanceof Error && error.message === "invalid_tag_ids") {
          return c.json({ error: "invalid_tag_ids" }, 400);
        }

        throw error;
      }
    })
    .delete("/:memoId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const repository = resolveMemoRepository(c, options);
      if (!repository) {
        return c.json({ error: "memo_repository_unavailable" }, 500);
      }

      const memo = await requireVisibleMemo(
        c,
        repository,
        resolveMemoLockRepository(c, options),
        user.uid,
        c.req.param("memoId")
      );
      if (!memo) {
        return c.json({ error: "memo_not_found" }, 404);
      }

      const assetRepository = resolveMemoAssetRepository(c, options);
      const assetStorage = resolveAssetStorage(c, options);
      if (assetRepository) {
        const assets = await assetRepository.listByMemo(user.uid, memo.id);
        if (assets.length > 0 && !assetStorage) {
          return c.json({ error: "memo_asset_repository_unavailable" }, 500);
        }

        if (assetStorage) {
          await Promise.all(
            assets.flatMap((asset) => [
              assetStorage.delete(asset.objectKey),
              assetStorage.delete(asset.thumbnailObjectKey)
            ])
          );
        }
      }

      const deleted = await repository.delete(memo.id, user.uid);
      if (!deleted) {
        return c.json({ error: "memo_not_found" }, 404);
      }
      await resolveMemoLockRepository(c, options)?.deleteMemoPassword(user.uid, memo.id);

      return c.json<MemoDeleteResponse>({ ok: true });
    })
    .get("/:memoId/assets", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const memoRepository = resolveMemoRepository(c, options);
      const assetRepository = resolveMemoAssetRepository(c, options);
      if (!memoRepository || !assetRepository) {
        return c.json({ error: "memo_asset_repository_unavailable" }, 500);
      }

      const memo = await requireVisibleMemo(
        c,
        memoRepository,
        resolveMemoLockRepository(c, options),
        user.uid,
        c.req.param("memoId")
      );
      if (!memo) {
        return c.json({ error: "memo_not_found" }, 404);
      }

      const assets = await assetRepository.listByMemo(user.uid, memo.id);
      return c.json<MemoAssetListResponse>({
        assets: assets.map(toMemoAssetResponse)
      });
    })
    .post("/:memoId/assets", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const memoRepository = resolveMemoRepository(c, options);
      const assetRepository = resolveMemoAssetRepository(c, options);
      const assetStorage = resolveAssetStorage(c, options);
      if (!memoRepository || !assetRepository || !assetStorage) {
        return c.json({ error: "memo_asset_repository_unavailable" }, 500);
      }

      const memo = await requireVisibleMemo(
        c,
        memoRepository,
        resolveMemoLockRepository(c, options),
        user.uid,
        c.req.param("memoId")
      );
      if (!memo) {
        return c.json({ error: "memo_not_found" }, 404);
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
      if (file.size > MEMO_ASSET_MAX_UPLOAD_BYTES) {
        return c.json({ error: "file_too_large" }, 413);
      }

      const thumbnailFile = formData?.get("thumbnail");
      if (thumbnailFile !== null && thumbnailFile !== undefined) {
        if (!(thumbnailFile instanceof File) || !thumbnailFile.type.startsWith("image/")) {
          return c.json({ error: "unsupported_thumbnail_type" }, 400);
        }
        if (thumbnailFile.size > MEMO_ASSET_MAX_UPLOAD_BYTES) {
          return c.json({ error: "thumbnail_too_large" }, 413);
        }
      }

      const objectKey = `memo-assets/${user.uid}/${memo.id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
      const thumbnailObjectKey = getMemoAssetThumbnailObjectKey(objectKey);

      await assetStorage.put(objectKey, await file.arrayBuffer(), file.type);
      if (thumbnailFile instanceof File && thumbnailFile.size > 0) {
        await assetStorage.put(
          thumbnailObjectKey,
          await thumbnailFile.arrayBuffer(),
          thumbnailFile.type
        );
      }

      const asset = await assetRepository.create({
        userId: user.uid,
        memoId: memo.id,
        objectKey,
        thumbnailObjectKey,
        mimeType: file.type
      });

      return c.json<MemoAssetResponse>({ asset: toMemoAssetResponse(asset) }, 201);
    })
    .get("/:memoId/assets/:assetId/content", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const memoRepository = resolveMemoRepository(c, options);
      const assetRepository = resolveMemoAssetRepository(c, options);
      const assetStorage = resolveAssetStorage(c, options);
      if (!memoRepository || !assetRepository || !assetStorage) {
        return c.json({ error: "memo_asset_repository_unavailable" }, 500);
      }

      const memo = await requireVisibleMemo(
        c,
        memoRepository,
        resolveMemoLockRepository(c, options),
        user.uid,
        c.req.param("memoId")
      );
      if (!memo) {
        return c.json({ error: "memo_not_found" }, 404);
      }

      const asset = await assetRepository.getById(
        user.uid,
        memo.id,
        c.req.param("assetId")
      );
      if (!asset) {
        return c.json({ error: "memo_asset_not_found" }, 404);
      }

      const object = await getStoredMemoAssetObject(assetStorage, asset.objectKey);
      if (!object) {
        return c.json({ error: "memo_asset_content_not_found" }, 404);
      }

      return new Response(object.body, {
        headers: {
          "content-type": object.contentType,
          "cache-control": MEMO_ASSET_CONTENT_CACHE_CONTROL
        }
      });
    })
    .get("/:memoId/assets/:assetId/thumbnail", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const memoRepository = resolveMemoRepository(c, options);
      const assetRepository = resolveMemoAssetRepository(c, options);
      const assetStorage = resolveAssetStorage(c, options);
      if (!memoRepository || !assetRepository || !assetStorage) {
        return c.json({ error: "memo_asset_repository_unavailable" }, 500);
      }

      const memo = await requireVisibleMemo(
        c,
        memoRepository,
        resolveMemoLockRepository(c, options),
        user.uid,
        c.req.param("memoId")
      );
      if (!memo) {
        return c.json({ error: "memo_not_found" }, 404);
      }

      const asset = await assetRepository.getById(
        user.uid,
        memo.id,
        c.req.param("assetId")
      );
      if (!asset) {
        return c.json({ error: "memo_asset_not_found" }, 404);
      }

      const object = await getStoredMemoAssetObject(assetStorage, asset.thumbnailObjectKey, {
        fallbackObjectKey: asset.objectKey
      });
      if (!object) {
        return c.json({ error: "memo_asset_content_not_found" }, 404);
      }

      return new Response(object.body, {
        headers: {
          "content-type": object.contentType,
          "cache-control": MEMO_ASSET_THUMBNAIL_CACHE_CONTROL
        }
      });
    })
    .delete("/:memoId/assets/:assetId", async (c) => {
      const user = await getAuthenticatedUser(
        c,
        options.sessionSecret,
        resolveExtensionTokenRepository(c, options)
      );
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const memoRepository = resolveMemoRepository(c, options);
      const assetRepository = resolveMemoAssetRepository(c, options);
      const assetStorage = resolveAssetStorage(c, options);
      if (!memoRepository || !assetRepository || !assetStorage) {
        return c.json({ error: "memo_asset_repository_unavailable" }, 500);
      }

      const memo = await requireVisibleMemo(
        c,
        memoRepository,
        resolveMemoLockRepository(c, options),
        user.uid,
        c.req.param("memoId")
      );
      if (!memo) {
        return c.json({ error: "memo_not_found" }, 404);
      }

      const asset = await assetRepository.getById(
        user.uid,
        memo.id,
        c.req.param("assetId")
      );
      if (!asset) {
        return c.json({ error: "memo_asset_not_found" }, 404);
      }

      await assetRepository.delete(user.uid, memo.id, asset.id);
      await assetStorage.delete(asset.objectKey);
      await assetStorage.delete(asset.thumbnailObjectKey);

      return c.body(null, 204);
    });
}
