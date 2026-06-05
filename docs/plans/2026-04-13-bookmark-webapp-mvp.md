# 북마크 웹 MVP 구현 계획서

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**목표:** Google 로그인, 폴더, 태그, 즐겨찾기, 수동/자동 북마크 콘텐츠 수집, 이미지 업로드, 검색 모드, 규칙 기반 추천을 포함한 첫 번째 공개 웹앱 릴리스를 구축한다.

**아키텍처:** TypeScript 워크스페이스를 구성하고 `apps/web`에는 React PWA, `apps/api`에는 Hono 기반 Cloudflare Worker API를 둔다. 빌드된 SPA와 Worker를 하나의 Cloudflare Worker 오리진에서 함께 배포하여 브라우저, 세션 쿠키, 이후 크롬 확장 프로그램이 같은 API 오리진을 공유하도록 한다. 관계형 데이터는 D1, 업로드 이미지는 R2에 저장한다.

**기술 스택:** TypeScript, npm workspaces, Vite, React, React Router, Hono, Cloudflare Workers, D1 (SQLite + FTS5), R2, Vitest, Testing Library, Wrangler, vite-plugin-pwa

---

## 작업 원칙

- 패키지 관리는 모두 `npm` 사용
- 프론트엔드와 백엔드의 공용 타입은 `packages/shared`에 배치
- MVP에서는 ORM 대신 D1 SQL migration 사용
- 라우트 핸들러 안에 SQL을 직접 흩뿌리지 말고 repository 함수로 분리
- 순수 설정/부트스트랩 작업은 억지로 TDD를 만들지 말고, 명령 결과로 검증

### 작업 1: 워크스페이스 초기 구성

**파일:**
- 생성: `package.json`
- 생성: `.gitignore`
- 생성: `tsconfig.base.json`
- 생성: `wrangler.toml`
- 생성: `apps/web/package.json`
- 생성: `apps/web/tsconfig.json`
- 생성: `apps/api/package.json`
- 생성: `apps/api/tsconfig.json`
- 생성: `packages/shared/package.json`
- 생성: `packages/shared/tsconfig.json`

**Step 1: 루트 워크스페이스 파일 생성**

```json
{
  "name": "bookmark",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:web": "npm run dev --workspace apps/web",
    "dev:api": "npm run dev --workspace apps/api",
    "build:web": "npm run build --workspace apps/web",
    "test:web": "npm run test --workspace apps/web",
    "test:api": "npm run test --workspace apps/api"
  }
}
```

**Step 2: 앱 패키지 스캐폴딩**

실행:

```powershell
npm create vite@latest apps/web -- --template react-ts
npm create hono@latest apps/api -- --template cloudflare-workers
```

기대 결과: 두 스캐폴드가 프레임워크 재선택 없이 정상 종료된다.

**Step 3: 공용 패키지와 기본 TypeScript 설정 추가**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true
  }
}
```

**Step 4: 루트 의존성 설치**

실행:

```powershell
npm install
```

기대 결과: 루트에 단일 lockfile이 생성된다.

**Step 5: 워크스페이스 검증**

실행:

```powershell
npm run build:web
```

기대 결과: 기본 Vite 앱이 정상 빌드된다.

**Step 6: 커밋**

```powershell
git add .
git commit -m "chore: bootstrap bookmark workspace"
```

### 작업 2: Worker 기본 뼈대와 공용 타입 추가

**파일:**
- 수정: `apps/api/src/index.ts`
- 생성: `apps/api/src/env.ts`
- 생성: `apps/api/src/lib/json.ts`
- 생성: `apps/api/src/routes/health.ts`
- 생성: `apps/api/test/health.test.ts`
- 생성: `packages/shared/src/types.ts`
- 수정: `wrangler.toml`

**Step 1: 실패하는 Worker health 테스트 작성**

```ts
import { describe, expect, it } from 'vitest'
import app from '../src/index'

describe('health route', () => {
  it('returns ok payload', async () => {
    const res = await app.request('http://example.com/api/health')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })
})
```

**Step 2: 테스트가 실패하는지 확인**

실행:

```powershell
npm run test:api -- health.test.ts
```

기대 결과: 라우트가 없어서 FAIL.

**Step 3: Worker 엔트리와 라우트 마운트 구현**

```ts
import { Hono } from 'hono'
import { healthRoute } from './routes/health'

