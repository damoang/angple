# Progress

## Session Log

### 2026-02-16 — Open-Core 분리 첫 실행

- task_plan.md, findings.md, progress.md 업데이트
- 코드베이스 분석 완료: 환경변수화 대상, 위젯 이름 변경 대상 파악

**Phase 1 완료**: `docs/migration/open-core-separation.md` 저장

**Phase 2-1 완료**: 환경변수화
  - `gam.svelte.ts`: NETWORK_CODE, ADSENSE_CLIENT, site targeting → 환경변수
  - `mailer.ts`: 다모앙 fallback → 범용 기본값
  - `vite.config.ts`: allowedHosts 기본값 → 'localhost'만
  - `compose.prod.yml`: Docker 이미지 → 환경변수
  - `.env.example`: 새 환경변수 추가, 다모앙 URL 값 제거

**Phase 3-1 완료**: widgets/ad → widgets/ad-slot
  - 디렉토리 이름 변경, widget.json ID 변경
  - default-widgets.ts 9곳, widget-layout.svelte.ts 2곳 type 변경
  - migrateWidgetConfig()에 'ad' → 'ad-slot' 마이그레이션 추가
  - widget-spec-v1.0.md 예시 업데이트

**Phase 3-2 완료**: 위젯/확장 스펙 수정
  - sticky-ads, adsense-sidebar 카테고리 'sidebar' → 'ad'
  - plugin-banner-message, plugin-promotion, plugin-mention hooks → 배열 형식
  - plugin-mention에 license, main 필드 추가
  - plugin-content-history/plugin.json → extension.json 이름 변경

**검증**: svelte-check 실행 — 기존 에러 2개만 존재 (변경과 무관)

### 2026-02-16 — Open-Core 분리 Phase 2-2, 2-4, 3-3

**Step 1 완료**: `.env`에 GAM 환경변수 추가
  - `VITE_GAM_NETWORK_CODE`, `VITE_ADSENSE_CLIENT`, `VITE_GAM_SITE_NAME` 실제 값 추가
  - `VITE_ADS_URL`, `VITE_LEGACY_URL`, `VITE_S3_URL` 추가
  - `.env.example`에도 GAM 섹션 추가

**Phase 2-2 완료**: CSP 헤더 환경변수화
  - `hooks.server.ts`의 CSP `script-src`, `style-src`, `connect-src`에서 하드코딩된 `ads.damoang.net`, `damoang.net` → `VITE_ADS_URL`, `VITE_LEGACY_URL` 환경변수 기반 동적 생성

**Phase 2-4 완료**: s3.damoang.net URL 환경변수화
  - `celebration/today/+server.ts`: `https://s3.damoang.net` → `VITE_S3_URL` (2곳)
  - `image-text-banner/+server.ts`: URL 정규화 함수에서 `VITE_S3_URL` 사용
  - `ai-trend-card.svelte` (2개 파일): 캐릭터 이미지 URL 베이스 → `VITE_S3_URL`
  - `bracket-image.ts` (plugins + auto-embed): 도메인 허용목록을 `VITE_S3_URL`, `VITE_LEGACY_URL`에서 동적 추출

**Phase 3-3 완료**: 위젯 로더 Zod 검증 추가
  - `widget-component-loader.ts`에서 매니페스트 파싱 시 `safeValidateWidgetManifest()` 사용
  - 검증 실패 시 경고 로그 출력 후 해당 위젯 건너뛰기

**검증**: svelte-check 실행 — 기존 에러 2개만 존재 (변경과 무관, 수정 파일에 에러 없음)

**Phase 2-3 완료**: DB 자격증명 환경변수화
  - `db.ts`: 하드코딩된 RDS 호스트/유저/패스워드/DB명 제거 (보안 이슈 해결)
  - fallback을 범용 값으로 변경 (`localhost`/`root`/`angple`)
  - 실제 자격증명을 `.env`로 이동, `.env.example`에 DB 섹션 추가

**Phase 2-5 완료**: damoang_jwt 쿠키명 환경변수화
  - `VITE_LEGACY_SSO_COOKIE` 환경변수 도입 (빈 값 = 레거시 SSO 비활성화)
  - `client.ts`: `damoang_jwt` 하드코딩 → `LEGACY_SSO_COOKIE` 상수 기반
  - `hasDamoangJwtCookie()` → `hasLegacySsoCookie()` 메서드명 변경
  - `layout/+server.ts`: 인증 쿠키 확인 로직 환경변수 기반으로 변경
  - 주석에서 '다모앙' 특정 용어 → '레거시 SSO' 범용 용어로 변경

**검증**: svelte-check 실행 — 기존 에러 2개만 존재 (변경과 무관)

**Phase 2 전체 완료** (2-1 ~ 2-5). Phase 3도 전체 완료 (3-1 ~ 3-3).
남은 작업: Phase 4~6 (비공개 레포 분리, CI/CD, 검증) — 별도 세션에서 진행.

### 2026-02-14

- 사이드바 이미지 배너 3단계 폴백 체인 구현 (ads → 직접홍보 → AdSense)
- 홈페이지 글씨 크기 개선 (PostCard 제목 15px, Compact 메타 13px)
- favicon을 damoang.net과 동일하게 변경 (ico, 96x96, 32x32, 16x16)
- ads.damoang.net 시스템 분석 결과 findings.md에 정리

### 2026-01-31

- task_plan.md, findings.md, progress.md 생성
- 작업 시작 준비 완료
- Phase 1 (코드베이스 분석) 완료
    - 플러그인 시스템 이미 상당 부분 구현됨
    - Phase 11은 "검증 및 개선" 작업으로 재정의
    - findings.md 업데이트 완료
