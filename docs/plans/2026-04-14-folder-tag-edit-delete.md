# Folder/Tag Edit Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 폴더와 태그의 수정/삭제 기능을 추가해 관리 UI의 CRUD를 닫는다.

**Architecture:** 폴더/태그 라우트와 저장소에 `PATCH`/`DELETE`를 추가하고, 웹 대시보드의 관리자 섹션은 생성 폼을 수정 모드로 재사용한다. 삭제 시 북마크 상태에 남은 폴더/태그 참조도 함께 정리한다.

**Tech Stack:** Hono, Cloudflare D1, React, Vite, Testing Library

---

### Task 1: failing test 추가

**Files:**
- Modify: `apps/api/test/folders-tags-routes.test.ts`
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`

**Step 1: Write the failing tests**

- 폴더 삭제, 태그 수정/삭제, 웹 관리 UI 수정/삭제 케이스를 추가한다.

**Step 2: Run tests to verify they fail**

Run: `npm run test:api -- folders-tags-routes.test.ts`
Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

Expected: missing route/client/UI failures

### Task 2: API 구현

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/lib/repositories/folders.ts`
- Modify: `apps/api/src/lib/repositories/tags.ts`
- Modify: `apps/api/src/routes/folders.ts`
- Modify: `apps/api/src/routes/tags.ts`

**Step 1: Write minimal implementation**

- 태그 `PATCH/DELETE`
- 폴더 `DELETE`
- 삭제 시 연관 북마크/태그 관계 정리

**Step 2: Run targeted API test**

Run: `npm run test:api -- folders-tags-routes.test.ts`

Expected: PASS

### Task 3: 웹 구현

**Files:**
- Modify: `apps/web/src/lib/folders.ts`
- Modify: `apps/web/src/lib/tags.ts`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write minimal implementation**

- 폴더/태그 수정 상태 추가
- 수정/삭제 버튼과 취소 동작 추가
- 북마크 상태와 선택 상태 정리

**Step 2: Run targeted web test**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

Expected: PASS

### Task 4: 전체 검증

**Step 1: Run full verification**

Run: `npm run test:api`
Run: `npm run test:web`
Run: `npm run build:web`

Expected: all pass

### Task 5: Commit

```bash
git add docs/plans/2026-04-14-folder-tag-edit-delete-design.md docs/plans/2026-04-14-folder-tag-edit-delete.md packages/shared/src/index.ts apps/api/src/lib/repositories/folders.ts apps/api/src/lib/repositories/tags.ts apps/api/src/routes/folders.ts apps/api/src/routes/tags.ts apps/api/test/folders-tags-routes.test.ts apps/web/src/lib/folders.ts apps/web/src/lib/tags.ts apps/web/src/App.tsx apps/web/src/test/folder-tag-dashboard.test.tsx
git commit -m "feat: add folder and tag edit delete"
```
