# Folder Tree UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 폴더 관리 목록을 계층 트리처럼 보이게 정리하고 저장/검색 셀렉트와 같은 순서를 공유한다.

**Architecture:** 기존 계층 옵션 계산 로직을 폴더 목록 렌더링에도 재사용한다. 하위 폴더는 들여쓰기와 부모 보조 텍스트로 구분하고, 다음 드래그 정렬 슬라이스를 위해 행 구조를 정돈한다.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: 폴더 트리 UI RED

**Files:**
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`

**Step 1: Write the failing test**

- 상위/하위 폴더 계층 순서와 보조 텍스트를 확인하는 테스트를 추가한다.
- 북마크 저장 폼과 검색 폼 옵션 순서가 같은지 확인한다.

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`
Expected: 폴더 목록 표현/보조 텍스트가 없어 FAIL

**Step 3: Write minimal implementation**

- 폴더 관리 목록 렌더링을 계층형 행으로 정리한다.
- 부모 폴더 보조 텍스트를 추가한다.

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/test/folder-tag-dashboard.test.tsx apps/web/src/App.tsx
git commit -m "feat: refine folder tree ui"
```

### Task 2: Full verification

**Files:**
- Verify only

**Step 1: Run full API suite**

Run: `npm run test:api`
Expected: PASS

**Step 2: Run full web suite**

Run: `npm run test:web`
Expected: PASS

**Step 3: Run build**

Run: `npm run build:web`
Expected: PASS

**Step 4: Commit final slice**

```bash
git add apps/web/src/App.tsx apps/web/src/test/folder-tag-dashboard.test.tsx docs/plans/2026-04-14-folder-tree-ui-design.md docs/plans/2026-04-14-folder-tree-ui.md
git commit -m "feat: refine folder tree ui"
```
