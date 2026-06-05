# Trash Bookmarks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a real bookmark trash flow so deleting moves bookmarks into Trash, Trash can list/restore/permanently delete them, and normal bookmark views exclude trashed items.

**Architecture:** Add soft-delete state to the `bookmarks` table with `trashed_at`, keep assets/tags/activity while a bookmark is in Trash, and only delete related data during permanent deletion. API list/detail defaults exclude trashed bookmarks; Trash uses an explicit `trashed=1` query and restore/permanent-delete endpoints. Web UI treats Trash as a special folder-overview filter and exposes restore/permanent-delete actions only in Trash context.

**Tech Stack:** Cloudflare D1 migrations, Hono API routes, shared TypeScript DTOs in `@bookmark/shared`, React/Vite web app, Vitest tests.

---

## Assumptions

- Current `DELETE /api/bookmarks/:bookmarkId` permanently removes the bookmark and related tags/activity/assets.
- Trash should preserve bookmark assets in R2 while soft-deleted.
- Trash count should include only the current authenticated user's trashed bookmarks.
- Normal list/search/recommendation flows should exclude trashed bookmarks.
- Opening a trashed bookmark detail is allowed only from Trash view.

---

### Task 1: Add Shared Trash Types

**Files:**
- Modify: `packages/shared/src/index.ts`

**Step 1: Write the failing type-driven API test**

Update route/web tests later to expect these new fields:

```ts
expect(bookmark).toMatchObject({
  isTrashed: false,
  trashedAt: null
});
```

**Step 2: Add shared fields**

Update `Bookmark`:

```ts
isTrashed: boolean;
trashedAt: string | null;
```

Add request/response types:

```ts
export type BookmarkTrashMode = "active" | "trashed" | "all";

export type BookmarkRestoreResponse = {
  bookmark: Bookmark;
};

export type BookmarkPermanentDeleteResponse = {
  ok: true;
};
```

**Step 3: Run shared-dependent tests**

Run:

```powershell
npm run test:api -- bookmarks-routes.test.ts
npm run test:web -- bookmark-dashboard.test.tsx
```

Expected at this point: TypeScript/test failures until API and web are updated.

---

### Task 2: Add D1 Migration

**Files:**
- Create: `apps/api/migrations/0006_bookmark_trash.sql`

**Step 1: Add migration**

```sql
ALTER TABLE bookmarks
ADD COLUMN trashed_at TEXT;

CREATE INDEX idx_bookmarks_user_trashed_at
ON bookmarks(user_id, trashed_at);
```

**Step 2: Apply locally**

Run:

```powershell
npx wrangler d1 migrations apply bookmark --local
```

Expected: migration applies cleanly.

---

### Task 3: Repository Soft Delete And Restore

**Files:**
- Modify: `apps/api/src/lib/repositories/bookmarks.ts`
- Test: `apps/api/test/repositories/bookmarks.test.ts`

**Step 1: Write failing repository tests**

Add tests for:

- `delete(bookmarkId, userId)` sets `trashed_at` instead of removing the row.
- `listByUser(userId)` excludes trashed bookmarks by default.
- `listByUser(userId, { trashMode: "trashed" })` returns only trashed bookmarks.
- `restore(bookmarkId, userId)` clears `trashed_at`.
- `permanentlyDelete(bookmarkId, userId)` removes bookmark, tags, activity, extraction logs, and asset rows.

**Step 2: Update repository types**

Extend `BookmarkRow`:

```ts
trashed_at: string | null;
```

Extend `BookmarkListFilters`:

```ts
trashMode?: "active" | "trashed" | "all";
```

Extend `BookmarkRepository`:

```ts
restore(bookmarkId: string, userId: string): Promise<BookmarkRecord | null>;
permanentlyDelete(bookmarkId: string, userId: string): Promise<boolean>;
```

**Step 3: Update SQL reads**

Every `SELECT` for bookmarks must include:

```sql
trashed_at
```

`toBookmarkRecord()` must map:

```ts
isTrashed: row.trashed_at !== null,
trashedAt: row.trashed_at
```

**Step 4: Update filtering**

In `matchesBookmarkFilters()`:

```ts
const trashMode = filters.trashMode ?? "active";
if (trashMode === "active" && bookmark.isTrashed) return false;
if (trashMode === "trashed" && !bookmark.isTrashed) return false;
```

