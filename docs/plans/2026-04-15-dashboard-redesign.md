# Dashboard Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 현재 북마크 웹앱의 전체 UI를 조용한 운영형 작업 공간 스타일로 리디자인한다.

**Architecture:** 기존 기능 구조와 테스트 흐름은 유지하고, `apps/web/src/App.tsx`의 레이아웃 클래스와 `apps/web/src/App.css`의 스타일 시스템을 중심으로 리디자인한다. 리디자인은 데스크톱 2열 구조, 모바일 검색 패널, 모바일 작업 패널 탭, 모바일 목록 카드 구조를 보존하면서 시각 계층과 정보 밀도를 다시 조정하는 방식으로 진행한다.

**Tech Stack:** React, Vite, Vitest, CSS

---

### Task 1: 리디자인 기준 테스트 고정

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 대시보드 렌더 테스트에 새 구조 기준 텍스트 또는 클래스 기대값을 하나 추가한다.
- 예: 검색 패널 설명, 추천 섹션 헤더, 작업 패널 제목 구조 중 리디자인 이후에도 유지되어야 할 핵심 신호를 고정한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: 새 기대값이 없어 FAIL

**Step 3: Write minimal implementation**

- `App.tsx` 또는 `App.css`에 리디자인 기준 신호를 추가한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/test/bookmark-dashboard.test.tsx apps/web/src/App.tsx apps/web/src/App.css
git commit -m "test: lock dashboard redesign anchors"
```

### Task 2: 헤더와 전역 레이아웃 리디자인

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Test: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 헤더 영역의 설명 텍스트, 계정 카드 레이블, 또는 레이아웃 앵커가 새 구조와 맞는지 확인하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- `.app-shell`, `.app-hero`, `.hero-copy`, `.hero-actions`, `.dashboard-layout` 계열을 리디자인한다.
- 데스크톱 2열 구조는 유지하되 간격과 폭을 다시 조정한다.
- 계정 카드와 헤더 타이포 위계를 새 스타일로 맞춘다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: redesign dashboard shell"
```

### Task 3: 작업 패널 스택 리디자인

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Test: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 모바일 탭형 작업 패널과 데스크톱 작업 패널이 같은 제목 체계와 요약 구조를 유지하는지 검증하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- 북마크/폴더/태그 작업 패널의 시각 톤을 통일한다.
- 입력 라벨, 필드, 보조 문구, 액션 버튼 간격을 다시 맞춘다.
- 모바일 탭 헤더와 데스크톱 패널 제목이 같은 스타일 시스템을 공유하게 한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: redesign workspace panels"
```

### Task 4: 검색 패널 리디자인

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Test: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 검색 패널의 헤더, 설명, 고급 필터 그룹 구조, 활성 칩 섹션이 새 위계로 보이는지 검증하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- 검색 입력과 액션 버튼의 우선순위를 더 강하게 만든다.
- 필터 그룹의 배경면과 구분선을 다시 설계한다.
- 활성 칩은 “현재 조건” 영역으로 더 잘 읽히게 스타일을 조정한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: redesign search panel"
```

### Task 5: 추천과 상세 패널 리디자인

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Test: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 추천 섹션 헤더와 상세 패널 액션 구조가 유지되는지 검증하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- 추천 3개 컬럼은 유지하되 더 가벼운 리스트형 톤으로 조정한다.
- 상세 패널은 가장 읽기 좋은 면으로 보이게 여백과 본문 블록 위계를 재조정한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: redesign recommendations and detail panel"
```

### Task 6: 북마크 목록 카드 리디자인

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Test: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 북마크 카드의 제목, 메타, 배지, 액션 순서가 새 구조로 유지되는지 검증하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

- 데스크톱 카드의 시각 밀도와 위계를 정리한다.
- 모바일 압축형 방향은 유지하고, 데스크톱에서만 메타와 요약 구조를 재조정한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: redesign bookmark cards"
```

### Task 7: 전체 검증과 시각 점검 정리

**Files:**
- Modify: `docs/plans/2026-04-13-bookmark-session-handoff.md`

**Step 1: Run full verification**

Run: `npm run test:api`
Expected: `10 files / 50 tests` PASS or current total PASS

Run: `npm run test:web`
Expected: all PASS

Run: `npm run build:web`
Expected: build success

**Step 2: Record visual verification checklist**

- 데스크톱: 헤더, 작업 패널, 검색 패널, 추천, 상세, 목록 위계 확인
- 모바일: 검색 패널 토글, 작업 패널 탭, 카드 압축 흐름 확인

**Step 3: Update handoff if needed**

- 최신 UI 리디자인 상태와 검증 결과를 핸드오프 문서에 반영한다.

**Step 4: Commit**

```bash
git add docs/plans/2026-04-13-bookmark-session-handoff.md apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "docs: update redesign handoff"
```
