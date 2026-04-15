# Search Filter Chip Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 북마크 검색 조건 칩을 클릭해서 개별 해제할 수 있게 만든다.

**Architecture:** 검색 요약 문자열 배열을 칩 모델 배열로 바꾸고, 각 칩에 대응하는 `nextSearch` 계산 로직을 둔다. 칩 클릭 시 공용 검색 적용 함수를 호출해 draft/applied 상태와 목록 데이터를 함께 갱신한다.

**Tech Stack:** React, TypeScript, Vitest, Testing Library

---

### Task 1: 웹 테스트 추가

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 검색 실행 후 조건 칩이 보이는지 확인한다.
- 칩 클릭 시 해당 조건만 제거된 URL로 다시 호출되는지 확인한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

**Step 3: Write minimal implementation**

- `apps/web/src/App.tsx`

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: add search filter chip actions"
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
git add docs/plans/2026-04-14-search-filter-chip-actions-design.md docs/plans/2026-04-14-search-filter-chip-actions.md apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: add search filter chip actions"
```
