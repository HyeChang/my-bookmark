# Bookmark Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 북마크 삭제 기능을 추가해 목록/상세 패널에서 항목을 제거하고 연관 데이터도 함께 정리한다.

**Architecture:** 기존 북마크 라우트에 삭제 엔드포인트를 추가하고, 저장소 계층에서 북마크와 연관 레코드를 함께 지운다. 웹은 공용 삭제 클라이언트를 통해 상태를 갱신하고 상세 패널/추천 UI를 정리한다.

**Tech Stack:** Hono, Cloudflare D1/R2, React, Vite, Testing Library

---

### Task 1: 삭제 failing test 추가

**Files:**
- Modify: `apps/api/test/bookmarks-routes.test.ts`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing tests**

- API 삭제 성공과 상세 패널/목록 삭제 시나리오를 추가한다.

**Step 2: Run tests to verify they fail**

Run: `npm run test:api -- bookmarks-routes.test.ts`
Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: delete route/button missing failure

### Task 2: API 삭제 구현

**Files:**
- Modify: `apps/api/src/lib/repositories/bookmarks.ts`
- Modify: `apps/api/src/routes/bookmarks.ts`

**Step 1: Write minimal implementation**

- `BookmarkRepository.delete()` 추가
- 연관 테이블 정리
- R2 객체 정리와 route 연결

**Step 2: Run targeted API test**

Run: `npm run test:api -- bookmarks-routes.test.ts`

Expected: PASS

### Task 3: 웹 삭제 구현

**Files:**
- Modify: `apps/web/src/lib/bookmarks.ts`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write minimal implementation**

- `deleteBookmark()` 추가
- 목록/상세 패널 삭제 버튼
- `confirm` 확인
- 삭제 후 관련 상태 정리

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
git add docs/plans/2026-04-14-bookmark-delete-design.md docs/plans/2026-04-14-bookmark-delete.md apps/api/src/lib/repositories/bookmarks.ts apps/api/src/routes/bookmarks.ts apps/api/test/bookmarks-routes.test.ts apps/web/src/lib/bookmarks.ts apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: add bookmark deletion"
```
