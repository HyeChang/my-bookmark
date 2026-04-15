# Folder Drag Reparent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 드래그로 폴더 부모를 변경하는 기능을 추가한다.

**Architecture:** 같은 부모 내부 정렬은 기존 reorder 흐름을 유지하고, 다른 부모로 이동은 move 전용 API로 분리한다. 웹은 기존 drag/drop 분기만 확장해 새 부모 이동과 기존 reorder를 함께 처리한다.

**Tech Stack:** React, Hono, Cloudflare D1, Vitest, Testing Library

---

### Task 1: move API 테스트와 구현

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/lib/repositories/folders.ts`
- Modify: `apps/api/src/routes/folders.ts`
- Modify: `apps/api/test/folders-tags-routes.test.ts`

**Step 1: Write the failing test**

- 폴더를 다른 부모 아래로 이동시키는 테스트 추가
- 자손 아래 이동을 거부하는 테스트 추가

**Step 2: Run test to verify it fails**

Run: `npm run test:api -- folders-tags-routes.test.ts`

**Step 3: Write minimal implementation**

- `POST /api/folders/:folderId/move`
- 저장소 `move()` 추가

**Step 4: Run test to verify it passes**

Run: `npm run test:api -- folders-tags-routes.test.ts`

**Step 5: Commit**

```bash
git add packages/shared/src/index.ts apps/api/src/lib/repositories/folders.ts apps/api/src/routes/folders.ts apps/api/test/folders-tags-routes.test.ts
git commit -m "feat: add folder move api"
```

### Task 2: drag-to-reparent 웹 테스트와 구현

**Files:**
- Modify: `apps/web/src/lib/folders.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`

**Step 1: Write the failing test**

- 다른 부모 폴더 위 드롭 시 하위 폴더로 이동하는 테스트 추가

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

**Step 3: Write minimal implementation**

- `moveFolder()` 클라이언트 추가
- drop 처리에서 same-parent reorder / cross-parent move 분기

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

**Step 5: Commit**

```bash
git add apps/web/src/lib/folders.ts apps/web/src/App.tsx apps/web/src/test/folder-tag-dashboard.test.tsx
git commit -m "feat: add folder drag reparent"
```

### Task 3: Full verification

**Files:**
- Verify only

**Step 1: Run API tests**

Run: `npm run test:api`

**Step 2: Run web tests**

Run: `npm run test:web`

**Step 3: Run production build**

Run: `npm run build:web`

**Step 4: Commit final feature**

```bash
git add docs/plans/2026-04-14-folder-drag-reparent-design.md docs/plans/2026-04-14-folder-drag-reparent.md packages/shared/src/index.ts apps/api/src/lib/repositories/folders.ts apps/api/src/routes/folders.ts apps/api/test/folders-tags-routes.test.ts apps/web/src/lib/folders.ts apps/web/src/App.tsx apps/web/src/test/folder-tag-dashboard.test.tsx
git commit -m "feat: add folder drag reparent"
```
