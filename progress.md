# Progress

## Session Log

### 2026-02-17 — B3 개발자 문서 + 테스트 보강 + 배포 준비

**B3: 개발자 문서 4종 작성**
  - `docs/developers/extension-api.md` (15KB): ExtensionContext API, 매니페스트 스키마, 라이프사이클, 권한 시스템
  - `docs/developers/hook-reference.md` (14KB): HookManager API, 훅 목록, 프론트엔드 HookRegistry
  - `docs/developers/theme-development.md` (13KB): 테마 매니페스트, 컴포넌트 슬롯, 설정, CLI 스캐폴딩
  - `docs/developers/widget-development.md` (15KB): 위젯 매니페스트, 카테고리, 슬롯, 설정, 전체 예제

**Sprint D/E 테스트 보강 (68개 신규, 총 122개)**
  - `qa-board.test.ts`: 15 tests (parseQAInfo, getQAStatusLabel/Color)
  - `license.test.ts`: 15 tests (generateLicenseKey, isValidKeyFormat, signLicense, verifySignature)
  - `url-compat.test.ts`: 29 tests (mapGnuboardUrl, mapRhymixUrl)
  - `ai-content.test.ts`: 9 tests (summarizeContent, analyzeSpamWithAI)

**프로덕션 배포 준비**
  - `scripts/validate-env.ts`: 필수 환경변수 6개 + 권장 5개 검증 스크립트
  - `docs/deployment/production-checklist.md`: 배포 전/중/후 체크리스트, 롤백 절차
  - `/health` 엔드포인트: package.json에서 동적 버전 읽기
  - `compose.prod.yml`: NODE_OPTIONS=--max-old-space-size=512

**검증**: svelte-check 0 errors, 122 unit tests passed
**커밋**: `bbf9891`

---

### 2026-02-17 — 기존 TypeScript 에러 4개 수정

- sidebar-widget-renderer.svelte: `config`, `slot` 잘못된 props 제거
- login-form.svelte: `user_id` → `username`
- +layout.svelte: `nickname ?? ''` null coalescing 추가
- **커밋**: `f72555d`

---

### 2026-02-17 — Sprint E: 장기 차별화 완료

**E1: AI 콘텐츠 (스팸 필터, 자동 요약)**
  - `ai-content.ts`: OpenAI (gpt-4o-mini) / Anthropic (claude-haiku-4-5) 지원 AI 서비스
  - `/api/ai/spam-check`: 2단계 스팸 검사 (규칙 기반 → AI 보조)
  - `/api/ai/summarize`: AI 게시글 요약 (summary, keywords, category)

**E2: 실시간 SSE**
  - `/api/notifications/stream`: SSE 엔드포인트 (ReadableStream, 접속자 수 broadcast, 30초 heartbeat)
  - `sse.svelte.ts`: SSE 클라이언트 스토어 (자동 재연결, 지수 백오프, 알림 핸들러)

**E3: PWA 지원**
  - `manifest.json`: 사이트명 정리 (Angple Community)
  - `sw.js`: Cache-First (정적자산), Network-First (API), 오프라인 폴백, 푸시 알림 수신/클릭 핸들링
  - `offline.html`: 오프라인 페이지 (사이트명 수정)

**E4: 관리자 설정 강화**
  - Feature Flags 탭: 7개 기능 토글 (AI 스팸, AI 요약, SSE, 푸시, Q&A, 멘션, 자동저장)
  - SEO 설정 탭: 메타 설명 (160자 제한), OG 이미지 URL, robots.txt 추가 규칙
  - `admin-settings.ts`에 FeatureFlagsSettings, SeoSettings 타입 + 메타 추가

**E5: 라이선스 시스템**
  - `license.ts`: 라이선스 타입 (LicenseKey, LicenseTier, LicenseStatus), 티어 메타, 유틸 함수
  - `server/license.ts`: 라이선스 키 생성 (ANGP-XXXX-XXXX-XXXX-XXXX), HMAC 서명/검증
  - `/api/licenses/verify`: 라이선스 검증 API (Go 백엔드 프록시)
  - `admin-licenses.ts`: 관리자 라이선스 CRUD API 클라이언트
  - `/admin/commerce/licenses`: 관리자 라이선스 관리 페이지 (검색, 필터, 상태 통계, 도메인 관리)
  - Commerce 대시보드에 "라이선스" 빠른 링크 추가

**검증**: svelte-check 4 errors (기존 에러만), 54 unit tests passed

---

### 2026-02-17 — Sprint D: 플랫폼 완성도 완료

**D1: WYSIWYG 에디터 강화**
  - TipTap 에디터에 테이블 (Table/TableRow/TableHeader/TableCell), 코드 하이라이팅 (CodeBlockLowlight + lowlight), YouTube 임베드, 글자/단어 수 카운터 추가
  - 테이블 삽입/행열 추가·삭제/테이블 삭제 드롭다운 메뉴
  - Catppuccin 컬러 기반 구문 하이라이팅 스타일 (20+ hljs 클래스)
  - 하단 상태바에 실시간 글자 수·단어 수 표시

