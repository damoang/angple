# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Angple은 SvelteKit 5와 TypeScript를 기반으로 한 모노레포 프로젝트입니다. 두 개의 독립적인 SvelteKit 애플리케이션(웹, 관리자)을 Docker Compose로 관리합니다.

## 필수 명령어

### 개발 환경 실행

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

### 빌드 및 테스트

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

### 단일 테스트 실행

```bash
cd apps/web
pnpm test:unit src/lib/components/features/recommended/utils/format-number.ts
```

## 기술 스택 및 아키텍처

### 핵심 기술

- **Svelte 5.0** (Rune 모드 강제 적용)
- **SvelteKit 2.22** (Full-stack framework)
- **TypeScript 5.0** (strict mode)
- **Tailwind CSS 4.0** (유틸리티 기반 스타일링)
- **Vite 7.0** (개발 서버 및 빌드 도구)
- **pnpm** (패키지 관리자)
- **shadcn-svelte** (UI 컴포넌트 시스템)
- **Lucide** (아이콘 라이브러리)
- **bits-ui** (Headless UI 컴포넌트)

### 배포 방식

- **SvelteKit Adapter**: `@sveltejs/adapter-static` (nginx 정적 배포)
- **Docker**: 멀티 스테이지 빌드 (development/production)
- **컨테이너 구성**:
  - `angple-web`: 웹 애플리케이션 (포트 5173 → 80)
  - `angple-admin`: 관리자 대시보드 (포트 5174 → 80)

### 프로젝트 구조

```
angple/
├── apps/
│   ├── web/                    # 메인 웹 애플리케이션
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── api/        # API 클라이언트 및 타입
│   │       │   ├── components/
│   │       │   │   ├── features/   # 기능별 컴포넌트 (economy, gallery, group, recommended, etc.)
│   │       │   │   ├── layout/     # 레이아웃 컴포넌트 (header, footer, sidebar, panel)
│   │       │   │   └── ui/         # shadcn-svelte UI 컴포넌트
│   │       │   ├── assets/         # 정적 자산
│   │       │   └── utils.ts        # 유틸리티 함수
│   │       ├── routes/             # SvelteKit 라우팅
│   │       │   ├── +layout.svelte  # 전역 레이아웃
│   │       │   ├── +page.svelte    # 홈페이지
│   │       │   └── free/           # 자유게시판 라우트 예시
│   │       ├── app.html            # HTML 템플릿
│   │       ├── app.css             # 전역 스타일 (Tailwind)
│   │       └── app.d.ts            # TypeScript 타입 정의
│   └── admin/                  # 관리자 대시보드 (구조 동일)
├── packages/                   # 공유 패키지 (필요시)
├── compose.yml                 # 프로덕션 Docker Compose
├── compose.override.yml        # 개발 환경 오버라이드 (볼륨 마운트)
└── package.json                # 루트 워크스페이스 설정
```

## 코딩 규칙 및 컨벤션

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

- **컴포넌트 파일명**: `kebab-case` (예: `economy-post-list.svelte`)
- **TypeScript 파일**: `kebab-case` 또는 `camelCase`
- **디렉터리**: `kebab-case`
- **주석**: 한글로 작성

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
- 각 feature는 독립적으로 작동
- `index.ts`로 공개 API 명시
- 공통 로직은 `utils` 디렉터리로 분리

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

## API 클라이언트 아키텍처

### 위치
- **파일**: `apps/web/src/lib/api/client.ts`
- **타입**: `apps/web/src/lib/api/types.ts`
- **Mock 데이터**: `apps/web/src/lib/api/mock-data.ts`

### 특징

**Mock 모드 지원:**
- 로컬스토리지 `damoang_use_mock` 플래그로 제어
- 기본값: `true` (개발 편의성)
- Mock 데이터 응답 시 인위적 지연 추가 (200-300ms)

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

## 테스트 전략

### 테스트 프레임워크

- **단위 테스트**: Vitest + @testing-library/svelte
- **E2E 테스트**: Playwright
- **브라우저 테스트**: @vitest/browser

### 파일 네이밍

- `*.test.ts`, `*.spec.ts` → 단위 테스트
- `*.e2e.ts` → E2E 테스트

### 테스트 실행 흐름

```bash
# 1. 전체 테스트 스위트 실행
pnpm test

# 2. 특정 파일 테스트
pnpm test:unit src/lib/utils.ts

# 3. E2E 테스트만 실행
pnpm test:e2e
```

## 환경 변수

### 개발 환경

```bash
# .env.local (Git 무시됨)
VITE_API_BASE_URL=http://localhost:8080
```

### 환경별 포트

- **Web 개발 서버**: http://localhost:5173
- **Web 미리보기**: http://localhost:4173
- **Admin 개발 서버**: http://localhost:5174
- **Admin 미리보기**: http://localhost:4174

## Docker Compose 사용법

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

## 문제 해결

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

## Git 워크플로우

### 브랜치 전략

- `main`: 메인 브랜치 (PR 타겟)
- `feature/*`: 기능 개발 브랜치
- `fix/*`: 버그 수정 브랜치

### 커밋 전 체크리스트

```bash
pnpm check         # 타입 검사
pnpm lint          # 린트 검사
pnpm test          # 테스트 실행
pnpm build         # 빌드 검증
```

### Husky 훅

- **pre-commit**: `lint-staged` 실행 (ESLint + Prettier)
- **commit-msg**: `commitlint` 검증

## 워크스페이스 관리

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

## MCP 도구 통합

이 프로젝트는 다음 MCP 서버를 지원합니다:
- **Serena MCP**: 작업 자동화
- **Context7 MCP**: 라이브러리 문서 참조
- **Task Manager MCP**: 작업 관리

## 참고 문서

- SvelteKit 5 공식 문서: https://svelte.dev/docs/kit
- Tailwind CSS 4 문서: https://tailwindcss.com
- shadcn-svelte: https://www.shadcn-svelte.com
- Playwright: https://playwright.dev