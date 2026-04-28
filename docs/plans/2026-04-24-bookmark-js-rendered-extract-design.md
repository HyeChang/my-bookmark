# 북마크 JS 렌더링 추출 설계

## 목표

추가 서버 비용 없이, SPA 사이트에서 `You need to enable JavaScript to run this app.` 같은 fallback 문구가 본문으로 저장되는 문제를 줄인다. 기본 추출은 지금처럼 Worker에서 처리하되, JS 렌더링이 필요한 사이트만 설치된 브라우저 확장앱을 통해 실제 렌더링 DOM으로 다시 추출한다.

## 범위

- Worker 기반 북마크 추출기에 `JS 렌더링 필요` 판정 로직을 추가한다.
- `BookmarkExtractPreview`에 추출 상태와 추출 출처를 담아 웹앱이 fallback 여부를 판단할 수 있게 한다.
- 웹앱의 `URL 메타 불러오기`와 상세 `미리보기` 탭에서 Worker 결과가 저품질이면 확장앱 브리지 재추출을 시도한다.
- 확장앱은 백그라운드에서 비활성 탭을 열고 렌더링 완료 후 DOM을 읽어 동일한 preview 구조로 반환한다.
- 확장앱이 없거나 재추출이 실패하면 Worker 메타데이터 결과를 유지하고 안내 문구만 표시한다.

## 접근

### 1. Worker 추출 품질 신호

`apps/api/src/lib/extract/bookmark-extractor.ts`는 기존 HTML 파싱 흐름을 유지한다. 대신 `sourceContent`, `sourceSummary`, `sourceBlocks`를 계산한 뒤 아래 조건이면 결과를 `js_required`로 표기한다.

- SPA fallback 문구가 본문이나 summary에 포함됨
- 본문 길이가 매우 짧고 메타데이터만 존재함
- 대표 이미지와 제목은 있지만 본문 블록이 거의 없음

이 상태에서도 `og:title`, `og:description`, `og:image`는 그대로 반환한다. 즉 실패가 아니라 `metadata_only`에 가까운 응답을 반환해 웹앱이 2차 추출을 이어갈 수 있게 한다.

### 2. 웹앱 오케스트레이션

웹앱은 Worker preview를 받은 뒤 `renderStatus === "js_required"`이고 확장앱이 설치된 경우에만 브리지 재추출을 요청한다. 확장앱 결과가 오면 그 결과를 미리보기 카드와 상세 `미리보기` 탭에 우선 표시한다. 북마크 저장/수정 시에는 최종적으로 화면에 남은 preview 값을 `sourceTitle`, `sourceContent`, `sourceSummary`로 저장한다.

확장앱이 없거나 요청이 실패하면 Worker preview를 그대로 유지한다. 사용자는 이미지와 메타 설명은 보되, 렌더링이 필요한 사이트라는 설명을 함께 보게 된다.

### 3. 확장앱 렌더링 추출

확장앱은 현재의 페이지 presence bridge를 확장해 `bookmark-extension:extract-preview` 요청을 받는다. 요청은 웹앱 페이지의 content script가 받고, background service worker로 전달한다. background는 대상 URL을 비활성 탭으로 연 뒤 `complete` 상태를 기다리고, 해당 탭의 content script에 DOM 추출 메시지를 보낸다.

DOM 추출은 새 helper에서 처리한다. 우선순위는 다음과 같다.

- `article`
- `main`
- 본문 후보 컨테이너
- 최후 fallback으로 `body`

여기서 제목, 대표 이미지, paragraph/list/heading 블록을 정제해 `BookmarkExtractPreview` 형태로 만든다. 추출이 끝나면 background는 임시 탭을 닫고 결과를 원래 웹앱 브리지로 돌려준다.

### 4. 안전장치

- 재추출은 사용자 요청당 한 번만 수행한다.
- background 탭은 비활성으로 열고 결과/실패/timeout 어느 경우든 닫는다.
- 확장앱 추출에는 고정 timeout을 둔다.
- 모바일 웹과 확장앱 미설치 환경은 기존 Worker 추출만 사용한다.
- 로그인, 캡차, 접근 제한 사이트는 여전히 실패할 수 있으며 이 경우 fallback 안내만 제공한다.

## 비범위

- 별도 브라우저 렌더링 서버 추가
- 모바일 브라우저 JS 렌더링 추출
- 원문 iframe 렌더링
- 추출 결과 장기 캐시
- 사이트별 커스텀 파서 대량 추가

## 검증

- API extractor는 SPA fallback 문구를 `ready` 본문으로 분류하지 않는다.
- `URL 메타 불러오기`는 Worker 결과가 `js_required`일 때만 확장앱 브리지 재추출을 시도한다.
- 상세 `미리보기` 탭도 같은 fallback 규칙을 사용한다.
- 확장앱은 임시 탭을 열고 닫으며, 렌더링 결과를 웹앱에 다시 전달한다.
- 확장앱이 없거나 실패해도 저장/수정/상세보기 흐름은 깨지지 않는다.
