# Dashboard Card UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 추천 카드와 북마크 카드의 상태 표현을 강화해 목록을 더 빨리 읽고 행동할 수 있게 만든다.

**Architecture:** API는 유지하고, `apps/web/src/App.tsx`에서 카드 메타 계산 헬퍼와 카드 구조를 확장한다. 스타일은 `apps/web/src/App.css`에 추가하고, 웹 테스트는 추천/목록 카드 상태 표면을 먼저 실패시키고 맞춘다.

**Tech Stack:** React, Vite, Vitest, Testing Library, CSS

---

### Task 1: 카드 UX 설계 문서화

**Files:**
- Create: `docs/plans/2026-04-15-dashboard-card-ux-design.md`
- Create: `docs/plans/2026-04-15-dashboard-card-ux.md`

**Step 1: 설계 문서 작성**

- 카드 UX 목표, 추천 이유 배지, 상태 배지, 색상 메타 범위를 문서로 저장한다.

**Step 2: 문서 커밋**

Run:

```bash
git add docs/plans/2026-04-15-dashboard-card-ux-design.md docs/plans/2026-04-15-dashboard-card-ux.md
git commit -m "docs: add dashboard card ux plan"
```

### Task 2: 웹 테스트 추가

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: 실패하는 테스트 작성**

- 추천 카드에 `즐겨찾기 기반`, `최근 열람 기반`, `반복 열람 기반`이 보인다고 기대한다.
- 북마크 카드에 `수동 요약`, `태그 1개`, `북마크 색상`, `URL 색상`이 보인다고 기대한다.
- 이미지가 있을 때 `이미지 1장` 배지를 기대한다.

**Step 2: 실패 확인**

Run:

```bash
npm run test:web -- bookmark-dashboard.test.tsx
```

Expected:

- 카드 메타 텍스트를 찾지 못해 FAIL

### Task 3: 카드 메타 계산 구현

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: 최소 구현**

- 추천 종류별 이유 라벨 헬퍼 추가
- 북마크 요약 상태 라벨 헬퍼 추가
- 카드 메타 배지 렌더링 추가
- 이미지 수와 색상 메타 렌더링 추가

**Step 2: 테스트 재실행**

Run:

```bash
npm run test:web -- bookmark-dashboard.test.tsx
```

Expected:

- PASS

### Task 4: 스타일 보강

**Files:**
- Modify: `apps/web/src/App.css`

**Step 1: 카드 배지/메타 스타일 추가**

- 추천 이유 배지
- 상태 배지
- 색상칩
- 카드 hover 정리

**Step 2: 전체 검증**

Run:

```bash
npm run test:api
npm run test:web
npm run build:web
```

Expected:

- 전체 PASS

### Task 5: 기능 커밋

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: 커밋**

Run:

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: refine dashboard cards"
```
