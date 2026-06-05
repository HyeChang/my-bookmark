# Bookmark PWA + Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add installable PWA support, a Chrome/Edge MV3 extension, extension token auth, and a shared multi-image capture pipeline across the web app and extension.

**Architecture:** Extend the existing React web app in place for PWA installability, attachment queue UX, and extension-token management. Add server-side token issuance and token-auth middleware in the Worker API. Create a new `apps/extension` MV3 workspace that captures tab context, selected text, screenshots, pasted images, and uploads them through the same bookmark + asset pipeline used by the web app.

**Tech Stack:** React, TypeScript, CSS, Cloudflare Workers, D1, R2, Vite, vite-plugin-pwa, Vitest, Testing Library, Chrome/Edge Manifest V3

---

### Task 1: Save the approved design and implementation plan

**Files:**
- Create: `docs/plans/2026-04-17-pwa-extension-design.md`
- Create: `docs/plans/2026-04-17-pwa-extension.md`

**Step 1: Save the design doc**

Write the approved PWA, extension, auth, and capture-flow design into the design file.

**Step 2: Save the implementation plan**

Write this plan into `docs/plans/2026-04-17-pwa-extension.md`.

**Step 3: Verify the docs exist**

Run: `Get-ChildItem docs/plans | Select-String '2026-04-17-pwa-extension'`
Expected: both files are listed

### Task 2: Add the failing API tests for extension token auth

**Files:**
- Modify: `apps/api/test/auth.test.ts`
- Modify: `apps/api/test/bookmarks-routes.test.ts`
- Modify: `apps/api/test/folders-tags-routes.test.ts`
- Create: `apps/api/test/extension-tokens-routes.test.ts`

**Step 1: Write token route tests**

Add tests for:
- issuing a token
- listing token metadata without exposing raw token values
- revoking a token

**Step 2: Write token-auth bookmark tests**

Add tests proving that:
- extension-authenticated requests can create bookmarks
- revoked tokens fail
- invalid tokens fail

**Step 3: Run focused API tests to verify they fail**

Run: `npm run test:api -- extension-tokens-routes.test.ts bookmarks-routes.test.ts auth.test.ts`
Expected: FAIL because token routes and token-auth middleware do not exist yet

### Task 3: Add the extension token data model and API routes

**Files:**
- Create: `apps/api/migrations/0004_extension_tokens.sql`
- Modify: `packages/shared/src/index.ts`
- Create: `apps/api/src/lib/repositories/extension-tokens.ts`
- Create: `apps/api/src/routes/extension-tokens.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/src/routes/bookmarks.ts`
- Modify: `apps/api/src/routes/folders.ts`
- Modify: `apps/api/src/routes/tags.ts`

**Step 1: Add the D1 schema**

Create a table for extension tokens with:
- id
- user id
- label
- hashed token
- created/updated timestamps
- revoked timestamp or active flag

**Step 2: Add shared request/response types**

Define token-management and token-auth request/response shapes in `packages/shared`.

**Step 3: Implement repository helpers**

Add create/list/revoke/find-by-hash operations.

**Step 4: Add token-management routes**

Expose authenticated browser routes for issuing, listing, and revoking extension tokens.

**Step 5: Add token-auth middleware path**

Allow extension requests to authenticate with `Authorization: Bearer <token>` without using browser session cookies.

**Step 6: Run focused API tests**

Run: `npm run test:api -- extension-tokens-routes.test.ts bookmarks-routes.test.ts auth.test.ts`
Expected: token tests pass or move to the next missing area

