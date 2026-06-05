# Independent Memo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an independent memo workspace with rich-text JSON content, hierarchical memo folders, tags, list/card views, multi-image compressed attachments, and in-note search.

**Architecture:** Add memo-specific database tables, repositories, and `/api/memos` routes that do not share bookmark entities. Load the memo workspace, composer, and rich editor lazily from the authenticated dashboard. Store editor content as sanitized JSON plus plain text for list/search, and upload compressed memo images plus thumbnails to the existing R2 bucket under a `memo-assets/` key prefix.

**Tech Stack:** TypeScript, React, Vite, Vitest, Hono, Cloudflare D1, Cloudflare R2, Tiptap/ProseMirror.

---

### Task 1: Add shared memo contracts and D1 migration

**Files:**
- Modify: `packages/shared/src/index.ts`
- Create: `apps/api/migrations/0008_memos.sql`
- Test: `apps/api/test/memo-schema.test.ts`

**Step 1: Write the failing schema/type test**

Create `apps/api/test/memo-schema.test.ts` that reads `apps/api/migrations/0008_memos.sql` and asserts it contains:

- `CREATE TABLE memo_folders`
- `CREATE TABLE memos`
- `CREATE TABLE memo_tags`
- `CREATE TABLE memo_tag_links`
- `CREATE TABLE memo_assets`
- `content_json TEXT NOT NULL`
- `content_text TEXT NOT NULL`
- `parent_folder_id TEXT`
- `memo_id TEXT NOT NULL`
- `object_key TEXT NOT NULL`
- `thumbnail_object_key TEXT NOT NULL`

**Step 2: Run test to verify it fails**

Run: `npm run test:api -- memo-schema.test.ts`

Expected: FAIL because the migration does not exist.

**Step 3: Extend shared types**

In `packages/shared/src/index.ts`, add:

```ts
export type MemoSortMode = "updated_desc" | "updated_asc" | "title_asc" | "title_desc";
export type MemoViewMode = "list" | "card";

export type MemoRichContent = {
  type: "doc";
  content?: unknown[];
};

export type Memo = {
  id: string;
  folderId: string | null;
  tagIds: string[];
  title: string;
  contentJson: MemoRichContent;
  contentText: string;
  isFavorite: boolean;
  memoColor: string | null;
  assetCount: number;
  coverAsset: MemoAsset | null;
  createdAt: string;
  updatedAt: string;
};

export type MemoFolder = {
  id: string;
  parentFolderId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type MemoTag = {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemoAsset = {
  id: string;
  memoId: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
  contentUrl: string;
  thumbnailUrl: string;
  createdAt: string;
  updatedAt: string;
};
```

Also add request/response types for memo, memo folder, memo tag, and memo asset create/update/list responses.

**Step 4: Add migration**

Create `apps/api/migrations/0008_memos.sql` with:

```sql
CREATE TABLE memo_folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  parent_folder_id TEXT,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (parent_folder_id) REFERENCES memo_folders(id)
);

CREATE TABLE memos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_id TEXT,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  content_text TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  memo_color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (folder_id) REFERENCES memo_folders(id)
);

CREATE TABLE memo_tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE memo_tag_links (
  memo_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (memo_id, tag_id),
  FOREIGN KEY (memo_id) REFERENCES memos(id),
  FOREIGN KEY (tag_id) REFERENCES memo_tags(id)
);

CREATE TABLE memo_assets (
  id TEXT PRIMARY KEY,
  memo_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  thumbnail_object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (memo_id) REFERENCES memos(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_memo_folders_user_id ON memo_folders(user_id);
CREATE INDEX idx_memo_folders_parent ON memo_folders(user_id, parent_folder_id, sort_order);
CREATE INDEX idx_memos_user_updated_at ON memos(user_id, updated_at DESC);
CREATE INDEX idx_memos_user_folder_updated_at ON memos(user_id, folder_id, updated_at DESC);
CREATE INDEX idx_memos_user_favorite_updated_at ON memos(user_id, is_favorite, updated_at DESC);
CREATE INDEX idx_memo_tags_user_id ON memo_tags(user_id);
CREATE INDEX idx_memo_tag_links_tag_memo ON memo_tag_links(tag_id, memo_id);
CREATE INDEX idx_memo_assets_user_memo_sort ON memo_assets(user_id, memo_id, sort_order, created_at);
```