const app = new Hono()
app.route('/api/health', healthRoute)

export default app
```

**Step 4: 이후 SPA를 같은 오리진에서 서빙하도록 Worker 설정**

```toml
name = "bookmark"
main = "./apps/api/src/index.ts"
compatibility_date = "2026-04-13"

[assets]
directory = "./apps/web/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]
```

**Step 5: 테스트 통과 확인**

실행:

```powershell
npm run test:api -- health.test.ts
```

기대 결과: PASS.

**Step 6: 커밋**

```powershell
git add apps/api packages/shared wrangler.toml
git commit -m "feat: add worker skeleton and health route"
```

### 작업 3: React 앱 셸과 PWA 프레임 추가

**파일:**
- 수정: `apps/web/src/main.tsx`
- 생성: `apps/web/src/App.tsx`
- 생성: `apps/web/src/router.tsx`
- 생성: `apps/web/src/pages/LoginPage.tsx`
- 생성: `apps/web/src/pages/HomePage.tsx`
- 생성: `apps/web/src/styles.css`
- 생성: `apps/web/public/manifest.webmanifest`
- 생성: `apps/web/src/test/app-shell.test.tsx`
- 수정: `apps/web/vite.config.ts`

**Step 1: 실패하는 앱 셸 테스트 작성**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

describe('app shell', () => {
  it('shows the bookmark home heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /bookmark/i })).toBeInTheDocument()
  })
})
```

**Step 2: 테스트가 실패하는지 확인**

실행:

```powershell
npm run test:web -- app-shell.test.tsx
```

기대 결과: 새 앱 셸이 없어서 FAIL.

**Step 3: 라우터, 기본 셸, PWA manifest 구현**

```tsx
export default function App() {
  return (
    <main>
      <h1>Bookmark</h1>
      <p>Save, search, and organize links from anywhere.</p>
    </main>
  )
}
```

**Step 4: PWA 플러그인 추가**

실행:

```powershell
npm install -D vite-plugin-pwa --workspace apps/web
```

기대 결과: 플러그인이 `apps/web`에만 추가된다.

**Step 5: 웹 테스트 및 빌드 검증**

실행:

```powershell
npm run test:web -- app-shell.test.tsx
npm run build:web
```

기대 결과: PASS 및 정상 빌드.

**Step 6: 커밋**

```powershell
git add apps/web
git commit -m "feat: add web app shell and pwa scaffold"
```

### 작업 4: D1 스키마와 Repository 계층 구성

**파일:**
- 생성: `apps/api/migrations/0001_initial.sql`
- 생성: `apps/api/migrations/0002_search.sql`
- 생성: `apps/api/src/lib/db.ts`
- 생성: `apps/api/src/lib/repositories/folders.ts`
- 생성: `apps/api/src/lib/repositories/tags.ts`
- 생성: `apps/api/src/lib/repositories/bookmarks.ts`
- 생성: `apps/api/test/repositories/bookmarks.test.ts`

**Step 1: 사용자 입력 우선 표시 규칙에 대한 실패 테스트 작성**

```ts
it('prefers user fields over extracted source fields', async () => {
  const bookmark = await createBookmark(db, {
    url: 'https://example.com',
    sourceTitle: 'Source',
    userTitle: 'Manual'
  })

  expect(bookmark.displayTitle).toBe('Manual')
})
```

**Step 2: 테스트가 실패하는지 확인**

실행:

```powershell
npm run test:api -- repositories/bookmarks.test.ts
```

기대 결과: 스키마와 repository가 없어서 FAIL.

**Step 3: 초기 D1 스키마 추가**

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_id TEXT,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  bookmark_color TEXT,
  url_color TEXT,
  source_title TEXT,
  source_content TEXT,
  source_summary TEXT,
  user_title TEXT,
  user_content TEXT,
  user_summary TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Step 4: 검색용 가상 테이블과 repository helper 추가**

```sql
CREATE VIRTUAL TABLE bookmark_search USING fts5(
  bookmark_id UNINDEXED,
  title,
  content,
  tags
);
```

