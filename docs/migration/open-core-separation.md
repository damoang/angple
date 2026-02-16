# ANGPLE Open-Core 분리 계획: Core vs Damoang 분류 및 마이그레이션 로드맵

## Context

ANGPLE은 WordPress 스타일의 확장 가능한 커뮤니티 플랫폼이다. 현재 Core 기능과 다모앙(Damoang) 커뮤니티 전용 기능이 하나의 레포에 섞여 있다. **Core만 MIT로 공개**하고, 다모앙 전용 플러그인/위젯/테마는 비공개 레포로 분리해야 한다. `angple-backend`(Go)는 이미 별도 레포에 존재한다.

---

## Part 1: 글로벌 스탠다드 분석

### 주요 프로젝트 비교

| 프로젝트 | 레포 전략 | 상업 분리 방법 | 라이선스 |
|----------|-----------|---------------|---------|
| **WordPress** | Multi-repo | 프리미엄 플러그인은 완전 별도 레포, ZIP 배포, 라이선스 API | GPLv2 |
| **Ghost** | Mono + 테마 mono | SaaS 수익모델, 테마 마켓플레이스 | MIT |
| **Strapi** | Monorepo (Nx) | 동일 코드베이스, 라이선스 키로 Enterprise 기능 해제 | MIT (CE) |
| **GitLab** | 단일 repo + `ee/` 디렉토리 | `ee/` 폴더 자동 제거한 FOSS 미러 생성 | MIT (CE) |
| **Grafana** | 단일 repo | 라이선스 키로 Enterprise 기능 해제 | AGPL-3.0 |
| **Directus** | Monorepo | npm 패키지 기반 확장 마켓플레이스 | BSL/GPL |
| **Medusa** | Monorepo (pnpm) | SaaS 수익모델, 모듈은 전부 OSS | MIT |

### 레포 통합 전략 비교

| 전략 | 장점 | 단점 | 적합한 경우 |
|------|------|------|------------|
| **Git Submodule** | 커밋 핀닝, 명확한 경계 | DX 복잡, 머지 충돌 혼란 | 소규모 1-3개 확장 |
| **npm Private Package** | 표준 워크플로, semver, pnpm 호환 | 퍼블리시 후 테스트, 인증 필요 | **프로덕션 배포 (추천)** |
| **Deploy Script** | 최대 유연성, 빌드타임 조립 | 커스텀 툴링 유지보수 | 복합 엔터프라이즈 |
| **GitLab `ee/` 모델** | 단일 워크플로, 원자적 커밋 | 상업 코드 소스 노출 (source-available) | 소스 공개 괜찮을 때 |

### ANGPLE 추천 전략: WordPress 모델 + npm Private Packages

ANGPLE은 이미 WordPress 스타일 아키텍처(hook system, widget system, theme/plugin engine)를 구현했으므로, **WordPress의 분리 모델**이 가장 자연스럽다:

- **Core (MIT, 공개)**: 프레임워크 + 공식 무료 테마/위젯/확장
- **Premium (비공개)**: `@damoang/` 스코프의 npm private package로 배포
- **배포**: CI/CD에서 `pnpm install`로 private 패키지 설치 → `custom-plugins/`, `custom-themes/` 등에 복사
- **런타임**: 기존 dynamic loader (`import.meta.glob`)가 `custom-*` 디렉토리를 이미 스캔

---

## Part 2: 현재 코드베이스 분류 (Core vs Damoang)

### A. Packages (5개 — 전부 Core)

| 패키지 | 용도 | 분류 |
|--------|------|------|
| `@angple/types` | 공유 TypeScript 타입 | **Core** |
| `@angple/hook-system` | WordPress 스타일 액션/필터 | **Core** |
| `@angple/theme-engine` | 테마 로딩/관리 | **Core** |
| `@angple/plugin-engine` | 플러그인 레지스트리/컨텍스트 | **Core** |
| `@angple/i18n` | 다국어 (7개 언어) | **Core** |

### B. Themes (12개)