**Step 5: Run test to verify it passes**

Run: `npm run test:api -- memo-schema.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/shared/src/index.ts apps/api/migrations/0008_memos.sql apps/api/test/memo-schema.test.ts
git commit -m "feat: add memo schema contracts"
```

### Task 2: Add memo repositories

**Files:**
- Create: `apps/api/src/lib/repositories/memo-folders.ts`
- Create: `apps/api/src/lib/repositories/memo-tags.ts`
- Create: `apps/api/src/lib/repositories/memo-assets.ts`
- Create: `apps/api/src/lib/repositories/memos.ts`
- Test: `apps/api/test/repositories/memos.test.ts`

**Step 1: Write failing repository tests**

Create tests that use a D1 test database or repository-style fake consistent with existing repository tests. Cover:

- create/list/update/delete memo folders with `parentFolderId`
- prevent assigning a memo folder to another user's folder
- create/list/update/delete memo tags
- create memo with tag ids and folder id
- list memos by folder, descendant folder ids, tag, favorite, query, and sort
- update `contentJson`, `contentText`, title, folder, tags, favorite, color
- delete memo and cleanup tag links
- create/list/delete memo assets with stable sort order

**Step 2: Run tests to verify they fail**

Run: `npm run test:api -- repositories/memos.test.ts`

Expected: FAIL because repositories do not exist.

**Step 3: Implement memo folder repository**

Create `apps/api/src/lib/repositories/memo-folders.ts` with methods:

- `listByUser(userId)`
- `create({ userId, name, color, icon, parentFolderId })`
- `update(folderId, userId, input)`
- `delete(folderId, userId)`
- `listDescendantIds(userId, folderId)`

Use recursive traversal in TypeScript for descendant ids unless D1 recursive CTE is already used elsewhere.

**Step 4: Implement memo tag repository**

Create `apps/api/src/lib/repositories/memo-tags.ts` with methods:

- `listByUser(userId)`
- `create({ userId, name, color })`
- `update(tagId, userId, input)`
- `delete(tagId, userId)`

**Step 5: Implement memo asset repository**

Create `apps/api/src/lib/repositories/memo-assets.ts` with methods:

- `listByMemo(userId, memoId)`
- `getById(userId, memoId, assetId)`
- `create({ userId, memoId, objectKey, thumbnailObjectKey, mimeType, width, height })`
- `delete(userId, memoId, assetId)`
- `toMemoAssetResponse(asset)`

Return `contentUrl` as `/api/memos/${memoId}/assets/${assetId}/content` and `thumbnailUrl` as `/api/memos/${memoId}/assets/${assetId}/thumbnail`.

**Step 6: Implement memo repository**

Create `apps/api/src/lib/repositories/memos.ts` with methods:

- `pageByUser(userId, filters, options)`
- `getByUserAndId(userId, memoId)`
- `create(input)`
- `update(memoId, userId, input)`
- `delete(memoId, userId)`

Keep `content_json` stored as JSON text. Validate JSON shape at route level before repository calls.

**Step 7: Run tests to verify they pass**

Run: `npm run test:api -- repositories/memos.test.ts`

Expected: PASS.

**Step 8: Commit**

```bash
git add apps/api/src/lib/repositories/memo-folders.ts apps/api/src/lib/repositories/memo-tags.ts apps/api/src/lib/repositories/memo-assets.ts apps/api/src/lib/repositories/memos.ts apps/api/test/repositories/memos.test.ts
git commit -m "feat: add memo repositories"
```

### Task 3: Add `/api/memos` routes

**Files:**
- Create: `apps/api/src/routes/memos.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/memos-routes.test.ts`

**Step 1: Write failing route tests**

Cover authenticated requests for:

- `GET /api/memos`
- `POST /api/memos`
- `GET /api/memos/:memoId`
- `PATCH /api/memos/:memoId`
- `DELETE /api/memos/:memoId`
- folder CRUD under `/api/memos/folders`
- tag CRUD under `/api/memos/tags`
- asset upload/list/content/thumbnail/delete under `/api/memos/:memoId/assets`

Also test unauthenticated requests return 401 and cross-user access returns 404.

**Step 2: Run tests to verify they fail**

Run: `npm run test:api -- memos-routes.test.ts`

