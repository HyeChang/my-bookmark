import type { Bookmark, BookmarkExtractPreview } from "@bookmark/shared";

import type { BookmarkExtensionPresenceStatus } from "../lib/extension-presence";
import {
  getBookmarkPreviewWorkerFallbackMessage,
  hasTextContent,
  isJsRequiredBookmarkPreview,
  sanitizeExtractedDisplayText
} from "./bookmark-preview-utils";

export type BookmarkDetailPreviewResult = {
  preview: BookmarkExtractPreview;
  notice: string | null;
  extensionPresence: BookmarkExtensionPresenceStatus | null;
};

export type BookmarkExtensionRenderedPreviewAttempt =
  | {
      status: "success";
      presence: "installed";
      preview: BookmarkExtractPreview;
    }
  | {
      status: "missing" | "failed";
      presence: BookmarkExtensionPresenceStatus;
    };

export type BookmarkDetailPreviewCaches = {
  previewCache: Map<string, BookmarkDetailPreviewResult>;
  previewPromises: Map<string, Promise<BookmarkDetailPreviewResult>>;
};

type ResolveBookmarkDetailPreviewOptions = {
  loadBookmarkPreview: (bookmarkId: string) => Promise<BookmarkExtractPreview>;
  requestRenderedBookmarkPreview: (
    url: string
  ) => Promise<BookmarkExtensionRenderedPreviewAttempt>;
  onJsRequiredPreview?: () => void;
};

export function createBookmarkDetailPreviewCaches(): BookmarkDetailPreviewCaches {
  return {
    previewCache: new Map(),
    previewPromises: new Map()
  };
}

export function getBookmarkDetailFieldRows(bookmark: Bookmark, mode: "user" | "source") {
  const rows =
    mode === "user"
      ? [
          { label: "제목", value: bookmark.userTitle },
          { label: "내용", value: bookmark.userContent },
          { label: "요약", value: bookmark.userSummary }
        ]
      : [
          { label: "제목", value: bookmark.sourceTitle },
          { label: "내용", value: bookmark.sourceContent },
          { label: "요약", value: bookmark.sourceSummary }
        ];

  return rows
    .map((row) => ({
      ...row,
      value: mode === "source" ? sanitizeExtractedDisplayText(row.value) : row.value
    }))
    .filter((row): row is { label: string; value: string } => hasTextContent(row.value));
}

export function invalidateBookmarkDetailPreviewCache(
  caches: BookmarkDetailPreviewCaches,
  bookmarkId?: string
) {
  if (!bookmarkId) {
    caches.previewCache.clear();
    caches.previewPromises.clear();
    return;
  }

  caches.previewCache.delete(bookmarkId);
  caches.previewPromises.delete(bookmarkId);
}

export async function resolveBookmarkDetailPreview(
  bookmarkId: string,
  caches: BookmarkDetailPreviewCaches,
  options: ResolveBookmarkDetailPreviewOptions
) {
  const cachedPreview = caches.previewCache.get(bookmarkId);
  if (cachedPreview) {
    return cachedPreview;
  }

  const inFlightPreview = caches.previewPromises.get(bookmarkId);
  if (inFlightPreview) {
    return inFlightPreview;
  }

  const previewPromise = (async (): Promise<BookmarkDetailPreviewResult> => {
    const preview = await options.loadBookmarkPreview(bookmarkId);
    let resolvedPreview = preview;
    let previewNotice: string | null = null;
    let extensionPresence: BookmarkExtensionPresenceStatus | null = null;

    if (isJsRequiredBookmarkPreview(preview)) {
      options.onJsRequiredPreview?.();
      const renderedPreview = await options.requestRenderedBookmarkPreview(
        preview.normalizedUrl || preview.url
      );
      extensionPresence = renderedPreview.presence;

      if (renderedPreview.status === "success") {
        resolvedPreview = renderedPreview.preview;
      } else {
        previewNotice = getBookmarkPreviewWorkerFallbackMessage(renderedPreview.status);
      }
    }

    return {
      preview: resolvedPreview,
      notice: previewNotice,
      extensionPresence
    };
  })();

  caches.previewPromises.set(bookmarkId, previewPromise);

  try {
    const previewResult = await previewPromise;
    if (caches.previewPromises.get(bookmarkId) === previewPromise) {
      caches.previewCache.set(bookmarkId, previewResult);
    }
    return previewResult;
  } finally {
    if (caches.previewPromises.get(bookmarkId) === previewPromise) {
      caches.previewPromises.delete(bookmarkId);
    }
  }
}
