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

## Phase 5: CI/CD 정리 (완료)
- [x] Step 1: Damoang 인프라 스크립트 9개 Core에서 제거 → premium 이동
- [x] Step 2: deploy-dev.yml, deploy-prod.yml 삭제 (docker-publish.yml이 커버)
- [x] Step 2: ci.yml DAMOANG_JWT_SECRET → LEGACY_JWT_SECRET
- [x] Step 3: Premium repo에 deploy/scripts/ 추가 (9개 스크립트)
- [x] Step 4: Premium repo CI workflow (.github/workflows/verify.yml)

## Phase 6: 검증 (완료)
- [x] Step 5: Core 단독 테스트 (54 tests passed, build 성공)
- [x] Step 6: Premium install → Core 빌드 통합 검증 (성공)
- [x] Step 7: Core/Premium 양쪽 커밋 & push

## Sprint A: Quick Wins — 관리자 기능 (완료)
- [x] A1: 관리자 대시보드 실시간화 — admin-stats.ts API 생성, 대시보드 실시간 데이터 로딩 + 새로고침 + 에러 핸들링
- [x] A2: 게시판 CRUD 관리자 — admin-boards.ts API, /admin/boards 목록/생성/수정/삭제 페이지 생성
- [x] A3: 회원 관리 페이지 — admin-members.ts API, /admin/members 목록/검색/레벨변경/차단/일괄처리 생성
- [x] A3.5: 사이드바에 게시판 관리 + 회원 관리 메뉴 추가
- [x] A4: 공지사항 상단고정 — 이미 완전 구현됨 (importantNotices + normalNotices + Megaphone/Pin 아이콘)
- [x] A5: 자동저장 — 이미 완전 구현됨 (30초 자동저장 + localStorage + 복구 배너 + DraftList + TipTap 에디터)
- [x] 검증: svelte-check 4 errors (기존 에러), 54 unit tests passed

## Sprint B: 개발자 생태계 (완료)
- [x] B1: CLI 스캐폴딩 도구 (@angple/cli) — create theme/plugin/widget 명령어, Commander.js, `pnpm angple` 연동
- [x] B2: 공개 API 문서 (OpenAPI 3.0) — 85개 엔드포인트 openapi.yaml + Scalar 기반 /api-docs 페이지
- [x] B4: 테마 마켓플레이스 — /admin/themes/marketplace + API endpoint, 플러그인 마켓플레이스 패턴 미러링
- [x] B5: 확장 보안 샌드박스 — PermissionManager 런타임 차단 + 훅별 권한 검증 + 위험 권한 경고 + 감사 로그
- [x] 검증: svelte-check 4 errors (기존 에러만), 54 unit tests passed

## Sprint C: 마이그레이션 & 확산 (완료)
- [x] C1: 그누보드 DB 마이그레이션 도구 — @angple/migration 패키지, schema-mapper (wr_1~10 → extra_1~10), password-compat (PHP bcrypt → Go bcrypt), attachment-migrator, 배치 처리 오케스트레이터
- [x] C2: 라이믹스 DB 마이그레이션 도구 — xe_member/xe_modules/xe_documents/xe_comments 매핑, regdate(YYYYMMDDHHmmss) → ISO 변환, extra_vars JSON → extra_1~5
- [x] C3: 마이그레이션 관리자 UI — 5단계 위자드 (소스 선택 → DB 연결 → 분석 → 실행 → 결과), dry-run 지원, 사이드바 메뉴 추가
- [x] C4: 그누보드 URL 리다이렉트 — url-compat.ts (그누보드 + 라이믹스 URL 매핑), hooks.server.ts 301 리다이렉트 통합
- [x] 검증: svelte-check 4 errors (기존 에러만), 54 unit tests passed, migration 패키지 tsc 통과

## Sprint D: 플랫폼 완성도 (완료)
- [x] D1: WYSIWYG 에디터 강화 — Table, CodeBlockLowlight, YouTube 임베드, 글자수 카운터 추가
- [x] D2: Q&A 게시판 타입 — board_type 'qa' 추가, QAPostList 컴포넌트, QAAnswerSection 슬롯, qa-board.ts 타입
- [x] D3: 태그 시스템 UI — /tags/[tag] 페이지, 게시글 태그 클릭 가능 (링크)
- [x] D4: @멘션 알림 연동 — /api/mentions/notify API, 댓글/답글/게시글 작성 시 자동 알림
- [x] D5: 프로필 수정 — /my/settings → /member/settings 리다이렉트 (기존 완전 구현 활용)

## Sprint E: 장기 차별화 (완료)
- [x] E1: AI 콘텐츠 — ai-content.ts (OpenAI/Anthropic), 스팸 검사 API (규칙+AI 2단계), 자동 요약 API
- [x] E2: 실시간 SSE — SSE 스트림 엔드포인트 (접속자 수, 실시간 알림, heartbeat), SSE 클라이언트 스토어
- [x] E3: PWA — manifest.json 정리, Service Worker (Cache-First/Network-First/오프라인 폴백/푸시 알림), offline.html
- [x] E4: 관리자 설정 강화 — Feature Flags 탭 (7개 기능 토글), SEO 설정 탭 (메타설명, OG이미지, robots.txt)
- [x] E5: 라이선스 시스템 — 라이선스 키 타입/생성/검증, 관리자 라이선스 관리 페이지, Commerce 빠른 링크 추가

---

## Key Findings
- `hasEnabledAds`는 `type === 'ad'`로 체크 — 'ad-slot'으로 변경 필요
- `migrateWidgetConfig()`에 'sidebar-ad' → 'ad' 마이그레이션 존재 — 'ad' → 'ad-slot' 추가 필요
- settings.json에 저장된 레이아웃에 `type: "ad"` 존재 — 마이그레이션 필수
- 확장 hooks는 Zod에서 배열 형식 강제 (`ExtensionHookSchema[]`)
- `categoryOrder`는 `['content', 'layout', 'ad', 'sidebar']` — 'ad' 카테고리는 유지 (위젯 타입과 다름)
