# Folder Picker Quick Create Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 폴더 색상/아이콘을 선택형 UI로 바꾸고, URL 등록 중 인라인 폴더 생성을 지원하며, `Failed to fetch`를 구체적인 안내 메시지로 치환한다.

**Architecture:** web 쪽에 공용 fetch helper를 먼저 도입해 네트워크 예외와 JSON 에러 코드를 분리한다. 그 위에 폴더 색상/아이콘 프리셋 상수와 렌더링 helper를 두고, 폴더 관리 폼과 북마크 저장 폼의 빠른 폴더 생성 UI가 같은 입력 모델을 재사용하도록 맞춘다.

**Tech Stack:** React, TypeScript, Vitest, Cloudflare Workers API, shared types

---

### Task 1: 공용 fetch 에러 처리 테스트 고정

**Files:**
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/test/api-client.test.ts`
- Modify: `apps/web/src/lib/folders.ts`
- Modify: `apps/web/src/lib/bookmarks.ts`

**Step 1: Write the failing test**

- 네트워크 예외가 나면 `로컬 서버에 연결하지 못했습니다. 실행 중인지 확인해주세요.`로 바뀌는 테스트 작성
- JSON `{ error: "missing_url" }` 응답을 특정 액션 메시지로 바꾸는 테스트 작성

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- api-client.test.ts`

Expected: helper 부재 또는 메시지 불일치로 FAIL

**Step 3: Write minimal implementation**

- `requestJson()` 같은 helper 추가
- network error / JSON error / fallback message 분기 구현
- 폴더/북마크 helper부터 우선 연결

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- api-client.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/test/api-client.test.ts apps/web/src/lib/folders.ts apps/web/src/lib/bookmarks.ts
git commit -m "feat: add api error normalization"
```

### Task 2: 폴더 선택 프리셋 테스트 고정

**Files:**
- Create: `apps/web/src/lib/folder-presets.ts`
- Modify: `apps/web/src/test/folder-tag-dashboard.test.tsx`
- Modify: `apps/web/src/App.tsx`

**Step 1: Write the failing test**

- 폴더 관리 폼이 텍스트 입력 대신 색상 팔레트와 아이콘 선택 버튼을 보여주는 테스트 작성
- 기존 `change` 기반 입력 테스트는 클릭 기반 선택 테스트로 바꿈

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

Expected: 기존 입력 요소 부재/새 선택 UI 부재로 FAIL

**Step 3: Write minimal implementation**

- 폴더 색상 프리셋 상수 추가
- 폴더 아이콘 프리셋 상수 추가
- App에 공용 `renderFolderColorPicker`, `renderFolderIconPicker` 또는 작은 helper 컴포넌트 추가
- 폴더 관리 폼에서 텍스트 입력 제거 후 선택형 UI로 교체

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- folder-tag-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/lib/folder-presets.ts apps/web/src/test/folder-tag-dashboard.test.tsx apps/web/src/App.tsx
git commit -m "feat: add folder color and icon pickers"
```

### Task 3: 북마크 폼 인라인 빠른 폴더 추가

**Files:**
- Modify: `apps/web/src/test/bookmark-dashboard.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/lib/folders.ts`

**Step 1: Write the failing test**

- 북마크 저장 폼에서 `새 폴더 바로 추가`를 열고 폴더를 생성하면
  - 폴더 API가 호출되고
  - 새 폴더가 저장 폴더로 자동 선택되는 테스트 작성
- 폴더가 없을 때 부모 선택이 비활성화되는 테스트 작성

**Step 2: Run test to verify it fails**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: 빠른 폴더 추가 UI 부재로 FAIL

**Step 3: Write minimal implementation**

- 북마크 폼 안에 quick folder draft/state 추가
- 접이식 `새 폴더 바로 추가` 영역 추가
- 생성 성공 시 폴더 목록 업데이트 + `bookmarkDraft.folderId` 자동 선택 + quick form 초기화

**Step 4: Run test to verify it passes**

Run: `npm run test:web -- bookmark-dashboard.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/web/src/test/bookmark-dashboard.test.tsx apps/web/src/App.tsx apps/web/src/lib/folders.ts
git commit -m "feat: add inline folder quick create"
```

### Task 4: 폴더/북마크 오류 메시지와 API 회귀 검증

**Files:**
- Modify: `apps/api/test/folders-tags-routes.test.ts`
- Modify: `apps/api/test/bookmarks-routes.test.ts`
- Modify: `apps/web/src/lib/bookmark-extract.ts`
- Modify: `apps/web/src/lib/tags.ts`
- Modify: `docs/plans/2026-04-13-bookmark-session-handoff.md`

**Step 1: Write/adjust failing tests**

- web 테스트에 네트워크 실패 메시지 치환 시나리오 추가
- 필요한 경우 API 테스트에서 생성 흐름이 기존대로 유지되는지 확인하는 케이스 보강

**Step 2: Run tests to verify failures**

Run:
- `npm run test:web -- api-client.test.ts bookmark-dashboard.test.tsx folder-tag-dashboard.test.tsx`
- `npm run test:api -- bookmarks-routes.test.ts folders-tags-routes.test.ts`

Expected: 새 메시지/새 UI 기준으로 일부 FAIL

**Step 3: Write minimal implementation**

- tag/extract helper도 공용 fetch helper로 전환
- 핸드오프 문서에 새 폴더 입력/빠른 폴더 생성 방식 반영

**Step 4: Run full verification**

Run:
- `npm run test:api`
- `npm run test:web`
- `npm run build:web`

Expected: 모두 PASS

**Step 5: Commit**

```bash
git add apps/api/test/folders-tags-routes.test.ts apps/api/test/bookmarks-routes.test.ts apps/web/src/lib/bookmark-extract.ts apps/web/src/lib/tags.ts docs/plans/2026-04-13-bookmark-session-handoff.md
git commit -m "docs: update folder picker quick create handoff"
```
