# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🎯 프로젝트 비전

**Angple은 누구나 자유롭게 커뮤니티를 만들 수 있는 오픈소스 플랫폼입니다.**

### 핵심 개념

WordPress가 블로그와 웹사이트를 위한 플랫폼이라면, **Angple은 게시판 중심 커뮤니티를 위한 플랫폼**입니다. 테마와 플러그인 시스템을 통해 교회, 동호회, 회사, 개인 블로그 등 어떤 형태의 커뮤니티든 쉽게 구축할 수 있습니다.

### 누구를 위한 플랫폼인가?

Angple은 다모앙(damoang.net) 전용이 아닙니다. **누구나** 자유롭게 사용할 수 있는 오픈소스입니다:

-   🏢 **회사**: 사내 커뮤니티, 고객 지원 포럼
-   ⛪ **종교시설**: 교회, 성당, 사찰 홈페이지
-   🎭 **동호회**: 취미, 스포츠, 문화 모임
-   🎓 **교육기관**: 학교, 학원, 스터디 그룹
-   🏛️ **정당/단체**: 정당 홈페이지, 시민단체
-   📝 **개인 블로그**: 프로필 페이지, 개인 미디어
-   💼 **기업**: 제품 커뮤니티, 지식베이스

### 왜 필요한가?

**기술적 차별점:**

-   게시판 중심 커뮤니티에 최적화된 아키텍처
-   한국 커뮤니티 문화 반영 (추천/비추천, 레벨 시스템 등)
-   SvelteKit 5 기반 현대적 웹 기술 스택
-   타입 안전성 (TypeScript strict mode)

**오픈소스의 장점:**

-   자체 호스팅 가능 (데이터 소유권 완전 보장)
-   테마/플러그인 시스템으로 무한 확장
-   개발자 생태계 형성 가능
-   커뮤니티 주도 개발

### 비즈니스 모델

```
┌─────────────────────────────────────────────────────────────┐
│                     Angple 생태계                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. 오픈소스 코어 (무료)                                      │
│     ├─ GitHub에서 누구나 다운로드                             │
│     ├─ 자체 서버에 호스팅                                     │
│     └─ 자유로운 커스터마이징                                  │
│                                                              │
│  2. 호스팅 SaaS 서비스 (유료)                                 │
│     ├─ WordPress.com처럼 관리형 호스팅                        │
│     ├─ 자동 업데이트, 백업, 보안                              │
│     └─ 기술 지식 없이도 사용 가능                             │
│                                                              │
│  3. 마켓플레이스 (수수료 모델)                                │
│     ├─ 테마 판매 (개발자 70% / 플랫폼 30%)                    │
│     ├─ 플러그인 판매 (개발자 70% / 플랫폼 30%)                │
│     └─ 무료 테마/플러그인도 등록 가능                         │
│                                                              │
│  4. 웹 에이전시 비즈니스 활성화                               │
│     ├─ Angple 기반 맞춤형 개발 대행업 가능                    │
│     ├─ 테마/플러그인 개발 외주                                │
│     └─ 유지보수 서비스                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 실제 사용 사례

**현재 운영 중인 커뮤니티들:**

-   [다모앙](https://damoang.net) - 개발자 커뮤니티
-   [뮤지아](https://muzia.net) - 음악 커뮤니티
-   [구르밋](https://goorm.it) - 교육 플랫폼
-   [SDK 블로그](https://sdk.kr) - WordPress 블로그

**향후 확장 가능성:**

-   게임 길드 커뮤니티
-   지역 주민 커뮤니티
-   팬덤 커뮤니티
-   기업 내부 지식베이스
-   고객 지원 포럼

---

## 📊 개발 로드맵

### 완료된 단계 (Phase 1-10)

| Phase      | 내용                             | 상태    |
| ---------- | -------------------------------- | ------- |
| Phase 1-5  | 프로젝트 초기 설정, 기본 UI 구조 | ✅ 완료 |
| Phase 6-10 | **테마 시스템 구축**             | ✅ 완료 |
| -          | Theme Engine 패키지              | ✅ 완료 |
| -          | 테마 스캐너 & 로더               | ✅ 완료 |
| -          | 테마 활성화/비활성화             | ✅ 완료 |
| -          | 테마 설정 시스템                 | ✅ 완료 |
| -          | **테마 마켓플레이스**            | ✅ 완료 |
|            | └─ ZIP 업로드 기능               | ✅ 완료 |
|            | └─ 테마 삭제 (커스텀만)          | ✅ 완료 |
|            | └─ 공식/커스텀 구분              | ✅ 완료 |

### 현재 진행 상황

**Phase 10 완료!** 🎉

테마 마켓플레이스 기능이 완성되어, 사용자들이:

-   ZIP 파일로 커스텀 테마 업로드 가능
-   공식 테마와 커스텀 테마를 구분하여 관리
-   커스텀 테마는 삭제 가능 (공식 테마는 보호)
-   Admin 대시보드에서 테마 관리 UI 제공

### 다음 단계 (Phase 11-30)

#### Phase 11-15: 플러그인 시스템 (WordPress의 플러그인 개념)

```
┌─────────────────────────────────────────────────────────────┐
│ 플러그인 시스템 아키텍처                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Hook System (이미 구축됨 @angple/hook-system)            │
│     ├─ WordPress의 add_action(), add_filter() 개념           │
│     └─ 이벤트 기반 확장 포인트                                │
│                                                              │
│  2. Plugin API 설계                                          │
│     ├─ plugin.json (매니페스트)                              │
│     ├─ 플러그인 생명주기 (activate/deactivate)               │
│     └─ 의존성 관리                                           │
│                                                              │
│  3. Plugin Loader & Scanner                                  │
│     ├─ plugins/ 디렉터리 스캔                                │
│     ├─ 플러그인 로드 순서 제어                               │
│     └─ 오류 격리 (플러그인 오류가 전체에 영향 X)             │
│                                                              │
│  4. Admin UI                                                 │
│     ├─ 플러그인 설치/삭제/활성화                             │
│     ├─ 설정 페이지 자동 생성                                 │
│     └─ 플러그인 업로드 (ZIP)                                 │
│                                                              │
│  5. Marketplace 준비                                         │
│     ├─ 플러그인 등록 검증                                    │
│     └─ 버전 관리                                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Phase 16-20: Backend API 통합

