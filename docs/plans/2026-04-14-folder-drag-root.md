# Folder Drag Root Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 드래그로 하위 폴더를 최상위 폴더로 이동시킨다.

**Architecture:** 서버는 기존 `move` API를 재사용하고, 웹에 `최상위로 이동` drop 영역만 추가한다. 루트 이동 후 폴더 목록과 폴더 선택 셀렉트는 기존 계층 옵션 계산 로직으로 자동 갱신한다.

**Tech Stack:** React, Hono, Cloudflare D1, Vitest, Testing Library

---

### Task 1: 루트 이동 테스트 추가

**Files:**
- Modify: `apps/api/test/folders-tags-routes.test.ts`
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`

**Step 1: Write the failing test**

- API에 자식 폴더를 `parentFolderId=null`로 이동시키는 테스트 추가
- 웹에 `최상위로 이동` drop 영역으로 하위 폴더를 루트로 올리는 테스트 추가

**Step 2: Run test to verify it fails**

Run: `npm run test:api -- folders-tags-routes.test.ts`
Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

**Step 3: Write minimal implementation**

- `apps/web/src/App.tsx`

**Step 4: Run test to verify it passes**

Run: `npm run test:api -- folders-tags-routes.test.ts`
Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

**Step 5: Commit**

```bash
git add apps/api/test/folders-tags-routes.test.ts apps/web/src/App.tsx apps/web/src/test/folder-tag-dashboard.test.tsx
git commit -m "feat: add folder drag to root"
```

### Task 2: Full verification

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
git add docs/plans/2026-04-14-folder-drag-root-design.md docs/plans/2026-04-14-folder-drag-root.md apps/api/test/folders-tags-routes.test.ts apps/web/src/App.tsx apps/web/src/test/folder-tag-dashboard.test.tsx
git commit -m "feat: add folder drag to root"
```
