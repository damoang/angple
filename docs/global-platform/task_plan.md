# Angple 글로벌 플랫폼 구축 계획

## 역할
당신은 체계적인 프로젝트 매니저입니다.

## 목표
Angple 플랫폼을 Self-host + SaaS 듀얼 배포 지원, 7개 언어 다국어 지원, 서브도메인 기반 멀티테넌시 시스템으로 구축합니다.

## 작업 방식
1. 먼저 전체 작업을 단계별로 나누어 `task_plan.md`에 체크리스트로 기록하세요.
2. 작업 중 발견한 중요 정보는 `findings.md`에 정리하세요.
3. 각 단계를 완료할 때마다 `progress.md`에 시도한 내용과 결과를 기록하세요. 실패한 시도와 에러 메시지는 반드시 남겨주세요.
4. 중요한 결정 전에는 `task_plan.md`를 다시 읽고 원래 목표와 일치하는지 확인하세요.

---

## Phase 1: i18n 시스템 구축 (3주)

### Week 1: 패키지 설정
- [x] `packages/i18n/` 디렉터리 생성
- [x] `package.json` 생성 (paraglide-js, paraglide-js-adapter-sveltekit)
- [x] Paraglide 설정 파일 생성
- [x] RTL 지원 유틸리티 (`rtl.ts`) 작성
- [ ] Tailwind RTL 플러그인 설치 및 설정

### Week 2: 번역 파일 생성
- [x] `messages/en.json` 영어 번역 (기준)
- [x] `messages/ko.json` 한국어 번역
- [x] `messages/ja.json` 일본어 번역
- [x] `messages/zh.json` 중국어 번역
- [x] `messages/es.json` 스페인어 번역
- [x] `messages/ar.json` 아랍어 번역 (RTL)
- [x] `messages/vi.json` 베트남어 번역

### Week 3: 앱 통합
- [ ] `apps/web` 컴포넌트 번역 키 적용 (~50개 파일)
- [ ] `apps/admin` 컴포넌트 번역 키 적용 (~30개 파일)
- [ ] 설치 마법사 언어 선택 UI 구현
- [ ] 테마/플러그인 manifest에 translations 필드 추가
- [ ] RTL 레이아웃 테스트 (아랍어)

---

## Phase 2: SaaS 프론트엔드 구축 (3주)

### Week 4: 레포 초기화
- [x] `angple-saas/` 레포 구조 설정
- [x] `apps/web`, `apps/admin`, `apps/landing` 디렉터리 생성
- [ ] `packages/` 심볼릭 링크 또는 복사
- [x] Docker Compose 설정

### Week 5: 랜딩 페이지
- [x] www.angple.com 랜딩 페이지 디자인
- [x] 가격 페이지 (/pricing)
- [x] 회원가입 페이지 (/signup)
- [x] 로그인 페이지 (/login)

### Week 6: 사이트 생성 마법사
- [x] 언어 선택 스텝
- [x] 서브도메인 입력 (실시간 가용성 체크)
- [x] 테마 선택 (미리보기)
- [x] 플랜 선택 (Free/Pro/Business)
- [ ] 테넌트 미들웨어 (`hooks.server.ts`)

---

## Phase 3: 배포 인프라 (2주)

### Week 7: Caddy 설정
- [x] Caddy 글로벌 프록시 Caddyfile 작성
- [x] 와일드카드 SSL 설정 (Let's Encrypt)
- [x] api.angple.com 라우팅
- [x] admin.angple.com 라우팅
- [x] *.angple.com 테넌트 라우팅

### Week 8: Docker 최적화
- [x] `compose.yml` SaaS 전용 설정
- [x] 커스텀 도메인 On-Demand TLS
- [ ] 네트워크 설정 최적화
- [ ] 헬스체크 및 모니터링

---

## Phase 4: 백엔드 확장 (2주)

### Week 9: 테넌트 미들웨어
- [x] `internal/middleware/tenant.go` 작성
- [x] 서브도메인 추출 로직
- [x] 사이트 조회 및 컨텍스트 설정
- [ ] API 엔드포인트에 테넌트 격리 적용

### Week 10: Stripe 결제 연동
- [ ] Stripe Go SDK 설치
- [ ] `internal/service/billing_service.go` 작성
- [ ] 구독 생성/취소 로직
- [ ] Webhook 핸들러 (`/webhook/stripe`)
- [ ] 플랜별 기능 제한 로직

---

## Phase 5: Self-Host (1주)

### Week 11: 설치 자동화
- [x] `install.sh` 원클릭 설치 스크립트
- [ ] 웹 설치 마법사 완성 (`/install`)
- [ ] 문서화 (README, DEPLOYMENT.md)
- [ ] GitHub Release 설정

---

## 완료 조건
- [ ] 모든 체크리스트 완료
- [ ] i18n 7개 언어 작동 확인
- [ ] SaaS 회원가입 → 사이트 생성 플로우 테스트
- [ ] Self-host 설치 스크립트 테스트
- [ ] RTL (아랍어) 레이아웃 확인
