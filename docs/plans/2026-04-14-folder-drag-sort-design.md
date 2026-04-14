# Folder Drag Sort Design

## Goal

같은 부모 폴더 안에서만 드래그로 폴더 순서를 바꾸고, 저장된 순서가 폴더 트리와 모든 폴더 선택기에도 바로 반영되게 만든다.

## Scope

- 폴더 관리 목록에 드래그 정렬 UI를 추가한다.
- 정렬은 같은 `parentFolderId`를 가진 형제 폴더 사이에서만 허용한다.
- 서버는 형제 폴더 전체 순서를 받아 `sortOrder`를 다시 저장한다.
- 북마크 저장 폼, 검색 폼, 부모 폴더 선택 셀렉트는 저장된 새 순서를 그대로 재사용한다.

## Non-Goals

- 다른 부모 폴더로 드래그 이동
- 드래그로 부모 폴더 변경
- 접기/펼치기 트리
- 키보드 기반 정렬 접근성 개선

## API Design

- 엔드포인트: `POST /api/folders/reorder`
- 요청 본문:
  - `parentFolderId: string | null`
  - `folderIds: string[]`
- 서버 검증:
  - 중복 ID 금지
  - 요청한 ID가 모두 현재 사용자 폴더여야 함
  - 요청한 ID 집합이 해당 부모의 형제 폴더 전체 집합과 일치해야 함
  - 불일치 시 `400 invalid_folder_reorder`
- 응답:
  - 최신 `folders` 전체 목록

## Persistence

- `folders.sort_order`를 형제 범위 안에서 `0..n-1`로 다시 저장한다.
- 폴더 생성 시 새 폴더는 같은 부모의 마지막 순서 뒤에 붙는다.
- 삭제 후 sort order gap은 남아도 동작은 가능하지만, 재정렬 API가 호출되면 다시 정규화된다.

## UI Design

- 폴더 행에 `드래그 정렬` 핸들을 추가한다.
- 사용자는 핸들을 잡고 같은 부모의 다른 폴더 행 위로 드롭할 수 있다.
- 다른 부모 폴더 위에 드롭하면 무시한다.
- 드롭 성공 후 폴더 목록과 셀렉트 순서가 즉시 갱신된다.

## State Flow

1. 사용자가 폴더 핸들에서 drag start
2. 현재 드래그 중인 `folderId`를 로컬 상태에 저장
3. 드롭 대상이 같은 부모인지 검사
4. 형제 배열의 새 순서를 계산
5. `POST /api/folders/reorder` 호출
6. 응답 `folders`로 `setFolders` 갱신
7. 파생 UI(트리, 저장 폼, 검색 폼, 부모 폴더 셀렉트)가 자동 재렌더

## Testing

- API:
  - 같은 부모 형제 순서 재저장 성공
  - 다른 부모 폴더가 섞인 reorder 요청 거부
- Web:
  - 드래그 정렬 후 폴더 트리 순서 변경
  - 북마크 저장 폼과 검색 폼의 폴더 순서도 같이 변경
