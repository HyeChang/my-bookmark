# 북마크 프로젝트 세션 핸드오프

작성일: 2026-04-15

## 현재 기준점

- 최신 기능 커밋:
  - `9655bf6` `feat: add inline folder quick create`
  - `802eef3` `feat: add folder color and icon pickers`
  - `9a3872b` `feat: add api error normalization`
- 직전 리디자인 커밋:
  - `62f288a` `feat: redesign dashboard shell`
  - `999d466` `feat: redesign workspace panels`
  - `6340018` `feat: redesign search panel`
  - `8ae9766` `feat: redesign recommendations and detail panel`
- 리디자인 설계/계획 문서 커밋:
  - `d35c536` `docs: add dashboard redesign plan`
  - `fe4639a` `test: lock dashboard redesign anchors`

## 현재 구현 완료 범위

### 인증 / 세션

- Firebase Google 로그인 연동 완료
- Firebase ID 토큰을 Worker 세션 쿠키로 교환하는 흐름 완료
- 로그인 후 이메일 표시 / 로그아웃 동작 확인 완료

### 프로젝트 구조

- `apps/web`: React + Vite
- `apps/api`: Cloudflare Workers + Hono
- `packages/shared`: 공용 타입
- `wrangler.toml`: D1 / R2 / Assets 바인딩 연결 완료

### 북마크

- `GET /api/bookmarks`
- `POST /api/bookmarks`
- `GET /api/bookmarks/:bookmarkId`
- `PATCH /api/bookmarks/:bookmarkId`
- `DELETE /api/bookmarks/:bookmarkId`
- `POST /api/bookmarks/:bookmarkId/reextract`
- 사용자 입력 우선 표시 규칙 적용
- 북마크 생성 / 수정 / 삭제 / 상세 보기 완료
- 수동 제목 / 내용 / 요약 입력 지원
- 자동 추출 미리보기 / 저장 시 source 값 fallback 추출 지원
- 상세 패널에서 자동 추출 다시 시도 / 사용자 입력 초기화 지원

### 이미지 / 자산

- 북마크별 이미지 업로드 지원
- 업로드 이미지 목록 조회 지원
- 업로드 이미지 삭제 지원
- 자산 메타데이터는 D1, 바이너리는 R2 경로 사용

### 폴더 / 태그

- 폴더 CRUD 완료
- 태그 CRUD 완료
- 폴더 색상은 고정 팔레트 선택 방식
- 폴더 아이콘은 고정 프리셋 선택 방식
- 폴더 부모 지정 지원
- 폴더 계층 검색 지원
- 폴더 드래그 정렬 지원
- 드래그로 부모 변경 지원
- 드래그로 루트 이동 지원
- 북마크 저장 폼 안에서 `새 폴더 바로 추가` 지원
- 폴더가 없을 때 빠른 폴더 생성은 최상위 폴더로 생성
- 폴더가 있으면 빠른 폴더 생성 시 부모 폴더 선택 가능
- 태그는 북마크 생성 / 수정 시 연결 가능

### 검색 / 필터 / 정렬

- 검색 모드:
  - `all`: 제목 + 내용 + 태그
  - `title`: 제목만
  - `content`: 내용만
  - `folder`: 폴더명만
- 기본 필터:
  - 즐겨찾기만
  - 폴더
  - 태그
- 확장 필터:
  - 북마크 색상
  - URL 색상
  - 요약 있음 / 없음
- 기간 필터:
  - 최근 추가 `전체 / 7일 / 30일`
  - 최근 열람 `전체 / 7일 / 30일`
- 정렬:
  - 최근 추가순
  - 최근 열람순
- 다중 태그 검색:
  - `AND`
  - `OR`
- 검색 조건 칩:
  - 개별 제거 가능
- 폴더 검색:
  - 하위 폴더 포함 체크박스 지원

### 추천

- 추천 영역 3개 섹션:
  - 즐겨찾기 추천
  - 최근 열람
  - 자주 연 링크
- 추천 점수 반영 요소:
  - 즐겨찾기 여부
  - 열람 수
  - 마지막 열람 시각
  - 최근 문맥의 폴더 / 태그 일치
- 추천 카드에서 바로 열기 가능
- 열기 활동 기록 저장 후 추천에 반영

