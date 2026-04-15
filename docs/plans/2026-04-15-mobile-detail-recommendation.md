# 모바일 추천/상세 패널 정리 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모바일 화면에서 추천 링크와 북마크 상세 패널의 가독성과 터치 사용성을 높인다.

**Architecture:** `apps/web/src/App.tsx`에서 상세 패널 액션 순서와 구조를 정리하고, `apps/web/src/App.css`에서 모바일 전용 추천 항목/상세 패널 액션 배치와 간격을 조정한다. 테스트는 `bookmark-dashboard.test.tsx`에서 상세 패널 액션 순서를 고정한다.

**Tech Stack:** React, TypeScript, Vitest, CSS

---

### Task 1: 상세 패널 액션 순서 테스트 고정

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 상세 패널 테스트에 버튼 순서가 `열기 -> 수정 시작 -> 자동 추출 다시 시도 -> 사용자 입력 초기화 -> 닫기 -> 삭제`인지 검증을 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 현재 순서가 다르므로 FAIL

**Step 3: Write minimal implementation**

- `apps/web/src/App.tsx`에서 상세 패널 액션 버튼 순서를 재배치한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: reorder detail panel actions"
```

### Task 2: 모바일 추천/상세 패널 레이아웃 정리

**Files:**
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write the failing test**

- 기존 상세 패널 테스트에 버튼 그룹 구조 또는 액션 컨테이너 존재 확인을 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 현재 단일 액션 행이라 FAIL

**Step 3: Write minimal implementation**

- 추천 항목의 버튼을 모바일에서 전체 폭으로 보이도록 CSS 조정
- 상세 패널 액션을 `주요/보조/위험` 흐름에 맞게 구조화
- 모바일에서 상세 액션은 세로 스택, 이미지 그리드는 1열로 조정

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: refine mobile detail recommendation layout"
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
git add docs/plans/2026-04-15-mobile-detail-recommendation-design.md docs/plans/2026-04-15-mobile-detail-recommendation.md apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: improve mobile detail and recommendations"
```