Expected: FAIL because route does not exist.

**Step 3: Implement route factory**

Create `createMemoRoute(options)` in `apps/api/src/routes/memos.ts`. Follow the auth/session pattern in `apps/api/src/routes/bookmarks.ts`.

Route-level validation:

- title must trim to non-empty text or fallback to `Untitled`
- `contentJson` must be an object with `type: "doc"`
- `contentText` must be string
- image uploads must be `image/*`
- compressed file max size should be enforced server-side

**Step 4: Wire app**

Modify `apps/api/src/app.ts`:

- import memo repositories and route
- extend `CreateAppOptions`
- route `/api/memos`

**Step 5: Run route tests**

Run: `npm run test:api -- memos-routes.test.ts`

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/api/src/routes/memos.ts apps/api/src/app.ts apps/api/test/memos-routes.test.ts
git commit -m "feat: add memo api routes"
```

### Task 4: Add web memo clients and image compression helpers

**Files:**
- Create: `apps/web/src/lib/memos.ts`
- Create: `apps/web/src/lib/memo-assets.ts`
- Create: `apps/web/src/lib/memo-image-compression.ts`
- Create: `apps/web/src/lib/memo-editor-content.ts`
- Test: `apps/web/src/test/memo-api-client.test.ts`
- Test: `apps/web/src/test/memo-image-compression.test.ts`
- Test: `apps/web/src/test/memo-editor-content.test.ts`

**Step 1: Write failing tests**

Test API client URL/method/body construction for memo CRUD, folders, tags, and assets.

Test image helper behavior:

- ignores non-image files
- creates compressed image file with smaller dimensions
- creates thumbnail file
- supports multiple input files
- keeps GIF behavior explicit

Test editor content helpers:

- extracts plain text from Tiptap JSON
- counts checked and total task items
- returns safe empty document when content is invalid

**Step 2: Run tests to verify they fail**

Run: `npm run test:web -- memo-api-client.test.ts memo-image-compression.test.ts memo-editor-content.test.ts`

Expected: FAIL because helpers do not exist.

**Step 3: Implement clients**

In `apps/web/src/lib/memos.ts`, export:

- `loadMemoPage`
- `loadMemo`
- `createMemo`
- `updateMemo`
- `deleteMemo`
- `loadMemoFolders`
- `createMemoFolder`
- `updateMemoFolder`
- `deleteMemoFolder`
- `loadMemoTags`
- `createMemoTag`
- `updateMemoTag`
- `deleteMemoTag`

In `apps/web/src/lib/memo-assets.ts`, export:

- `loadMemoAssets`
- `uploadMemoAsset`
- `deleteMemoAsset`

**Step 4: Implement image compression**

In `apps/web/src/lib/memo-image-compression.ts`, implement:

- `compressMemoImage(file)`
- `createMemoImageThumbnail(file)`
- `prepareMemoImageUploadFiles(files)`

Use canvas + `createImageBitmap` with an image element fallback, mirroring `bookmark-asset-thumbnails.ts`. Produce one compressed image and one thumbnail per source image.

**Step 5: Implement content helpers**

In `apps/web/src/lib/memo-editor-content.ts`, implement:

- `createEmptyMemoDocument()`
- `normalizeMemoDocument(value)`
- `extractMemoPlainText(document)`
- `getMemoTaskProgress(document)`

**Step 6: Run tests**

Run: `npm run test:web -- memo-api-client.test.ts memo-image-compression.test.ts memo-editor-content.test.ts`

Expected: PASS.

**Step 7: Commit**

```bash
git add apps/web/src/lib/memos.ts apps/web/src/lib/memo-assets.ts apps/web/src/lib/memo-image-compression.ts apps/web/src/lib/memo-editor-content.ts apps/web/src/test/memo-api-client.test.ts apps/web/src/test/memo-image-compression.test.ts apps/web/src/test/memo-editor-content.test.ts
git commit -m "feat: add memo web clients and image helpers"
```

### Task 5: Add lazy memo workspace UI

**Files:**
- Modify: `apps/web/src/components/dashboard-panel-chunks.tsx`
- Modify: `apps/web/src/components/DashboardHeader.tsx`
- Modify: `apps/web/src/components/AuthenticatedDashboardApp.tsx`
- Create: `apps/web/src/components/MemoPanel.tsx`
- Create: `apps/web/src/components/MemoPanel.css`
- Test: `apps/web/src/test/memo-dashboard.test.tsx`
- Test: `apps/web/src/test/bundle-splitting.test.ts`

**Step 1: Write failing UI tests**

Test:

- authenticated dashboard exposes `메모` navigation
- opening `/?view=memos` selects memo view
- memo panel loads lazily
- header primary action says `새 메모` while in memo view
- list/card view toggle is visible
- folder filter is visible
- mobile menu includes `메모`

Add bundle splitting assertions that `MemoPanel` and memo clients are not imported directly into the initial dashboard chunk except through lazy loaders.

**Step 2: Run tests to verify they fail**

Run: `npm run test:web -- memo-dashboard.test.tsx bundle-splitting.test.ts`

Expected: FAIL because memo view does not exist.

**Step 3: Add memo panel chunk**

Modify `apps/web/src/components/dashboard-panel-chunks.tsx`:

- add `loadMemoPanel`
- export `LazyMemoPanel`
- extend `DashboardPanelChunk` with `"memos"`
- add preload support

**Step 4: Extend dashboard view state**

Modify `AuthenticatedDashboardApp.tsx`:

- extend `DashboardView` to `"home" | "bookmarks" | "memos"`
- read initial `view=memos` from URL
- write view changes to URL query without full navigation
- load memo data when view is memos
- render `LazyMemoPanel`
- switch create button action to memo composer when memos is active

**Step 5: Implement `MemoPanel`**

Create `apps/web/src/components/MemoPanel.tsx` with:

- folder tree filter
- tag filter chips
- search input
- favorite filter
- list/card segmented control
- memo result list
- empty state
- create/edit/delete callbacks passed from dashboard

Create `MemoPanel.css` with compact dashboard styling, mobile full-width layout, and no nested cards.

**Step 6: Run tests**

Run: `npm run test:web -- memo-dashboard.test.tsx bundle-splitting.test.ts`

Expected: PASS.

**Step 7: Commit**

```bash
git add apps/web/src/components/dashboard-panel-chunks.tsx apps/web/src/components/DashboardHeader.tsx apps/web/src/components/AuthenticatedDashboardApp.tsx apps/web/src/components/MemoPanel.tsx apps/web/src/components/MemoPanel.css apps/web/src/test/memo-dashboard.test.tsx apps/web/src/test/bundle-splitting.test.ts
git commit -m "feat: add lazy memo workspace"
```

### Task 6: Add rich memo composer/editor

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`
- Create: `apps/web/src/components/MemoComposerDialog.tsx`
- Create: `apps/web/src/components/MemoComposerDialog.css`
- Create: `apps/web/src/components/MemoRichEditor.tsx`
- Create: `apps/web/src/components/MemoRichEditor.css`
- Modify: `apps/web/src/components/dashboard-dialog-chunks.tsx`
- Test: `apps/web/src/test/memo-editor.test.tsx`
- Test: `apps/web/src/test/memo-composer-dialog.test.tsx`

