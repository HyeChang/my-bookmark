import type {
  CreateExtensionTokenRequest,
  CreateExtensionTokenResponse,
  ExtensionTokenListResponse
} from "@bookmark/shared";
import { Hono } from "hono";

import type { AppBindings } from "../env";
import { getSessionAuthenticatedUser } from "../lib/auth/current-user";
import {
  createExtensionTokenRepository,
  toExtensionTokenResponse,
  type ExtensionTokenRepository
} from "../lib/repositories/extension-tokens";
import { syncAuthenticatedUser } from "../lib/repositories/users";

type ExtensionTokenRouteOptions = {
  extensionTokenRepository?: ExtensionTokenRepository;
  sessionSecret?: string;
};

function normalizeTokenLabel(label: string | undefined) {
  return label?.trim() ?? "";
}

export function createExtensionTokenRoute(options: ExtensionTokenRouteOptions = {}) {
  return new Hono<{ Bindings: AppBindings }>()
    .get("/", async (c) => {
      const user = await getSessionAuthenticatedUser(c, options.sessionSecret);
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      if (!options.extensionTokenRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository =
        options.extensionTokenRepository ??
        (c.env?.bookmark ? createExtensionTokenRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "extension_token_repository_unavailable" }, 500);
      }

      const tokens = await repository.listByUser(user.uid);
      return c.json<ExtensionTokenListResponse>({
        tokens: tokens.map(toExtensionTokenResponse)
      });
    })
    .post("/", async (c) => {
      const user = await getSessionAuthenticatedUser(c, options.sessionSecret);
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const body = await c.req.json<CreateExtensionTokenRequest>().catch(() => null);
      const label = normalizeTokenLabel(body?.label);
      if (!label) {
        return c.json({ error: "missing_extension_token_label" }, 400);
      }

      if (!options.extensionTokenRepository && c.env?.bookmark) {
        await syncAuthenticatedUser(c.env.bookmark, user);
      }

      const repository =
        options.extensionTokenRepository ??
        (c.env?.bookmark ? createExtensionTokenRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "extension_token_repository_unavailable" }, 500);
      }

      const created = await repository.create({
        userId: user.uid,
        label
      });

      return c.json<CreateExtensionTokenResponse>(
        {
          token: toExtensionTokenResponse(created.token),
          rawToken: created.rawToken
        },
        201
      );
    })
    .delete("/:tokenId", async (c) => {
      const user = await getSessionAuthenticatedUser(c, options.sessionSecret);
      if (!user) {
        return c.json({ error: "unauthorized" }, 401);
      }

      const repository =
        options.extensionTokenRepository ??
        (c.env?.bookmark ? createExtensionTokenRepository(c.env.bookmark) : null);

      if (!repository) {
        return c.json({ error: "extension_token_repository_unavailable" }, 500);
      }

      const deleted = await repository.revoke(c.req.param("tokenId"), user.uid);
      if (!deleted) {
        return c.json({ error: "extension_token_not_found" }, 404);
      }

      return c.json({ ok: true as const });
    });
}
