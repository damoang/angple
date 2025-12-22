# 다모앙 관리자 대시보드

다모앙 플랫폼의 관리자 대시보드 애플리케이션입니다. SvelteKit과 TypeScript를 기반으로 구축된 모던 프론트엔드 애플리케이션입니다.

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

# 브라우저에서 http://localhost:3011 접속
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

-   개발 서버: http://localhost:3011
-   미리보기 서버: http://localhost:4174

### 환경 변수

환경별 설정은 `.env` 파일을 통해 관리합니다:

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8080
```

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
