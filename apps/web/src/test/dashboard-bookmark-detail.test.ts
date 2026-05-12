import { describe, expect, it, vi } from "vitest";
import type { Bookmark, BookmarkExtractPreview } from "@bookmark/shared";

import {
  createBookmarkDetailPreviewCaches,
  getBookmarkDetailFieldRows,
  invalidateBookmarkDetailPreviewCache,
  resolveBookmarkDetailPreview
} from "../components/dashboard-bookmark-detail";

function createBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    id: overrides.id ?? "bookmark-1",
    folderId: overrides.folderId ?? null,
    tagIds: overrides.tagIds ?? [],
    url: overrides.url ?? "https://example.com",
    isFavorite: overrides.isFavorite ?? false,
    isHidden: overrides.isHidden ?? false,
    isTrashed: overrides.isTrashed ?? false,
    trashedAt: overrides.trashedAt ?? null,
    bookmarkColor: overrides.bookmarkColor ?? null,
    urlColor: overrides.urlColor ?? null,
    sourceTitle: overrides.sourceTitle ?? null,
    sourceContent: overrides.sourceContent ?? null,
    sourceSummary: overrides.sourceSummary ?? null,
    userTitle: overrides.userTitle ?? null,
    userContent: overrides.userContent ?? null,
    userSummary: overrides.userSummary ?? null,
    displayTitle: overrides.displayTitle ?? "Bookmark",
    displayContent: overrides.displayContent ?? "",
    displaySummary: overrides.displaySummary ?? "",
    createdAt: overrides.createdAt ?? "2026-04-27T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-27T00:00:00.000Z"
  };
}

function createPreview(overrides: Partial<BookmarkExtractPreview> = {}): BookmarkExtractPreview {
  return {
    url: overrides.url ?? "https://example.com",
    normalizedUrl: overrides.normalizedUrl ?? "https://example.com",
    sourceTitle: overrides.sourceTitle ?? "Preview title",
    sourceContent: overrides.sourceContent ?? "Preview content",
    sourceSummary: overrides.sourceSummary ?? "Preview summary",
    sourceImageUrl: overrides.sourceImageUrl,
    sourceBlocks: overrides.sourceBlocks,
    renderStatus: overrides.renderStatus,
    renderSource: overrides.renderSource,
    renderReason: overrides.renderReason
  };
}

describe("dashboard bookmark detail helpers", () => {
  it("builds sanitized source field rows and hides blank rows", () => {
    const bookmark = createBookmark({
      sourceTitle: "<strong>Saved title</strong>",
      sourceContent: "   ",
      sourceSummary: "One<br>Two"
    });

    expect(getBookmarkDetailFieldRows(bookmark, "source")).toEqual([
      { label: "제목", value: "Saved title" },
      { label: "요약", value: "One\nTwo" }
    ]);
  });

  it("deduplicates in-flight preview requests and caches resolved previews", async () => {
    const caches = createBookmarkDetailPreviewCaches();
    const loadBookmarkPreview = vi.fn(async () => createPreview({ sourceTitle: "Loaded once" }));
    const requestRenderedBookmarkPreview = vi.fn();

    const [firstResult, secondResult] = await Promise.all([
      resolveBookmarkDetailPreview("bookmark-1", caches, {
        loadBookmarkPreview,
        requestRenderedBookmarkPreview
      }),
      resolveBookmarkDetailPreview("bookmark-1", caches, {
        loadBookmarkPreview,
        requestRenderedBookmarkPreview
      })
    ]);
    const cachedResult = await resolveBookmarkDetailPreview("bookmark-1", caches, {
      loadBookmarkPreview,
      requestRenderedBookmarkPreview
    });

    expect(loadBookmarkPreview).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual(secondResult);
    expect(cachedResult).toEqual(firstResult);
  });

  it("uses extension-rendered previews for JavaScript-required pages and invalidates cached entries", async () => {
    const caches = createBookmarkDetailPreviewCaches();
    const onJsRequiredPreview = vi.fn();
    const loadBookmarkPreview = vi.fn(async () =>
      createPreview({
        normalizedUrl: "https://example.com/app",
        renderStatus: "js_required",
        sourceTitle: "Worker title"
      })
    );
    const requestRenderedBookmarkPreview = vi.fn(async () => ({
      status: "success" as const,
      presence: "installed" as const,
      preview: createPreview({
        renderStatus: "ready",
        renderSource: "extension",
        sourceTitle: "Rendered title"
      })
    }));

    const renderedResult = await resolveBookmarkDetailPreview("bookmark-1", caches, {
      loadBookmarkPreview,
      requestRenderedBookmarkPreview,
      onJsRequiredPreview
    });
    invalidateBookmarkDetailPreviewCache(caches, "bookmark-1");
    await resolveBookmarkDetailPreview("bookmark-1", caches, {
      loadBookmarkPreview,
      requestRenderedBookmarkPreview
    });

    expect(onJsRequiredPreview).toHaveBeenCalledTimes(1);
    expect(requestRenderedBookmarkPreview).toHaveBeenCalledWith("https://example.com/app");
    expect(renderedResult.preview.sourceTitle).toBe("Rendered title");
    expect(renderedResult.extensionPresence).toBe("installed");
    expect(loadBookmarkPreview).toHaveBeenCalledTimes(2);
  });
});
