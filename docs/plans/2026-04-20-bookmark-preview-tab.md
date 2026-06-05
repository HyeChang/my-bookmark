# Bookmark Preview Tab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a detail-panel `미리보기` tab that fetches a fresh crawled preview every time it is opened while keeping existing automatic extraction behavior unchanged.

**Architecture:** Reuse the existing `BookmarkExtractor` for fresh preview reads through a new authenticated bookmark-specific API endpoint. Keep persisted `source*` fields unchanged unless the existing reextract action is used. Split the React detail panel into `상세` and `미리보기` tab panels with request-id guarded loading state.

**Tech Stack:** TypeScript, React, Vite, Vitest, Hono, Cloudflare D1 test doubles.

---

### Task 1: API preview endpoint

**Files:**
- Modify: `apps/api/src/routes/bookmarks.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/api/test/bookmark-extract-routes.test.ts`

**Step 1: Write the failing API test**

Add a test that creates an app with a fake bookmark repository and fake extractor, requests `GET /api/bookmarks/bookmark-preview/preview`, and verifies:

- response status is `200`
- response body has `preview.sourceTitle`
- extractor receives the stored bookmark URL
- repository `update` is not called

**Step 2: Run test to verify it fails**

Run: `npm run test:api -- bookmark-extract-routes.test.ts`

Expected: FAIL because `/api/bookmarks/:bookmarkId/preview` does not exist.

**Step 3: Add shared response type**

Export `BookmarkPreviewResponse = { preview: BookmarkExtractPreview }` from `packages/shared/src/index.ts`.

**Step 4: Implement endpoint**

In `apps/api/src/routes/bookmarks.ts`, add `GET /:bookmarkId/preview` before broader dynamic routes that could capture it incorrectly. Authenticate user, load bookmark by user/id, reject missing bookmarks, then call `bookmarkExtractor.extract(bookmark.url)` and return `{ preview }`. Map invalid/non-HTML/fetch failures using the same error codes as existing extraction routes.

**Step 5: Run API test**

Run: `npm run test:api -- bookmark-extract-routes.test.ts`

Expected: PASS.

### Task 2: Web client preview loader

**Files:**
- Modify: `apps/web/src/lib/bookmarks.ts`
- Test: `apps/web/src/test/api-client.test.ts`

**Step 1: Write the failing client test**

Add a test for `loadBookmarkPreview("bookmark-preview")` that expects a GET request to `/api/bookmarks/bookmark-preview/preview` with `credentials: "include"` and returns the `preview` payload.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- api-client.test.ts`

Expected: FAIL because `loadBookmarkPreview` is not exported.

**Step 3: Implement client loader**

Import `BookmarkExtractPreview` and `BookmarkPreviewResponse`, add error mapping for preview failures, and export `loadBookmarkPreview(bookmarkId: string)`.

**Step 4: Run web client test**

Run: `npm run test:web -- api-client.test.ts`

Expected: PASS.

### Task 3: Detail panel tabs and fresh preview behavior

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Test: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write failing UI tests**

Add tests that open a bookmark detail panel and verify:

- the detail panel has `상세` and `미리보기` tabs
- the `상세` tab does not render the old `자동 추출` block
- clicking `미리보기` shows saved automatic extraction values in that tab
- each click/open of `미리보기` calls `/api/bookmarks/:id/preview` again and displays the latest returned source title/content/summary
- a preview API failure leaves the panel open and shows an error inside the preview tab

**Step 2: Run UI tests to verify they fail**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: FAIL because the tabs and fresh preview loader do not exist yet.

**Step 3: Add preview tab state**

In `App.tsx`, add:

- `BookmarkDetailTab = "detail" | "preview"`
- active tab state
- live preview state keyed by bookmark id
- loading/error state
- request id ref for stale-response protection

Reset these states when closing detail or switching selected bookmark.

**Step 4: Implement tab UI**

Add a tablist inside the detail card. Keep existing header, metadata, assets, and actions. Move the saved automatic extraction rows into the `미리보기` panel. Keep user rows and image assets in the `상세` panel.

**Step 5: Implement fresh preview fetch**

When the preview tab is activated, call `loadBookmarkPreview(visibleSelectedBookmark.id)` every time. Display live preview first on success. Display loading and error states inside the preview panel. Do not mutate `bookmarks`, `selectedBookmark`, or `source*` persisted fields with live preview data.

**Step 6: Add CSS**

Style the detail tabs as compact segmented controls that match the existing restrained app surface. Add stable panel spacing and keep text wrapping within the detail rail/dialog.

**Step 7: Run UI tests**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS.

### Task 4: Verification

**Files:**
- Existing project files only

**Step 1: Run focused API tests**

Run: `npm run test:api -- bookmark-extract-routes.test.ts`

Expected: PASS.

**Step 2: Run focused web tests**

Run: `npm run test:web -- api-client.test.ts bookmark-dashboard.test.tsx`

Expected: PASS.

**Step 3: Run build**

Run: `npm run build:web`

Expected: PASS.
