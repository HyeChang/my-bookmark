# 북마크 검색 UI 정리 및 태그 조건 전환 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 검색 UI를 기본/고급 영역으로 정리하고 다중 태그 `AND/OR` 전환을 추가한다.

**Architecture:** 검색 상태에 `tagMode`와 고급 필터 토글 상태를 추가하고, 웹 검색 폼을 두 영역으로 재구성한다. API는 `tagMode`를 받아 저장소 필터에 전달하고, 저장소는 `and|or` 조건에 따라 다중 태그 포함 여부를 계산한다.

**Tech Stack:** React, TypeScript, Hono, Cloudflare D1, Vitest

---

### Task 1: API 실패 테스트 추가

**Files:**
- Modify: `apps/api/test/bookmarks-routes.test.ts`

**Step 1: Write the failing test**

- `tagMode=or`일 때 태그 하나만 포함한 북마크도 결과에 포함되는 테스트를 추가한다.
- 잘못된 `tagMode`가 400을 반환하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:api -- bookmarks-routes.test.ts`

Expected: 새 `tagMode` 테스트가 실패한다.

### Task 2: 웹 실패 테스트 추가

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- `고급 필터` 토글을 눌러 필터 영역이 열리는지 확인한다.
- `태그 조건`을 `하나라도 포함`으로 바꾸고 `tagMode=or`가 쿼리에 들어가는지 확인한다.
- `검색 초기화` 시 `태그 조건`이 `and`로 돌아가는지 확인한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 새 UI 구조/라벨이 없어 실패한다.

### Task 3: API 최소 구현

**Files:**
- Modify: `apps/api/src/lib/repositories/bookmarks.ts`
- Modify: `apps/api/src/routes/bookmarks.ts`

**Step 1: Write minimal implementation**

- `BookmarkListFilters`에 `tagMode`를 추가한다.
- `GET /api/bookmarks`에서 `tagMode`를 파싱하고 유효성 검사를 추가한다.
- 저장소 필터에서 `and|or`를 처리한다.

**Step 2: Run targeted API test**

Run: `npm run test:api -- bookmarks-routes.test.ts`

Expected: PASS

### Task 4: 웹 최소 구현

**Files:**
- Modify: `apps/web/src/lib/bookmarks.ts`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write minimal implementation**

- 검색 상태에 `tagMode`와 `isAdvancedSearchOpen`을 추가한다.
- 검색 폼을 `기본 검색`과 `고급 필터`로 나눈다.
- `loadBookmarks()`에 `tagMode` 파라미터를 추가한다.
- 현재 검색 표시는 칩 목록으로 바꾼다.

**Step 2: Run targeted web test**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

### Task 5: Full verification

**Files:**
- No code changes expected

**Step 1: Run API tests**

Run: `npm run test:api`

Expected: PASS

**Step 2: Run web tests**

Run: `npm run test:web`

Expected: PASS

**Step 3: Run production build**

Run: `npm run build:web`

Expected: PASS

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: refine bookmark search ui and tag mode"
```
