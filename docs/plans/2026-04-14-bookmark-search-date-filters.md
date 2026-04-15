# 북마크 기간형 검색 필터 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 북마크 검색에 `최근 추가`와 `최근 열람` 기간 필터를 추가한다.

**Architecture:** 기존 `GET /api/bookmarks` 엔드포인트에 기간 파라미터를 추가하고, 현재 목록 조회 결과를 라우트 레벨에서 후처리한다. `createdWithin`은 북마크 자체의 생성일을, `openedWithin`은 활동 저장소의 마지막 열람 시각을 사용한다.

**Tech Stack:** React, TypeScript, Hono, Cloudflare D1, Vitest

---

### Task 1: API 기간 필터 테스트 추가

**Files:**
- Modify: `apps/api/test/bookmarks-routes.test.ts`

**Step 1: Write the failing test**

- `createdWithin=7d` 필터 테스트를 추가한다.
- `openedWithin=7d` 필터 테스트를 추가한다.
- 잘못된 값 검증 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:api -- bookmarks-routes.test.ts`

Expected: 새 기간 필터 테스트가 실패한다.

**Step 3: Commit**

```bash
git add apps/api/test/bookmarks-routes.test.ts
git commit -m "test: cover bookmark date search filters"
```

### Task 2: 웹 검색 폼 테스트 추가

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- `최근 추가`, `최근 열람` 셀렉트 선택 시 쿼리 문자열이 포함되는지 확인한다.
- `검색 초기화` 시 두 셀렉트가 `all`로 복귀하는지 확인한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 새 라벨/쿼리 파라미터가 아직 없어 실패한다.

**Step 3: Commit**

```bash
git add apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "test: cover bookmark date filters in dashboard"
```

### Task 3: API 최소 구현

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/routes/bookmarks.ts`

**Step 1: Write minimal implementation**

- 기간 필터 타입을 공유 타입에 추가한다.
- `GET /api/bookmarks`에서 `createdWithin`, `openedWithin`을 파싱한다.
- 유효성 검사를 추가한다.
- 기존 조회 결과를 기간 기준으로 후처리한다.

**Step 2: Run targeted API test**

Run: `npm run test:api -- bookmarks-routes.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add packages/shared/src/index.ts apps/api/src/routes/bookmarks.ts apps/api/test/bookmarks-routes.test.ts
git commit -m "feat: add bookmark date search filters api"
```

### Task 4: 웹 최소 구현

**Files:**
- Modify: `apps/web/src/lib/bookmarks.ts`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write minimal implementation**

- 검색 상태에 `createdWithin`, `openedWithin`을 추가한다.
- 검색 폼에 셀렉트 두 개를 추가한다.
- `loadBookmarks()`에 쿼리 파라미터를 추가한다.
- 현재 검색 요약/초기화에도 반영한다.

**Step 2: Run targeted web test**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/lib/bookmarks.ts apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: add bookmark date search filters ui"
```

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
git commit -m "feat: add bookmark date search filters"
```
