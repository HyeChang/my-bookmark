# Search Filter Chip Actions Design

## Goal

현재 적용된 북마크 검색 조건을 개별 해제 가능한 칩으로 바꾸고, 사용자가 칩을 클릭하면 해당 조건만 제거된 상태로 목록을 즉시 다시 불러오게 만든다.

## Scope

- `현재 적용된 검색` 영역을 단순 텍스트 리스트에서 클릭 가능한 칩 리스트로 변경
- 각 칩은 자기 조건만 제거
- 칩 클릭 후 `appliedBookmarkSearch`와 `bookmarkSearchDraft`를 함께 갱신
- 갱신 직후 새 조건으로 북마크 목록을 다시 조회

## Chip Rules

- `검색어` 칩 제거:
  - `query=""`
  - `mode`는 유지하지만 표시 칩은 사라짐
- `모드` 칩 제거:
  - `mode="all"`
- `정렬` 칩 제거:
  - `sort="created_desc"`
- `최근 추가`, `최근 열람` 칩 제거:
  - 각 값을 `all`로
- `즐겨찾기만` 칩 제거:
  - `favoriteOnly=false`
- `폴더` 칩 제거:
  - `folderId=""`
  - `includeDescendantFolders=false`
- `하위 폴더 포함` 칩 제거:
  - `includeDescendantFolders=false`
- `태그`는 태그별 칩으로 분리:
  - 해당 tagId만 제거
  - 마지막 태그가 제거되면 `tagMode="and"`로 복귀
- `태그 조건` 칩 제거:
  - `tagMode="and"`
- `북마크 색상`, `URL 색상` 칩 제거:
  - 각 값을 빈 문자열로
- `요약 있음/없음` 칩 제거:
  - `summaryState="all"`

## UI Design

- 각 칩은 버튼으로 렌더링
- 텍스트는 기존 라벨을 유지하고 끝에 `×`를 붙임
- `aria-label`은 `검색 조건 제거: ...` 형태로 준다

## Testing

- 검색 실행 후 칩이 버튼으로 보이는지 확인
- 칩 클릭 시 해당 조건만 빠진 URL로 다시 요청하는지 확인
- 제거 후 관련 칩이 사라지는지 확인
