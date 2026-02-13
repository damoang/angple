# Task Plan: Plugin ZIP Upload System - COMPLETE ✅

## Goal

테마 시스템과 동일한 패턴으로 ZIP 파일 업로드를 통한 커스텀 플러그인 설치 기능을 구현한다.

## 전체 완료! 🎉

---

## Phases

### Phase 1: 기존 테마 ZIP 업로드 패턴 분석 ✅

-   [x] 테마 ZIP 업로드 API 확인 (`/api/themes/upload`)
-   [x] ZIP 압축 해제 로직 확인
-   [x] 매니페스트 검증 프로세스 확인
-   [x] 에러 처리 패턴 확인
-   [x] findings.md에 분석 결과 기록
-   **Status:** ✅ complete

### Phase 2: Plugin Upload API 구현 ✅

-   [x] `/api/plugins/upload` POST 엔드포인트 생성
-   [x] FormData로 ZIP 파일 수신
-   [x] custom-plugins/ 디렉토리에 압축 해제
-   [x] plugin.json 매니페스트 검증 (ExtensionManifest + Zod)
-   [x] 중복 플러그인 ID 체크
-   **Status:** ✅ complete

### Phase 3: Admin UI - Upload 컴포넌트 ✅

-   [x] 플러그인 업로드 버튼/모달 추가 (PluginUploader 컴포넌트)
-   [x] ZIP 파일 선택 input (드래그 앤 드롭 지원)
-   [x] 업로드 진행 상태 표시 (진행률 바)
-   [x] 성공/실패 알림 (toast)
-   [x] 업로드 후 플러그인 목록 자동 새로고침
-   [x] Admin 플러그인 관리 페이지 생성 (/plugins)
-   **Status:** ✅ complete

### Phase 4: 보안 및 검증 강화 ✅

-   [x] ZIP 파일 크기 제한 (10MB) - 구현됨
-   [x] 허용된 MIME 타입 검증 - 구현됨
-   [x] 경로 탐색 공격 방지 (sanitizePath) - 구현됨
-   [x] ExtensionManifest Zod 검증 - 구현됨
-   **Status:** ✅ complete (기존 구현 충분)

### Phase 5: 테스트 및 정리 ✅

-   [x] 샘플 플러그인 ZIP 생성 (`/tmp/sample-test-plugin.zip`)
-   [x] ZIP 구조 검증
-   [x] 문서화 (`PLUGIN_ZIP_GUIDE.md`)
-   **Status:** ✅ complete

---

## 최종 결과

### 타입 안전성

```
Web 앱:   0 errors ✅
Admin 앱: 0 errors ✅
```

### 생성된 파일

**Backend**

-   `apps/web/src/routes/api/plugins/upload/+server.ts`

**Frontend**

-   `apps/admin/src/lib/components/plugin-uploader.svelte`
-   `apps/admin/src/routes/plugins/+page.svelte`

**Documentation**

-   `PLUGIN_ZIP_GUIDE.md`

**Test Assets**

-   `/tmp/sample-test-plugin.zip` (1.9KB)

### PR

-   PR #151: https://github.com/damoang/angple/pull/151

---

## 주요 기능

1. ✅ ZIP 파일 업로드 (드래그 앤 드롭)
2. ✅ 진행률 표시
3. ✅ ExtensionManifest 자동 검증
4. ✅ custom-plugins/ 자동 압축 해제
5. ✅ 플러그인 자동 스캔
6. ✅ Admin UI 플러그인 관리
7. ✅ 활성화/비활성화 기능
8. ✅ 커스텀 플러그인 삭제

---

## 다음 단계 (향후)

1. 플러그인 마켓플레이스 구현
2. GitHub 직접 설치 기능
3. 플러그인 업데이트 시스템
4. 권한 및 샌드박싱 강화
