# 독립 메모 기능 설계

## 목표

북마크와 연동하지 않는 별도 메모 공간을 추가한다. 메모는 제목, 리치 본문, 계층형 폴더, 태그, 색상, 즐겨찾기, 다중 이미지 첨부를 지원하고, 데스크톱과 모바일에서 모두 메모 작성과 조회가 편해야 한다.

## 사용자 경험

로그인 후 대시보드에 `홈`, `북마크`, `메모` 전환을 추가한다. 기존 앱 주소는 유지하고, 메모 직접 진입은 `/?view=memos` 쿼리로 처리한다. 메모 화면에서는 주요 액션이 `새 메모`로 바뀌며, 모바일 헤더 메뉴에도 `메모` 이동 항목을 추가한다.

데스크톱 메모 화면은 작업 앱처럼 구성한다.

- 왼쪽: 계층형 메모 폴더, 즐겨찾기, 태그 필터
- 가운데: 메모 목록
- 오른쪽 또는 모달: 메모 상세/편집

모바일 메모 화면은 한 화면에 하나의 주요 작업만 보이게 한다.

- 목록은 전체 폭을 사용한다.
- 메모를 누르면 상세 또는 편집 패널을 전체화면에 가깝게 연다.
- 에디터 툴바와 본문 검색은 화면 상하단에 고정해 스크롤 중에도 접근 가능하게 한다.

## 메모 목록

메모 목록은 `리스트`와 `카드` 보기 방식을 지원한다.

- 리스트 보기: 제목, 본문 일부, 폴더, 태그, 체크리스트 진행률, 이미지 수, 수정일을 조밀하게 표시한다.
- 카드 보기: 본문 미리보기와 대표 이미지를 더 크게 표시한다.
- 선택한 보기 방식은 사용자 설정으로 저장한다.
- 대표 이미지는 첫 번째 메모 이미지 썸네일을 사용하고, 이미지가 여러 개면 이미지 개수를 함께 표시한다.

검색은 두 층으로 나눈다.

- 메모 목록 검색: 제목과 plain text 본문을 대상으로 메모를 찾는다.
- 메모 본문 내부 검색: 열린 메모 안에서 검색어를 찾고 이전/다음 결과로 이동한다. 모바일에서 브라우저 `Ctrl+F`를 대체하는 필수 기능으로 본다.

## 메모 에디터

본문은 textarea가 아니라 lazy-loaded 리치 텍스트 에디터로 구현한다. 저장 포맷은 JSON 문서이며, 목록과 검색용 plain text를 함께 저장한다.

1차 에디터 기능은 아래로 제한한다.

- `[]` 입력 후 공백 또는 엔터 시 체크박스 라인으로 변환
- 체크박스 체크 시 해당 라인의 텍스트에 취소선 적용
- 굵게
- 글자 크기 조절
- 이미지 삽입
- 본문 내부 검색

에디터 구현은 Tiptap/ProseMirror 계열을 우선한다. 직접 `contenteditable`을 구현하면 선택 영역, 모바일 입력, 붙여넣기, 체크박스 동기화, 검색 하이라이트에서 버그 가능성이 높다.

## 이미지 첨부

메모 하나에는 이미지를 여러 개 첨부할 수 있다. 첨부 방식은 복사/붙여넣기, 드래그앤드롭, 파일 선택을 모두 지원한다.

원본 이미지는 저장하지 않는다. 클라이언트에서 저장용 이미지를 먼저 압축한 뒤 업로드한다.

- 저장용 이미지: 긴 변 1600-1920px 수준, WebP 또는 JPEG, 품질 0.75-0.82
- 썸네일: 긴 변 512px 수준, WebP
- GIF는 1차에서 압축 대상에서 제외하거나 첫 프레임 정지 이미지로 처리한다. 움직이는 GIF 원본 보존은 1차 범위에서 제외한다.
- 업로드 순서를 `sort_order`로 보관한다.
- 1차에서는 이미지 순서 변경은 제외하고 삽입 순서대로 표시한다.

