# 검색 칩 UX 정리 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 검색 패널의 활성 필터 칩을 더 읽기 쉽고 제거하기 쉬운 구조로 정리한다.

**Architecture:** 검색 로직은 유지하고 `apps/web/src/App.tsx`의 칩 텍스트 구조와 `apps/web/src/App.css`의 칩 시각 스타일만 정리한다. 테스트는 `bookmark-dashboard.test.tsx`에서 칩 텍스트와 제거 동작을 고정한다.

**Tech Stack:** React, TypeScript, Vitest, CSS

---

### Task 1: 검색 칩 텍스트 구조 테스트 고정

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 칩 제거 테스트에 `분류: 즐겨찾기만`, `검색어: paper` 같은 라벨을 기대하는 검증을 추가한다.
- 다중 태그 검색 테스트에 `분류: 태그 research`, `분류: 태그 video`가 보이는지 확인한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 칩 버튼 텍스트가 기존 단순 값이라 실패

**Step 3: Write minimal implementation**

- `apps/web/src/App.tsx`에서 활성 검색 요약 아이템 라벨을 그룹 라벨 포함 텍스트로 바꾼다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: refine search chip labels"
```

### Task 2: 검색 칩 스타일 정리

**Files:**
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write the failing test**

- 기존 웹 테스트에 칩 내부 구조가 그룹 라벨/값 단위로 렌더링되는지 확인하는 검증을 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 구조가 아직 단순 문자열이라 실패

**Step 3: Write minimal implementation**

- 칩에 그룹 라벨 span, 값 span, 제거 span을 추가한다.
- CSS에서 칩 배경, 경계, hover, 모바일 줄바꿈을 정리한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: refine search chip styles"
```

### Task 3: 전체 검증

**Files:**
- Modify: 없음

**Step 1: Run API tests**

Run: `npm run test:api`

Expected: PASS

**Step 2: Run web tests**

Run: `npm run test:web`

Expected: PASS

**Step 3: Run production build**

Run: `npm run build:web`

Expected: PASS

**Step 4: Commit**

```bash
git add docs/plans/2026-04-15-search-chip-ux-design.md docs/plans/2026-04-15-search-chip-ux.md apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: refine search chip ux"
```
