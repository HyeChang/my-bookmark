import { Hono } from "hono";

import { createFirebaseVerifier } from "./lib/auth/firebase";
import type { VerifyIdToken } from "./lib/auth/types";
import type { BookmarkAssetRepository } from "./lib/repositories/bookmark-assets";
import type { BookmarkActivityRepository } from "./lib/repositories/bookmark-activity";
import type { BookmarkRepository } from "./lib/repositories/bookmarks";
import type { FolderRepository } from "./lib/repositories/folders";
import type { TagRepository } from "./lib/repositories/tags";
import type { BookmarkExtractor } from "./lib/extract/bookmark-extractor";
import type { BookmarkAssetStorage } from "./lib/storage/assets";
import { healthRoute } from "./routes/health";
import { createAuthRoute } from "./routes/auth";
import { createBookmarkRoute } from "./routes/bookmarks";
import { createFolderRoute } from "./routes/folders";
import { createRecommendationRoute } from "./routes/recommendations";
import { createTagRoute } from "./routes/tags";

type CreateAppOptions = {
  verifyIdToken?: VerifyIdToken;
  sessionSecret?: string;
  bookmarkRepository?: BookmarkRepository;
  bookmarkAssetRepository?: BookmarkAssetRepository;
  bookmarkActivityRepository?: BookmarkActivityRepository;
  assetStorage?: BookmarkAssetStorage;
  bookmarkExtractor?: BookmarkExtractor;
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
      bookmarkActivityRepository: options.bookmarkActivityRepository,
      assetStorage: options.assetStorage,
      bookmarkExtractor: options.bookmarkExtractor,
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
  app.route(
    "/api/recommendations",
    createRecommendationRoute({
      bookmarkRepository: options.bookmarkRepository,
      bookmarkActivityRepository: options.bookmarkActivityRepository,
      sessionSecret: options.sessionSecret
    })
  );

  return app;
}
