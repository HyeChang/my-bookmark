# 북마크 검색 정렬 설계

## 목표

검색 결과와 일반 목록 조회에 아래 정렬 전환을 추가한다.

- `최근 추가순`
- `최근 열람순`

기존 검색어/검색 모드/기본 필터/확장 필터와 함께 조합되어야 한다.

## 접근 방식

### 1. 정렬 파라미터

`GET /api/bookmarks`에 `sort=created_desc|opened_desc`를 추가한다.

- 기본값: `created_desc`
- `created_desc`: 현재 동작 유지
- `opened_desc`: 마지막 열람 시각 기준 정렬

### 2. 정렬 위치

필터와 검색은 기존 `BookmarkRepository`가 처리하고, 정렬은 라우트 레이어에서 적용한다.

이유:

- `created_desc`는 이미 저장소 기본 순서와 맞다.
- `opened_desc`는 `bookmark_activity` 집계가 필요하므로 라우트에서 `BookmarkActivityRepository`를 붙여 정렬하는 편이 간단하다.
- 저장소 책임을 불필요하게 늘리지 않는다.

## 최근 열람순 규칙

- `lastOpenedAt`이 있는 북마크를 먼저 둔다.
- 최신 `lastOpenedAt`이 큰 순서로 정렬한다.
- 같은 `lastOpenedAt`이면 `createdAt` 최신순으로 정렬한다.
- 열람 이력이 없는 북마크는 뒤로 보낸다.
- 열람 이력이 없는 북마크끼리는 `createdAt` 최신순으로 유지한다.

## UI

검색 폼에 `정렬` 선택을 추가한다.

- `최근 추가순`
- `최근 열람순`

`검색 초기화` 시 정렬도 `최근 추가순`으로 되돌린다.

## 테스트 전략

### API

- `sort=opened_desc`일 때 열람 이력이 있는 북마크가 먼저 오는지 검증
- 필터와 함께 사용해도 정렬만 마지막 단계에서 적용되는지 검증

### Web

- 정렬 선택 변경 시 `/api/bookmarks?sort=opened_desc`가 전달되는지 검증
- 검색 초기화 시 정렬이 기본값으로 돌아오는지 검증
