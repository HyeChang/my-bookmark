import { getCookie } from "hono/cookie";
import type { Context } from "hono";

import type { AppBindings } from "../../env";
import {
  DEFAULT_SESSION_SECRET,
  readSessionValue,
  SESSION_COOKIE_NAME
} from "./session";
import type { AuthenticatedUser } from "./types";

export async function getAuthenticatedUser(
  c: Context<{ Bindings: AppBindings }>,
  sessionSecret?: string
): Promise<AuthenticatedUser | null> {
  const secret = c.env?.SESSION_SECRET ?? sessionSecret ?? DEFAULT_SESSION_SECRET;
  const sessionValue = getCookie(c, SESSION_COOKIE_NAME);

  return readSessionValue(sessionValue, secret);
}
