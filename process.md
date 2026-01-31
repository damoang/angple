# ANGPLE Frontend — 개발 프로세스

> 최종 수정: 2026-01-31 | 버전: v1.0

---

## 1. 개발 환경 설정

### 필수 도구

| 도구             | 버전   | 용도             |
| ---------------- | ------ | ---------------- |
| Node.js          | 18+    | 런타임           |
| pnpm             | 10.15+ | 패키지 매니저    |
| Docker + Compose | 최신   | 통합 테스트 환경 |

### 초기 설정

```bash
# 1. 저장소 클론
git clone https://github.com/damoang/angple.git
cd angple

# 2. 의존성 설치
pnpm install

# 3. 환경 변수 설정
cp .env.example .env
# .env에서 API URL 등 설정

# 4. 개발 서버 시작
pnpm dev              # Web 앱 (port 5173)
pnpm dev:admin        # Admin 앱 (port 5174)
```

### 주요 명령어

```bash
pnpm dev              # Web 개발 서버
pnpm dev:admin        # Admin 개발 서버
pnpm build            # Web 프로덕션 빌드
pnpm build:admin      # Admin 프로덕션 빌드
pnpm test             # Vitest 실행
pnpm lint             # ESLint 검사
pnpm format           # Prettier 포맷팅
```

### 포트 구성

| 서비스 | 개발 포트 | 프로덕션 포트 |
| ------ | --------- | ------------- |
| Web    | 5173      | 3010 (Docker) |
| Admin  | 5174      | 3011 (Docker) |

### 환경 변수

| 변수                  | 설명               | 기본값                  |
| --------------------- | ------------------ | ----------------------- |
| `PUBLIC_API_BASE_URL` | 클라이언트 API URL | `http://localhost:8081` |
| `INTERNAL_API_URL`    | SSR 내부 API URL   | `http://api:8081`       |
| `DATA_PATH`           | 데이터 디렉토리    | `./data`                |

---

## 2. Git 워크플로우

### 브랜치 전략

```
main ──────────────────────────────── 프로덕션 (보호)
  └── develop ─────────────────────── 개발 통합
        ├── feature/플러그인-로더 ───── 기능 개발
        ├── fix/테마-로딩-오류 ─────── 버그 수정
        └── hotfix/xss-패치 ──────── 긴급 수정
```

> 브랜치 네이밍 규칙은 [백엔드 process.md](../angple-backend/process.md) §2와 동일

### Husky Git 훅

```bash
# pre-commit: lint-staged 실행
pnpm lint-staged   # *.{js,ts,svelte} 파일에 eslint + prettier

# commit-msg: commitlint 검사
# 커밋 메시지 형식 강제
```

### 커밋 컨벤션

```
<type>(<scope>): <subject>

feat(theme): SSR 테마 로딩 구현
fix(auth): 토큰 갱신 무한 루프 수정
refactor(widget): 위젯 레지스트리 타입 개선
style(ui): 사이드바 반응형 레이아웃 수정
```

> type 목록은 [백엔드 process.md](../angple-backend/process.md) §2와 동일

---

## 3. 코딩 표준

### Svelte 5 Rune 모드 (필수)

```svelte
<!-- ✅ 올바름: Rune 모드 -->
<script lang="ts">
    let count = $state(0);
    let doubled = $derived(count * 2);

    function increment() {
        count++;
    }
</script>

<!-- ❌ 금지: 구형 반응성 -->
<script>
    let count = 0;  // $state 없음
    $: doubled = count * 2;  // $: 사용 금지
</script>
```

### 네이밍 규칙

| 대상            | 규칙                   | 예시                                        |
| --------------- | ---------------------- | ------------------------------------------- |
| 컴포넌트 파일   | kebab-case             | `post-card.svelte`                          |
| TypeScript 파일 | kebab-case             | `api-client.ts`                             |
| 디렉토리        | kebab-case             | `board-list/`                               |
| 컴포넌트 이름   | PascalCase (import 시) | `import PostCard from './post-card.svelte'` |
| 변수/함수       | camelCase              | `const postList = ...`                      |
| 타입/인터페이스 | PascalCase             | `interface PostData`                        |
| 상수            | UPPER_SNAKE_CASE       | `const MAX_FILE_SIZE = ...`                 |
| CSS 클래스      | Tailwind 유틸리티      | `class="flex gap-2"`                        |

### UI 컴포넌트

