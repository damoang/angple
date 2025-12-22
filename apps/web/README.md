# 다모앙 웹 애플리케이션

다모앙 플랫폼의 웹 애플리케이션입니다. SvelteKit과 TypeScript를 기반으로 구축된 모던 프론트엔드 애플리케이션입니다.

## 기술 스택

-   **Svelte 5.0** - 컴포넌트 프레임워크 (Rune 모드)
-   **SvelteKit 2.22** - 풀스택 웹 프레임워크
-   **TypeScript 5.0** - 타입 안전성을 위한 정적 타입 검사
-   **Tailwind CSS 4.0** - 유틸리티 퍼스트 CSS 프레임워크
-   **Vite 7.0** - 개발 서버 및 빌드 도구
-   **pnpm** - 패키지 관리

## 시작하기

### 필수 조건

-   Node.js 18.0 이상
-   pnpm 8.0 이상

### 설치 및 실행

```bash
# 의존성 설치
pnpm install

# 개발 서버 시작
pnpm dev

# 브라우저에서 http://localhost:3010 접속
```

## 주요 스크립트

```bash
# 개발
pnpm dev                # 개발 서버 시작
pnpm check              # 타입 검사
pnpm check:watch        # 타입 검사 (감시 모드)

# 코드 품질
pnpm lint               # ESLint + Prettier 검사
pnpm format             # 코드 포맷팅

# 테스트
pnpm test               # 전체 테스트 실행
pnpm test:unit          # 단위 테스트 (Vitest)
pnpm test:e2e           # E2E 테스트 (Playwright)

# 빌드 및 배포
pnpm build              # 프로덕션 빌드
pnpm preview            # 빌드된 애플리케이션 미리보기
```

## 프로젝트 구조

```
src/
├── lib/                    # 공통 라이브러리
│   ├── components/         # 재사용 가능한 컴포넌트
│   │   ├── layout/         # 레이아웃 컴포넌트
│   │   └── ui/             # UI 컴포넌트
│   ├── assets/             # 정적 자산
│   ├── hooks/              # SvelteKit 훅
│   └── utils.ts            # 유틸리티 함수
├── routes/                 # 페이지 및 API 라우트
│   ├── +layout.svelte      # 전역 레이아웃
│   └── +page.svelte        # 홈페이지
├── app.html                # HTML 템플릿
├── app.css                 # 전역 스타일
└── app.d.ts                # TypeScript 타입 정의
```

## UI 컴포넌트

shadcn-svelte와 Lucide 아이콘을 활용한 일관된 UI 시스템:

```bash
# 새로운 UI 컴포넌트 추가
pnpm dlx shadcn-svelte@latest add button
pnpm dlx shadcn-svelte@latest add card
pnpm dlx shadcn-svelte@latest add dialog
```

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
        <Button class="w-full">
            <User class="mr-2 h-4 w-4" />
            버튼
        </Button>
    </CardContent>
</Card>
```

## 개발 가이드라인

### 코딩 규칙

-   Svelte 5의 Rune 모드 사용 ($state, $derived, $effect)
-   TypeScript 엄격 모드로 타입 안전성 확보
-   컴포넌트 파일명은 kebab-case 사용
-   모든 코드 주석은 한글로 작성

### 이벤트 핸들러

Svelte 5의 새로운 이벤트 핸들러 문법을 사용합니다:

```svelte
<!-- 기존 방식 (deprecated) -->
<button on:click={handleClick}>클릭</button>

<!-- Svelte 5 방식 -->
<button onclick={handleClick}>클릭</button>
```

### 상태 관리

```svelte
<script lang="ts">
    // Svelte 5 Rune 모드
    let count = $state(0);
    let doubled = $derived(count * 2);

    $effect(() => {
        console.log('카운트 변경:', count);
    });