R2 저장소는 기존 bucket을 재사용하되 object key prefix를 `memo-assets/`로 분리한다. 북마크 이미지와 메모 이미지는 DB 테이블과 API 경로도 분리한다.

## 데이터 모델

북마크와 메모는 분리한다.

### memos

- `id`
- `user_id`
- `folder_id`
- `title`
- `content_json`
- `content_text`
- `is_favorite`
- `memo_color`
- `created_at`
- `updated_at`

### memo_folders

- `id`
- `user_id`
- `parent_folder_id`
- `name`
- `color`
- `icon`
- `sort_order`
- `created_at`
- `updated_at`

폴더는 계층형이다. 북마크 폴더와 테이블을 공유하지 않는다.

### memo_tags

- `id`
- `user_id`
- `name`
- `color`
- `created_at`
- `updated_at`

### memo_tag_links

- `memo_id`
- `tag_id`

### memo_assets

- `id`
- `memo_id`
- `user_id`
- `object_key`
- `thumbnail_object_key`
- `mime_type`
- `width`
- `height`
- `sort_order`
- `created_at`
- `updated_at`

## API

메모 API는 `/api/memos` 아래에 둔다.

- `GET /api/memos`
- `POST /api/memos`
- `GET /api/memos/:memoId`
- `PATCH /api/memos/:memoId`
- `DELETE /api/memos/:memoId`
- `GET /api/memos/folders`
- `POST /api/memos/folders`
- `PATCH /api/memos/folders/:folderId`
- `DELETE /api/memos/folders/:folderId`
- `GET /api/memos/tags`
- `POST /api/memos/tags`
- `PATCH /api/memos/tags/:tagId`
- `DELETE /api/memos/tags/:tagId`
- `GET /api/memos/:memoId/assets`
- `POST /api/memos/:memoId/assets`
- `DELETE /api/memos/:memoId/assets/:assetId`
- `GET /api/memos/:memoId/assets/:assetId/content`
- `GET /api/memos/:memoId/assets/:assetId/thumbnail`

검색과 필터는 1차에서 아래만 지원한다.

- `query`
- `folderId`
- `includeDescendantFolders`
- `tagId`
- `favorite`
- `sort=updated_desc | updated_asc | title_asc | title_desc`
- `limit`
- `offset`

## 보안과 검증

모든 메모, 폴더, 태그, 이미지 API는 세션 인증을 요구한다. 모든 조회와 변경은 `user_id`로 제한한다. 리치 텍스트 JSON은 허용한 노드와 mark만 저장한다. HTML은 저장하지 않는다.

이미지 업로드는 MIME 타입과 파일 크기를 제한한다. 서버는 클라이언트가 압축했다고 믿지 않고 최대 크기를 다시 확인한다. R2 object는 인증된 API를 통해서만 제공한다.

## 비범위

- 북마크와 메모 연결
- 공유와 협업
- 버전 히스토리
- OCR
- 이미지 순서 변경
- 고급 블록 타입
- 메모 휴지통
- 실시간 동기화 편집

## 검증 기준

- 로그인한 사용자는 메모 화면으로 이동할 수 있다.
- 메모를 작성, 수정, 삭제할 수 있다.
- 계층형 메모 폴더를 만들고 메모를 폴더에 넣을 수 있다.
- 태그, 색상, 즐겨찾기를 설정할 수 있다.
- 메모 목록은 리스트/카드 보기로 전환된다.
- `[]` 입력으로 체크박스 라인이 만들어진다.
- 체크된 라인은 취소선으로 표시된다.
- 굵게와 글자 크기 조절이 저장 후에도 유지된다.
- 여러 이미지를 붙여넣기, 드래그앤드롭, 파일 선택으로 첨부할 수 있다.
- 첨부 이미지는 압축본과 썸네일로 저장된다.
- 모바일에서 메모 본문 내부 검색을 사용할 수 있다.