| 테마 | 분류 | 비공개 레포 이동 |
|------|------|-----------------|
| `sample-theme` | **Core** | - |
| `minimal-light` | **Core** | - |
| `modern-dark` | **Core** | - |
| `colorful-blog` | **Core** | - |
| `corporate-landing` | **Core** | - |
| `damoang-official` | **Damoang** | `@damoang/theme-official` |
| `damoang-classic` | **Damoang** | `@damoang/theme-classic` |
| `damoang-basic` | **Damoang** | `@damoang/theme-basic` |
| `damoang-default` | **Damoang** | `@damoang/theme-default` |
| `damoang-dev` | **Damoang** | `@damoang/theme-dev` |
| `damoang-legacy` | **Damoang** | `@damoang/theme-legacy` |

### C. Widgets (12개)

| 위젯 | 분류 | 사유 |
|------|------|------|
| `post-list` | **Core** | 범용 게시글 목록 |
| `recommended` | **Core** | 인기글 (범용) |
| `notice` | **Core** | 공지사항 (범용) |
| `image-text-banner` | **Core** | 범용 배너 (광고/안내 겸용) |
| `ai-analysis` | **Core** | AI 분석 (Gemini 기반, 범용) |
| `ad-slot` | **Damoang** | GAM/AdSense 전용, 하드코딩된 네트워크 코드 |
| `celebration-card` | **Damoang** | 축하메시지 (다모앙 전용 기능) |
| `podcast` | **Damoang** | 다모앙 팟캐스트 |
| `giving` | **Damoang** | 나눔 게시판 위젯 |
| `adsense-sidebar` | **Damoang** | AdSense 하드코딩 (`ca-pub-5124617752473025`) |
| `sticky-ads` | **Damoang** | AdSense 하드코딩 |
| `sharing-board` | **Damoang** | 다모앙 내부 홍보 |

### D. Plugins (8개 — 전부 Damoang)

| 플러그인 | 비공개 패키지 |
|----------|--------------|
| `giving` | `@damoang/plugin-giving` |
| `emoticon` | `@damoang/plugin-emoticon` |
| `da-reaction` | `@damoang/plugin-da-reaction` |
| `member-memo` | `@damoang/plugin-member-memo` |
| `auto-embed` | `@damoang/plugin-auto-embed` |
| `bracket-image` | `@damoang/plugin-bracket-image` |
| `ad-widget` | `@damoang/plugin-ad-widget` |
| `interaction-analysis` | `@damoang/plugin-interaction-analysis` |

### E. Extensions (7개)

| 확장 | 분류 | 사유 |
|------|------|------|
| `sample-extension` | **Core** | 레퍼런스 |
| `sample-plugin-ai` | **Core** | 레퍼런스 |
| `sample-plugin-seo` | **Core** | 레퍼런스 |
| `plugin-content-history` | **Core** | 범용 편집이력/소프트 삭제 |
| `plugin-promotion` | **Damoang** | 직접홍보 (DISABLED) |
| `plugin-banner-message` | **Damoang** | 배너 광고 (DISABLED) |
| `plugin-mention` | **Damoang** | @멘션 (다모앙 커뮤니티 전용) |

### F. 앱 내 하드코딩된 Damoang 컴포넌트

**UI 컴포넌트 (apps/web/src/lib/components/ui/)**:

| 컴포넌트 | 분류 | 처리 방향 |
|----------|------|----------|
| `ad-slot/` | **Damoang** | GAM 하드코딩 → 범용 AdSlot으로 리팩터 or 플러그인 추출 |
| `gam-slot/` | **Damoang** | GAM 전용 → 플러그인 추출 |
| `damoang-banner/` | **Damoang** | 3단 폴백(축하→다모앙광고→GAM) → 플러그인 추출 |
| `celebration-rolling/` | **Damoang** | 축하메시지 롤링 → 플러그인 추출 |
| `promotion-inline-post/` | **Damoang** | 직접홍보 사잇글 → 플러그인 추출 |
| `podcast-player/` | **Damoang** | 팟캐스트 → 플러그인 추출 |

**레이아웃 컴포넌트 (apps/web/src/lib/components/layout/)**:

| 컴포넌트 | 분류 | 처리 방향 |
|----------|------|----------|
| `left-banner.svelte` | **Damoang** | 윙 광고 → 플러그인/테마 영역 |
| `right-banner.svelte` | **Damoang** | 윙 광고 → 플러그인/테마 영역 |

**스토어 (apps/web/src/lib/stores/)**:

| 스토어 | 분류 | 처리 방향 |
|--------|------|----------|
| `gam.svelte.ts` | **Damoang** | GAM 네트워크 코드 하드코딩 → 설정/플러그인 |
| `podcast.svelte.ts` | **Damoang** | 팟캐스트 → 플러그인 |

**API 라우트 (apps/web/src/routes/api/)**:

| 라우트 | 분류 |
|--------|------|
| `/api/ads/*` | **Damoang** (축하메시지, 배너, 홍보글) |
| `/api/mentions/*` | **Damoang** |

**서버 유틸 (apps/web/src/lib/server/)**:

| 파일 | 분류 | 처리 방향 |
|------|------|----------|
| `db.ts` | **Damoang** | 다모앙 G5 DB 직접 연결 (하드코딩 RDS URL) → 제거, API로 대체 |
| `mailer.ts` | **Damoang** | `noreply@damoang.net` 하드코딩 → 환경변수화 |

**설정 하드코딩**:

| 항목 | 위치 | 처리 방향 |
|------|------|----------|
| GAM 네트워크 코드 `22996793498` | `gam.svelte.ts` | 환경변수/설정 |
| AdSense `ca-pub-5124617752473025` | `gam.svelte.ts`, `sticky-ads`, `adsense-sidebar` | 환경변수/설정 |
| `ads.damoang.net` | `.env.example`, 여러 파일 | 환경변수 |
| `s3.damoang.net` | `.env.example` | 환경변수 |
| 다모앙 G5 DB RDS URL | `db.ts` | 환경변수 (이미 부분적) |
| `noreply@damoang.net` | `mailer.ts` | 환경변수 |
| `ghcr.io/damoang/angple-web` | `compose.prod.yml` | 환경변수 |
| `web.damoang.net, damoang.dev` | `vite.config.ts` allowedHosts | 환경변수 |

---

## Part 3: Widget Spec v1.0 준수 분석

### Critical (반드시 수정)

| # | 이슈 | 현재 | 스펙 요구 |
|---|------|------|----------|
| C1 | 위젯 ID `ad`는 2글자 (최소 3자 위반) | `widgets/ad/widget.json` → `"id": "ad"` | 스펙 §2.2: 최소 3자, `ad` → `ad-slot` 예시 |
| C2 | 13곳 이상 하드코딩 광고가 위젯 시스템 우회 | AdSlot/DamoangBanner 직접 삽입 | 스펙 §10: 위젯 레이아웃으로 관리 |
| C3 | AdSlot이 GAM 사용, 스펙은 iframe/ADS_URL | GAM `googletag` API (580줄) | 스펙 §10.2: iframe + `ADS_URL` |
| C4 | 3개 확장 매니페스트 hooks 형식 오류 | `Record<string, string>` (객체) | Zod 스키마: `ExtensionHook[]` (배열) |

### Warning (수정 권장)

| # | 이슈 |
|---|------|
| W1 | `sticky-ads`, `adsense-sidebar` 카테고리가 `sidebar`여야 할 것이 `ad`여야 함 |
| W2 | 클라이언트 위젯 로더(`widget-component-loader.ts`)가 Zod 검증 생략 |
| W3 | AdSense 자격증명(client ID, slot ID) 하드코딩 |
| W4 | `plugin-mention` 확장에 `license`, `main` 필수 필드 누락 |
| W5 | `plugin-content-history`가 `plugin.json` 사용 (다른 확장은 `extension.json`) |
| W6 | 레이아웃 API 키 이름 `widgets`/`sidebarWidgets` (스펙은 `main`/`sidebar`) |

---

## Part 4: 레포 구조 설계

### 4.1 공개 레포 (angple — MIT)

```
angple/                          # MIT License
├── apps/web/                    # SvelteKit 앱 (Core만)
├── packages/
│   ├── types/                   # @angple/types
│   ├── hook-system/             # @angple/hook-system
│   ├── theme-engine/            # @angple/theme-engine
│   ├── plugin-engine/           # @angple/plugin-engine
│   └── i18n/                    # @angple/i18n
├── themes/                      # Core 무료 테마 (5-6개)
├── widgets/                     # Core 무료 위젯 (5개)
├── extensions/                  # Core 확장 + 샘플
├── custom-themes/               # .gitignore (런타임 설치)
├── custom-plugins/              # .gitignore
├── custom-widgets/              # .gitignore
├── custom-extensions/           # .gitignore
└── docs/specs/                  # 공개 스펙 문서
```

