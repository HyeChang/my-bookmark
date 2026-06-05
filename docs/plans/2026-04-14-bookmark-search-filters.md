# Bookmark Search Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 북마크 검색에 `즐겨찾기만`, `폴더`, `태그` 기본 필터를 추가한다.

**Architecture:** 북마크 목록 API는 검색어/검색 모드와 함께 필터 파라미터를 받도록 확장하고, 저장소는 공통 필터 함수를 통해 목록 조회와 검색 결과를 동일하게 좁힌다. 웹은 기존 검색 폼에 필터 입력을 추가해 같은 요청 파라미터를 보낸다.

**Tech Stack:** Hono, Cloudflare D1, React, Vite, Vitest

---

### Task 1: failing test 추가

**Files:**
- Modify: `apps/api/test/bookmarks-routes.test.ts`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing tests**

- API에서 즐겨찾기/폴더/태그 필터를 단독 또는 검색어와 함께 적용하는 테스트를 추가한다.
- 웹에서 필터를 선택한 뒤 검색 실행/초기화하는 테스트를 추가한다.

**Step 2: Run tests to verify they fail**

Run: `npm run test:api -- bookmarks-routes.test.ts`
Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: missing filter handling failure

### Task 2: API 구현

**Files:**
- Modify: `apps/api/src/routes/bookmarks.ts`
- Modify: `apps/api/src/lib/repositories/bookmarks.ts`

**Step 1: Write minimal implementation**

- 필터 쿼리 파라미터 파싱
- 공통 필터 함수 추가
- 검색어 없이도 필터-only 조회 지원

**Step 2: Run targeted API test**

Run: `npm run test:api -- bookmarks-routes.test.ts`

Expected: PASS

### Task 3: 웹 구현

**Files:**
- Modify: `apps/web/src/lib/bookmarks.ts`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write minimal implementation**

- 검색 draft에 `favoriteOnly`, `folderId`, `tagId` 추가
- 검색 폼과 초기화 동작 확장
- API 요청에 필터 포함

**Step 2: Run targeted web test**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

### Task 4: 전체 검증

**Step 1: Run full verification**

Run: `npm run test:api`
Run: `npm run test:web`
Run: `npm run build:web`

Expected: all pass

### Task 5: Commit

```bash
git add docs/plans/2026-04-14-bookmark-search-filters-design.md docs/plans/2026-04-14-bookmark-search-filters.md apps/api/src/routes/bookmarks.ts apps/api/src/lib/repositories/bookmarks.ts apps/api/test/bookmarks-routes.test.ts apps/web/src/lib/bookmarks.ts apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: add bookmark search filters"
```
