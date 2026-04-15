# Folder Drag Reparent Design

## Goal

드래그한 폴더를 다른 폴더 위에 놓으면 그 폴더의 하위 폴더로 이동시키고, 계층 트리와 모든 폴더 선택기 순서가 즉시 반영되게 만든다.

## Scope

- 같은 부모 내부 정렬은 기존 `reorder`를 그대로 사용한다.
- 다른 부모 폴더 위에 드롭하면 `move` API를 호출해 부모를 바꾼다.
- 이동된 폴더는 새 부모의 마지막 자식으로 붙인다.
- 서버는 자기 자신/자손 폴더 아래로 이동시키는 순환 참조를 거부한다.

## Non-Goals

- 루트 영역으로 드래그해서 최상위 이동
- 드래그로 임의 위치 삽입
- 접기/펼치기 트리
- 드래그 미리보기 스타일

## API Design

- 엔드포인트: `POST /api/folders/:folderId/move`
- 요청 본문:
  - `parentFolderId: string | null`
- 동작:
  - 이동 대상 폴더 존재 확인
  - `parentFolderId`가 존재하면 같은 사용자 폴더인지 확인
  - 자기 자신 또는 자손 아래로 이동하려는 경우 `400 invalid_parent_folder_cycle`
  - 새 부모 자식 목록의 마지막 `sortOrder` 뒤에 이동
  - 이전 부모와 새 부모의 형제 정렬을 모두 정규화
- 응답:
  - 최신 `folders` 전체 목록

## Persistence

- `parent_folder_id`와 `sort_order`를 함께 갱신한다.
- 이전 부모 형제들의 `sort_order` gap은 정규화한다.
- 새 부모 자식 목록도 `0..n-1`로 정규화한다.

## UI Design

- 현재 `드래그 정렬` 버튼을 drag handle로 계속 사용한다.
- 같은 부모 폴더 위로 드롭하면 기존처럼 reorder.
- 다른 폴더 위로 드롭하면 그 폴더의 하위 폴더로 이동.
- 자기 자신이나 자기 자손 위로 드롭하면 무시.

## Testing

- API:
  - 다른 부모 폴더 아래로 이동 성공
  - 자손 폴더 아래 이동 거부
- Web:
  - 드롭 후 트리 구조가 부모-자식으로 바뀌는지
  - 부모 변경 후 북마크 저장 폼/검색 폼의 계층 옵션도 반영되는지
