# Bookmark PWA + Extension Design

**Goal:** Make the bookmark product usable outside the desktop web session by adding installable PWA support for phones and a Chrome/Edge extension that can capture pages, selections, links, screenshots, and multiple images.

**Design Direction:** Keep one bookmark platform and one storage model. The web app, installed PWA, and extension should feel like different entry points into the same system rather than separate products.

**Product Thesis:** The web app remains the source of truth for editing and browsing. The extension becomes the fastest capture tool. The PWA becomes the lightweight mobile client. All three share the same bookmark, folder, tag, and asset model.

## Scope

### 1. Installable PWA

- Turn `apps/web` into an installable PWA using the already-installed `vite-plugin-pwa`.
- Provide a manifest, service worker, app icons, and install metadata.
- Support basic offline shell behavior so the app can open and render chrome even if data loading later fails.
- Keep API-backed bookmark data online-only for the first version; do not introduce offline sync yet.

### 2. Extension Platform

- Add a new `apps/extension` workspace for a Chrome/Edge Manifest V3 extension.
- Include:
  - popup UI
  - background service worker
  - content script
  - options page
  - context menu registrations
- Use the popup for full capture and tagging flows.
- Use context menus for fast capture flows.

### 3. Shared Capture Model

- Unify all capture paths into one bookmark creation pipeline:
  - page save
  - selected text save
  - image save
  - link save
  - screenshot save
  - pasted image save
  - multi-image upload
- All image-like inputs become bookmark assets.
- Selected text becomes bookmark draft content by default.
- The bookmark record is created first, then assets are uploaded and attached.

### 4. Image Input Expansion

- Replace the current “single pending upload feel” with a proper attachment queue in the web bookmark composer.
- Support in the web app and extension popup:
  - file picker
  - multiple files
  - clipboard paste
  - drag and drop
  - page image picking
  - screenshot capture
- Show thumbnails before save and allow removing individual items before upload.

### 5. Extension Authentication

- Do not reuse Firebase web session cookies inside the extension.
- Add an extension-specific token flow:
  - token create
  - token list/status
  - token revoke
- Store only hashed tokens server-side.
- Show the raw token only once when created.
- Let the user manage tokens from the web app.

### 6. Context Menu Behavior

- Register these menus in the extension:
  - page save
  - selection save
  - image save
  - link save
  - screenshot save
- Fast saves should use the extension’s default folder/tag settings when no popup confirmation is required.
- More complex saves should open the popup prefilled with the capture payload.

### 7. Popup Behavior

- The popup should show:
  - current page title
  - current page URL
  - selected text preview when present
  - chosen images and screenshot thumbnails
  - folder selector
  - tag selector
  - save action
- The popup should accept `Ctrl+V` image paste directly.
- The popup should allow multiple attachments to accumulate in a single queue.

### 8. Options Page Behavior

- Add extension settings for:
  - API base URL
  - extension access token
  - default folder
  - default tags
  - fast-save behavior
  - screenshot capture preference
- Make connection health visible so the user can verify that the extension can reach the deployed API.

## Architecture

### Web App / PWA

- Keep `apps/web` as the main UI.
- Add PWA manifest + service worker via Vite plugin.
- Add a reusable attachment queue component for the bookmark composer.
- Add a web settings surface for extension token issuance and revocation.

### API

- Keep current session-authenticated browser routes.
- Add extension-token-authenticated routes or auth middleware for extension calls.
- Reuse current bookmark and asset repositories where possible.
- Extend asset upload flows to handle multiple uploads consistently.

### Extension

- `background` handles context menus, screenshot capture, and API coordination.
- `content script` extracts selected text, page metadata, and image candidates from the active tab.
- `popup` edits the pending capture and submits to the API.
- `options page` manages persistent extension settings.

## Data Flow

### Page / Link / Selection Save

1. Extension gathers current tab metadata.
2. Optional selected text or clicked link/image data is added.
3. Popup or background submits bookmark payload to the API.
4. API creates bookmark.
5. If there are queued image assets, they upload next.

### Multi-Image / Paste / Screenshot Save

1. User adds images via file picker, paste, screenshot, or candidate selection.
2. UI stores them in a local attachment queue.
3. Bookmark is created first.
4. Assets upload one by one against the created bookmark.
5. UI refreshes bookmark assets after success.

## Error Handling

- Token-auth failures should surface as “extension reconnect needed”, not generic save failures.
- Partial asset failures should not discard an already-created bookmark.
- If bookmark creation succeeds and one asset upload fails, report which asset failed and keep the bookmark.
- Popup and web composer should both allow retrying failed uploads.
- PWA should degrade to the online experience if service worker registration fails; installability is not required for core browsing.

## Security Notes

- Extension tokens must be hashed at rest.
- Token scope is user-bound and limited to bookmark/folder/tag read-write for that user.
- Revoked tokens stop working immediately.
- Extension should never receive Firebase admin credentials or session secrets.

## Testing Plan

- Web tests:
  - multi-image queue
  - paste image flow
  - bookmark composer asset removal
  - extension-token management UI
  - PWA manifest/service-worker registration smoke tests
- API tests:
  - token issuance/revocation
  - token-protected bookmark creation
  - multi-asset upload success/failure behavior
  - screenshot/image upload authorization
- Extension tests:
  - popup state assembly
  - context menu dispatch
  - content script selection extraction
  - options page token persistence
- Verification:
  - `npm run test:web`
  - `npm run test:api`
  - extension-focused tests
  - `npm run build:web`
  - extension build

