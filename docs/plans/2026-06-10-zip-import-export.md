# ZIP Import/Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Export and import bookmark and memo backups as ZIP files that include JSON manifests and image asset files.

**Architecture:** The web app keeps the existing dashboard-driven export/import flow and adds focused client-side ZIP helpers under `apps/web/src/lib`. Export builds a `manifest.json` plus asset files from fetched asset URLs; import reads the manifest, recreates folders/tags/items through existing APIs, uploads asset files, and rewrites memo image URLs to the new uploaded asset URLs.

**Tech Stack:** React, TypeScript, Vitest, JSZip, existing Cloudflare Worker API endpoints.

---

### Task 1: ZIP Backup Utilities

**Files:**
- Create: `apps/web/src/lib/backup-zip.ts`
- Test: `apps/web/src/test/backup-zip.test.ts`

**Steps:**
1. Write failing tests for creating a ZIP with `manifest.json` and binary assets.
2. Write failing tests for reading a ZIP and returning manifest plus asset blobs.
3. Implement minimal JSZip helpers.
4. Run `vitest run src/test/backup-zip.test.ts`.

### Task 2: Bookmark Import/Export Mapping

**Files:**
- Modify: `apps/web/src/lib/bookmark-export.ts`
- Test: `apps/web/src/test/bookmark-import-export.test.ts`

**Steps:**
1. Write failing tests for bookmark backup ZIP manifest and asset path mapping.
2. Write failing tests for folder/tag/bookmark id remapping during import.
3. Implement export ZIP payload creation and import orchestration helpers.
4. Keep legacy JSON payload type readable where practical.

### Task 3: Memo Import/Export Mapping

**Files:**
- Modify: `apps/web/src/lib/memo-export.ts`
- Test: `apps/web/src/test/memo-import-export.test.ts`

**Steps:**
1. Write failing tests for memo backup ZIP manifest and asset path mapping.
2. Write failing tests for replacing memo rich-content image URLs after asset upload.
3. Implement export ZIP payload creation and import orchestration helpers.

### Task 4: Dashboard UI Wiring

**Files:**
- Modify: `apps/web/src/components/AuthenticatedDashboardApp.tsx`
- Modify: `apps/web/src/components/BookmarkResultsPanel.tsx`
- Modify: `apps/web/src/components/MemoPanel.tsx`
- Modify CSS files if button layout needs minor adjustments.
- Test: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Steps:**
1. Add failing UI tests for "북마크 불러오기" and "메모 불러오기".
2. Add hidden file inputs beside export buttons.
3. Wire selected ZIP files to import handlers.
4. Refresh relevant dashboard data and show success/error status.

### Task 5: Verification

**Commands:**
- `..\\..\\node_modules\\.bin\\vitest.cmd run src\\test\\backup-zip.test.ts --reporter verbose`
- `..\\..\\node_modules\\.bin\\vitest.cmd run src\\test\\bookmark-import-export.test.ts --reporter verbose`
- `..\\..\\node_modules\\.bin\\vitest.cmd run src\\test\\memo-import-export.test.ts --reporter verbose`
- `..\\..\\node_modules\\.bin\\vitest.cmd run src\\test\\bookmark-dashboard.test.tsx -t "backup zip" --reporter verbose`
- `..\\..\\node_modules\\.bin\\vitest.cmd run src\\test\\bundle-splitting.test.ts --reporter verbose`
- `npm run test:web`
- `npm run build:web`
- `git diff --check`
