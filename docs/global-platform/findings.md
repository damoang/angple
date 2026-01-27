# 중요 발견 사항

## 현재 상태 분석 (2026-01-28)

### 1. angple-saas 레포
- **상태**: 초기화 완료 - 랜딩 페이지, 회원가입/로그인 페이지 구현
- **멀티테넌시**: angple-backend에 40% 구현됨
  - `sites`, `site_settings`, `site_users`, `site_usage` 테이블 완성
  - 7개 API 엔드포인트 구현 (`/api/v2/sites/*`)
  - 테넌트 미들웨어 (`internal/middleware/tenant.go`) 추가됨

### 2. i18n
- **상태**: 기본 패키지 생성 완료
- **구현**: `packages/i18n/` 패키지 생성됨
  - 7개 언어 번역 파일 (en, ko, ja, zh, es, ar, vi)
  - RTL 지원 유틸리티 (`rtl.ts`)
  - 언어 메타데이터 및 감지 로직
- **남은 작업**:
  - apps/web, apps/admin 컴포넌트에 번역 키 적용
  - Tailwind RTL 플러그인 설정

### 3. 배포 인프라
- **현재**: Docker Compose 기반 설정 완료
- **Caddy**: 글로벌 프록시 Caddyfile 작성 완료
  - 와일드카드 서브도메인 라우팅
  - 커스텀 도메인 On-Demand TLS
  - API/Admin/Landing 라우팅

### 4. 기존 구현된 시스템
- ✅ 테마 시스템 (완료)
- ✅ 플러그인 시스템 (완료)
- ✅ Hook 시스템 (완료)
- ✅ Slot Manager (완료)
- ✅ i18n 패키지 (기본 완료)
- ✅ SaaS 랜딩 페이지 (완료)
- ✅ 테넌트 미들웨어 (완료)

---

## 기술 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| i18n 라이브러리 | Paraglide | SvelteKit 최적화, 컴파일 타임 안전성 |
| 결제 시스템 | Stripe | 글로벌 지원, 다양한 통화 |
| 프록시 | Caddy | 자동 HTTPS, 간단한 설정 |
| DB 전략 | Hybrid | Free=shared, Pro+=schema |

---

## 주요 파일 위치

### angple (Self-host)
- `apps/web/` - 웹 애플리케이션
- `apps/admin/` - 관리자 대시보드
- `packages/` - 공유 패키지
  - `packages/i18n/` - 국제화 패키지 (신규)
- `plugins/` - 플러그인 디렉터리
- `themes/` - 테마 디렉터리
- `install.sh` - 원클릭 설치 스크립트 (신규)

### angple-backend
- `internal/domain/site.go` - 멀티테넌시 모델
- `internal/handler/site_handler.go` - 사이트 API
- `internal/middleware/tenant.go` - 테넌트 미들웨어 (신규)
- `.docker/mysql/init/03-multitenant-schema.sql` - DB 스키마

### angple-saas (신규 구축)
- `apps/landing/` - 랜딩 페이지 (www.angple.com)
  - `src/routes/+page.svelte` - 홈페이지
  - `src/routes/signup/` - 회원가입 마법사
  - `src/routes/login/` - 로그인
  - `src/lib/components/` - 공통 컴포넌트
- `compose.yml` - Docker Compose 설정
- `Caddyfile` - Caddy 프록시 설정

---

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                    Angple 글로벌 플랫폼                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐        ┌──────────────────┐               │
│  │   Self-Host      │        │      SaaS        │               │
│  │   (angple)       │        │  (angple-saas)   │               │
│  ├──────────────────┤        ├──────────────────┤               │
│  │ • 단일 인스턴스   │        │ • 멀티테넌트      │               │
│  │ • 자체 서버      │        │ • *.angple.com   │               │
│  │ • install.sh     │        │ • Caddy 프록시   │               │
│  │ • Docker Compose │        │ • Stripe 결제    │               │
│  └──────────────────┘        └──────────────────┘               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    공통 코어                               │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ • packages/i18n (7개 언어 + RTL)                          │   │
│  │ • packages/theme-engine                                    │   │
│  │ • packages/hook-system                                     │   │
│  │ • packages/types                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 멀티테넌시 DB 전략

| 플랜 | 전략 | 격리 수준 | 가격 |
|------|------|----------|------|
| Free | `shared` | site_id FK | $0 |
| Pro | `schema` | 전용 스키마 | $29/월 |
| Business | `schema` | 전용 스키마 + 리소스 보장 | $99/월 |
| Enterprise | `dedicated` | 전용 DB 인스턴스 | 협의 |
