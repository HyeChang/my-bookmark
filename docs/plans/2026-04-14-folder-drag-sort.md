# Folder Drag Sort Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 같은 부모 안 폴더 드래그 정렬과 서버 저장을 추가한다.

**Architecture:** 폴더 라우트에 reorder 전용 엔드포인트를 추가하고, 저장소는 `sort_order`를 형제 범위 안에서 다시 쓴다. 웹은 드래그 핸들과 drop 처리만 붙여 기존 계층 옵션 계산을 그대로 재사용한다.

**Tech Stack:** React, Hono, Cloudflare D1, Vitest, Testing Library

---

### Task 1: API reorder 테스트 추가

**Files:**
- Modify: `apps/api/test/folders-tags-routes.test.ts`

**Step 1: Write the failing test**

- 같은 부모 형제 폴더 reorder 성공 테스트 추가
- 다른 부모 폴더를 섞은 reorder 거부 테스트 추가

**Step 2: Run test to verify it fails**

Run: `npm run test:api -- folders-tags-routes.test.ts`

**Step 3: Write minimal implementation**

- `packages/shared/src/index.ts`
- `apps/api/src/lib/repositories/folders.ts`
- `apps/api/src/routes/folders.ts`

**Step 4: Run test to verify it passes**

Run: `npm run test:api -- folders-tags-routes.test.ts`

**Step 5: Commit**

```bash
git add packages/shared/src/index.ts apps/api/src/lib/repositories/folders.ts apps/api/src/routes/folders.ts apps/api/test/folders-tags-routes.test.ts
git commit -m "feat: add folder reorder api"
```

### Task 2: 웹 드래그 정렬 테스트 추가

**Files:**
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`

**Step 1: Write the failing test**

- 같은 부모 폴더를 drag/drop으로 재정렬하고 트리/셀렉트 순서가 함께 바뀌는 테스트 추가

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

**Step 3: Write minimal implementation**

- `apps/web/src/lib/folders.ts`
- `apps/web/src/App.tsx`

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

**Step 5: Commit**

```bash
git add apps/web/src/lib/folders.ts apps/web/src/App.tsx apps/web/src/test/folder-tag-dashboard.test.tsx
git commit -m "feat: add folder drag sorting"
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
git add docs/plans/2026-04-14-folder-drag-sort-design.md docs/plans/2026-04-14-folder-drag-sort.md packages/shared/src/index.ts apps/api/src/lib/repositories/folders.ts apps/api/src/routes/folders.ts apps/api/test/folders-tags-routes.test.ts apps/web/src/lib/folders.ts apps/web/src/App.tsx apps/web/src/test/folder-tag-dashboard.test.tsx
git commit -m "feat: add folder drag sorting"
```
