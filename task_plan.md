# Task Plan: ANGPLE Open-Core 분리 — 첫 실행 단계

## 목표
Core (MIT 공개) vs Damoang (비공개) 분리를 위한 첫 실행 단계 수행

---

## Phase 1: 분류 문서 저장
- [x] `docs/migration/open-core-separation.md`에 분류 문서 저장

## Phase 2-1: 환경변수화
- [x] `gam.svelte.ts`: NETWORK_CODE → `VITE_GAM_NETWORK_CODE`, ADSENSE_CLIENT → `VITE_ADSENSE_CLIENT`, site 타겟팅 → `VITE_GAM_SITE_NAME`
- [x] `mailer.ts`: fallback → 범용 기본값 (`noreply@example.com`, `Angple`)
- [x] `vite.config.ts`: allowedHosts 기본값에서 다모앙 도메인 제거 → 'localhost'만
- [x] `compose.prod.yml`: Docker 이미지 → `${ANGPLE_WEB_IMAGE:-ghcr.io/angple/angple-web:latest}`
- [x] `.env.example`: 새 환경변수 추가 (GAM, mailer, allowed hosts 등), 다모앙 전용 값 제거

## Phase 3-1: 위젯 ad → ad-slot 이름 변경
- [x] `widgets/ad/` → `widgets/ad-slot/` 디렉토리 이름 변경
- [x] `widgets/ad-slot/widget.json`: id를 'ad-slot'으로 변경
- [x] `default-widgets.ts`: type 'ad' → 'ad-slot' 참조 변경 (9곳)
- [x] `widget-layout.svelte.ts`: hasEnabledAds에서 'ad' → 'ad-slot' 변경 (2곳)
- [x] `migrateWidgetConfig()`: 'ad' → 'ad-slot' 마이그레이션 추가 (저장된 레이아웃 호환)
- [x] `add-widget-dialog.svelte`: categoryOrder 'ad'는 카테고리명이므로 변경 불필요
- [x] `widget-spec-v1.0.md`: 예시 코드 'ad' → 'ad-slot' 업데이트
- [x] `sidebar-ad` 마이그레이션도 'ad-slot'로 자동 변경됨

## Phase 3-2: 위젯/확장 스펙 수정
- [x] `sticky-ads/widget.json`: category 'sidebar' → 'ad'
- [x] `adsense-sidebar/widget.json`: category 'sidebar' → 'ad'
- [x] `plugin-banner-message/extension.json`: hooks 객체 → 배열
- [x] `plugin-promotion/extension.json`: hooks 객체 → 배열
- [x] `plugin-mention/extension.json`: hooks 배열 + license, main 필드 추가
- [x] `plugin-content-history/plugin.json` → `extension.json` 이름 변경

## Phase 2-2: CSP 헤더 환경변수화
- [x] `hooks.server.ts` CSP의 `ads.damoang.net` → `VITE_ADS_URL` 환경변수
- [x] `hooks.server.ts` CSP의 `damoang.net` → `VITE_LEGACY_URL` 환경변수

## Phase 2-4: s3.damoang.net URL 환경변수화
- [x] `celebration/today/+server.ts`: 2곳 → `VITE_S3_URL`
- [x] `image-text-banner/+server.ts`: normalizeImageUrl → `VITE_S3_URL`
- [x] `ai-trend-card.svelte` (features): 캐릭터 이미지 URL → `VITE_S3_URL`
- [x] `ai-trend-card.svelte` (ui): 캐릭터 이미지 URL → `VITE_S3_URL`
- [x] `bracket-image.ts` (plugins): 도메인 목록 동적화
- [x] `bracket-image.ts` (auto-embed): 도메인 목록 동적화

## Phase 3-3: 위젯 로더 Zod 검증
- [x] `widget-component-loader.ts`에 `safeValidateWidgetManifest()` 적용

## .env 실제 값 추가
- [x] `apps/web/.env`에 GAM 3개 + 레거시 연동 3개 환경변수 추가
- [x] `apps/web/.env.example`에 GAM 섹션 추가

## Phase 2-3: DB 자격증명 환경변수화
- [x] `db.ts`: 하드코딩된 RDS 호스트/유저/패스워드/DB명 제거 → 범용 fallback (`localhost`/`root`/`angple`)
- [x] `.env`에 실제 DB 자격증명 이동
- [x] `.env.example`에 DB 섹션 추가

## Phase 2-5: damoang_jwt 쿠키명 환경변수화
- [x] `VITE_LEGACY_SSO_COOKIE` 환경변수 도입 (빈 값이면 레거시 SSO 비활성화)
- [x] `client.ts`: `damoang_jwt` 하드코딩 → `LEGACY_SSO_COOKIE` 상수 (3곳 코드 + 3곳 주석)
- [x] `layout/+server.ts`: `damoang_jwt` → `VITE_LEGACY_SSO_COOKIE` / `refresh_token` 폴백
- [x] `auth.svelte.ts`: 주석 범용화
- [x] `login-form.svelte`: 주석 범용화
- [x] `.env`, `.env.example` 업데이트

## Phase 4: 물리적 분리 (완료)
- [x] Step 1: ad-slot.svelte GAM 하드코딩 환경변수화 (VITE_GAM_NETWORK_CODE, VITE_GAM_SITE_NAME)
- [x] Step 2: Dead code 삭제 (gam-slot/, podcast.svelte.ts)
- [x] Step 3: DamoangBanner → AdSlot 대체 (default-layout, [boardId]/+page, [postId]/+page)
- [x] Step 4: [boardId]/+page.ts promotion fetch 제거
- [x] Step 5: +layout.svelte memo → 동적 import, 사이트명 환경변수화
- [x] Step 6: default-widgets.ts 다모앙 전용 위젯 제거 (celebration-card, podcast, sharing-board, sticky-ads)
- [x] Step 7: Damoang API 라우트 삭제 (api/ads/, api/mentions/)
- [x] Step 8: Damoang UI 컴포넌트 삭제 (damoang-banner, celebration-rolling, promotion-inline-post, podcast-player)
- [x] Step 9: Tier 1 동적 로딩 항목 삭제 (테마6 + 위젯6 + 플러그인8 + 확장3 = 23개 디렉토리)
- [x] Step 10: 사이트명 하드코딩 일괄 변경 (27개 파일, VITE_SITE_NAME)
- [x] Step 11: Premium 레포 구조 생성 (/tmp/angple-premium/)
- [x] Step 12: 빌드 검증 (pnpm check 4 errors — 모두 기존 에러, pnpm build 성공)
- [x] 추가: plugin-optional-loader.ts 유틸 생성 (import.meta.glob 기반 안전한 플러그인 로드)

## 남은 작업 (후속 세션)
- [ ] Phase 5~6: CI/CD, 검증

## Key Findings
- `hasEnabledAds`는 `type === 'ad'`로 체크 — 'ad-slot'으로 변경 필요
- `migrateWidgetConfig()`에 'sidebar-ad' → 'ad' 마이그레이션 존재 — 'ad' → 'ad-slot' 추가 필요
- settings.json에 저장된 레이아웃에 `type: "ad"` 존재 — 마이그레이션 필수
- 확장 hooks는 Zod에서 배열 형식 강제 (`ExtensionHookSchema[]`)
- `categoryOrder`는 `['content', 'layout', 'ad', 'sidebar']` — 'ad' 카테고리는 유지 (위젯 타입과 다름)
