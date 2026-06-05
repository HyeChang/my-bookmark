import { Hono } from "hono";

import { createFirebaseVerifier } from "./lib/auth/firebase";
import type { VerifyIdToken } from "./lib/auth/types";
import type { BookmarkAssetRepository } from "./lib/repositories/bookmark-assets";
import type { BookmarkActivityRepository } from "./lib/repositories/bookmark-activity";
import type { BookmarkRepository } from "./lib/repositories/bookmarks";
import type { ExtensionTokenRepository } from "./lib/repositories/extension-tokens";
import type { FolderRepository } from "./lib/repositories/folders";
import type { MemoAssetRepository } from "./lib/repositories/memo-assets";
import type { MemoFolderRepository } from "./lib/repositories/memo-folders";
import type { MemoLockRepository } from "./lib/repositories/memo-locks";
import type { MemoTagRepository } from "./lib/repositories/memo-tags";
import type { MemoRepository } from "./lib/repositories/memos";
import type { TagRepository } from "./lib/repositories/tags";
import type { BookmarkExtractor } from "./lib/extract/bookmark-extractor";
import type { BookmarkAssetStorage } from "./lib/storage/assets";
import { healthRoute } from "./routes/health";
import { createAuthRoute } from "./routes/auth";
import { createBookmarkRoute } from "./routes/bookmarks";
import { createExtensionTokenRoute } from "./routes/extension-tokens";
import { createFolderRoute } from "./routes/folders";
import { createMemoRoute } from "./routes/memos";
import { createRecommendationRoute } from "./routes/recommendations";
import { rumRoute } from "./routes/rum";
import { createTagRoute } from "./routes/tags";

type CreateAppOptions = {
  verifyIdToken?: VerifyIdToken;
  sessionSecret?: string;
  bookmarkRepository?: BookmarkRepository;
  bookmarkAssetRepository?: BookmarkAssetRepository;
  bookmarkActivityRepository?: BookmarkActivityRepository;
  memoRepository?: MemoRepository;
  memoFolderRepository?: MemoFolderRepository;
  memoLockRepository?: MemoLockRepository;
  memoTagRepository?: MemoTagRepository;
  memoAssetRepository?: MemoAssetRepository;
  assetStorage?: BookmarkAssetStorage;
  bookmarkExtractor?: BookmarkExtractor;
  folderRepository?: FolderRepository;
  tagRepository?: TagRepository;
  extensionTokenRepository?: ExtensionTokenRepository;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono();

  app.route("/api/health", healthRoute);
  app.route("/api/rum", rumRoute);
  app.route(
    "/api/auth",
    createAuthRoute({
      verifyIdToken: options.verifyIdToken ?? createFirebaseVerifier(),
      sessionSecret: options.sessionSecret
    })
  );
  app.route(
    "/api/extension-tokens",
    createExtensionTokenRoute({
      extensionTokenRepository: options.extensionTokenRepository,
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
      folderRepository: options.folderRepository,
      extensionTokenRepository: options.extensionTokenRepository,
      sessionSecret: options.sessionSecret
    })
  );
  app.route(
    "/api/memos",
    createMemoRoute({
      memoRepository: options.memoRepository,
      memoFolderRepository: options.memoFolderRepository,
      memoLockRepository: options.memoLockRepository,
      memoTagRepository: options.memoTagRepository,
      memoAssetRepository: options.memoAssetRepository,
      assetStorage: options.assetStorage,
      extensionTokenRepository: options.extensionTokenRepository,
      sessionSecret: options.sessionSecret
    })
  );
  app.route(
    "/api/folders",
    createFolderRoute({
      folderRepository: options.folderRepository,
      extensionTokenRepository: options.extensionTokenRepository,
      sessionSecret: options.sessionSecret
    })
  );
  app.route(
    "/api/tags",
    createTagRoute({
      tagRepository: options.tagRepository,
      extensionTokenRepository: options.extensionTokenRepository,
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
