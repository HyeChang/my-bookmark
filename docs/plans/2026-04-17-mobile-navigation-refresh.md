# Mobile Navigation Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모바일 화면을 탐색 우선 구조로 재구성해 폴더, 북마크, 추천을 각각 분리된 탭으로 보여주고 헤더와 카드 UI를 컴팩트하게 정리한다.

**Architecture:** 기존 데스크톱 레이아웃은 유지하고, 모바일 분기만 `App.tsx`와 `App.css`에서 별도 최적화한다. 모바일 탭 기본값을 폴더로 바꾸고, 등록/관리 기능은 헤더의 등록 버튼과 햄버거 메뉴에서 전체화면 오버레이로 여는 흐름으로 통일한다.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Cloudflare Workers

---

### Task 1: 모바일 탭 회귀 테스트 갱신

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`

**Step 1: Write the failing test**

- 모바일 탭이 `폴더 / 북마크 / 추천`으로 보이는지 검증한다.
- 기본 선택 탭이 `폴더`인지 검증한다.
- 모바일 헤더에 `등록` 버튼과 `모바일 메뉴` 버튼이 보이는지 검증한다.
- 모바일 북마크 카드 액션이 `열기`, `상세`만 노출되는지 검증한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 모바일 탭/헤더/카드 기대값 불일치로 실패

### Task 2: 모바일 앱 구조 정리

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: Fix mobile navigation state**

- 모바일 탭 타입과 기본값을 `folder / bookmark / recommendation`으로 유지한다.
- 폴더 선택 시 모바일에서 북마크 탭으로 자동 전환되는 흐름을 유지한다.
- 모바일 오버레이 조건을 새 상태명으로 정리한다.

**Step 2: Fix mobile rendering**

- 모바일 헤더를 `등록 + 햄버거` 구조로 고정한다.
- 모바일 탭 패널은 `폴더`, `북마크`, `추천`만 렌더한다.
- 북마크 목록은 모바일에서 제목 + 한 줄 요약 + `열기/상세`만 보이게 정리한다.
- 모바일에서 폴더 드래그/정렬/인라인 더보기 UI를 숨긴다.

### Task 3: 모바일 스타일 정리

**Files:**
- Modify: `apps/web/src/App.css`

**Step 1: Compact mobile header**

- 모바일 헤더의 높이, 타이포, 액션 버튼 크기를 줄인다.
- 햄버거 메뉴와 등록 버튼이 좁은 폭에서도 깨지지 않게 조정한다.

**Step 2: Compact mobile cards and panels**

- 폴더 탭과 북마크 카드가 한 손으로 읽기 쉬운 밀도로 보이게 간격과 폰트 크기를 줄인다.
- 카드 액션을 가로 배치로 유지하고 긴 텍스트는 1줄 요약으로 제한한다.

### Task 4: Verify and deploy

**Files:**
- No code changes expected

**Step 1: Run focused verification**

Run: `npm run test:web -- pwa-install.test.tsx`
Run: `npm run test:web -- bookmark-dashboard.test.tsx`
Run: `npm run build --workspace apps/web`

**Step 2: Deploy**

Run: `npx wrangler deploy`

Expected: 테스트와 빌드가 모두 통과하고 최신 모바일 UI가 Workers에 배포됨
