# 북마크 프로젝트 세션 핸드오프

작성일: 2026-04-13

## 현재 기준점

- 최신 커밋: `0cbd4b9` (`feat: add folder and tag management`)
- 이전 주요 커밋: `f6b5ee9` (`feat: bootstrap bookmark auth and dashboard`)

## 현재 구현 완료 범위

### 인증 / 세션

- Firebase Google 로그인 연동 완료
- Firebase ID 토큰을 Worker 세션 쿠키로 교환하는 흐름 완료
- 로그인 후 이메일 표시 / 로그아웃 동작 확인 완료

### 웹앱 기본 구조

- `apps/web`: React + Vite
- `apps/api`: Cloudflare Workers + Hono
- `packages/shared`: 공용 타입
- `wrangler.toml`: D1/R2/ASSETS 바인딩 연결 완료

### 북마크

- `GET /api/bookmarks`
- `POST /api/bookmarks`
- `GET /api/bookmarks/:bookmarkId`
- `PATCH /api/bookmarks/:bookmarkId`
- 사용자 입력 우선 표시 규칙 적용
- 웹에서 북마크 저장 폼 / 북마크 목록 UI 구현 완료

### 폴더 / 태그

- `GET /api/folders`
- `POST /api/folders`
- `PATCH /api/folders/:folderId`
- `GET /api/tags`
- `POST /api/tags`
- 웹에서 폴더 생성 UI / 태그 생성 UI 구현 완료
- 북마크 저장 폼에서 폴더 선택 가능

## 로컬 실행 방법

### 필요 파일

- `apps/web/.env.local`
- 루트 `.dev.vars`

이 파일들은 현재 사용자가 직접 채운 상태를 기준으로 로컬에서 실행한다.

### 실행 순서

```powershell
npm run build:web
npm run dev:api
```

- 브라우저 접속 주소: `http://localhost:8787`
- `127.0.0.1` 대신 `localhost` 사용

## 최근 검증 결과

세션 종료 직전 기준 아래 명령 통과:

```powershell
npm run test:api
npm run test:web
npm run build:web
```

## 다음 추천 작업 순서

### 1. 북마크-태그 연결

- 북마크 생성/수정 시 태그 ID 배열을 받을 수 있도록 확장
- `bookmark_tags` 테이블 연동
- 웹 북마크 폼에서 태그 선택 UI 추가

### 2. 검색 모드 구현

- `all`: 제목 + 내용 + 태그
- `title`: 제목만
- `content`: 내용만
- `folder`: 폴더명만

기본 검색에서 URL / 폴더명 제외 규칙 유지

### 3. 북마크 상세/수정 화면 확장

- 기존 북마크 수정
- 수동 입력값 편집
- 폴더/태그/즐겨찾기/색상 수정

### 4. 추출 / 업로드

- URL 메타 추출
- 수동 이미지 업로드
- R2 presigned URL 경로 구현

## 주의할 점

- Worker 런타임에서는 `Buffer`를 쓰지 않는다. 세션 인코딩은 이미 Web API 방식으로 바꿔둠.
- `wrangler dev`는 루트에서 실행해야 현재 환경 구성과 맞다.
- 로컬 D1 마이그레이션은 이미 적용됨.

## 관련 문서

- 설계: `docs/plans/2026-04-13-bookmark-design.md`
- 구현 계획: `docs/plans/2026-04-13-bookmark-webapp-mvp.md`
