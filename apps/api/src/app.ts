import { Hono } from "hono";

import { createFirebaseVerifier } from "./lib/auth/firebase";
import type { VerifyIdToken } from "./lib/auth/types";
import type { BookmarkAssetRepository } from "./lib/repositories/bookmark-assets";
import type { BookmarkRepository } from "./lib/repositories/bookmarks";
import type { FolderRepository } from "./lib/repositories/folders";
import type { TagRepository } from "./lib/repositories/tags";
import type { BookmarkAssetStorage } from "./lib/storage/assets";
import { healthRoute } from "./routes/health";
import { createAuthRoute } from "./routes/auth";
import { createBookmarkRoute } from "./routes/bookmarks";
import { createFolderRoute } from "./routes/folders";
import { createTagRoute } from "./routes/tags";

type CreateAppOptions = {
  verifyIdToken?: VerifyIdToken;
  sessionSecret?: string;
  bookmarkRepository?: BookmarkRepository;
  bookmarkAssetRepository?: BookmarkAssetRepository;
  assetStorage?: BookmarkAssetStorage;
  folderRepository?: FolderRepository;
  tagRepository?: TagRepository;
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
      bookmarkAssetRepository: options.bookmarkAssetRepository,
      assetStorage: options.assetStorage,
      sessionSecret: options.sessionSecret
    })
  );
  app.route(
    "/api/folders",
    createFolderRoute({
      folderRepository: options.folderRepository,
      sessionSecret: options.sessionSecret
    })
  );
  app.route(
    "/api/tags",
    createTagRoute({
      tagRepository: options.tagRepository,
      sessionSecret: options.sessionSecret
    })
  );

  return app;
}