### 4.2 비공개 레포 (angple-premium — Proprietary)

```
angple-premium/                  # Proprietary License
├── themes/                      # 다모앙 테마 6개
├── widgets/                     # 다모앙 위젯 7개
├── plugins/                     # 다모앙 플러그인 8개
├── extensions/                  # 다모앙 확장 3개
├── components/                  # Core에서 추출한 다모앙 전용 컴포넌트
├── api-routes/                  # Core에서 추출한 API 라우트
├── stores/                      # Core에서 추출한 스토어
├── deploy/
│   ├── install.sh               # CI/CD: premium → custom-* 복사
│   └── compose.prod.yml         # 다모앙 프로덕션 Docker 설정
└── package.json
```

### 4.3 배포 플로우

```
┌─────────────────────┐     ┌─────────────────────────┐
│  angple (Public)     │     │  angple-premium (Private) │
│  MIT License         │     │  Proprietary              │
└──────────┬──────────┘     └───────────┬─────────────┘
           │                             │
           ▼                             ▼
┌──────────────────────────────────────────────────────┐
│  CI/CD Pipeline (GitHub Actions)                       │
│                                                        │
│  1. git clone angple (public)                         │
│  2. git clone angple-premium (private, with token)    │
│  3. cp -r premium/themes/* → angple/custom-themes/    │
│  4. cp -r premium/plugins/* → angple/custom-plugins/  │
│  5. cp -r premium/widgets/* → angple/custom-widgets/  │
│  6. cp -r premium/extensions/* → angple/custom-ext./  │
│  7. pnpm install && pnpm build                        │
│  8. docker build → ghcr.io/damoang/angple-web         │
└──────────────────────────────────────────────────────┘
```

---

## Part 5: 마이그레이션 로드맵

### Phase 1: 분류 문서화 ✅

- [x] 글로벌 스탠다드 리서치
- [x] Core vs Damoang 전체 인벤토리 분류
- [x] Widget Spec 준수 분석
- [x] 레포 구조 설계
- [x] 이 문서를 `docs/migration/open-core-separation.md`에 저장

### Phase 2: 하드코딩 정리 (선행 조건)

Core에서 다모앙 참조를 제거/설정화해야 분리 가능:

1. **환경변수화**: GAM 코드, AdSense ID, 다모앙 URL, DB URL, 메일 발신자 등
2. **AdSlot 리팩터**: 현재 GAM 전용 → Core용 범용 iframe AdSlot + 다모앙용 GAM AdSlot (플러그인)
3. **DamoangBanner 추출**: Core 레이아웃에서 제거, Slot/Hook으로 주입
4. **DB 직접 연결 제거**: `server/db.ts` → 백엔드 API 호출로 대체
5. **CSP 헤더 정리**: 다모앙 도메인 하드코딩 → 환경변수

### Phase 3: 위젯 스펙 준수 수정

1. `widgets/ad/` → `widgets/ad-slot/` (ID 3자 미만 위반)
2. 광고 위젯 카테고리 수정: `sidebar` → `ad`
3. 확장 매니페스트 hooks 형식 통일 (배열로)
4. 확장 매니페스트 누락 필드 추가
5. `plugin-content-history/plugin.json` → `extension.json` 이름 변경

### Phase 4: 비공개 레포 생성 및 이동

1. `damoang/angple-premium` 레포 생성
2. 다모앙 테마 6개 이동
3. 다모앙 위젯 7개 이동
4. 다모앙 플러그인 8개 이동
5. 다모앙 확장 3개 이동
6. 하드코딩 컴포넌트 추출 및 이동
7. API 라우트, 스토어 추출

### Phase 5: CI/CD 파이프라인

1. GitHub Actions: premium 레포 clone + 복사 스크립트
2. Docker 빌드 파이프라인 수정
3. 개발 환경 셋업 스크립트 (`scripts/setup-premium.sh`)
4. 공개 레포 standalone 빌드 검증 (premium 없이도 동작)

### Phase 6: 검증

1. **공개 레포 단독 빌드**: `pnpm build` 성공, 다모앙 참조 없음
2. **다모앙 배포 빌드**: premium 통합 후 기존과 동일 동작
3. **스펙 준수 검증**: Zod 검증 통과, ID/카테고리/매니페스트 정상
