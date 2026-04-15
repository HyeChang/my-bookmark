# 모바일 북마크 카드 최적화 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모바일 화면에서 북마크 목록 카드를 더 압축적이고 터치 친화적으로 만든다.

**Architecture:** `apps/web/src/App.tsx`에서 모바일 뷰포트일 때 카드 렌더링 정보를 축약하고 액션 순서를 바꾼다. `apps/web/src/App.css`에서 모바일 액션 버튼과 요약 텍스트 배치를 조정한다. 테스트는 `bookmark-dashboard.test.tsx`에서 모바일 카드 압축 구조를 고정한다.

**Tech Stack:** React, TypeScript, Vitest, CSS

---

### Task 1: 모바일 카드 압축 구조 테스트 고정

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 모바일 뷰포트에서 북마크 카드가 개별 태그 이름과 이미지 썸네일 없이 보이는지 검증하는 테스트를 추가한다.
- 액션 버튼 순서가 `열기 -> 상세 보기 -> 수정 -> 삭제`인지 확인한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 현재 모바일에서도 데스크톱 카드가 그대로 보여 FAIL

**Step 3: Write minimal implementation**

- `App.tsx`에서 모바일 뷰포트일 때 카드 렌더링을 압축형으로 바꾼다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: compact bookmark cards on mobile"
```

### Task 2: 모바일 카드 스타일 정리

**Files:**
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write the failing test**

- 기존 모바일 카드 테스트에 축약 색상 배지와 액션 버튼 구조를 확인하는 검증을 추가한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 현재 구조와 텍스트가 달라 FAIL

**Step 3: Write minimal implementation**

- 모바일 액션을 세로 스택으로 정리한다.
- 요약을 2줄 제한 스타일로 조정하고 카드 간격을 정리한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: refine mobile bookmark card layout"
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
git add docs/plans/2026-04-15-mobile-bookmark-card-design.md docs/plans/2026-04-15-mobile-bookmark-card.md apps/web/src/App.tsx apps/web/src/App.css apps/web/src/test/bookmark-dashboard.test.tsx
git commit -m "feat: improve mobile bookmark cards"
```