-   Go/Fiber 백엔드 연동
-   실제 데이터베이스 연결 (PostgreSQL/MySQL)
-   인증/인가 시스템 (JWT)
-   API 클라이언트 개선 (Mock 모드 제거)

#### Phase 21-25: 콘텐츠 관리 (CRUD)

-   게시판 CRUD
-   댓글 시스템
-   파일 업로드
-   이미지 최적화

#### Phase 26-30: 고급 기능

-   실시간 알림 (WebSocket)
-   검색 엔진 (Elasticsearch)
-   캐싱 전략 (Redis)
-   성능 최적화

### 장기 목표 (Phase 31+)

-   모바일 앱 (React Native / Flutter)
-   AI 기반 콘텐츠 추천
-   다국어 지원 (i18n)
-   SEO 최적화
-   접근성 개선 (a11y)

---

## 🏗️ 아키텍처 비교

### WordPress vs Angple

| 구분             | WordPress                      | Angple                       |
| ---------------- | ------------------------------ | ---------------------------- |
| **언어**         | PHP                            | TypeScript (SvelteKit 5)     |
| **프론트엔드**   | jQuery / React (Gutenberg)     | Svelte 5 (Rune 모드)         |
| **데이터베이스** | MySQL                          | PostgreSQL/MySQL (계획)      |
| **확장 방식**    | Plugins + Themes               | Plugins + Themes             |
| **Hook 시스템**  | `add_action()`, `add_filter()` | `@angple/hook-system`        |
| **관리자**       | wp-admin (PHP)                 | SvelteKit Admin (TypeScript) |
| **배포**         | LAMP/LEMP Stack                | Docker Compose / Static      |
| **REST API**     | WordPress REST API             | Custom REST API (Go/Fiber)   |
| **생태계**       | 60,000+ 플러그인, 10,000+ 테마 | 🚧 구축 중                   |

### 핵심 철학

**"누구나 커뮤니티를 만들 수 있어야 합니다"**

