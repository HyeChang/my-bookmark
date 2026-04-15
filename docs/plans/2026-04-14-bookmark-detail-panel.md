# Bookmark Detail Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 북마크 목록에서 선택한 항목의 상세 정보를 같은 화면 안에서 볼 수 있는 상세 패널을 추가한다.

**Architecture:** 기존 북마크 목록과 편집 폼은 유지하고, 선택된 북마크 상태를 별도로 관리하는 인페이지 상세 패널을 추가한다. 상세 데이터는 기존 `/api/bookmarks/:id`와 자산 조회 API를 재사용해 불러온다.

**Tech Stack:** React, TypeScript, Vite, Testing Library, Hono API

---

### Task 1: 상세 패널 테스트 추가

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- `상세 보기` 클릭 후 상세 패널이 열리고 상세 값이 보이는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 상세 패널 관련 assertion fail

**Step 3: Commit**

- 이 단계에서는 커밋하지 않는다.

### Task 2: 상세 조회 클라이언트 추가

**Files:**
- Modify: `apps/web/src/lib/bookmarks.ts`

**Step 1: Write minimal implementation**

- `loadBookmark(bookmarkId)`를 추가해 `/api/bookmarks/:id`를 호출한다.

**Step 2: Run targeted test if needed**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 아직 fail

### Task 3: 상세 패널 UI와 상태 추가

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: Write minimal implementation**

- 선택된 북마크 상태
- 상세 패널 열기/닫기 함수
- 상세 패널 UI
- `수정 시작`에서 기존 편집 흐름 재사용

**Step 2: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

### Task 4: 전체 검증

**Files:**
- No code changes

**Step 1: Run full verification**

Run: `npm run test:api`
Run: `npm run test:web`
Run: `npm run build:web`

Expected: all pass

### Task 5: Commit

**Files:**
- Stage relevant files for detail panel

**Step 1: Commit**

```bash
git add docs/plans/2026-04-14-bookmark-detail-panel-design.md docs/plans/2026-04-14-bookmark-detail-panel.md apps/web/src/lib/bookmarks.ts apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: add bookmark detail panel"
```