**Step 1: Install editor dependencies**

Run:

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-text-style @tiptap/extension-image --workspace apps/web
```

Expected: package files update successfully.

**Step 2: Write failing editor tests**

Test:

- editor renders initial JSON
- typing `[] ` creates a task item
- checking a task item marks it checked
- checked task item has a class or data attribute that CSS can strike through
- bold button toggles bold mark
- font size control updates selected text attrs
- image paste/drop/file select calls image upload handler for multiple files
- in-note search finds matches and next/previous changes active match

**Step 3: Run tests to verify they fail**

Run: `npm run test:web -- memo-editor.test.tsx memo-composer-dialog.test.tsx`

Expected: FAIL because editor components do not exist.

**Step 4: Implement `MemoRichEditor`**

Use Tiptap with:

- StarterKit
- TaskList
- TaskItem
- TextStyle
- Image
- custom FontSize extension based on text style attrs

Add CSS:

```css
.memo-editor-content li[data-checked="true"] p {
  text-decoration: line-through;
}
```

Implement input conversion for `[] ` if TaskItem input rules do not cover the exact Korean IME/mobile behavior.

**Step 5: Implement image insertion flow**

In `MemoRichEditor`, support:

- paste image files
- drag/drop image files
- file input multiple images

For each image:

1. call `prepareMemoImageUploadFiles`
2. upload compressed file and thumbnail
3. insert returned asset thumbnail/content URL as image node

**Step 6: Implement in-note search**

Keep this local to the editor component:

- search query state
- match list derived from visible text
- active match index
- previous/next buttons
- visual mark/highlight for matches

If full ProseMirror decorations are too large for 1차, implement a pragmatic first pass that scrolls to matching text blocks and displays active match count, then enhance later.

**Step 7: Implement `MemoComposerDialog`**

Create dialog with:

- title
- folder picker
- tag picker
- color
- favorite
- rich editor
- save/cancel

Use lazy dialog loading through `dashboard-dialog-chunks.tsx`.

**Step 8: Run tests**

Run: `npm run test:web -- memo-editor.test.tsx memo-composer-dialog.test.tsx`

Expected: PASS.

**Step 9: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/src/components/MemoComposerDialog.tsx apps/web/src/components/MemoComposerDialog.css apps/web/src/components/MemoRichEditor.tsx apps/web/src/components/MemoRichEditor.css apps/web/src/components/dashboard-dialog-chunks.tsx apps/web/src/test/memo-editor.test.tsx apps/web/src/test/memo-composer-dialog.test.tsx
git commit -m "feat: add rich memo editor"
```

