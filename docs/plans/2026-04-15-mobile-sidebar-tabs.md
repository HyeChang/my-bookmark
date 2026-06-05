# 모바일 작업 패널 탭 전환 구현 계획

작성일: 2026-04-15

## 구현 순서

1. 모바일 탭 전환을 검증하는 웹 테스트 추가
2. 실패 테스트 실행으로 현재 아코디언 구조 확인
3. `App.tsx`에서 모바일 탭 헤더와 조건부 본문 렌더링 추가
4. `App.css`에 세그먼트 탭 스타일 추가
5. 웹 테스트 재실행
6. 전체 검증(`test:api`, `test:web`, `build:web`)

## 수정 대상

- `apps/web/src/App.tsx`
- `apps/web/src/App.css`
- `apps/web/src/test/bookmark-dashboard.test.tsx`

## 구현 메모

- 기존 `mobileSidebarPanel` 상태 재사용
- 데스크톱에서는 기존 `renderSidebarPanel` 카드 구조 유지
- 모바일에서만 `tablist` + `tab` 구조 활성화
- 기존 모바일 헤더 요약 로직 재사용

## 검증 포인트

- 모바일 기본 탭이 `북마크`인지
- 탭 전환 후 해당 본문만 보이는지
- 데스크톱 회귀가 없는지
