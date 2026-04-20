# Bookmark Hide Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 북마크 단위 숨김 기능을 추가하고, 폴더 숨김과 분리된 좌물쇠 토글로 목록/검색/추천/상세 표시 여부를 제어한다.

**Architecture:** `bookmarks` 테이블에 `is_hidden` 컬럼을 추가하고, 공유 타입과 API 저장소를 통해 숨김 상태를 round-trip 한다. 웹 대시보드는 `showHiddenBookmarks` 상태를 따로 두고, 기존 `showHiddenFolders`와 독립적으로 북마크 데이터만 필터링한다.

**Tech Stack:** Cloudflare D1, Hono, React, TypeScript, Vitest

---

### Task 1: 북마크 숨김 API RED/GREEN

**Files:**
- Create: `apps/api/migrations/0005_hidden_bookmarks.sql`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/lib/repositories/bookmarks.ts`
- Modify: `apps/api/src/routes/bookmarks.ts`
- Modify: `apps/api/test/bookmarks-routes.test.ts`

**Step 1: Write the failing test**

- `apps/api/test/bookmarks-routes.test.ts`에 아래 케이스를 추가한다.
- 숨김 북마크 생성 시 응답에 `isHidden: true`가 내려오는지 검증한다.
- 숨김 북마크 수정 시 `PATCH /api/bookmarks/:id`로 상태가 바뀌는지 검증한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:api -- bookmarks-routes.test.ts`
Expected: `isHidden` 누락 또는 `no such column: is_hidden`로 FAIL

**Step 3: Write minimal implementation**

- `bookmarks` 테이블에 `is_hidden` 컬럼을 추가하는 마이그레이션을 만든다.
- 공유 타입 `Bookmark`, `CreateBookmarkRequest`, `UpdateBookmarkRequest`에 `isHidden?: boolean`을 추가한다.
- `BookmarkRow`, `toBookmarkRecord`, `toBookmarkResponse`, `create`, `update`, `getByUserAndId`, `listBookmarksByUser`에 `is_hidden` 매핑을 추가한다.
- 라우트 `POST /api/bookmarks`와 `PATCH /api/bookmarks/:bookmarkId`가 `isHidden`을 저장하도록 연결한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:api -- bookmarks-routes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/migrations/0005_hidden_bookmarks.sql packages/shared/src/index.ts apps/api/src/lib/repositories/bookmarks.ts apps/api/src/routes/bookmarks.ts apps/api/test/bookmarks-routes.test.ts
git commit -m "feat: add hidden bookmark api support"
```

### Task 2: 웹 북마크 작성/수정 숨김 UI RED/GREEN

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 북마크 작성 모달에서 `숨김 북마크` 체크를 켜고 저장하면 요청 payload에 `isHidden: true`가 들어가는 테스트를 추가한다.
- 수정 흐름에서 숨김 북마크 체크를 바꾸면 `PATCH` payload가 갱신되는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: 숨김 체크 UI가 없거나 payload에 `isHidden`이 없어 FAIL

**Step 3: Write minimal implementation**

- 북마크 draft 초기값에 `isHidden: false`를 추가한다.
- 북마크 작성/수정 UI에 `숨김 북마크` 체크를 추가한다.
- `POST /api/bookmarks`, `PATCH /api/bookmarks/:id` 호출 payload에 `isHidden`을 포함한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: add bookmark hide controls"
```

### Task 3: 북마크 숨김 토글과 목록 필터 RED/GREEN

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 저장된 북마크 헤더에 `숨김 북마크 보기` 버튼이 보이는지 확인한다.
- 숨김 북마크가 기본적으로 목록, 검색, 추천에서 감춰지는지 테스트한다.
- 토글을 켜면 같은 북마크가 다시 보이는지 테스트한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: 북마크 숨김 토글이 없고 숨김 필터도 적용되지 않아 FAIL

**Step 3: Write minimal implementation**

- `showHiddenBookmarks` 상태를 추가한다.
- 북마크 데이터 필터 함수에 `bookmark.isHidden` 조건을 추가한다.
- 저장된 북마크 헤더 액션에 좌물쇠 토글을 추가한다.
- 검색 결과, 추천 데이터 계산, 리스트 렌더링이 `showHiddenBookmarks`를 따르도록 정리한다.
- 토글 스타일을 기존 폴더 숨김 버튼과 같은 톤으로 맞춘다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: add hidden bookmark visibility toggle"
```

### Task 4: 폴더 숨김과 북마크 숨김 독립성 RED/GREEN

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 숨김 폴더 토글을 켜지 않은 상태에서 숨김 폴더의 북마크는 북마크 숨김 토글만 켜도 보이지 않는지 테스트한다.
- 북마크 숨김 토글을 끈 상태에서 일반 폴더의 숨김 북마크는 계속 감춰지는지 테스트한다.
- 숨김 상태인 북마크가 상세 선택 중일 때 토글을 끄면 상세가 정리되는지 테스트한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: 폴더 숨김/북마크 숨김 경계가 섞여 FAIL

**Step 3: Write minimal implementation**

- 가시성 계산을 `숨김 폴더`와 `숨김 북마크` 두 조건으로 분리한다.
- 상세 선택 북마크가 현재 가시 조건에서 제외되면 선택 해제 로직을 추가한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "fix: separate folder and bookmark hidden visibility"
```

### Task 5: Full verification and migration readiness

**Files:**
- Verify only

**Step 1: Run bookmark API tests**

Run: `npm run test:api -- bookmarks-routes.test.ts`
Expected: PASS

**Step 2: Run full API suite**

Run: `npm run test:api`
Expected: PASS

**Step 3: Run web bookmark tests**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: PASS

**Step 4: Run full web suite**

Run: `npm run test:web`
Expected: PASS

**Step 5: Run web build**

Run: `npm run build:web`
Expected: PASS

**Step 6: Apply local migration if needed**

Run: `npx wrangler d1 migrations apply bookmark --local`
Expected: `0005_hidden_bookmarks.sql` applied successfully

**Step 7: Commit final slice**

```bash
git add apps/api/migrations/0005_hidden_bookmarks.sql packages/shared/src/index.ts apps/api/src/lib/repositories/bookmarks.ts apps/api/src/routes/bookmarks.ts apps/api/test/bookmarks-routes.test.ts apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx docs/plans/2026-04-17-bookmark-hide-design.md docs/plans/2026-04-17-bookmark-hide.md
git commit -m "feat: add bookmark hidden visibility controls"
```
