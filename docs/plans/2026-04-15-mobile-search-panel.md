# 모바일 검색 패널 사용성 보강 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모바일 화면에서 검색 패널을 접고 펼칠 수 있게 하고, 검색 실행 흐름을 더 명확하게 만든다.

**Architecture:** `apps/web/src/App.tsx`에 모바일 검색 패널 토글 상태를 추가하고, `apps/web/src/App.css`에서 모바일 전용 검색 패널 레이아웃을 정리한다. 테스트는 `bookmark-dashboard.test.tsx`에서 모바일 기본 접힘과 토글 동작을 검증한다.

**Tech Stack:** React, TypeScript, Vitest, CSS

---

### Task 1: 모바일 검색 패널 기본 접힘 테스트 고정

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 모바일 viewport를 설정한 뒤 검색 패널이 기본적으로 접혀 있는지 확인하는 테스트를 추가한다.
- `검색/필터 열기` 버튼을 누르면 검색어 입력과 고급 필터 버튼이 보이는지 검증한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 현재는 모바일에서도 검색 패널이 기본 노출이라 실패

**Step 3: Write minimal implementation**

- `App.tsx`에 모바일 검색 패널 열림 상태를 추가한다.
- 모바일에서만 기본값이 닫힘으로 잡히도록 처리한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: add mobile search panel toggle"
```

### Task 2: 모바일 검색 패널 레이아웃 정리

**Files:**
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write the failing test**

- 모바일 토글 상태에서 액션 버튼과 필터 요약이 보이는지 기존 테스트에 확인을 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 현재 모바일 전용 토글/레이아웃이 없어 실패

**Step 3: Write minimal implementation**

- 모바일에서 `검색 실행`과 `검색 초기화`를 세로 배치한다.
- 검색 패널 토글 헤더와 활성 필터 개수 보조 텍스트를 추가한다.
- 모바일 칩과 패널 간격을 보강한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: refine mobile search panel layout"
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
git add docs/plans/2026-04-15-mobile-search-panel-design.md docs/plans/2026-04-15-mobile-search-panel.md apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: improve mobile search panel"
```