-   **shadcn-svelte** 기반 (bits-ui + Tailwind)
-   아이콘: **Lucide Icons**
-   커스텀 컴포넌트: `$lib/components/ui/` 하위

### 파일 크기 제한

-   **최대 1000줄/파일**
-   컴포넌트가 커지면 하위 컴포넌트로 분리
-   로직이 복잡하면 `*.svelte.ts` 스토어로 추출

---

## 4. 컴포넌트 개발 프로세스

### features 디렉토리 구조

```
src/lib/features/{feature-name}/
├── index.ts              # Public API (re-export)
├── components/           # 컴포넌트
│   ├── feature-list.svelte
│   └── feature-card.svelte
├── stores/               # 상태 관리
│   └── feature.svelte.ts
├── api/                  # API 클라이언트
│   └── feature-api.ts
└── types/                # 타입 정의
    └── feature.ts
```

### index.ts API 패턴

```typescript
// features/board/index.ts
// Public API만 export (내부 구현은 숨김)
export { default as BoardList } from './components/board-list.svelte';
export { default as BoardCard } from './components/board-card.svelte';
export { boardStore } from './stores/board.svelte';
export type { Board, BoardConfig } from './types/board';
```

### Svelte 5 Store 패턴

```typescript
// stores/board.svelte.ts
class BoardStore {
    boards = $state<Board[]>([]);
    loading = $state(false);
    error = $state<string | null>(null);

    get isEmpty() {
        return $derived(this.boards.length === 0);
    }

    async loadBoards() {
        this.loading = true;
        try {
            this.boards = await apiClient.getBoards();
        } catch (e) {
            this.error = e.message;
        } finally {
            this.loading = false;
        }
    }
}

export const boardStore = new BoardStore();
```

---

## 5. 테마 개발 프로세스

> 상세 스펙: [`CLAUDE.md`](CLAUDE.md) "테마 시스템" 섹션 참조

### 테마 구조

```
themes/{theme-id}/
├── theme.json           # 매니페스트 (필수)
├── components/          # 오버라이드 컴포넌트
│   ├── header.svelte
│   ├── footer.svelte
│   └── sidebar.svelte
├── layouts/             # 레이아웃 템플릿
│   └── default.svelte
├── hooks/               # 테마 Hook 핸들러
│   └── index.ts
├── screenshot.png       # 미리보기 (권장)
└── README.md            # 설명 (권장)
```

### theme.json 필수 필드

```json
{
    "id": "my-theme",
    "name": "My Theme",
    "version": "1.0.0",
    "author": { "name": "Developer" },
    "description": "테마 설명",
    "angpleVersion": "0.1.0",
    "settings": {
        "appearance": {
            "primaryColor": { "type": "color", "default": "#10b981" }
        }
    }
}
```

### SSR 테마 로딩 흐름

```
+layout.server.ts
    → settings.json에서 활성 테마 ID 조회
    → themes/{id}/theme.json 로드
    → PageData로 반환

+layout.svelte
    → themeStore.initFromSSR(data.activeTheme)
    → 테마 CSS 변수 적용 (FOUC 방지)
```

---

## 6. 위젯 개발 프로세스

> 상세 스펙: [`docs/specs/widget-spec-v1.0.md`](docs/specs/widget-spec-v1.0.md) 참조

### 위젯 구조

```
custom-widgets/{widget-id}/
├── widget.json          # 매니페스트 (필수)
├── index.svelte         # 메인 컴포넌트 (필수)
├── settings.svelte      # 설정 UI (선택)
└── README.md            # 설명 (선택)
```

### widget.json 스키마

```json
{
    "id": "my-widget",
    "name": "My Widget",
    "version": "1.0.0",
    "description": "위젯 설명",
    "author": "Developer",
    "main": "index.svelte",
    "settings": {
        "title": { "type": "string", "default": "제목" },
        "count": { "type": "number", "default": 5 }
    }
}
```

### 보안 검증 (5단계)