```ts
export function toDisplayBookmark(row: BookmarkRow) {
  return {
    ...row,
    displayTitle: row.user_title ?? row.source_title ?? '',
    displayContent: row.user_content ?? row.source_content ?? '',
    displaySummary: row.user_summary ?? row.source_summary ?? ''
  }
}
```

**Step 5: migration 및 테스트 실행**

실행:

```powershell
npx wrangler d1 migrations apply bookmark --local
npm run test:api -- repositories/bookmarks.test.ts
```

기대 결과: 로컬 migration 적용 성공 및 repository 테스트 PASS.

**Step 6: 커밋**

```powershell
git add apps/api/migrations apps/api/src/lib apps/api/test/repositories
git commit -m "feat: add d1 schema and repositories"
```

### 작업 5: Google 인증 및 세션 구현

**파일:**
- 생성: `apps/api/src/lib/auth/google.ts`
- 생성: `apps/api/src/lib/auth/sessions.ts`
- 생성: `apps/api/src/lib/auth/cookies.ts`
- 생성: `apps/api/src/routes/auth.ts`
- 생성: `apps/api/src/middleware/require-auth.ts`
- 생성: `apps/api/test/auth.test.ts`
- 생성: `.env.example`

**Step 1: 실패하는 인증 테스트 작성**

```ts
it('rejects protected routes without a valid session', async () => {
  const res = await app.request('http://example.com/api/bookmarks')
  expect(res.status).toBe(401)
})
```

**Step 2: 테스트가 실패하는지 확인**

실행:

```powershell
npm run test:api -- auth.test.ts
```

기대 결과: 인증 미들웨어와 보호 라우트가 없어서 FAIL.

**Step 3: 세션 발급과 보호 미들웨어 구현**

```ts
export async function requireAuth(c: Context, next: Next) {
  const session = await readSession(c)
  if (!session) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  c.set('user', session.user)
  await next()
}
```

**Step 4: Google OAuth 라우트와 환경 변수 계약 추가**

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
SESSION_SECRET=
```

추가할 라우트:

- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/logout`
- `GET /api/auth/session`

**Step 5: 인증 테스트 실행**

실행:

```powershell
npm run test:api -- auth.test.ts
```

기대 결과: 비인증 접근 거절 및 세션 성공 케이스 PASS.

**Step 6: 커밋**

```powershell
git add apps/api/src/lib/auth apps/api/src/routes/auth.ts apps/api/src/middleware .env.example apps/api/test/auth.test.ts
git commit -m "feat: add google auth and session handling"
```

### 작업 6: 폴더, 태그, 북마크 CRUD 구현

**파일:**
- 생성: `apps/api/src/routes/folders.ts`
- 생성: `apps/api/src/routes/tags.ts`
- 생성: `apps/api/src/routes/bookmarks.ts`
- 생성: `apps/api/test/bookmarks-routes.test.ts`
- 생성: `packages/shared/src/contracts.ts`

**Step 1: 실패하는 북마크 생성 라우트 테스트 작성**

```ts
it('creates a bookmark with manual values and favorite state', async () => {
  const res = await authenticatedRequest(app, '/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify({
      url: 'https://example.com/post',
      userTitle: 'Manual title',
      userContent: 'Manual content',
      userSummary: 'Manual summary',
      isFavorite: true
    })
  })

  expect(res.status).toBe(201)
})
```

**Step 2: 테스트가 실패하는지 확인**

실행:

```powershell
npm run test:api -- bookmarks-routes.test.ts
```

기대 결과: CRUD 라우트가 없어서 FAIL.

**Step 3: 핵심 라우트 구현**

추가할 라우트:

- `GET /api/folders`
- `POST /api/folders`
- `PATCH /api/folders/:id`
- `GET /api/tags`
- `POST /api/tags`
- `GET /api/bookmarks`
- `POST /api/bookmarks`
- `GET /api/bookmarks/:id`
- `PATCH /api/bookmarks/:id`
- `POST /api/bookmarks/:id/reextract`

**Step 4: 표시 우선순위 규칙 강제**

```ts
const bookmark = {
  displayTitle: input.userTitle ?? row.source_title ?? '',
  displayContent: input.userContent ?? row.source_content ?? '',
  displaySummary: input.userSummary ?? row.source_summary ?? ''
}
```

**Step 5: 라우트 테스트 실행**

