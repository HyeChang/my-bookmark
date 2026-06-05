# Bookmark JS Rendered Extract Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a zero-extra-server-cost fallback path that uses the installed browser extension to extract rendered SPA content when Worker HTML extraction only returns metadata or JavaScript fallback text.

**Architecture:** Keep Worker extraction as the first pass and add explicit quality signals to `BookmarkExtractPreview`. When the Worker marks a preview as `js_required`, the web app requests a rendered preview through the existing extension bridge. The extension opens an inactive tab, waits for page completion, extracts DOM content in the content script, and posts a preview result back to the web app.

**Tech Stack:** TypeScript, React, Vitest, Hono, Chrome extension MV3, Cloudflare Workers.

---

### Task 1: Add Worker extraction quality signals

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/lib/extract/bookmark-extractor.ts`
- Test: `apps/api/test/bookmark-extractor.test.ts`
- Test: `apps/api/test/bookmark-extract-routes.test.ts`

**Step 1: Write the failing extractor tests**

Add unit tests that feed SPA-style HTML into `extractBookmarkPreviewFromHtml()` and verify:

- `sourceImageUrl` still comes from meta tags
- `sourceContent` does not keep `You need to enable JavaScript to run this app.`
- `renderStatus` becomes `"js_required"`
- `renderReason` becomes `"spa_fallback"`

Also add a route-level test that confirms `/api/bookmarks/extract` returns the same `renderStatus` fields.

**Step 2: Run tests to verify they fail**

Run: `npm run test:api -- bookmark-extractor.test.ts bookmark-extract-routes.test.ts`

Expected: FAIL because `BookmarkExtractPreview` does not expose render status fields and the extractor does not classify fallback HTML yet.

**Step 3: Extend shared preview types**

In `packages/shared/src/index.ts`, add specific fields to `BookmarkExtractPreview`:

- `renderStatus?: "ready" | "js_required"`
- `renderSource?: "worker" | "extension"`
- `renderReason?: "spa_fallback" | "thin_content" | "missing_article"`

Keep them optional so existing callers compile while the implementation is completed.

**Step 4: Implement Worker classification**

In `apps/api/src/lib/extract/bookmark-extractor.ts`:

- add a small set of known SPA fallback markers
- strip those markers from `sourceContent` and `sourceBlocks`
- classify thin metadata-only responses as `js_required`
- set `renderSource` to `"worker"` for Worker-produced previews

Do not throw for these pages. Return the best metadata available.

**Step 5: Run tests to verify they pass**

Run: `npm run test:api -- bookmark-extractor.test.ts bookmark-extract-routes.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/shared/src/index.ts apps/api/src/lib/extract/bookmark-extractor.ts apps/api/test/bookmark-extractor.test.ts apps/api/test/bookmark-extract-routes.test.ts
git commit -m "feat: classify worker previews that need js rendering"
```

### Task 2: Build DOM-based rendered preview extraction in the extension

**Files:**
- Create: `apps/extension/src/lib/rendered-preview.ts`
- Test: `apps/extension/src/lib/rendered-preview.test.ts`

**Step 1: Write the failing extension extractor tests**

Add tests for a DOM extraction helper that:

- prefers `article` over `main` and `body`
- extracts heading, paragraph, and image blocks in reading order
- ignores `script`, `style`, `noscript`, and obvious fallback text
- returns a `BookmarkExtractPreview` with `renderSource: "extension"` and `renderStatus: "ready"`

**Step 2: Run tests to verify they fail**

Run: `npm run test --workspace apps/extension -- rendered-preview.test.ts`

Expected: FAIL because `rendered-preview.ts` does not exist yet.

**Step 3: Implement the DOM extractor**

Create `apps/extension/src/lib/rendered-preview.ts` with a pure helper that receives `Document` + `url` and returns `BookmarkExtractPreview`. Reuse the same block shape as shared preview results and keep sanitizing logic local to this helper.

**Step 4: Run tests to verify they pass**

Run: `npm run test --workspace apps/extension -- rendered-preview.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/extension/src/lib/rendered-preview.ts apps/extension/src/lib/rendered-preview.test.ts
git commit -m "feat: add rendered dom preview extractor for extension"
```

### Task 3: Wire extension bridge and background tab orchestration

**Files:**
- Create: `apps/extension/src/lib/rendered-preview-session.ts`
- Test: `apps/extension/src/lib/rendered-preview-session.test.ts`
- Modify: `apps/extension/src/lib/web-bridge.ts`
- Modify: `apps/extension/src/lib/web-bridge.test.ts`
- Modify: `apps/extension/src/content.ts`
- Modify: `apps/extension/src/background.ts`

**Step 1: Write the failing bridge/session tests**

Add tests that verify:

- the web bridge accepts `bookmark-extension:extract-preview`
- the content script relays the request to the runtime
- the background/session helper opens an inactive tab, waits for completion, requests DOM extraction from that tab, and closes the tab
- success posts `bookmark-extension:preview-result`
- timeout or extraction failure posts `bookmark-extension:preview-failed`

**Step 2: Run tests to verify they fail**

Run: `npm run test --workspace apps/extension -- rendered-preview-session.test.ts web-bridge.test.ts`

Expected: FAIL because the bridge message types and background workflow do not exist.

**Step 3: Implement background session helper**

Create `apps/extension/src/lib/rendered-preview-session.ts` to isolate the MV3 tab lifecycle:

- create inactive tab
- wait for `tabs.onUpdated` complete state
- send `bookmark:extract-rendered-preview` to the tab
- enforce a timeout
- close the tab in `finally`

Keep direct Chrome API access in this helper so `background.ts` stays thin.

**Step 4: Extend the content script**

In `apps/extension/src/content.ts`:

- keep existing presence/configuration behavior
- add a runtime message handler for `bookmark:extract-rendered-preview`
- call the new DOM extractor against the current document and return the preview payload

**Step 5: Extend the page bridge**

In `apps/extension/src/lib/web-bridge.ts`:

- recognize extract-preview requests from the web app
- call a provided `extractPreview(url)` async option
- post back `bookmark-extension:preview-result` or `bookmark-extension:preview-failed`
- keep existing ping/configure behavior unchanged

Update `apps/extension/src/lib/web-bridge.test.ts` for the new message flow.

**Step 6: Connect the background entrypoint**

In `apps/extension/src/background.ts`, import the session helper and register a runtime listener that serves the bridge-triggered extract requests.

**Step 7: Run tests to verify they pass**

Run: `npm run test --workspace apps/extension -- rendered-preview-session.test.ts web-bridge.test.ts`

Expected: PASS.

**Step 8: Commit**

```bash
git add apps/extension/src/lib/rendered-preview-session.ts apps/extension/src/lib/rendered-preview-session.test.ts apps/extension/src/lib/web-bridge.ts apps/extension/src/lib/web-bridge.test.ts apps/extension/src/content.ts apps/extension/src/background.ts
git commit -m "feat: bridge rendered preview extraction through extension"
```

### Task 4: Add web fallback orchestration for composer and detail preview

**Files:**
- Modify: `apps/web/src/lib/extension-presence.ts`
- Modify: `apps/web/src/test/extension-presence.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing web tests**