WordPress가 블로그와 웹사이트 구축을 민주화했듯이, Angple은 커뮤니티 구축을 민주화합니다:

-   코딩 없이 테마로 디자인 변경
-   플러그인으로 기능 확장
-   개발자라면 직접 테마/플러그인 제작 가능
-   마켓플레이스를 통한 수익 창출 기회

---

## 💡 개발 철학

### 1. WordPress 호환성 지향

WordPress가 수십 년간 쌓아온 개발자 경험을 존중하고 참고합니다:

-   **Hook System**: WordPress의 `add_action()`, `add_filter()` 개념을 TypeScript로 구현
-   **테마 구조**: `theme.json`은 WordPress의 `style.css` 헤더와 유사
-   **플러그인 API**: WordPress Plugin API 설계 패턴 참조
-   **관리자 페이지**: wp-admin의 직관성을 현대적 UI로 재해석

### 2. 한국 중심, 글로벌 확장

-   **1차 목표**: 한국 커뮤니티 문화에 최적화

    -   게시판 중심 구조
    -   실시간 댓글
    -   추천/비추천 시스템
    -   레벨/등급 시스템

-   **2차 목표**: 국제화 (i18n)
    -   영어, 일본어, 중국어 지원
    -   타임존 처리
    -   다국어 콘텐츠 관리

### 3. 개발자 우선 (Developer First)

-   **명확한 API**: 타입 안전성 (TypeScript strict mode)
-   **풍부한 문서**: 코드 주석 + 외부 문서
-   **예제 코드**: 샘플 테마/플러그인 제공
-   **커뮤니티**: Discord, GitHub Discussions

### 4. 성능 우선 (Performance First)

-   **SSR + Hydration**: SvelteKit의 장점 활용
-   **Code Splitting**: 자동 라우트 기반 분할
-   **이미지 최적화**: WebP, AVIF 지원
-   **캐싱**: Redis + CDN 전략

---

## 🤝 기여 가이드

### 마켓플레이스 수익 모델

**테마 개발자:**

-   무료 테마: GitHub에 공개, 포트폴리오 활용
-   유료 테마: 마켓플레이스 등록, 판매 가격의 70% 수령
-   평균 가격대: ₩30,000 - ₩100,000
-   인기 테마는 월 수백만원 수익 가능 (WordPress 시장 참고)

**플러그인 개발자:**

-   무료 플러그인: 사용자 확보, 프리미엄 버전 판매
-   유료 플러그인: 라이선스 판매 (단일 사이트 / 무제한)
-   구독 모델: 월간/연간 결제 (지속적 수익)

**웹 에이전시:**

-   Angple 기반 웹사이트 제작 대행
-   커스텀 테마/플러그인 개발
-   유지보수 계약

### 기여 방법

1. **코드 기여**: GitHub Issues, Pull Requests
2. **테마/플러그인 제작**: 마켓플레이스 등록
3. **문서 작성**: 튜토리얼, 가이드
4. **커뮤니티 운영**: Discord, 포럼 활동
5. **버그 리포트**: GitHub Issues
6. **번역**: i18n 파일 번역

---

## 📁 프로젝트 구조

