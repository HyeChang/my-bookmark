import { getCookie } from "hono/cookie";
import type { Context } from "hono";

import type { AppBindings } from "../../env";
import type { ExtensionTokenRepository } from "../repositories/extension-tokens";
import {
  DEFAULT_SESSION_SECRET,
  readSessionValue,
  SESSION_COOKIE_NAME
} from "./session";
import type { AuthenticatedUser } from "./types";

function parseBearerToken(authorizationHeader: string | undefined) {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function getSessionAuthenticatedUser(
  c: Context<{ Bindings: AppBindings }>,
  sessionSecret?: string
): Promise<AuthenticatedUser | null> {
  const secret = c.env?.SESSION_SECRET ?? sessionSecret ?? DEFAULT_SESSION_SECRET;
  const sessionValue = getCookie(c, SESSION_COOKIE_NAME);

  return readSessionValue(sessionValue, secret);
}

export async function getAuthenticatedUser(
  c: Context<{ Bindings: AppBindings }>,
  sessionSecret?: string,
  extensionTokenRepository?: ExtensionTokenRepository
): Promise<AuthenticatedUser | null> {
  const rawToken = parseBearerToken(c.req.header("authorization"));
  if (rawToken && extensionTokenRepository) {
    const extensionToken = await extensionTokenRepository.findByRawToken(rawToken);
    if (extensionToken) {
      return extensionToken.user;
    }
  }

  return getSessionAuthenticatedUser(c, sessionSecret);
}