1. ZIP 크기 제한 (10MB)
2. 경로 탈출 방지 (`..\`, 절대경로, null bytes)
3. widget.json Zod 스키마 검증
4. 메인 파일 존재 확인
5. 파일 확장자 화이트리스트 (.svelte, .ts, .js, .css, .json, .md, .png, .jpg, .svg)

---

## 7. 패키지 관리 (Monorepo)

### 워크스페이스 구조

```yaml
# pnpm-workspace.yaml
packages:
    - apps/*
    - packages/*
```

### 패키지 목록

| 패키지                 | 경로                    | 설명        |
| ---------------------- | ----------------------- | ----------- |
| `@angple/web`          | `apps/web`              | Web 앱      |
| `@angple/admin`        | `apps/admin`            | Admin 앱    |
| `@angple/hook-system`  | `packages/hook-system`  | Hook 시스템 |
| `@angple/i18n`         | `packages/i18n`         | 다국어      |
| `@angple/theme-engine` | `packages/theme-engine` | 테마 엔진   |
| `@angple/types`        | `packages/types`        | 공유 타입   |

### 패키지 간 의존성

```
apps/web ──→ @angple/hook-system
         ──→ @angple/i18n
         ──→ @angple/theme-engine
         ──→ @angple/types

apps/admin ─→ @angple/types
           ─→ @angple/i18n
```

### 패키지 추가 명령어

```bash
# 특정 워크스페이스에 의존성 추가
pnpm --filter @angple/web add some-package

# 루트에 dev 의존성 추가
pnpm add -D -w some-dev-package
```

---

## 8. 테스트 전략

### 테스트 종류

| 종류            | 도구                    | 대상                             | 위치                        |
| --------------- | ----------------------- | -------------------------------- | --------------------------- |
| 단위 테스트     | Vitest                  | 유틸리티, 스토어, API 클라이언트 | `*.test.ts` (같은 디렉토리) |
| 컴포넌트 테스트 | @testing-library/svelte | Svelte 컴포넌트                  | `*.test.ts`                 |
| E2E 테스트      | Playwright              | 사용자 플로우                    | `tests/e2e/`                |
| 시각적 회귀     | Percy / Chromatic       | UI 스냅샷                        | CI 전용                     |

### 테스트 명령어

```bash
pnpm test              # Vitest 실행
pnpm test -- --watch   # Watch 모드
pnpm test -- --coverage # 커버리지

# Playwright E2E
npx playwright test
npx playwright test --headed  # 브라우저 표시
```

### 테스트 작성 예시

```typescript
// stores/board.svelte.test.ts
import { describe, it, expect } from 'vitest';
import { boardStore } from './board.svelte';

describe('BoardStore', () => {
    it('초기 상태는 빈 배열', () => {
        expect(boardStore.boards).toEqual([]);
        expect(boardStore.loading).toBe(false);
    });
});
```

---

## 9. 빌드 & 배포

### 빌드 명령어

```bash
# Web 빌드 (adapter-static → nginx)
pnpm build

# Admin 빌드
pnpm build:admin

# Docker 이미지 빌드
docker build -f apps/web/Dockerfile -t angple-web .
```

### Docker 구성

```bash
# 개발 환경
docker compose up -d

# 프로덕션
docker compose -f compose.yml -f compose.prod.yml up -d
```

### 배포 아키텍처

```
Docker (angple-web)
    └── Node.js SvelteKit (SSR)
        └── adapter-node (port 3000)
            └── 내부: INTERNAL_API_URL → angple-backend:8081

Nginx (프록시)
    └── :3010 → angple-web:3000
```

### CI/CD

```
Push/PR → ESLint + Prettier 검사
        → Vitest 실행
        → TypeScript 타입 체크

Merge to main → Docker 이미지 빌드
              → GHCR Push
              → 프로덕션 배포
```

---

## 10. 보안 체크리스트

### Path Sanitization

```typescript
// 테마/위젯/플러그인 경로 접근 시 필수
import { sanitizePath } from '$lib/server/security';

const safePath = sanitizePath(userInput);
// .., \, 절대경로, null bytes 차단
```

### XSS 방지

-   [ ] 사용자 입력 HTML 이스케이프 (Svelte는 기본 이스케이프)
-   [ ] `{@html}` 사용 시 DOMPurify 적용
-   [ ] URL 파라미터 검증

### CORS

-   [ ] API 클라이언트에 `credentials: 'include'` 설정
-   [ ] 백엔드 CORS 허용 Origin 확인
-   [ ] SameSite Cookie 정책 검증

### 파일 업로드

-   [ ] 파일 크기 제한 (클라이언트 + 서버)
-   [ ] 파일 확장자 화이트리스트
-   [ ] ZIP 업로드 경로 탈출 방지

### 인증

-   [ ] 토큰은 httpOnly Cookie에만 저장 (localStorage 금지)
-   [ ] 401 응답 시 자동 토큰 갱신
-   [ ] 인증 필요 페이지에 서버측 가드 적용