### UI / UX

- 데스크톱 2열 구조 유지:
  - 좌측 `작업 패널`
  - 우측 `작업 결과`
- 모바일 검색 패널 접힘 / 펼침 지원
- 모바일 작업 패널 탭형 전환 완료:
  - 북마크
  - 폴더
  - 태그
- 모바일 북마크 카드 압축형 유지
- web API 클라이언트 공용 에러 처리 적용:
  - 네트워크 실패는 `로컬 서버에 연결하지 못했습니다. 실행 중인지 확인해주세요.`로 안내
  - 폴더 / 북마크 / 태그 / URL 메타 추출 경로는 JSON 에러 코드를 사용자 메시지로 변환
- 전체 리디자인 1차 완료:
  - 헤더 / 전역 셸
  - 작업 패널 스택
  - 검색 패널
  - 추천 영역
  - 상세 패널
  - 북마크 목록 카드

## 로컬 실행 방법

### 필요 파일

- `apps/web/.env.local`
- 루트 `.dev.vars`

현재 로컬 실행은 사용자가 직접 채운 값 기준으로 동작한다.

### 실행 순서

```powershell
npm run build:web
npm run dev:api
```

- Windows 더블클릭 실행:
  - 루트의 `start-bookmark-local.cmd`
  - 내부에서 `build:web` 후 `dev:api`를 실행하고 `http://localhost:8787`를 연다.
- 브라우저 접속 주소: `http://localhost:8787`
- `127.0.0.1` 대신 `localhost` 사용

## 최신 검증 결과

2026-04-15 기준 최신 실행 결과:

```powershell
npm run test:api
```

- 통과: `10 files / 50 tests`

```powershell
npm run test:web
```

- 통과: `3 files / 33 tests`

```powershell
npm run build:web
```

- 통과

## 시각 점검 체크리스트

### 데스크톱

- 헤더에 `개인 아카이브 작업 공간` 보조 문구 노출
- 좌측 `작업 패널`, 우측 `작업 결과` 위계 확인
- 작업 패널 3개가 공통 헤더 체계 사용
- 검색 패널에 `탐색 기준`과 `현재 작업 조건` 노출
- 추천 영역에 `빠른 진입점` 노출
- 상세 패널에 `읽기 중심`과 액션 그룹 라벨 노출
- 북마크 목록에 `보관 목록`과 카드 섹션 라벨 노출

### 모바일

- 검색 패널 기본 접힘 / 열기 동작 확인
- 작업 패널 탭 전환 확인
- 모바일 카드 압축형 유지 확인
- 추천 버튼 전체 폭 정렬 확인
- 상세 패널 액션 세로 정렬 확인

## 현재 남은 큰 작업 후보

### 1. 전체 UI 폴리시

- 미세 타이포 / 색상 / 간격 추가 정리
- 실제 브라우저 스크린샷 기준 미세 조정

### 2. 기능 확장

- 댓글 요약 지원 사이트 한정 구현
- 자동 추출 품질 보강
- 이미지 대표 지정 / 정렬
- 북마크 대량 정리 UX

### 3. 배포 / 운영

- 원격 D1 마이그레이션 적용
- `workers.dev` 기준 실제 배포 검증
- 이후 크롬 확장프로그램 연동 준비

## 주의할 점

- Worker 런타임에서는 `Buffer`를 쓰지 않는다. 세션 인코딩은 Web API 방식으로 맞춰둠.
- `wrangler dev`는 루트에서 실행해야 현재 환경 구성과 맞다.
- 로컬 D1 마이그레이션은 이미 적용된 상태다.
- Firebase 승인 도메인 / Cloudflare 환경값은 사용자가 직접 설정한 로컬 값 기준이다.
- 브라우저에서 raw `Failed to fetch` 대신 공용 네트워크 오류 안내를 띄우도록 web 클라이언트를 정리한 상태다.

## 관련 문서

- 설계: `docs/plans/2026-04-13-bookmark-design.md`
- MVP 구현 계획: `docs/plans/2026-04-13-bookmark-webapp-mvp.md`
- 리디자인 설계: `docs/plans/2026-04-15-dashboard-redesign-design.md`
- 리디자인 계획: `docs/plans/2026-04-15-dashboard-redesign.md`
