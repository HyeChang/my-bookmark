# 북마크 확장 검색 필터 구현 계획

1. API 테스트 추가
- `apps/api/test/bookmarks-routes.test.ts`에 색상/요약 필터 시나리오 추가
- 인메모리 저장소 테스트 더블도 확장 필터를 이해하도록 보강

2. Web 테스트 추가
- `apps/web/src/test/bookmark-dashboard.test.tsx`에 색상/요약 필터 시나리오 추가

3. API 구현
- `apps/api/src/lib/repositories/bookmarks.ts`의 필터 타입과 필터 헬퍼 확장
- `apps/api/src/routes/bookmarks.ts`에서 새 쿼리 파라미터 파싱

4. Web 구현
- `apps/web/src/lib/bookmarks.ts`에 새 쿼리 파라미터 전송 추가
- `apps/web/src/App.tsx` 검색 상태와 검색 UI 확장
- 활성 검색 요약 문구 보강

5. 검증
- `npm run test:api`
- `npm run test:web`
- `npm run build:web`

6. 커밋
- `feat: add extended bookmark search filters`
