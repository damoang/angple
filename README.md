# Angple

**오픈소스 커뮤니티 플랫폼**

누구나 자유롭게 커뮤니티를 만들 수 있는 게시판 중심 플랫폼입니다. 테마, 플러그인, 위젯, 확장 시스템을 통해 기업, 단체, 교회, 동호회, 회사, 개인 블로그 등 다양한 형태의 커뮤니티를 쉽게 구축할 수 있습니다.

## 주요 기능

- **SvelteKit 5 기반 현대적 아키텍처** — Svelte 5 Rune 모드, TypeScript strict mode, Tailwind CSS 4
- **통합 관리자 대시보드** — `/admin` 라우트에서 대시보드, 게시판, 회원, 테마, 플러그인 관리
- **SSR (Server-Side Rendering)** — 서버사이드 데이터 로딩, 깜박임 없는 초기 렌더링
- **테마 시스템** — 13개 공식 테마, ZIP 업로드 커스텀 테마, 테마 마켓플레이스
- **플러그인 시스템** — Hook 기반 확장, 컴포넌트 슬롯, 플러그인 마켓플레이스
- **위젯 시스템** — 드래그 앤 드롭 레이아웃, 메인/사이드바 위젯 관리
- **확장 시스템** — 보안 샌드박스, 런타임 권한 관리, 감사 로그
- **Hook 시스템** — WordPress 스타일 Action/Filter, 테마/플러그인에서 코어 기능 확장
- **i18n** — Paraglide.js 기반 7개 언어 지원
- **WYSIWYG 에디터** — TipTap 기반, 테이블/코드블록/YouTube 임베드/자동저장
- **Q&A 게시판** — 질문/답변 게시판 타입, 채택 시스템
- **AI 기능** — 스팸 검사, 콘텐츠 자동 요약 (OpenAI/Anthropic)
- **실시간 SSE** — 접속자 수, 실시간 알림, heartbeat
- **PWA** — Service Worker, 오프라인 지원, 푸시 알림
- **마이그레이션 도구** — 그누보드/라이믹스 DB 마이그레이션, URL 리다이렉트

## 빠른 시작

### 필수 요구사항

- Docker Compose (권장)
- Node.js 18+
- pnpm 9+

### 개발 환경 실행

```bash
# Docker Compose 사용 (권장)
docker compose up -d

# 로컬 개발
pnpm install
cd apps/web && pnpm dev    # http://localhost:3010
```

### 접속 URL

- **Web App**: http://localhost:3010
- **Admin Dashboard**: http://localhost:3010/admin

## 기술 스택

### 프론트엔드

- **Svelte 5** (Rune 모드)
- **SvelteKit 2** (SSR/SSG)
- **TypeScript 5** (strict mode)
- **Tailwind CSS 4**
- **Vite 7**
- **shadcn-svelte** (UI 컴포넌트)
- **Lucide** (아이콘)

### 백엔드

- **Go** + **Fiber** — API 서버
- **MySQL/PostgreSQL** — 데이터베이스
- **Redis** — 캐싱

### 인프라

- **Docker Compose** (멀티 스테이지 빌드)
- **pnpm** (Monorepo 관리)
- **GitHub Actions** (CI/CD)

## 프로젝트 구조

```
angple/
├── apps/
│   └── web/                      # 메인 웹 + 관리자 대시보드
│       └── src/
│           ├── lib/
│           │   ├── api/          # API 클라이언트
│           │   ├── components/   # Svelte 컴포넌트
│           │   ├── stores/       # Svelte 5 스토어
│           │   ├── hooks/        # Hook 시스템
│           │   ├── server/       # 서버 사이드 로직
│           │   └── types/        # TypeScript 타입
│           └── routes/
│               ├── admin/        # 관리자 대시보드 라우트
│               ├── api/          # API 엔드포인트
│               ├── [boardId]/    # 게시판/게시글
│               └── member/       # 회원 관련
│
├── packages/                     # 공유 패키지
│   ├── types/                    # @angple/types
│   ├── theme-engine/             # @angple/theme-engine
│   ├── hook-system/              # @angple/hook-system
│   ├── plugin-engine/            # @angple/plugin-engine
│   └── i18n/                     # @angple/i18n (7개 언어)
│
├── themes/                       # 공식 테마 (13개)
├── custom-themes/                # 사용자 업로드 테마
├── widgets/                      # 위젯
├── plugins/                      # 플러그인
├── extensions/                   # 확장
│
├── docs/                         # 개발자 문서
│   ├── extension-api.md
│   ├── hook-reference.md
│   ├── theme-development.md
│   └── widget-development.md
│
└── CLAUDE.md                     # 프로젝트 가이드
```

## 환경변수

| 환경변수 | 설명 | 기본값 |
| --- | --- | --- |
| `BACKEND_URL` | Go 백엔드 URL (SSR) | `http://localhost:8081` |
| `INTERNAL_API_URL` | SSR API 베이스 | `http://localhost:8081/api/v2` |
| `PUBLIC_API_BASE_URL` | 클라이언트 API 베이스 | — |
| `VITE_API_PROXY_TARGET` | Dev 프록시 타겟 | `http://localhost:8081` |
| `WEB_PORT` / `VITE_PORT` | Dev 서버 포트 | `3010` |
| `ADAPTER` | `static`으로 설정 시 SPA 빌드 | — |
| `VITE_SITE_NAME` | 사이트 이름 | `Angple` |
| `VITE_GAM_NETWORK_CODE` | Google Ad Manager 네트워크 코드 | — |
| `VITE_S3_URL` | S3 저장소 URL | — |

```bash
cp apps/web/.env.example apps/web/.env
# .env 파일 수정 후 개발 서버 실행
```

## 개발

```bash
# 의존성 설치
pnpm install

# 개발 서버 (localhost:3010)
cd apps/web && pnpm dev

# 빌드
cd apps/web && pnpm build               # Node adapter (SSR)
cd apps/web && ADAPTER=static pnpm build # Static adapter (SPA)

# 린트 & 포맷
cd apps/web && pnpm lint
cd apps/web && pnpm format
cd apps/web && pnpm check               # svelte-check + TypeScript

# 테스트
cd apps/web && pnpm test:unit -- --run   # 단위 테스트
cd apps/web && pnpm test:e2e             # E2E 테스트
cd apps/web && pnpm test                 # 전체 테스트
```

## 사용 사례

Angple은 다양한 형태의 커뮤니티에 활용할 수 있습니다:

- **회사** — 사내 커뮤니티, 고객 지원 포럼
- **종교시설** — 교회, 성당, 사찰 홈페이지
- **동호회** — 취미, 스포츠, 문화 모임
- **교육기관** — 학교, 학원, 스터디 그룹
- **개인 블로그** — 프로필 페이지, 개인 미디어
- **기업** — 제품 커뮤니티, 지식베이스

## 기여하기

1. 저장소 클론: `git clone https://github.com/angple/angple.git`
2. 의존성 설치: `pnpm install`
3. 브랜치 생성: `git checkout -b feature/my-feature`
4. 커밋 전 체크: `pnpm check && pnpm lint && pnpm test:unit -- --run && pnpm build`
5. Pull Request 생성

## 라이선스

MIT License

---

Made with ❤️ by [SDK Co.](https://sdkcorp.com) | [Angple](https://angple.com)
