import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";

import type { AppBindings } from "../env";
import {
  createSessionValue,
  DEFAULT_SESSION_SECRET,
  readSessionValue,
  SESSION_COOKIE_NAME
} from "../lib/auth/session";
import type { VerifyIdToken } from "../lib/auth/types";

type AuthRouteOptions = {
  verifyIdToken: VerifyIdToken;
  sessionSecret?: string;
};

export function createAuthRoute(options: AuthRouteOptions) {
  return new Hono<{ Bindings: AppBindings }>()
    .post("/session", async (c) => {
      const sessionSecret =
        c.env?.SESSION_SECRET ?? options.sessionSecret ?? DEFAULT_SESSION_SECRET;
      const body = await c.req.json<{ idToken?: string }>().catch(() => ({}));
      if (!body.idToken) {
        return c.json({ error: "missing_id_token" }, 400);
      }

      const user = await options.verifyIdToken(
        body.idToken,
        c.env?.FIREBASE_PROJECT_ID
      );
      const sessionValue = await createSessionValue(user, sessionSecret);

      setCookie(c, SESSION_COOKIE_NAME, sessionValue, {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        secure: false,
        maxAge: 60 * 60 * 24 * 7
      });

      return c.json({
        authenticated: true,
        user
      });
    })
    .get("/session", async (c) => {
      const sessionSecret =
        c.env?.SESSION_SECRET ?? options.sessionSecret ?? DEFAULT_SESSION_SECRET;
      const sessionValue = getCookie(c, SESSION_COOKIE_NAME);
      const user = await readSessionValue(sessionValue, sessionSecret);

      if (!user) {
        return c.json({ authenticated: false }, 401);
      }

      return c.json({
        authenticated: true,
        user
      });
    })
    .post("/logout", async (c) => {
      deleteCookie(c, SESSION_COOKIE_NAME, {
        path: "/"
      });

      return c.json({ ok: true });
    });
}
