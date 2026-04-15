# 데스크톱 UI 현대화 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 데스크톱 기준으로 북마크 앱 화면을 더 컴팩트하고 현대적으로 재구성하고, 긴 좌측 폼과 과도한 액션 노출을 줄인다.

**Architecture:** 현재 단일 `App.tsx` 레이아웃을 유지하되, 좌측은 탐색과 진입만 담당하고 생성/수정은 모달 또는 오버레이로 옮긴다. 검색 패널은 상단 압축형 바와 팝오버형 고급 필터로 나누고, 폴더 행은 액션 메뉴 기반으로 단순화한다.

**Tech Stack:** React, TypeScript, Vitest, CSS, Testing Library

---

### Task 1: 레이아웃 앵커 테스트 고정

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 기존 테스트에 아래 앵커를 추가한다.
  - 좌측 `navigation-sidebar`
  - 중앙 `bookmark-results`
  - 우측 `bookmark-detail`
  - 좌측에 상시 `bookmark-form` region이 없어야 함
  - `새 북마크`, `새 폴더`, `태그 관리` 진입 버튼 존재

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 기존 구조와 새 앵커 불일치로 FAIL

**Step 3: Write minimal implementation**

- `apps/web/src/App.tsx`에 새 레이아웃 region 라벨과 진입 버튼 구조를 최소 구현한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/test/bookmark-dashboard.test.tsx apps/web/src/App.tsx
git commit -m "test: lock desktop layout anchors"
```

### Task 2: 좌측 탐색 패널 재배치

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`

**Step 1: Write the failing test**

- 좌측 패널이 `폴더 트리 + 진입 버튼` 중심으로 보이는 테스트를 추가한다.
- 기존 모바일 탭 테스트가 있다면 데스크톱과 충돌하지 않도록 기대값을 조정한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 데스크톱 사이드바 구조 불일치로 FAIL

**Step 3: Write minimal implementation**

- 사이드바에서 상시 북마크/폴더/태그 폼 렌더링을 제거
- `새 북마크`, `새 폴더`, `태그 관리` 진입 버튼 추가
- 폴더 트리를 좌측 주 탐색으로 배치

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: restructure desktop navigation sidebar"
```

### Task 3: 북마크 생성/수정 모달화

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- `새 북마크` 버튼을 누르면 생성 모달이 열리는 테스트 작성
- `수정` 버튼을 누르면 같은 모달이 수정 상태로 열리는 테스트 작성
- 생성/수정 후 닫힘 동작 테스트 작성

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 모달 부재로 FAIL

**Step 3: Write minimal implementation**

- 북마크 폼을 좌측 상시 렌더링에서 모달 컴포넌트처럼 감싼다
- `isBookmarkComposerOpen` 같은 상태 추가
- `editingBookmarkId`와 연동해 생성/수정 모두 같은 폼 사용

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: move bookmark compose flow into modal"
```

### Task 4: 폴더 생성/수정과 태그 관리 오버레이화

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`

**Step 1: Write the failing test**

- `새 폴더` 버튼으로 폴더 생성 모달이 열리는 테스트 작성
- 폴더 수정 시작 시 수정 모달이 열리는 테스트 작성
- `태그 관리` 버튼으로 태그 관리 패널 또는 모달이 열리는 테스트 작성

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

Expected: 상시 폼 구조와 달라 FAIL

**Step 3: Write minimal implementation**

- 폴더 폼을 오버레이로 이동
- 태그 관리도 별도 오버레이 컨테이너로 이동
- 기존 CRUD 로직은 유지

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/folder-tag-dashboard.test.tsx
git commit -m "feat: move folder and tag management into overlays"
```

### Task 5: 폴더 행 액션 메뉴화

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`

**Step 1: Write the failing test**

- 폴더 행에 `더보기` 버튼이 있고, 클릭 시 `수정`, `삭제`가 보이는 테스트 작성
- 드래그 정렬 핸들은 유지되지만 상시 큰 버튼 묶음이 사라지는지 확인하는 테스트 작성

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

Expected: 폴더 행 액션 구조 불일치로 FAIL

**Step 3: Write minimal implementation**

- 폴더 행 액션을 `menu` 스타일 구조로 변경
- 정렬/이동 관련 시각 노출 최소화
- 버튼 줄바꿈과 겹침을 막는 CSS 재작성

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/folder-tag-dashboard.test.tsx
git commit -m "feat: simplify folder row actions"
```

### Task 6: 검색 패널 압축

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 검색 패널이 `검색어 + 모드 + 정렬 + 필터 버튼` 중심으로 보이는 테스트 작성
- 고급 필터는 기본 숨김 또는 팝오버 구조라는 기대값 추가

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 기존 장문 패널 구조와 달라 FAIL

**Step 3: Write minimal implementation**

- 검색 상단을 한 줄 바 구조로 축소
- 고급 필터는 토글형 팝오버/드롭다운 컨테이너로 이동
- 활성 칩은 유지하되 시각 밀도만 줄임

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: compact desktop search panel"
```

### Task 7: 시각 톤 정리와 전체 검증

**Files:**
- Modify: `apps/web/src/App.css`
- Modify: `docs/plans/2026-04-13-bookmark-session-handoff.md`

**Step 1: Write/adjust failing tests**

- 필요한 경우 웹 테스트에서 새 버튼 라벨, 오버레이 라벨, 메뉴 구조 기대값 보강

**Step 2: Run focused tests to verify failures**

Run:
- `npm run test:web -- bookmark-dashboard.test.tsx`
- `npm run test:web -- folder-tag-dashboard.test.tsx`

Expected: 스타일/구조 기대값 차이로 일부 FAIL

**Step 3: Write minimal implementation**

- 버튼 높이, 여백, 카드 표면, 배지 색감, 오버레이 톤 조정
- 핸드오프 문서에 새 데스크톱 구조 반영

**Step 4: Run full verification**

Run:
- `npm run test:api`
- `npm run test:web`
- `npm run build:web`

Expected: 모두 PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.css docs/plans/2026-04-13-bookmark-session-handoff.md apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx apps/web/src/test/folder-tag-dashboard.test.tsx
git commit -m "feat: modernize desktop bookmark workspace"
```
