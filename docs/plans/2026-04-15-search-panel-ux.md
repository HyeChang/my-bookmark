# Search Panel UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 검색 패널을 더 읽기 쉽고 조작하기 쉬운 구조로 정리한다.

**Architecture:** API는 유지하고 `apps/web/src/App.tsx`에서 검색 패널 JSX 구조를 그룹형으로 정리한다. `apps/web/src/App.css`에 그룹 카드, 요약 영역, 버튼 상태 스타일을 추가하고, 웹 테스트는 검색 패널 구조와 상태 라벨부터 실패시키고 맞춘다.

**Tech Stack:** React, Vite, Vitest, Testing Library, CSS

---

### Task 1: 설계 문서 저장

**Files:**
- Create: `docs/plans/2026-04-15-search-panel-ux-design.md`
- Create: `docs/plans/2026-04-15-search-panel-ux.md`

**Step 1: 설계/계획 문서 작성**

- 검색 패널 구조, 그룹 이름, 상태 요약 범위를 문서로 저장한다.

**Step 2: 문서 커밋**

```bash
git add docs/plans/2026-04-15-search-panel-ux-design.md docs/plans/2026-04-15-search-panel-ux.md
git commit -m "docs: add search panel ux plan"
```

### Task 2: 실패하는 웹 테스트 작성

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: 테스트 추가**

- 고급 필터 버튼이 `고급 필터 열기`로 시작하는지 기대
- 버튼 클릭 후 `고급 필터 접기`, `기간`, `분류`, `상태`가 보인다고 기대
- 검색 적용 후 `선택된 필터 n개`가 보인다고 기대

**Step 2: 실패 확인**

```bash
npm run test:web -- bookmark-dashboard.test.tsx
```

Expected:

- 새 구조/문구를 찾지 못해 FAIL

### Task 3: 검색 패널 구조 구현

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: 최소 구현**

- 고급 필터 버튼 라벨 토글
- 고급 필터 그룹 제목 추가
- 활성 필터 요약 제목과 개수 표시

**Step 2: 대상 테스트 재실행**

```bash
npm run test:web -- bookmark-dashboard.test.tsx
```

Expected:

- PASS

### Task 4: 스타일 보강

**Files:**
- Modify: `apps/web/src/App.css`

**Step 1: 패널/그룹/요약 스타일 추가**

- 그룹 섹션 카드
- 요약 헤더
- 모바일 버튼 배치

**Step 2: 전체 검증**

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

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: refine search panel ux"
```