Add tests that cover:

- `URL 메타 불러오기` calls the extension bridge when Worker preview returns `renderStatus: "js_required"` and the extension is installed
- the extension result replaces Worker fallback text in the composer preview
- the detail `미리보기` tab also retries through the extension for `js_required` previews
- when the extension is missing or fails, the Worker metadata remains visible and a fallback notice is shown

Add unit tests for a new bridge request helper in `extension-presence.ts` that sends a request id and resolves the matching result.

**Step 2: Run tests to verify they fail**

Run: `npm run test:web -- extension-presence.test.ts bookmark-dashboard.test.tsx`

Expected: FAIL because the web bridge has no extract-preview request helper and `App.tsx` does not branch on `renderStatus`.

**Step 3: Add a web extract-preview bridge helper**

In `apps/web/src/lib/extension-presence.ts`, add a promise-based request helper such as `requestBookmarkExtensionPreview(url)` that:

- posts `bookmark-extension:extract-preview`
- waits for `preview-result` / `preview-failed`
- filters by request id and same-origin bridge rules
- times out cleanly

**Step 4: Integrate the composer flow**

In `apps/web/src/App.tsx`, update `handleExtractBookmarkPreview()` so it:

- keeps the Worker request as the first pass
- checks `preview.renderStatus`
- requests extension extraction only when status is `js_required` and the extension is installed
- stores the best final preview in `bookmarkPreview`
- keeps fallback UI for missing extension and failed extension extraction

**Step 5: Integrate the detail preview flow**

Reuse the same fallback logic for `loadBookmarkPreview()` results in the detail panel. The detail panel should display the rendered extension preview first when available without mutating persisted bookmark data unless the user later saves/reextracts.

**Step 6: Run tests to verify they pass**

Run: `npm run test:web -- extension-presence.test.ts bookmark-dashboard.test.tsx`

Expected: PASS.

**Step 7: Commit**

```bash
git add apps/web/src/lib/extension-presence.ts apps/web/src/test/extension-presence.test.ts apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: retry js-required previews through extension"
```

### Task 5: Final verification

**Files:**
- Existing project files only

**Step 1: Run focused API tests**

Run: `npm run test:api -- bookmark-extractor.test.ts bookmark-extract-routes.test.ts`

Expected: PASS.

**Step 2: Run focused extension tests**

Run: `npm run test --workspace apps/extension -- rendered-preview.test.ts rendered-preview-session.test.ts web-bridge.test.ts`

Expected: PASS.

**Step 3: Run focused web tests**

Run: `npm run test:web -- extension-presence.test.ts bookmark-dashboard.test.tsx`

Expected: PASS.

**Step 4: Run the build**

Run: `npm run build:web`

Expected: PASS.

**Step 5: Smoke-check the desktop flow**

Manual check:

- install the latest extension build
- open the web app on desktop
- request metadata for a known SPA page
- confirm the fallback text is gone and the rendered content appears
- repeat in the detail `미리보기` tab