**Step 5: Change delete semantics**

Change `delete()` from hard delete to:

```sql
UPDATE bookmarks
SET trashed_at = ?, updated_at = ?
WHERE id = ? AND user_id = ? AND trashed_at IS NULL
```

Return `true` if the bookmark exists, even if already trashed.

**Step 6: Add restore**

```sql
UPDATE bookmarks
SET trashed_at = NULL, updated_at = ?
WHERE id = ? AND user_id = ?
```

Return the restored bookmark.

**Step 7: Add permanent deletion**

Move the current hard-delete batch into `permanentlyDelete()`.

**Step 8: Verify**

Run:

```powershell
npm run test:api -- repositories/bookmarks.test.ts
```

Expected: repository tests pass.

---

### Task 4: API Routes

**Files:**
- Modify: `apps/api/src/routes/bookmarks.ts`
- Test: `apps/api/test/bookmarks-routes.test.ts`

**Step 1: Write failing route tests**

Add tests for:

- `DELETE /api/bookmarks/:id` returns `204`, normal list excludes item, `?trashed=1` includes item.
- `POST /api/bookmarks/:id/restore` returns restored bookmark and normal list includes it again.
- `DELETE /api/bookmarks/:id/permanent` permanently removes the item and deletes R2 assets.
- `GET /api/bookmarks/:id` returns `404` for trashed bookmarks unless `?trashed=1` is passed.
- Recommendations exclude trashed bookmarks.

**Step 2: Parse trash query**

In list route:

```ts
const trashed = c.req.query("trashed");
const trashMode =
  trashed === "1" ? "trashed" : trashed === "all" ? "all" : "active";
```

Pass `trashMode` into repository filters.

**Step 3: Update detail route**

Default detail route should reject trashed bookmarks:

```ts
if (bookmark.isTrashed && c.req.query("trashed") !== "1") {
  return c.json({ error: "bookmark_not_found" }, 404);
}
```

**Step 4: Keep DELETE as soft delete**

Change existing `DELETE /:bookmarkId` to call `bookmarkRepository.delete()` only. Do not delete R2 assets here.

**Step 5: Add restore route**

```ts
.post("/:bookmarkId/restore", async (c) => {
  // auth
  // repository.restore()
  // 404 if null
  // return { bookmark }
})
```

**Step 6: Add permanent delete route**

```ts
.delete("/:bookmarkId/permanent", async (c) => {
  // auth
  // load bookmark with trashed allowed
  // list assets
  // delete R2 objects
  // repository.permanentlyDelete()
  // return { ok: true }
})
```

**Step 7: Verify**

Run:

```powershell
npm run test:api -- bookmarks-routes.test.ts
```

Expected: route tests pass.

---

### Task 5: Web API Client

**Files:**
- Modify: `apps/web/src/lib/bookmarks.ts`

**Step 1: Add options**

Extend `LoadBookmarksOptions`:

```ts
trashMode?: "active" | "trashed" | "all";
```

Map to URL:

```ts
if (options.trashMode === "trashed") searchParams.set("trashed", "1");
if (options.trashMode === "all") searchParams.set("trashed", "all");
```

**Step 2: Add restore/permanent delete functions**

```ts
export async function restoreBookmark(bookmarkId: string) {
  const data = await requestJson<BookmarkResponse>(`/api/bookmarks/${bookmarkId}/restore`, {
    method: "POST",
    credentials: "include"
  });
  return data.bookmark;
}

export async function permanentlyDeleteBookmark(bookmarkId: string) {
  await requestVoid(`/api/bookmarks/${bookmarkId}/permanent`, {
    method: "DELETE",
    credentials: "include"
  });
}
```

**Step 3: Verify**

Run:

```powershell
npm run test:web -- bookmark-dashboard.test.tsx
```

Expected: compile failures until UI is updated.

---

### Task 6: Web Trash State And Folder Overview

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write failing UI tests**

Add tests for:

- Trash system item shows count from `/api/bookmarks?trashed=1`.
- Clicking Trash loads and displays trashed bookmarks.
- Normal `모든 북마크` excludes trashed bookmarks.
- Trash cards show `복구` and `영구 삭제`, not normal `삭제`.
- Restore moves item out of Trash and back into normal list.
- Permanent delete removes item from Trash.

