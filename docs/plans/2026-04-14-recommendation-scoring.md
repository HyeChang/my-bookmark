# Recommendation Scoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 추천 섹션의 응답 스키마는 유지하면서 사용 빈도, 최근성, 폴더/태그 문맥을 반영한 정렬 규칙으로 고도화한다.

**Architecture:** 활동 저장소는 북마크별 열람 통계를 반환하고, 추천 라우트는 전체 북마크와 활동 통계를 결합해 섹션별 점수를 계산한다. 웹은 기존 추천 배열을 그대로 렌더링한다.

**Tech Stack:** Hono, Cloudflare D1, React, Vite, Vitest

---

### Task 1: failing test 추가

**Files:**
- Modify: `apps/api/test/recommendations-routes.test.ts`
- Modify: `apps/api/test/bookmarks-routes.test.ts`

**Step 1: Write the failing tests**

- 문맥 가산점과 열람 통계 기반 정렬을 검증하는 추천 라우트 테스트를 추가한다.
- 활동 저장소 test double에 새 메서드 요구사항을 반영한다.

**Step 2: Run tests to verify they fail**

Run: `npm run test:api -- recommendations-routes.test.ts`

Expected: missing stats method / old ordering failure

### Task 2: 활동 저장소/추천 라우트 구현

**Files:**
- Modify: `apps/api/src/lib/repositories/bookmark-activity.ts`
- Modify: `apps/api/src/routes/recommendations.ts`

**Step 1: Write minimal implementation**

- `listOpenStats()` 추가
- 문맥 추론 및 섹션별 점수 계산
- 기존 응답 형태 유지

**Step 2: Run targeted API tests**

Run: `npm run test:api -- recommendations-routes.test.ts`
Run: `npm run test:api -- bookmarks-routes.test.ts`

Expected: PASS

### Task 3: 전체 검증

**Step 1: Run full verification**

Run: `npm run test:api`
Run: `npm run test:web`
Run: `npm run build:web`

Expected: all pass

### Task 4: Commit

```bash
git add docs/plans/2026-04-14-recommendation-scoring-design.md docs/plans/2026-04-14-recommendation-scoring.md apps/api/src/lib/repositories/bookmark-activity.ts apps/api/src/routes/recommendations.ts apps/api/test/recommendations-routes.test.ts apps/api/test/bookmarks-routes.test.ts
git commit -m "feat: enhance recommendation scoring"
```