### Task 7: Wire memo CRUD state into the dashboard

**Files:**
- Modify: `apps/web/src/components/AuthenticatedDashboardApp.tsx`
- Modify: `apps/web/src/components/MemoPanel.tsx`
- Modify: `apps/web/src/components/MemoComposerDialog.tsx`
- Test: `apps/web/src/test/memo-dashboard.test.tsx`

**Step 1: Write failing integration tests**

Test:

- create memo from memo view
- edit memo title/content/folder/tag/color/favorite
- delete memo
- switch list/card view and persist setting
- upload multiple memo images and see image count
- filter by folder descendants
- filter by tag
- search by memo content text

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- memo-dashboard.test.tsx`

Expected: FAIL because dashboard state wiring is incomplete.

**Step 3: Implement memo state orchestration**

In `AuthenticatedDashboardApp.tsx`, add memo-specific state:

- memo page
- memo folders
- memo tags
- selected memo
- active filters
- memo view mode
- composer open/editing state
- pending memo asset uploads

Keep service imports lazy by adding memo service loaders if needed, mirroring `dashboard-service-modules.ts`.

**Step 4: Implement create/update/delete flows**

Use `createMemo`, `updateMemo`, and `deleteMemo`. After save:

- update local memo list by id
- refresh detail if selected
- preserve current filters
- show status/error messages

**Step 5: Run tests**

Run: `npm run test:web -- memo-dashboard.test.tsx`

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/web/src/components/AuthenticatedDashboardApp.tsx apps/web/src/components/MemoPanel.tsx apps/web/src/components/MemoComposerDialog.tsx apps/web/src/test/memo-dashboard.test.tsx
git commit -m "feat: wire memo dashboard flows"
```

### Task 8: Final verification, migration, and deployment

**Files:**
- No new source files expected unless verification finds defects.

**Step 1: Run full tests**

Run:

```bash
npm run test:api
npm run test:web
npm run build:web
```

Expected: all pass.

**Step 2: Browser smoke test**

Start local web server:

```bash
npm run dev --workspace apps/web -- --host 127.0.0.1 --port 5178
```

Verify:

- `/` loads
- `/?view=memos` opens memo view
- create memo dialog opens
- list/card toggle works
- mobile viewport shows memo navigation and editor controls
- console has no runtime errors

**Step 3: Apply D1 migration to production**

Run:

```bash
npx wrangler d1 migrations apply bookmark --remote
```

Expected: migration `0008_memos.sql` applies successfully.

**Step 4: Deploy**

Run:

```bash
npx wrangler deploy
```

Expected: worker deploy succeeds and prints the production URL and version id.

**Step 5: Verify production**

Run:

```bash
curl -I https://bookmark.example.workers.dev
```

Expected: `HTTP/1.1 200 OK`.

**Step 6: Commit any verification fixes**

If verification required fixes, commit them:

```bash
git add <changed-files>
git commit -m "fix: stabilize memo workspace"
```