```
angple/
├── apps/
│   ├── web/                    # 메인 웹 애플리케이션 (사용자용)
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── api/        # API 클라이언트
│   │       │   ├── components/
│   │       │   │   ├── features/   # 기능별 컴포넌트
│   │       │   │   ├── layout/     # 레이아웃 컴포넌트
│   │       │   │   └── ui/         # shadcn-svelte UI
│   │       │   ├── server/         # 서버 사이드 로직
│   │       │   │   ├── themes/     # 테마 스캐너, 로더
│   │       │   │   └── settings/   # 설정 관리
│   │       │   └── types/          # TypeScript 타입
│   │       ├── routes/             # SvelteKit 라우팅
│   │       │   ├── api/            # API 엔드포인트
│   │       │   │   └── themes/     # 테마 관리 API
│   │       │   └── +page.svelte    # 홈페이지
│   │       └── app.css             # 전역 스타일
│   │
│   └── admin/                  # 관리자 대시보드
│       └── src/
│           ├── lib/
│           │   ├── api/        # Web API 클라이언트
│           │   ├── stores/     # Svelte 5 스토어
│           │   └── components/
│           └── routes/
│               ├── themes/     # 테마 관리 페이지
│               └── plugins/    # 플러그인 관리 페이지 (예정)
│
├── packages/                   # 공유 패키지 (Monorepo)
│   ├── theme-engine/          # 테마 엔진 코어
│   ├── hook-system/           # Hook System (WordPress의 add_action/filter)
│   └── types/                 # 공유 TypeScript 타입
│
├── themes/                    # 공식 테마 디렉터리
│   ├── damoang-classic/       # 다모앙 클래식 테마
│   ├── sample-theme/          # 샘플 테마 (개발자 참고용)
│   └── ...
│
├── custom-themes/             # 사용자 업로드 커스텀 테마
│   └── (ZIP 업로드 시 여기에 저장됨)
│
├── plugins/                   # 플러그인 디렉터리 (예정)
│   └── (플러그인 ZIP 업로드 시 여기에 저장됨)
│
├── docs/                      # 프로젝트 문서
│   ├── design_system.md       # 디자인 시스템
│   └── ...
│
├── compose.yml                # Docker Compose (프로덕션)
├── compose.override.yml       # Docker Compose (개발)
└── CLAUDE.md                  # Claude Code 가이드 (이 파일)
```

---

## 🛠️ 기술 스택

### 핵심 기술

-   **Svelte 5.0** (Rune 모드 강제 적용)
-   **SvelteKit 2.22** (Full-stack framework)
-   **TypeScript 5.0** (strict mode)
-   **Tailwind CSS 4.0** (유틸리티 기반 스타일링)
-   **Vite 7.0** (개발 서버 및 빌드 도구)
-   **pnpm** (패키지 관리자, Monorepo 지원)
-   **shadcn-svelte** (UI 컴포넌트 시스템)
-   **Lucide** (아이콘 라이브러리)
-   **bits-ui** (Headless UI 컴포넌트)

### 배포 방식

-   **SvelteKit Adapter**: `@sveltejs/adapter-static` (nginx 정적 배포)
-   **Docker**: 멀티 스테이지 빌드 (development/production)
-   **컨테이너 구성**:
    -   `angple-web`: 웹 애플리케이션 (포트 5173 → 80)
    -   `angple-admin`: 관리자 대시보드 (포트 5174 → 80)

### 향후 백엔드 스택 (계획)

-   **Go 1.21** + **Fiber** (고성능 웹 프레임워크)
-   **PostgreSQL** 또는 **MySQL** (관계형 데이터베이스)
-   **Redis** (캐싱, 세션 관리)
-   **MinIO** 또는 **AWS S3** (파일 스토리지)

---

## 💻 개발 환경 설정

### 필수 명령어

#### 개발 서버 실행

```bash
# Docker Compose 사용 (권장)
docker compose up -d web        # 웹 애플리케이션 (http://localhost:5173)
docker compose up -d admin      # 관리자 대시보드 (http://localhost:5174)
docker compose up -d            # 모든 서비스 시작

# 로컬 개발 (pnpm 사용)
cd apps/web && pnpm dev         # 웹 개발 서버
cd apps/admin && pnpm dev       # 관리자 개발 서버

# 루트에서 실행
npm run dev                     # web 앱 개발 서버
npm run dev:admin               # admin 앱 개발 서버
```

#### 빌드 및 테스트

```bash
# 웹 애플리케이션
cd apps/web
pnpm build                      # 프로덕션 빌드
pnpm preview                    # 빌드 결과 미리보기
pnpm check                      # TypeScript 타입 검사
pnpm check:watch                # 타입 검사 (감시 모드)
pnpm lint                       # ESLint + Prettier 검사
pnpm format                     # 코드 포맷팅
pnpm test                       # 전체 테스트 (unit + e2e)
pnpm test:unit                  # Vitest 단위 테스트
pnpm test:e2e                   # Playwright E2E 테스트

# 관리자 대시보드
cd apps/admin
# (동일한 명령어 사용)

# 루트에서 실행
npm run build                   # web 앱 빌드
npm run build:admin             # admin 앱 빌드
npm run lint                    # web 앱 린트
npm run test                    # web 앱 테스트
npm run format                  # 전체 포맷팅
npm run clean                   # node_modules 삭제 후 재설치
```