**Step 2: Add state**

```ts
const [trashedBookmarks, setTrashedBookmarks] = useState<Bookmark[]>([]);
```

**Step 3: Load trash counts**

In `refreshDashboardData()`, load:

```ts
loadBookmarks({ trashMode: "trashed" })
```

Store in `trashedBookmarks`.

**Step 4: Update folder system filter**

`휴지통` count becomes:

```ts
trashedBookmarks.length
```

Clicking Trash sets:

```ts
setBookmarks(trashedBookmarks);
setFolderOverviewSpecialFilter("trash");
```

**Step 5: Update normal filters**

`all` and `unfiled` must use active inventory only:

```ts
bookmarkInventory.filter((bookmark) => !bookmark.isTrashed)
```

**Step 6: Add actions**

Implement:

```ts
async function handleBookmarkRestore(bookmark: Bookmark) { ... }
async function handleBookmarkPermanentDelete(bookmark: Bookmark) { ... }
```

Restore updates:

- remove from `trashedBookmarks`
- add/replace in `bookmarkInventory`
- if current filter is Trash, remove from `bookmarks`

Permanent delete updates:

- remove from `trashedBookmarks`
- remove from `bookmarks`
- remove from `bookmarkInventory`
- remove assets cache

**Step 7: Update card/menu rendering**

If `folderOverviewSpecialFilter === "trash"`:

- show `복구`
- show `영구 삭제`
- hide `열기` only if opening trashed links should be blocked, otherwise keep it
- hide normal `삭제`

**Step 8: Verify**

Run:

```powershell
npm run test:web -- bookmark-dashboard.test.tsx
```

Expected: web dashboard tests pass.

---

### Task 7: Recommendations And Detail Safety

**Files:**
- Modify: `apps/api/src/routes/recommendations.ts`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/api/test/recommendations-routes.test.ts`
- Test: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write failing tests**

Add tests that a trashed bookmark never appears in favorites/recent/frequent recommendations.

**Step 2: API filter**

Ensure recommendation repository calls use active-only list. If it currently calls `listByUser(userId)`, this should already be active-only after Task 3. Add tests anyway.

**Step 3: Web guard**

When a selected bookmark becomes trashed outside Trash context, clear selected detail:

```ts
if (selectedBookmark?.isTrashed && folderOverviewSpecialFilter !== "trash") {
  setSelectedBookmark(null);
}
```

**Step 4: Verify**

Run:

```powershell
npm run test:api -- recommendations-routes.test.ts
npm run test:web -- bookmark-dashboard.test.tsx
```

Expected: tests pass.

---

### Task 8: Full Verification And Deployment

**Files:**
- No code changes unless verification fails.

**Step 1: Run API tests**

```powershell
npm run test:api -- repositories/bookmarks.test.ts
npm run test:api -- bookmarks-routes.test.ts
npm run test:api -- recommendations-routes.test.ts
```

Expected: all pass.

**Step 2: Run web tests**

```powershell
npm run test:web -- bookmark-dashboard.test.tsx
npm run test:web -- pwa-install.test.tsx
```

Expected: all pass.

**Step 3: Build web**

```powershell
npm run build --workspace apps/web
```

Expected: build succeeds.

**Step 4: Apply remote migration**

Run only after local tests pass:

```powershell
npx wrangler d1 migrations apply bookmark --remote
```

Expected: `0006_bookmark_trash.sql` applied remotely.

**Step 5: Deploy**

```powershell
npx wrangler deploy
```

Expected: Worker deploy succeeds and returns production URL/version.

---

## Rollback Plan

- If deployment fails before migration: redeploy previous Worker version.
- If migration succeeds but app has issues: deploy code that ignores `trashed_at`; active bookmarks still work because `trashed_at` defaults to `NULL`.
- Do not remove the `trashed_at` column in rollback; leave it dormant to avoid destructive schema changes.

---

## Open Decisions Before Implementation

- Should Trash allow opening links, or only restore/permanent-delete?
- Should deleting a folder move contained bookmarks to Trash, or keep the existing behavior of clearing the folder relationship?
- Should Trash auto-purge after a retention period, e.g. 30 days, or remain manual-only?
