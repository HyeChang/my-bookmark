# Local Launcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 더블클릭 한 번으로 `build:web`, `dev:api`, 브라우저 열기를 실행하는 Windows 로컬 런처를 추가한다.

**Architecture:** 루트의 `.cmd` 파일을 사용자 진입점으로 두고, 실제 제어 로직은 `scripts/start-bookmark-local.ps1`에 둔다. 테스트 가능한 판단 로직은 작은 Node helper 모듈로 분리해 Node 내장 테스트로 먼저 고정한다.

**Tech Stack:** Windows CMD, PowerShell 7, Node.js 내장 테스트, npm scripts, Wrangler dev

---

### Task 1: 런처 helper 테스트 고정

**Files:**
- Create: `scripts/start-bookmark-local-lib.mjs`
- Create: `scripts/start-bookmark-local-lib.test.mjs`

**Step 1: Write the failing test**

- helper가 아래를 반환해야 한다고 테스트를 먼저 쓴다.
  - 기본 URL: `http://localhost:8787`
  - PowerShell 스크립트 상대 경로
  - 브라우저 열기 지연 시간

**Step 2: Run test to verify it fails**

Run: `node --test scripts/start-bookmark-local-lib.test.mjs`

Expected: helper 모듈 또는 export 누락으로 FAIL

**Step 3: Write minimal implementation**

- `getLauncherConfig(repoRoot)` 같은 함수로 필요한 값만 반환한다.

**Step 4: Run test to verify it passes**

Run: `node --test scripts/start-bookmark-local-lib.test.mjs`

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/start-bookmark-local-lib.mjs scripts/start-bookmark-local-lib.test.mjs
git commit -m "test: lock local launcher config"
```

### Task 2: PowerShell 런처 구현

**Files:**
- Modify: `scripts/start-bookmark-local-lib.mjs`
- Create: `scripts/start-bookmark-local.ps1`

**Step 1: Write the failing test**

- helper에 PowerShell에서 쓸 명령 문자열 또는 실행 순서 값을 노출하는 테스트를 추가한다.

**Step 2: Run test to verify it fails**

Run: `node --test scripts/start-bookmark-local-lib.test.mjs`

Expected: 새 속성 누락으로 FAIL

**Step 3: Write minimal implementation**

- PowerShell 스크립트는
  - 프로젝트 루트 이동
  - `npm run build:web`
  - 브라우저 열기 시도
  - `npm run dev:api`
  - 실패 시 안내 후 종료 코드 반환
  를 수행한다.

**Step 4: Run test to verify it passes**

Run: `node --test scripts/start-bookmark-local-lib.test.mjs`

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/start-bookmark-local-lib.mjs scripts/start-bookmark-local.ps1
git commit -m "feat: add local launcher powershell flow"
```

### Task 3: 더블클릭 진입점 추가

**Files:**
- Create: `start-bookmark-local.cmd`

**Step 1: Write the failing test**

- helper 테스트에 `.cmd`가 기대하는 PowerShell 파일명과 진입 흐름 값을 먼저 추가한다.

**Step 2: Run test to verify it fails**

Run: `node --test scripts/start-bookmark-local-lib.test.mjs`

Expected: launcher entry 속성 누락으로 FAIL

**Step 3: Write minimal implementation**

- `.cmd`에서 PowerShell 7이 있으면 우선 사용하고, 없으면 기본 `powershell.exe`로 fallback 한다.
- `-ExecutionPolicy Bypass -NoExit -File`로 스크립트를 실행한다.
- 오류 시 `pause`로 창을 유지한다.

**Step 4: Run test to verify it passes**

Run: `node --test scripts/start-bookmark-local-lib.test.mjs`

Expected: PASS

**Step 5: Commit**

```bash
git add start-bookmark-local.cmd scripts/start-bookmark-local-lib.mjs scripts/start-bookmark-local-lib.test.mjs
git commit -m "feat: add one-click local launcher entry"
```

### Task 4: 수동 검증 및 문서 보강

**Files:**
- Modify: `docs/plans/2026-04-13-bookmark-session-handoff.md`

**Step 1: Run focused verification**

Run:
- `node --test scripts/start-bookmark-local-lib.test.mjs`
- `npm run test:api`
- `npm run test:web`
- `npm run build:web`

Expected: 모두 PASS

**Step 2: Manual verification**

- `start-bookmark-local.cmd` 실행
- 브라우저가 `http://localhost:8787`로 열리는지 확인
- `npm run dev:api`가 같은 창에서 유지되는지 확인

**Step 3: Update handoff**

- 로컬 실행 섹션에 더블클릭 런처 사용법을 추가한다.

**Step 4: Commit**

```bash
git add docs/plans/2026-04-13-bookmark-session-handoff.md
git commit -m "docs: add local launcher handoff notes"
```
