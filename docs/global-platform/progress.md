# 작업 진행 기록

## 2026-01-28

### Phase 1: i18n 시스템 구축 - 완료

#### packages/i18n 패키지 생성
- [x] `packages/i18n/package.json` 생성
- [x] `packages/i18n/tsconfig.json` 생성
- [x] `packages/i18n/src/types.ts` - 타입 정의
- [x] `packages/i18n/src/rtl.ts` - RTL 지원 유틸리티
- [x] `packages/i18n/src/locales.ts` - 언어 메타데이터
- [x] `packages/i18n/src/config.ts` - i18n 설정
- [x] `packages/i18n/src/index.ts` - 공개 API

#### 번역 파일 생성 (7개 언어)
- [x] `messages/en.json` - 영어 (기준)
- [x] `messages/ko.json` - 한국어
- [x] `messages/ja.json` - 일본어
- [x] `messages/zh.json` - 중국어 (간체)
- [x] `messages/es.json` - 스페인어
- [x] `messages/ar.json` - 아랍어 (RTL)
- [x] `messages/vi.json` - 베트남어

#### Paraglide 설정
- [x] `project.inlang/settings.json` 생성

---

### Phase 2: SaaS 프론트엔드 구축 - 완료

#### 레포 초기화
- [x] `angple-saas/package.json` - pnpm 모노레포 설정
- [x] `angple-saas/pnpm-workspace.yaml`
- [x] `angple-saas/.env.example`

#### 랜딩 페이지 앱 (`apps/landing/`)
- [x] `package.json`, `svelte.config.js`, `vite.config.ts`
- [x] `src/app.html`, `src/app.css`
- [x] `src/routes/+layout.svelte`
- [x] `src/routes/+page.svelte`

#### 랜딩 페이지 컴포넌트
- [x] `src/lib/components/header.svelte`
- [x] `src/lib/components/hero.svelte`
- [x] `src/lib/components/features.svelte`
- [x] `src/lib/components/pricing.svelte`
- [x] `src/lib/components/testimonials.svelte`
- [x] `src/lib/components/cta.svelte`
- [x] `src/lib/components/footer.svelte`

#### 인증 페이지
- [x] `src/routes/signup/+page.svelte` - 5단계 사이트 생성 마법사
- [x] `src/routes/login/+page.svelte` - 로그인 페이지

#### Docker 설정
- [x] `Dockerfile` - 멀티스테이지 빌드
- [x] `src/routes/health/+server.ts` - 헬스체크 엔드포인트

---

### Phase 3: 배포 인프라 - 완료

#### Docker Compose
- [x] `compose.yml` - 전체 서비스 정의
  - landing (포트 3000)
  - web (테넌트 앱)
  - admin (관리자)
  - caddy (리버스 프록시)
  - api (백엔드)
  - mysql (데이터베이스)
  - redis (캐시)

#### Caddy 프록시
- [x] `Caddyfile` - 글로벌 프록시 설정
  - api.angple.com → api:8081
  - admin.angple.com → admin:3000
  - www.angple.com → landing:3000
  - *.angple.com → web:3000 (테넌트)
  - 커스텀 도메인 On-Demand TLS

---

### Phase 4: 백엔드 확장 - 진행 중

#### 테넌트 미들웨어
- [x] `internal/middleware/tenant.go` 작성
  - 서브도메인 추출 로직
  - 커스텀 도메인 지원
  - 예약 서브도메인 필터링
  - 테넌트 컨텍스트 저장
  - 플랜별 기능 제한 미들웨어

---

### Phase 5: Self-Host - 완료

#### 설치 스크립트
- [x] `install.sh` 작성
  - Docker/Docker Compose 확인
  - 사용자 설정 입력
  - 자동 비밀번호 생성
  - 서비스 시작 및 헬스체크

---

## 다음 작업

### 즉시 필요한 작업
1. apps/web, apps/admin 컴포넌트에 i18n 적용
2. Tailwind RTL 플러그인 설정
3. 테넌트 미들웨어 통합 테스트

### 추후 작업
1. Stripe 결제 연동
2. 웹 설치 마법사 완성
3. 문서화

---

## 에러 기록

(작업 중 발생한 에러를 여기에 기록)

### 형식
```
#### [날짜] 에러 제목
- **상황**: 무엇을 시도했는가
- **에러 메시지**: 실제 에러 내용
- **해결**: 어떻게 해결했는가
```

---

## 통계

| 항목 | 수량 |
|------|------|
| 생성된 파일 수 | 40+ |
| 지원 언어 수 | 7 |
| SaaS 컴포넌트 수 | 10+ |
| Docker 서비스 수 | 7 |
