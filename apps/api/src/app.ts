import { Hono } from "hono";

import { createFirebaseVerifier } from "./lib/auth/firebase";
import type { VerifyIdToken } from "./lib/auth/types";
import type { BookmarkRepository } from "./lib/repositories/bookmarks";
import { healthRoute } from "./routes/health";
import { createAuthRoute } from "./routes/auth";
import { createBookmarkRoute } from "./routes/bookmarks";

type CreateAppOptions = {
  verifyIdToken?: VerifyIdToken;
  sessionSecret?: string;
  bookmarkRepository?: BookmarkRepository;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono();

  app.route("/api/health", healthRoute);
  app.route(
    "/api/auth",
    createAuthRoute({
      verifyIdToken: options.verifyIdToken ?? createFirebaseVerifier(),
      sessionSecret: options.sessionSecret
    })
  );
  app.route(
    "/api/bookmarks",
    createBookmarkRoute({
      bookmarkRepository: options.bookmarkRepository,
      sessionSecret: options.sessionSecret
    })
  );

  return app;
}
