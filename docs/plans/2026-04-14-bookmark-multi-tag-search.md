# 북마크 다중 태그 검색 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 북마크 검색의 태그 필터를 다중 선택 AND 검색으로 확장한다.

**Architecture:** 검색 상태는 `tagIds: string[]`를 사용하고, 웹은 체크박스 목록으로 여러 태그를 선택한다. API는 반복된 `tagId` 쿼리 파라미터를 읽어 배열로 정규화하고, 저장소 필터에서 선택된 모든 태그가 포함되는지 검사한다.

**Tech Stack:** React, TypeScript, Hono, Cloudflare D1, Vitest

---

### Task 1: API 실패 테스트 추가

**Files:**
- Modify: `apps/api/test/bookmarks-routes.test.ts`

**Step 1: Write the failing test**

- `tagId`가 두 번 들어왔을 때 두 태그를 모두 가진 북마크만 반환하는 테스트를 추가한다.
- 검색어와 다중 태그를 같이 쓴 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:api -- bookmarks-routes.test.ts`

Expected: 새 다중 태그 필터 테스트가 실패한다.

### Task 2: 웹 실패 테스트 추가

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 검색 폼에서 태그 체크박스 두 개를 선택하고 `tagId` 반복 쿼리로 요청하는지 확인한다.
- `검색 초기화` 시 두 체크박스가 모두 해제되는지 확인한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 기존 단일 셀렉트 UI와 맞지 않아 실패한다.

### Task 3: API 최소 구현

**Files:**
- Modify: `apps/api/src/lib/repositories/bookmarks.ts`
- Modify: `apps/api/src/routes/bookmarks.ts`

**Step 1: Write minimal implementation**

- 필터 타입을 `tagIds?: string[]`로 확장한다.
- 반복된 `tagId` 파라미터를 모두 읽는다.
- 저장소 필터에서 선택된 태그가 모두 포함되는지 검사한다.

**Step 2: Run targeted API test**

Run: `npm run test:api -- bookmarks-routes.test.ts`

Expected: PASS

### Task 4: 웹 최소 구현

**Files:**
- Modify: `apps/web/src/lib/bookmarks.ts`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write minimal implementation**

- 검색 상태를 `tagIds: string[]`로 바꾼다.
- 검색 폼의 태그 필터를 체크박스 목록으로 바꾼다.
- `loadBookmarks()`에서 `tagId`를 반복 추가한다.
- 태그 삭제/검색 초기화/검색 요약에 맞춰 상태를 정리한다.

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
git commit -m "feat: add bookmark multi-tag search"
```