</script>
```

## 테스트

-   **단위 테스트**: Vitest + @testing-library/svelte
-   **E2E 테스트**: Playwright
-   **브라우저 테스트**: @vitest/browser

테스트 파일 규칙:

-   단위 테스트: `*.test.ts`, `*.spec.ts`
-   E2E 테스트: `*.e2e.ts`

## 빌드 및 배포

### 프로덕션 빌드

```bash
pnpm build
```

빌드 결과물은 `build/` 디렉터리에 생성됩니다.

### 빌드 미리보기

```bash
pnpm preview
```

## 환경 설정

### 개발 환경 포트

-   개발 서버: http://localhost:3010
-   미리보기 서버: http://localhost:4173

### 4개 환경 구성

이 프로젝트는 4개의 환경을 지원합니다:

| 환경          | 파일              | SSR         | API URL                   | 용도                        |
| ------------- | ----------------- | ----------- | ------------------------- | --------------------------- |
| **로컬 개발** | `.env`            | CSR (false) | `https://api.damoang.dev` | 로컬 개발, Mock 데이터 사용 |
| **개발 서버** | `.env`            | CSR (false) | `https://api.damoang.dev` | 개발 서버 테스트            |
| **스테이징**  | `.env.staging`    | SSR (true)  | `https://api.damoang.net` | 배포 전 검증                |
| **운영**      | `.env.production` | SSR (true)  | `https://api.damoang.net` | 실제 서비스                 |

### 환경 변수 설정

#### `.env` (로컬 개발)

```bash
# SSR 설정 (로컬은 CSR 사용)
PUBLIC_SSR=false

# 브라우저용 API URL
PUBLIC_API_URL=https://api.damoang.dev/api/v1

# 서버용 API URL (SSR 전용)
INTERNAL_API_URL=http://localhost:8080/api/v1
```

#### `.env.production` (운영)

```bash
# SSR 설정 (운영은 SSR 사용)
PUBLIC_SSR=true

# 브라우저용 API URL
PUBLIC_API_URL=https://api.damoang.net/api/v1

# 서버용 API URL (Docker 내부 네트워크)
INTERNAL_API_URL=http://angple-gateway:8080/api/v1
```

#### `.env.staging` (스테이징)

```bash
# SSR 설정
PUBLIC_SSR=true

# 브라우저용 API URL
PUBLIC_API_URL=https://api.damoang.net/api/v1

# 서버용 API URL
INTERNAL_API_URL=http://angple-gateway:8080/api/v1
```

### SSR vs CSR 비교

| 구분               | CSR (로컬 개발)                  | SSR (운영/스테이징)       |
| ------------------ | -------------------------------- | ------------------------- |
| **렌더링 위치**    | 브라우저                         | 서버 + 브라우저           |
| **초기 로딩**      | 느림 (JavaScript 실행 필요)      | 빠름 (완성된 HTML 제공)   |
| **SEO**            | 불리 (검색엔진이 빈 페이지 인식) | 유리 (완전한 HTML 인덱싱) |
| **소셜 공유**      | 메타태그 없음                    | 완전한 메타태그 제공      |
| **트래픽 비용**    | 외부 API 직접 호출               | 내부 네트워크 사용 (무료) |
| **개발 편의성**    | 높음 (Mock 데이터 사용)          | 낮음 (백엔드 필요)        |
| **API 엔드포인트** | PUBLIC_API_URL                   | INTERNAL_API_URL          |

### SSR 장점

#### 1. SEO 최적화

```html
<!-- SSR로 렌더링된 HTML -->
<html>
    <head>
        <title>다모앙 - 커뮤니티</title>
        <meta property="og:title" content="자유게시판" />
        <meta property="og:description" content="게시글 내용..." />
    </head>
    <body>
        <article>
            <h1>게시글 제목</h1>
            <p>게시글 내용이 이미 렌더링되어 있음</p>
        </article>
    </body>
</html>
```

#### 2. 초기 로딩 성능

-   CSR: HTML 다운로드 → JavaScript 다운로드 → API 호출 → 렌더링 (느림)
-   SSR: 완성된 HTML 다운로드 → 즉시 표시 (빠름)

#### 3. 트래픽 비용 절감

```
CSR 방식:
브라우저 → PUBLIC_API_URL (외부 네트워크) → 백엔드
           ⚠️ 트래픽 요금 발생

SSR 방식:
브라우저 → SSR 서버 → INTERNAL_API_URL (Docker 내부 네트워크) → 백엔드
                       ✅ 트래픽 요금 없음
```

## Mock 데이터 사용법

### Mock 모드 활성화

브라우저 콘솔에서 다음 명령어를 실행:

```javascript
// Mock 모드 활성화 (기본값)
localStorage.setItem('damoang_use_mock', 'true');

// Mock 모드 비활성화 (실제 API 호출)
localStorage.setItem('damoang_use_mock', 'false');

// 페이지 새로고침
location.reload();
```

### Mock 데이터 추가

새로운 API 엔드포인트를 추가할 때는 다음 3단계를 거칩니다:

#### 1단계: 타입 정의 (`src/lib/api/types.ts`)

```typescript
export interface MyData {
    id: number;
    title: string;
    content: string;
}
```

#### 2단계: Mock 데이터 생성 (`src/lib/api/mock-data.ts`)

```typescript
import type { MyData } from './types.js';

export function getMockMyData(): MyData[] {
    return [
        {
            id: 1,
            title: 'Mock 제목 1',
            content: 'Mock 내용 1'
        },
        {
            id: 2,
            title: 'Mock 제목 2',
            content: 'Mock 내용 2'
        }
    ];
}
```

#### 3단계: API 클라이언트 메서드 추가 (`src/lib/api/client.ts`)

```typescript
import { getMockMyData } from './mock-data.js';
import type { MyData } from './types.js';

class ApiClient {
    // ... 기존 코드

    async getMyData(): Promise<MyData[]> {
        // Mock 모드 체크
        if (this.useMock) {
            // 인위적 지연 (실제 API 시뮬레이션)
            await new Promise((resolve) => setTimeout(resolve, 200));
            return getMockMyData();
        }

        // 실제 API 호출
        const response = await this.request<MyData[]>('/my-data');
        return response.data;
    }
}
```

### 컴포넌트에서 사용

```svelte
<script lang="ts">
    import { apiClient } from '$lib/api';
    import type { MyData } from '$lib/api/types.js';

    let data = $state<MyData[]>([]);
    let loading = $state(true);
    let error = $state('');

    async function loadData() {
        try {
            loading = true;
            // Mock/실제 API 자동 전환
            data = await apiClient.getMyData();
        } catch (err) {
            error = err instanceof Error ? err.message : '데이터 로드 실패';
        } finally {
            loading = false;
        }
    }

    // 컴포넌트 마운트 시 데이터 로드
    $effect(() => {
        loadData();
    });
</script>

{#if loading}
    <p>로딩 중...</p>
{:else if error}
    <p class="text-red-500">{error}</p>
{:else}
    {#each data as item}
        <div>{item.title}</div>
    {/each}
{/if}
```

### API 클라이언트 Best Practice

#### ✅ 올바른 패턴

```svelte
<script lang="ts">
    import { apiClient } from '$lib/api';

    // apiClient를 통한 호출 (Mock 지원)
    const data = await apiClient.getMenus();
</script>
```

#### ❌ 잘못된 패턴

```svelte
<script lang="ts">
    // 직접 fetch 호출 (Mock 미지원, 404 에러 발생)
    const response = await fetch('/api/v2/menus/sidebar');
    const data = await response.json();
</script>
```

### 현재 제공되는 Mock 데이터

-   `getMockFreePosts()` - 자유게시판 목록
-   `getMockFreePost(id)` - 자유게시판 단일 글
-   `getMockFreeComments(postId)` - 댓글 목록
-   `getMockMenus()` - 사이드바 메뉴
-   `getMockCurrentUser()` - 현재 사용자 (50% 확률 로그인)
-   `getMockIndexWidgets()` - 메인 페이지 위젯 (뉴스, 경제, 갤러리, 그룹)

## 문제 해결

### 자주 발생하는 문제

1. **타입 에러**: `pnpm check`로 타입 검사 후 수정
2. **린트 에러**: `pnpm lint`로 검사 후 `pnpm format`으로 자동 수정
3. **캐시 문제**: `rm -rf .svelte-kit node_modules && pnpm install`

### 개발 서버 재시작

```bash
# Ctrl+C로 개발 서버 종료 후
pnpm dev
```

## 기여 가이드

1. 작업 전 `pnpm check` 및 `pnpm lint` 실행
2. 커밋 전 테스트 실행 (`pnpm test`)
3. PR 생성 전 빌드 확인 (`pnpm build`)