**D2: Q&A 게시판 타입**
  - `Board.board_type`에 `'qa'` 추가
  - `qa-board.ts`: QAStatus 타입, parseQAInfo(), getQAStatusLabel/Color() 유틸
  - `qa-post-list.svelte`: Q&A 전용 게시판 목록 (필터: 전체/미해결/답변됨/해결됨, 상태 뱃지, 현상금 표시)
  - `qa-answer-section.svelte`: 게시글 상세 Q&A 상태 헤더 (post.before_content 슬롯)
  - boardTypeRegistry에 'qa' 등록, postSlotRegistry에 before_content 슬롯 추가
  - `UpdatePostRequest`에 extra_1~3 필드 추가 (답변 채택용)

**D3: 태그 시스템 UI**
  - `/tags/[tag]/+page.svelte`: 태그별 게시글 목록 페이지 (페이지네이션 포함)
  - 게시글 상세의 태그 Badge를 `/tags/{tag}` 링크로 변경 (클릭 가능)

**D4: @멘션 알림 연동**
  - `/api/mentions/notify/+server.ts`: 멘션 알림 생성 API (content에서 @멘션 추출 → DB 알림 레코드 생성)
  - `mention-notify.ts`: 클라이언트 유틸 (fire-and-forget 방식)
  - 댓글 작성, 답글 작성, 게시글 작성 시 자동 멘션 알림 전송

**D5: 프로필 수정**
  - `/my/settings/+page.server.ts`: `/member/settings`로 302 리다이렉트 (기존 완전 구현 활용)

**검증**: svelte-check 4 errors (기존 에러만), 54 unit tests passed

### 2026-02-16 — Sprint B: 개발자 생태계 완료

**B1: CLI 스캐폴딩 도구** — `@angple/cli` 패키지 생성
  - `angple create theme/plugin/widget` 3가지 명령어
  - Commander.js + picocolors, 테마/플러그인/위젯 매니페스트 스키마 준수
  - root package.json에 `pnpm angple` 스크립트 추가

**B2: 공개 API 문서 (OpenAPI 3.0)**
  - `apps/web/static/openapi.yaml` — 85개 엔드포인트 정의 (Auth, Boards, Posts, Comments, Likes, Search, Members, Files, Notifications, Messages, Admin)
  - `apps/web/src/routes/api-docs/+page.svelte` — Scalar CDN 기반 인터랙티브 API 문서 페이지

**B4: 테마 마켓플레이스**
  - `apps/web/src/routes/api/themes/marketplace/+server.ts` — 테마 마켓플레이스 API (공식 테마 스캔)
  - `apps/web/src/routes/admin/themes/marketplace/+page.svelte` — 테마 마켓플레이스 UI (검색, 카테고리 필터, 적용, 설정 링크)
  - 기존 테마 목록 페이지의 "마켓플레이스" 버튼에 href 연결

**B5: 확장 보안 샌드박스**
  - `PermissionManager` 강화: `require()` (throw on deny), `checkHookPermission()` (훅별 권한 매핑), `analyzeDangerousPermissions()` (위험 권한 분석), 감사 로그 (최근 1000건)
  - `PluginHookManagerProxy` 개선: addAction/addFilter 시 권한 검증 적용
  - `plugin-security.ts` 확장: `analyzePluginPermissions()` — 설치 시 위험 권한 경고 + riskLevel 분석

검증: svelte-check 4 errors (전부 기존 에러), 54 unit tests passed

### 2026-02-16 — Sprint C: 마이그레이션 & 확산 완료

**C1: 그누보드 DB 마이그레이션 도구**
  - `@angple/migration` 패키지 생성 (mysql2 + picocolors)
  - `schema-mapper.ts`: g5_member/g5_board/g5_write_*/g5_point → Angple 형식 (wr_1~10 → extra_1~10 1:1 매핑)
  - `password-compat.ts`: PHP $2y$ → Go/Node $2a$ 변환, md5/sha256 구버전 감지 및 리셋 플래그
  - `attachment-migrator.ts`: g5_data/file/ → uploads/ 복사, 본문 내 이미지 경로 변환
  - `index.ts`: 7단계 마이그레이션 오케스트레이터 (배치 500건, 진행률 콜백)

**C2: 라이믹스 DB 마이그레이션 도구**
  - `rhymix/schema-mapper.ts`: xe_member/xe_modules/xe_documents/xe_comments/xe_files 매핑
  - regdate(YYYYMMDDHHmmss) → ISO 8601 변환, extra_vars JSON → extra_1~5
  - module_srl → mid 매핑으로 게시글이 올바른 게시판에 연결

**C3: 마이그레이션 관리자 UI**
  - `/admin/migration` 5단계 위자드: 소스 선택 → DB 연결 → 사전 분석 → 실행 → 결과
  - 옵션: PHP 비밀번호 호환, 첨부파일 마이그레이션, dry-run 모드
  - API: `/api/admin/migration/analyze` (사전 분석), `/api/admin/migration/run` (실행)
  - 사이드바에 "마이그레이션" 메뉴 추가 (DatabaseZap 아이콘)

**C4: 그누보드 URL 리다이렉트 (SEO 보존)**
  - `url-compat.ts`: 그누보드 URL 매핑 (/bbs/board.php?bo_table=free → /free 등 10가지 패턴)
  - 라이믹스 URL 매핑 (/index.php?mid=board&document_srl=123 → /board/123)
  - `hooks.server.ts`에 301 리다이렉트 통합 (검색엔진 색인 보존)

검증: svelte-check 4 errors (기존 에러만), 54 unit tests passed, migration 패키지 tsc 통과

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