실행:

```powershell
npm run test:api -- bookmarks-routes.test.ts
```

기대 결과: 생성, 조회, 수정, 소유권 보호 케이스 PASS.

**Step 6: 커밋**

```powershell
git add apps/api/src/routes packages/shared/src/contracts.ts apps/api/test/bookmarks-routes.test.ts
git commit -m "feat: add folder tag and bookmark crud"
```

### 작업 7: 자동 추출, 검색 인덱싱, 검색 모드 구현

**파일:**
- 생성: `apps/api/src/lib/extract/fetch-html.ts`
- 생성: `apps/api/src/lib/extract/parse-meta.ts`
- 생성: `apps/api/src/lib/extract/summarize.ts`
- 생성: `apps/api/src/lib/search/indexer.ts`
- 생성: `apps/api/src/routes/search.ts`
- 생성: `apps/api/test/search.test.ts`

**Step 1: 실패하는 검색 모드 테스트 작성**

```ts
it('searches title content and tags in integrated mode but excludes folder names', async () => {
  const res = await authenticatedRequest(
    app,
    '/api/search?mode=all&q=manual'
  )

  expect(res.status).toBe(200)
})
```

**Step 2: 테스트가 실패하는지 확인**

실행:

```powershell
npm run test:api -- search.test.ts
```

기대 결과: 검색 라우트와 FTS 동기화가 없어서 FAIL.

**Step 3: 경량 요약과 추출 로직 구현**

```ts
export function summarizeText(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
}
```

추출 동작:

- 가능한 경우 공개 HTML fetch
- title 및 meta tag 파싱
- `source_content`를 위해 불필요한 마크업 노이즈 제거
- 차단 또는 실패 시 실패 사유 저장

**Step 4: FTS 동기화와 검색 모드 구현**

검색 모드:

- `all`: 실제 제목 + 실제 내용 + 태그
- `title`
- `content`
- `folder`

폴더 검색 규칙:

- `folders.name` 직접 조회
- 북마크 FTS는 사용하지 않음

**Step 5: 검색 테스트 실행**

실행:

```powershell
npm run test:api -- search.test.ts
```

기대 결과: 통합 검색, 제목 검색, 내용 검색, 폴더 검색 동작 PASS.

**Step 6: 커밋**

```powershell
git add apps/api/src/lib/extract apps/api/src/lib/search apps/api/src/routes/search.ts apps/api/test/search.test.ts
git commit -m "feat: add extraction and search modes"
```

### 작업 8: R2 업로드 서명과 자산 관리 구현

**파일:**
- 생성: `apps/api/src/lib/r2/sign-upload.ts`
- 생성: `apps/api/src/routes/uploads.ts`
- 생성: `apps/api/src/routes/assets.ts`
- 생성: `apps/api/test/uploads.test.ts`
- 수정: `.env.example`

**Step 1: 실패하는 업로드 서명 테스트 작성**

```ts
it('returns a signed upload target for authenticated users', async () => {
  const res = await authenticatedRequest(app, '/api/uploads/sign', {
    method: 'POST',
    body: JSON.stringify({ mimeType: 'image/png', fileName: 'capture.png' })
  })

  expect(res.status).toBe(200)
})
```

**Step 2: 테스트가 실패하는지 확인**

실행:

```powershell
npm run test:api -- uploads.test.ts
```

기대 결과: 업로드 라우트가 없어서 FAIL.

**Step 3: 서명된 PUT URL 발급 구현**

```ts
const signed = await aws.sign(new Request(url, { method: 'PUT' }), {
  aws: { signQuery: true }
})
```

추가할 환경 변수:

```env
R2_BUCKET=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
```

**Step 4: 자산 등록 및 삭제 라우트 추가**

추가할 라우트:

- `POST /api/uploads/sign`
- `POST /api/bookmarks/:id/assets`
- `DELETE /api/bookmarks/:id/assets/:assetId`

**Step 5: 업로드 테스트 실행**

실행:

```powershell
npm run test:api -- uploads.test.ts
```

기대 결과: 업로드 서명, 소유권 보호, 자산 등록 PASS.

**Step 6: 커밋**

