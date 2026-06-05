# 북마크 검색 정렬 구현 계획

1. 공용 타입과 테스트 추가
- 정렬 모드를 공용 타입으로 추가
- API/Web 실패 테스트부터 추가

2. API 구현
- `GET /api/bookmarks`에 `sort` 파라미터 파싱 추가
- `opened_desc`일 때 `bookmark_activity` 집계로 결과 정렬

3. Web 구현
- 검색 상태에 `sort` 추가
- 검색 폼에 `정렬` 선택 추가
- 검색 초기화 시 `created_desc`로 복귀

4. 검증
- `npm run test:api`
- `npm run test:web`
- `npm run build:web`

5. 커밋
- `feat: add bookmark search sorting`