#### 단일 테스트 실행

```bash
cd apps/web
pnpm test:unit src/lib/components/features/recommended/utils/format-number.ts
```

### 환경 변수

#### 개발 환경

```bash
# .env.local (Git 무시됨)
VITE_API_BASE_URL=http://localhost:8080
```

#### 환경별 포트

-   **Web 개발 서버**: http://localhost:5173
-   **Web 미리보기**: http://localhost:4173
-   **Admin 개발 서버**: http://localhost:5174
-   **Admin 미리보기**: http://localhost:4174

---

## 📝 코딩 규칙 및 컨벤션

### Svelte 5 Rune 모드 (필수)

이 프로젝트는 `compilerOptions.runes: true`로 설정되어 있어 **Rune 모드가 강제 적용**됩니다.

**상태 관리:**

```svelte
<script lang="ts">
    // ✅ Svelte 5 Rune 모드
    let count = $state(0);
    let doubled = $derived(count * 2);

    $effect(() => {
        console.log('카운트 변경:', count);
    });
</script>
```

**이벤트 핸들러:**

```svelte
<!-- ❌ 구버전 문법 (deprecated) -->
<button on:click={handleClick}>클릭</button>

<!-- ✅ Svelte 5 권장 문법 -->
<button onclick={handleClick}>클릭</button>
```

### 파일 및 컴포넌트 네이밍

-   **컴포넌트 파일명**: `kebab-case` (예: `economy-post-list.svelte`)
-   **TypeScript 파일**: `kebab-case` 또는 `camelCase`
-   **디렉터리**: `kebab-case`
-   **주석**: 한글로 작성

### 컴포넌트 구조화

**features 디렉터리 구조 예시:**

```
components/features/recommended/
├── components/               # 하위 컴포넌트
│   ├── ai-trend/
│   │   ├── ai-trend-card.svelte
│   │   ├── headline-rotator.svelte
│   │   └── index.ts
│   ├── post-list/
│   │   ├── post-list.svelte
│   │   └── index.ts
│   └── tabs/
├── utils/                    # 유틸리티 함수
│   ├── format-number.ts
│   └── recommend-badge.ts
├── recommended-posts.svelte  # 메인 컴포넌트
└── index.ts                  # 공개 API
```

**원칙:**

-   각 feature는 독립적으로 작동
-   `index.ts`로 공개 API 명시
-   공통 로직은 `utils` 디렉터리로 분리

### UI 컴포넌트 시스템

**새 UI 컴포넌트 추가:**

```bash
cd apps/web
pnpm dlx shadcn-svelte@latest add button
pnpm dlx shadcn-svelte@latest add card
pnpm dlx shadcn-svelte@latest add dialog
```

**사용 예시:**

```svelte
<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
    import User from '@lucide/svelte/icons/user';
</script>

<Card class="w-full max-w-md">
    <CardHeader>
        <CardTitle>카드 제목</CardTitle>
    </CardHeader>
    <CardContent>
        <Button>
            <User class="mr-2 h-4 w-4" />
            버튼
        </Button>
    </CardContent>
</Card>
```

---

## 🔌 API 클라이언트 아키텍처

### 위치

-   **파일**: `apps/web/src/lib/api/client.ts`
-   **타입**: `apps/web/src/lib/api/types.ts`
-   **Mock 데이터**: `apps/web/src/lib/api/mock-data.ts`

### 특징

**Mock 모드 지원:**

-   로컬스토리지 `damoang_use_mock` 플래그로 제어
-   기본값: `true` (개발 편의성)
-   Mock 데이터 응답 시 인위적 지연 추가 (200-300ms)

**싱글톤 패턴:**

```typescript
import { apiClient } from '$lib/api';

// Mock 모드 전환
apiClient.setMockMode(false);

// 데이터 조회
const posts = await apiClient.getFreePosts(1, 10);
```

### 보안 이슈 (중요)

