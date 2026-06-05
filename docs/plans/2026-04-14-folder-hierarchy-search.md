# Folder Hierarchy Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 폴더 부모 지정과 하위 폴더 포함 검색을 함께 도입한다.

**Architecture:** 폴더 계층은 기존 `parentFolderId` 모델을 재사용하고, 검색은 라우트 레벨에서 자손 폴더 ID 집합을 계산해 북마크 저장소 필터로 넘긴다. UI는 폴더 관리와 검색 필터 양쪽 모두 계층형 옵션 렌더링을 재사용한다.

**Tech Stack:** React, TypeScript, Hono, Cloudflare D1, Vitest

---

### Task 1: 폴더 계층 API RED

**Files:**
- Modify: `apps/api/test/folders-tags-routes.test.ts`

**Step 1: Write the failing test**

- 부모 폴더 지정 생성 테스트를 추가한다.
- 자기 자신/자손을 부모로 지정하는 수정 거부 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:api -- folders-tags-routes.test.ts`
Expected: 부모 검증/순환 거부 관련 실패

**Step 3: Write minimal implementation**

- 폴더 저장소와 라우트에 부모 검증을 추가한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:api -- folders-tags-routes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/test/folders-tags-routes.test.ts apps/api/src/routes/folders.ts apps/api/src/lib/repositories/folders.ts
git commit -m "feat: validate folder hierarchy"
```

### Task 2: 북마크 하위 폴더 검색 RED

**Files:**
- Modify: `apps/api/test/bookmarks-routes.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/bookmarks.ts`
- Modify: `apps/api/src/lib/repositories/bookmarks.ts`

**Step 1: Write the failing test**

- `folderId`만 있을 때는 선택 폴더만 검색되는 테스트를 유지한다.
- `folderId + includeDescendantFolders=1`이면 하위 폴더 북마크도 포함되는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:api -- bookmarks-routes.test.ts`
Expected: 하위 폴더 포함 검색 실패

**Step 3: Write minimal implementation**

- 북마크 라우트에 `includeDescendantFolders` 파싱 추가
- 폴더 목록에서 자손 ID를 계산하는 helper 추가
- 저장소 필터에 `folderIds` 지원 추가

**Step 4: Run test to verify it passes**

Run: `npm run test:api -- bookmarks-routes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/test/bookmarks-routes.test.ts apps/api/src/app.ts apps/api/src/routes/bookmarks.ts apps/api/src/lib/repositories/bookmarks.ts
git commit -m "feat: add descendant folder bookmark search"
```

### Task 3: 폴더 계층 UI RED

**Files:**
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 폴더 관리 폼의 `부모 폴더` 셀렉트와 계층형 옵션 표시 테스트를 추가한다.
- 검색 필터의 `하위 폴더 포함` 체크박스와 요청 파라미터 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx bookmark-dashboard.test.tsx`
Expected: 새 UI 요소 부재로 실패

**Step 3: Write minimal implementation**

- 폴더 draft에 `parentFolderId` 추가
- 폴더 관리 폼에 부모 셀렉트 추가
- 검색 draft에 `includeDescendantFolders` 추가
- 계층형 폴더 옵션 렌더링 helper 추가

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx bookmark-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/test/folder-tag-dashboard.test.tsx apps/web/src/test/bookmark-dashboard.test.tsx apps/web/src/App.tsx apps/web/src/lib/bookmarks.ts
git commit -m "feat: add folder hierarchy search ui"
```

### Task 4: Full verification

**Files:**
- Verify only

**Step 1: Run full API suite**

Run: `npm run test:api`
Expected: PASS

**Step 2: Run full web suite**

Run: `npm run test:web`
Expected: PASS

**Step 3: Run production build**

Run: `npm run build:web`
Expected: PASS

**Step 4: Commit final slice**

```bash
git add apps/api apps/web packages/shared docs/plans/2026-04-14-folder-hierarchy-search-design.md docs/plans/2026-04-14-folder-hierarchy-search.md
git commit -m "feat: add folder hierarchy search"
```