### Task 4: Add failing web tests for multi-image and pasted-image support

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`
- Modify: `apps/web/src/test/api-client.test.ts`

**Step 1: Write composer attachment queue tests**

Add tests that assert:
- multiple image files can be queued before save
- pasted clipboard images are added to the queue
- queued images can be removed before save

**Step 2: Write token-management UI tests**

Add tests for:
- opening extension token settings
- creating a token
- revoking a token

**Step 3: Run focused web tests to verify they fail**

Run: `npm run test:web -- bookmark-dashboard.test.tsx api-client.test.ts`
Expected: FAIL because queue UI and token UI do not exist yet

### Task 5: Build the shared attachment queue for the web app

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Create: `apps/web/src/lib/clipboard-images.ts`
- Modify: `apps/web/src/lib/bookmark-assets.ts`

**Step 1: Add attachment queue state**

Track multiple pending assets in bookmark composer state rather than a single loose file list.

**Step 2: Support file picker and drag/drop**

Allow multiple files to be added into the same queue.

**Step 3: Support paste**

Read image blobs from the clipboard and enqueue them.

**Step 4: Add thumbnail preview and removal**

Show queued thumbnails and let the user remove individual items.

**Step 5: Upload all queued assets after bookmark create/update**

Keep the current bookmark create flow but upload queued assets sequentially after bookmark creation succeeds.

**Step 6: Run focused web tests**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: queue-related tests pass

### Task 6: Add extension token management to the web UI

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Create: `apps/web/src/lib/extension-tokens.ts`

**Step 1: Add a settings surface**

Expose a manageable UI for:
- creating a token
- showing token metadata
- revoking a token

**Step 2: Keep raw token display one-time only**

Show the raw token only at creation time and instruct the user to copy it immediately.

**Step 3: Run focused tests**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: token-management UI tests pass

### Task 7: Convert the web app into an installable PWA

**Files:**
- Modify: `apps/web/vite.config.ts`
- Create: `apps/web/public/manifest.webmanifest`
- Create: `apps/web/public/icons/icon-192.png`
- Create: `apps/web/public/icons/icon-512.png`
- Create: `apps/web/src/pwa/register.ts`
- Modify: `apps/web/src/main.tsx`

**Step 1: Configure vite-plugin-pwa**

Enable manifest + service worker generation for `apps/web`.

**Step 2: Add install metadata**

Provide app name, icons, theme colors, and standalone display mode.

**Step 3: Register the service worker**

Add client-side registration without blocking app startup.

**Step 4: Add lightweight install UX**

Surface an install hint or install action where appropriate without disturbing the current layout.

**Step 5: Run web tests and build**

Run: `npm run test:web`
Expected: PASS

Run: `npm run build:web`
Expected: PASS

### Task 8: Scaffold the extension workspace

**Files:**
- Create: `apps/extension/package.json`
- Create: `apps/extension/tsconfig.json`
- Create: `apps/extension/vite.config.ts`
- Create: `apps/extension/manifest.json`
- Create: `apps/extension/src/background.ts`
- Create: `apps/extension/src/content.ts`
- Create: `apps/extension/src/popup/index.html`
- Create: `apps/extension/src/popup/main.tsx`
- Create: `apps/extension/src/options/index.html`
- Create: `apps/extension/src/options/main.tsx`

**Step 1: Create the MV3 skeleton**

Add popup, background, content script, and options page entries.

**Step 2: Add an extension build command**

Update the root workspace scripts so the extension can build independently.

**Step 3: Run the extension build to verify the scaffold**

Run: `npm run build --workspace apps/extension`
Expected: build succeeds with an empty or placeholder extension bundle

### Task 9: Implement popup capture state and options-page settings

**Files:**
- Modify: `apps/extension/src/popup/main.tsx`
- Modify: `apps/extension/src/options/main.tsx`
- Create: `apps/extension/src/lib/storage.ts`
- Create: `apps/extension/src/lib/api.ts`
- Create: `apps/extension/src/lib/capture.ts`

**Step 1: Add token and settings persistence**

Store extension token, API base URL, default folder, default tags, and fast-save settings in extension storage.

**Step 2: Build popup capture UI**

Show:
- title
- URL
- selected text
- folder selector
- tag selector
- queued images

**Step 3: Support image paste and local file selection**

Allow the popup to collect multiple images into one queue.

**Step 4: Save through the token-auth API**

Create bookmark first, then upload queued assets.

**Step 5: Run extension-focused tests or targeted checks**

Run the extension test command if added, or at minimum build the extension.
Expected: popup and options compile cleanly

### Task 10: Implement context menus, content extraction, and screenshot capture

**Files:**
- Modify: `apps/extension/src/background.ts`
- Modify: `apps/extension/src/content.ts`
- Create: `apps/extension/src/lib/context-menus.ts`
- Create: `apps/extension/src/lib/screenshot.ts`

**Step 1: Register context menus**

Add:
- page save
- selection save
- image save
- link save
- screenshot save

**Step 2: Extract tab and selection data**

Use content scripts and tab messaging to gather selected text, image candidates, and page metadata.

**Step 3: Add screenshot capture**

Capture the visible tab and treat the image as another queued asset.

**Step 4: Support fast-save vs popup-save**

Use default settings for immediate saves; otherwise open or route through popup state.

**Step 5: Run extension build**

Run: `npm run build --workspace apps/extension`
Expected: PASS

### Task 11: Final verification

**Files:**
- Modify: `apps/api/...`
- Modify: `apps/web/...`
- Modify: `apps/extension/...`

**Step 1: Run the full web suite**

Run: `npm run test:web`
Expected: PASS

**Step 2: Run the full API suite**

Run: `npm run test:api`
Expected: PASS

**Step 3: Build the web app**

Run: `npm run build:web`
Expected: PASS

**Step 4: Build the extension**

Run: `npm run build --workspace apps/extension`
Expected: PASS

**Step 5: Manual verification**

Check:
- PWA install prompt or installability
- extension token creation
- popup save
- context menu save
- selected text capture
- multi-image file save
- pasted image save
- screenshot save

