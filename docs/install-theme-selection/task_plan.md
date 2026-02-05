# 설치 마법사 테마 선택 기능

## 목표
설치 마법사 Step 1에서 사용자가 기본 테마를 선택할 수 있도록 함

## 체크리스트

### Phase 1: 기본 구현 ✅
- [x] `+page.server.ts`에서 `scanThemes()` 호출하여 테마 목록 로드
- [x] `+page.svelte`에 테마 선택 UI 추가 (카드 그리드)
- [x] 선택된 테마를 `settings.json`의 `activeTheme`에 저장
- [x] 기본 선택값: `damoang-default`

### Phase 2: 스크린샷 처리 ✅
- [x] 스크린샷 파일 존재 여부 서버에서 확인
- [x] 존재하는 경우만 이미지 경로 반환
- [x] 없는 경우 "미리보기 없음" 표시
- [x] 404 에러 제거

### Phase 3: 테스트 ✅
- [x] 테마 선택 UI 표시 확인
- [x] 테마 클릭 시 선택 상태 변경
- [x] 폼 제출 후 settings.json 저장 확인
- [x] 설치 완료 후 선택한 테마 적용 확인

### Phase 4: 리팩토링 (선택사항)
- [ ] 테마 카드 컴포넌트 분리
- [ ] 테마 스캔 결과 캐싱
- [ ] 테마 미리보기 모달 추가

## 관련 파일
- `apps/web/src/routes/install/+page.server.ts`
- `apps/web/src/routes/install/+page.svelte`
- `apps/web/src/lib/server/themes/scanner.ts`
- `apps/web/src/lib/server/install/check-installed.ts`

## 의존성
- `scanThemes()` - 테마 스캐너
- `getThemePath()` - 테마 경로 조회
- `updateSettings()` - 설정 저장
