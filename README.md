# Angple

**오픈소스 커뮤니티 플랫폼**

누구나 자유롭게 커뮤니티를 만들 수 있는 게시판 중심 플랫폼입니다. 테마와 플러그인 시스템을 통해 교회, 동호회, 회사, 개인 블로그 등 다양한 형태의 커뮤니티를 쉽게 구축할 수 있습니다.

## ✨ 주요 기능

### 현재 구현 완료 (Phase 1-10)

- ✅ **SvelteKit 5 기반 현대적 아키텍처**
  - Svelte 5 Rune 모드
  - TypeScript strict mode
  - Tailwind CSS 4

- ✅ **듀얼 애플리케이션 구조**
  - Web App: 사용자용 프론트엔드 (http://localhost:5173)
  - Admin Dashboard: 관리자 대시보드 (http://localhost:5174)

- ✅ **테마 시스템** (Phase 6-10 완료)
  - `@angple/theme-engine` 패키지
  - 테마 스캐너 & 로더
  - 테마 활성화/비활성화
  - 테마 설정 시스템
  - **테마 마켓플레이스**:
    - ZIP 업로드로 커스텀 테마 설치
    - 공식 테마 / 커스텀 테마 구분
    - 커스텀 테마 삭제 (공식 테마는 보호)
    - Admin 대시보드 UI 제공

- ✅ **Hook 시스템**
  - `@angple/hook-system` 패키지
  - 이벤트 기반 확장 포인트

### 다음 단계

- 🚧 **플러그인 시스템** (Phase 11-15, 계획 중)
- 🚧 **Backend API 통합** (Phase 16-20)
- 🚧 **콘텐츠 관리** (CRUD, Phase 21-25)

## 🚀 빠른 시작

### 필수 요구사항

- Docker Compose (권장)
- Node.js 18+
- pnpm 9+

### 개발 환경 실행

```bash
# Docker Compose 사용 (권장)
docker compose up -d web        # 웹 애플리케이션
docker compose up -d admin      # 관리자 대시보드
docker compose up -d            # 모든 서비스

# 로컬 개발 (pnpm 사용)
cd apps/web && pnpm dev         # 웹 개발 서버
cd apps/admin && pnpm dev       # 관리자 개발 서버

# 루트에서 실행
npm run dev                     # web 앱
npm run dev:admin               # admin 앱
```

### 접속 URL

- **Web App**: http://localhost:5173
- **Admin Dashboard**: http://localhost:5174

## 🛠️ 기술 스택

### 프론트엔드

- **Svelte 5.0** (Rune 모드)
- **SvelteKit 2.22** (SSR/SSG 지원)
- **TypeScript 5.0** (strict mode)
- **Tailwind CSS 4.0**
- **Vite 7.0**
- **shadcn-svelte** (UI 컴포넌트)
- **Lucide** (아이콘)

### 백엔드 (계획 중)

- **Go 1.21** + **Fiber**
- **PostgreSQL** 또는 **MySQL**
- **Redis** (캐싱)

### 인프라

- **Docker Compose** (멀티 스테이지 빌드)
- **nginx** (정적 파일 서빙)
- **pnpm** (Monorepo 관리)

## 📁 프로젝트 구조

```
angple/
├── apps/
│   ├── web/                    # 메인 웹 애플리케이션
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── api/        # API 클라이언트
│   │       │   ├── components/ # Svelte 컴포넌트
│   │       │   ├── server/     # 서버 사이드 로직
│   │       │   │   ├── themes/ # 테마 스캐너, 로더
│   │       │   │   └── settings/ # 설정 관리
│   │       │   └── types/      # TypeScript 타입
│   │       └── routes/         # SvelteKit 라우팅
│   │           └── api/        # API 엔드포인트
│   │               └── themes/ # 테마 관리 API
│   │
│   └── admin/                  # 관리자 대시보드
│       └── src/
│           ├── lib/
│           │   ├── api/        # Web API 클라이언트
│           │   ├── stores/     # Svelte 5 스토어
│           │   └── components/
│           └── routes/
│               └── themes/     # 테마 관리 페이지
│
├── packages/                   # 공유 패키지
│   ├── theme-engine/          # 테마 엔진 코어
│   ├── hook-system/           # Hook System
│   └── types/                 # 공유 타입
│
├── themes/                    # 공식 테마
│   ├── damoang-classic/
│   ├── sample-theme/
│   └── ...
│
├── custom-themes/             # 사용자 업로드 테마
│
└── CLAUDE.md                  # 개발자 가이드
```

## 🧪 테스트

```bash
# 타입 검사
pnpm check

# 린트 검사
pnpm lint

# 코드 포맷팅
pnpm format

# 단위 테스트
pnpm test:unit

# E2E 테스트
pnpm test:e2e

# 전체 테스트
pnpm test
```

## 📖 문서

자세한 개발 가이드는 [CLAUDE.md](./CLAUDE.md)를 참고하세요:

- 프로젝트 비전 및 로드맵
- 개발 환경 설정
- 코딩 규칙 및 컨벤션
- API 클라이언트 아키텍처
- 테스트 전략
- 문제 해결 가이드

## 🎯 사용 사례

Angple은 다양한 형태의 커뮤니티에 활용할 수 있습니다:

- 🏢 **회사**: 사내 커뮤니티, 고객 지원 포럼
- ⛪ **종교시설**: 교회, 성당, 사찰 홈페이지
- 🎭 **동호회**: 취미, 스포츠, 문화 모임
- 🎓 **교육기관**: 학교, 학원, 스터디 그룹
- 🏛️ **정당/단체**: 정당 홈페이지, 시민단체
- 📝 **개인 블로그**: 프로필 페이지, 개인 미디어
- 💼 **기업**: 제품 커뮤니티, 지식베이스

## 🤝 기여하기

Angple은 오픈소스 프로젝트입니다. 다음과 같은 방법으로 기여할 수 있습니다:

1. **코드 기여**: GitHub Issues, Pull Requests
2. **테마/플러그인 제작**: 마켓플레이스 등록 (준비 중)
3. **문서 작성**: 튜토리얼, 가이드
4. **버그 리포트**: GitHub Issues
5. **기능 제안**: GitHub Discussions

### 개발 가이드

```bash
# 1. 저장소 클론
git clone https://github.com/angple/angple.git
cd angple

# 2. 의존성 설치
pnpm install

# 3. 개발 서버 실행
docker compose up -d

# 4. 브랜치 생성
git checkout -b feature/my-feature

# 5. 커밋 전 체크리스트
pnpm check         # 타입 검사
pnpm lint          # 린트 검사
pnpm test          # 테스트 실행
pnpm build         # 빌드 검증
```

## 🌐 커뮤니티

- **공식 블로그**: https://sdk.kr
- **다모앙 커뮤니티**: https://damoang.net (개발자 커뮤니티)
- **GitHub Discussions**: (준비 중)
- **Discord**: (준비 중)

## 📜 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

## 🙏 감사

Angple은 다음 오픈소스 프로젝트들에 영감을 받았습니다:

- [WordPress](https://wordpress.org) - 플러그인/테마 시스템 아키텍처
- [Svelte](https://svelte.dev) - 현대적 웹 프레임워크
- [SvelteKit](https://kit.svelte.dev) - Full-stack 프레임워크
- [shadcn-svelte](https://www.shadcn-svelte.com) - UI 컴포넌트 시스템

---

**현재 버전**: Phase 10 완료 (테마 마켓플레이스)
**다음 목표**: Phase 11 - 플러그인 시스템 구축

Made with ❤️ by [SDK Co.](https://sdk.kr)
