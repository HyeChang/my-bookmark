# 모바일 작업 패널 구현 계획

작성일: 2026-04-15

## 구현 순서

1. 모바일 패널 기본 상태와 토글 동작을 검증하는 웹 테스트 추가
2. 실패 테스트 실행으로 현재 동작 확인
3. `App.tsx`에 모바일 패널 상태와 토글 렌더링 추가
4. `App.css`에 모바일 패널 버튼/본문 스타일 추가
5. 웹 테스트 재실행
6. 전체 검증(`test:api`, `test:web`, `build:web`)

## 수정 대상

- `apps/web/src/App.tsx`
- `apps/web/src/App.css`
- `apps/web/src/test/bookmark-dashboard.test.tsx`

## 상태 관리 계획

- 현재 모바일 검색용 뷰포트 상태와 같은 기준(`720px`)을 재사용한다.
- 모바일 작업 패널 상태는 `"bookmark" | "folder" | "tag"` 단일 값으로 관리한다.
- 데스크톱에서는 상태와 무관하게 세 패널 모두 렌더링한다.

## 테스트 포인트

- 모바일 초기 진입 시 `bookmark-form`만 보이는지
- `folder-manager`, `tag-manager` 패널이 닫힌 상태에서는 본문이 보이지 않는지
- 토글 버튼의 `aria-expanded` 값이 맞는지
- 모바일에서 패널 전환 후 해당 폼이 나타나는지
- 데스크톱 기존 동작이 깨지지 않는지