```powershell
git add apps/api/src/lib/r2 apps/api/src/routes/uploads.ts apps/api/src/routes/assets.ts apps/api/test/uploads.test.ts .env.example
git commit -m "feat: add upload signing and bookmark assets"
```

### 작업 9: 추천 기능과 주요 웹 화면 구현

**파일:**
- 생성: `apps/api/src/lib/recommendations.ts`
- 생성: `apps/api/src/routes/recommendations.ts`
- 생성: `apps/web/src/lib/api.ts`
- 생성: `apps/web/src/lib/session.ts`
- 생성: `apps/web/src/pages/DashboardPage.tsx`
- 생성: `apps/web/src/pages/BookmarkFormPage.tsx`
- 생성: `apps/web/src/pages/BookmarkDetailPage.tsx`
- 생성: `apps/web/src/pages/SearchPage.tsx`
- 생성: `apps/web/src/pages/FoldersPage.tsx`
- 생성: `apps/web/src/components/BookmarkCard.tsx`
- 생성: `apps/web/src/components/BookmarkForm.tsx`
- 생성: `apps/web/src/components/SearchModeTabs.tsx`
- 생성: `apps/web/src/test/bookmark-form.test.tsx`

**Step 1: 실패하는 북마크 폼 테스트 작성**

```tsx
it('submits manual title content summary and image placeholders together', async () => {
  render(<BookmarkFormPage />)
  expect(screen.getByLabelText(/url/i)).toBeInTheDocument()
})
```

**Step 2: 테스트가 실패하는지 확인**

실행:

```powershell
npm run test:web -- bookmark-form.test.tsx
```

기대 결과: 페이지와 컴포넌트가 없어서 FAIL.

**Step 3: 추천 점수 계산 구현**

```ts
export function computeRecommendationScore(row: RecommendationRow) {
  return row.favoriteWeight + row.recentWeight + row.frequencyWeight + row.contextWeight
}
```

노출할 API:

- `GET /api/recommendations`

추천 그룹:

- 자주 사용하는 링크
- 최근 본 링크
- 현재 폴더 또는 태그와 관련된 링크

**Step 4: 주요 인증 후 화면 구현**

필수 UI 동작:

- 로그인 화면
- 추천 블록이 있는 대시보드
- URL, 수동 입력 필드, 폴더, 태그, 즐겨찾기, 북마크 색상, URL 색상, 이미지 업로드를 모두 포함한 북마크 생성 폼
- 북마크 상세 수정 화면
- `all`, `title`, `content`, `folder` 모드를 가진 검색 화면

**Step 5: 웹 테스트 및 빌드 실행**

실행:

```powershell
npm run test:web -- bookmark-form.test.tsx
npm run build:web
```

기대 결과: PASS 및 프로덕션 빌드 성공.

**Step 6: 커밋**

```powershell
git add apps/web apps/api/src/lib/recommendations.ts apps/api/src/routes/recommendations.ts
git commit -m "feat: add dashboard forms search and recommendations"
```

### 작업 10: 최종 검증, 배포 문서, MVP 준비

**파일:**
- 생성: `README.md`
- 생성: `docs/deployment.md`
- 수정: `wrangler.toml`
- 수정: `.env.example`

**Step 1: 엔드투엔드 검증 체크리스트 추가**

포함 항목:

- 로컬 로그인 흐름
- 폴더 CRUD
- 북마크 생성/수정
- 자동 추출 재시도
- 업로드 서명
- 검색 모드
- 추천 블록

**Step 2: 배포 절차 문서화**

문서에 포함:

- `wrangler d1 create`
- `wrangler r2 bucket create`
- `wrangler secret put`
- `wrangler deploy`

**Step 3: 전체 검증 실행**

실행:

```powershell
npm run test:api
npm run test:web
npm run build:web
```

기대 결과: 모든 테스트 통과 및 SPA 빌드 성공.

**Step 4: 빌드된 프론트와 함께 로컬 Worker 스모크 테스트**

실행:

```powershell
npm run build:web
npm run dev:api
```

기대 결과: `/api/health`는 JSON을 반환하고, SPA 라우트는 같은 Worker 오리진에서 정상 로드된다.

**Step 5: 커밋**

```powershell
git add README.md docs/deployment.md wrangler.toml .env.example
git commit -m "docs: add deployment and verification notes"
```