⚠️ **현재 accessToken을 localStorage에 저장** → XSS 공격에 취약

**권장 개선 사항:**

1. `refreshToken` → httpOnly cookie (서버에서만 접근)
2. `accessToken` → 메모리 저장 (페이지 로드 시마다 재발급)
3. CSRF 보호 (`SameSite=Strict`)

**자세한 내용**: `apps/web/src/lib/api/SECURITY.md` 참고

---

## 🧪 테스트 전략

### 테스트 프레임워크

-   **단위 테스트**: Vitest + @testing-library/svelte
-   **E2E 테스트**: Playwright
-   **브라우저 테스트**: @vitest/browser

### 파일 네이밍

-   `*.test.ts`, `*.spec.ts` → 단위 테스트
-   `*.e2e.ts` → E2E 테스트

### 테스트 실행 흐름

```bash
# 1. 전체 테스트 스위트 실행
pnpm test

# 2. 특정 파일 테스트
pnpm test:unit src/lib/utils.ts

# 3. E2E 테스트만 실행
pnpm test:e2e
```

---

## 🐳 Docker Compose 사용법

### 개발 환경

```bash
# compose.override.yml 자동 병합됨
docker compose up -d web

# 특징:
# - 소스 코드 볼륨 마운트 (hot reload)
# - node_modules 볼륨 분리 (성능 향상)
# - target: development
```

### 프로덕션 빌드

```bash
docker compose -f compose.yml up -d

# 특징:
# - 멀티 스테이지 빌드
# - 최적화된 nginx 정적 서빙
# - target: production
```

---

## 🚨 문제 해결

### 자주 발생하는 문제

**타입 에러:**

```bash
pnpm check
# 오류 수정 후 재검사
```

**린트 에러:**

```bash
pnpm lint          # 검사
pnpm format        # 자동 수정
```

**캐시 문제:**

```bash
rm -rf .svelte-kit node_modules
pnpm install
```

**Docker 볼륨 초기화:**

```bash
docker compose down -v
docker compose up -d --build
```

---

## 🌿 Git 워크플로우

### 브랜치 전략

-   `main`: 메인 브랜치 (PR 타겟)
-   `feature/*`: 기능 개발 브랜치
-   `fix/*`: 버그 수정 브랜치

### 커밋 전 체크리스트

```bash
pnpm check         # 타입 검사
pnpm lint          # 린트 검사
pnpm test          # 테스트 실행
pnpm build         # 빌드 검증
```

### Husky 훅

-   **pre-commit**: `lint-staged` 실행 (ESLint + Prettier)
-   **commit-msg**: `commitlint` 검증

---

## 📦 워크스페이스 관리

### 패키지 설치

```bash
# 루트 워크스페이스 의존성
npm install -D <package> -w angple

# 특정 앱 의존성
pnpm add <package> --filter web
pnpm add <package> --filter admin

# 또는 직접 이동
cd apps/web && pnpm add <package>
```

### 공유 패키지 생성 (필요시)

```bash
mkdir -p packages/shared
cd packages/shared
pnpm init
```

---

## 🤖 MCP 도구 통합

이 프로젝트는 다음 MCP 서버를 지원합니다:

-   **Serena MCP**: 작업 자동화
-   **Context7 MCP**: 라이브러리 문서 참조
-   **Task Manager MCP**: 작업 관리

---

## 📚 참고 문서

-   SvelteKit 5 공식 문서: https://svelte.dev/docs/kit
-   Tailwind CSS 4 문서: https://tailwindcss.com
-   shadcn-svelte: https://www.shadcn-svelte.com
-   Playwright: https://playwright.dev
-   WordPress Plugin Handbook: https://developer.wordpress.org/plugins
-   WordPress Theme Handbook: https://developer.wordpress.org/themes

---

## 📞 커뮤니티

-   **GitHub**: https://github.com/angple/angple
-   **Discord**: (준비 중)
-   **공식 블로그**: https://sdk.kr
-   **다모앙 커뮤니티**: https://damoang.net

---

**마지막 업데이트**: 2025-12-30
**버전**: Phase 10 완료 (테마 마켓플레이스)
**다음 목표**: Phase 11 - 플러그인 시스템 구축
