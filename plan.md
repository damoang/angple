# ANGPLE Frontend — 프로젝트 계획서

> 최종 수정: 2026-01-31 | 버전: v1.0

---

## 1. 프로젝트 비전

**누구나 자유롭게 커뮤니티를 만들 수 있는 오픈소스 플랫폼. WordPress를 넘어서는 한국형 게시판 기반 커뮤니티 시스템.**

### WordPress vs ANGPLE

| 항목 | WordPress | ANGPLE |
|------|-----------|--------|
| 핵심 | 블로그/CMS | 게시판/커뮤니티 |
| 기술 | PHP + jQuery | SvelteKit 5 + Go |
| 확장 | 플러그인 + 테마 | 플러그인 + 테마 + 위젯 + 확장 |
| 렌더링 | 서버 사이드 | SSR + CSR 하이브리드 |
| 대상 | 글로벌 | 한국 우선 → 글로벌 확장 |

---

## 2. 현재 상태 요약

- **Phase 10 완료** (테마 마켓플레이스 + 확장 시스템 + SSR 테마 로딩)
- **테마 시스템**: 100% (13개 공식 테마, 커스텀 테마 업로드)
- **위젯 시스템**: 스펙 완성, 기본 구현 완료
- **확장 시스템**: 아키텍처 설계 완료
- **i18n**: 7개 언어 (ko, en, ja, zh, es, ar, vi)
- **Hook 시스템**: `@angple/hook-system` 패키지 완성
- **API**: Mock 모드로 동작 (백엔드 미연동)

### 완료된 기능

| 영역 | 상태 | 세부 |
|------|------|------|
| SvelteKit 5 + Svelte 5 Rune | ✅ | 전체 앱 Rune 모드 |
| 듀얼 앱 (Web + Admin) | ✅ | 독립 빌드 |
| SSR 테마 로딩 | ✅ | FOUC 방지 |
| 테마 설정 시스템 | ✅ | theme.json → Admin UI |
| 커스텀 테마 업로드 | ✅ | ZIP → 검증 → 설치 |
| Hook 시스템 | ✅ | Action + Filter |
| 위젯 레이아웃 | ✅ | main + sidebar 영역 |
| 다크/라이트 모드 | ✅ | 시스템 연동 |
| Slot 시스템 | ✅ | 13개 슬롯 정의 |

---

## 3. Phase별 실행 계획

### 플러그인 시스템 (Phase 11-15)

#### Phase 11: Plugin Loader & Scanner

- 플러그인 디렉토리 스캔 (`plugins/`, `custom-plugins/`)
- `extension.json` / `plugin.yaml` 매니페스트 파싱
- 플러그인 유효성 검증 (Zod 스키마)
- 플러그인 레지스트리 구현
- 활성/비활성 상태 관리 (settings.json)

**완료 기준**: 플러그인 자동 감지 및 메타데이터 로딩

#### Phase 12: Plugin API & Permission

- 플러그인 권한 시스템 (posts:read, api:external 등)
- 사용자 승인 UI (권한 요청 팝업)
- 플러그인 Hook 등록 API
- 플러그인 Slot 컴포넌트 등록
- 플러그인 간 의존성 해결

**완료 기준**: 플러그인이 Hook/Slot에 안전하게 컴포넌트 삽입

#### Phase 13: 플러그인 Admin UI

- 관리자 → 플러그인 관리 페이지
- 플러그인 설치/활성화/비활성화/삭제
- 플러그인별 설정 페이지 (자동 생성)
- 플러그인 로그/에러 뷰어

**완료 기준**: Admin에서 플러그인 전체 생명주기 관리

#### Phase 14: 플러그인 마켓플레이스

- 마켓플레이스 UI (검색, 카테고리, 평점)
- ZIP 업로드 설치 (보안 검증)
- 원클릭 설치/업데이트
- 플러그인 호환성 검사 (angpleVersion)

**완료 기준**: 마켓플레이스에서 플러그인 검색 → 설치 → 활성화 플로우

#### Phase 15: 위젯 동적 로딩

- 위젯 실시간 추가/제거/순서 변경
- 위젯 설정 실시간 반영
- 위젯 드래그 앤 드롭 (Admin)
- 위젯 ↔ 플러그인 연동

**완료 기준**: Admin에서 위젯 드래그 앤 드롭으로 레이아웃 구성

---

### 백엔드 통합 (Phase 16-20)

> **의존성**: angple-backend Phase 1-7 완료 필요 ([백엔드 plan.md](../angple-backend/plan.md) 참조)

#### Phase 16: Mock 제거, API 클라이언트 실제 연동

- `localStorage.getItem('USE_MOCK')` 제거
- API 클라이언트를 실제 백엔드 URL로 전환
- SSR에서 `INTERNAL_API_URL` 사용
- 에러 핸들링 통합 (네트워크 에러, 인증 만료)

**완료 기준**: Mock 코드 0줄, 모든 API가 백엔드와 통신
**백엔드 의존**: Phase 1-7 (전체 v1 API 완성)

#### Phase 17: 인증 시스템 (JWT httpOnly Cookie)

- 로그인/회원가입 폼 → 백엔드 연동
- httpOnly Cookie 기반 토큰 관리
- 자동 토큰 갱신 (401 → refresh → retry)
- SSR 서버측 인증 상태 확인
- 소셜 로그인 UI (6개 프로바이더)

**완료 기준**: 로그인 → 토큰 발급 → API 호출 → 자동 갱신 플로우
**백엔드 의존**: Phase 1 (인증 API)

#### Phase 18: 게시판 CRUD 실제 연동

- 게시글 목록/상세/작성/수정/삭제
- 페이지네이션 (서버 기반)
- 게시판별 설정 적용 (권한, 에디터 타입)
- 에디터 연동 (이미지 업로드 → 백엔드)

**완료 기준**: 게시판 전체 CRUD 정상 동작
**백엔드 의존**: Phase 1 (게시글 + 파일 업로드 API)

#### Phase 19: 댓글, 추천, 파일 업로드

- 댓글 CRUD + 대댓글
- 추천/비추천 UI (토글 버튼)
- 파일 첨부 (드래그 앤 드롭)
- 파일 다운로드 (포인트 차감 표시)

**완료 기준**: 댓글, 추천, 파일 전체 기능 동작
**백엔드 의존**: Phase 1-2

#### Phase 20: 실시간 알림 (WebSocket)

- WebSocket 클라이언트 구현
- 알림 드롭다운 UI (미읽음 배지)
- 실시간 알림 수신 (댓글, 추천, 쪽지)
- 알림 목록 페이지 (읽음/삭제)

**완료 기준**: 실시간 알림 수신 및 표시
**백엔드 의존**: Phase 3 (알림 + WebSocket API)

---

### 콘텐츠 & UX (Phase 21-25)

#### Phase 21: 에디터 고도화

- 리치 텍스트 에디터 (Tiptap / ProseMirror)
- 이미지 붙여넣기 + 자동 업로드
- 코드 블록 (구문 강조)
- 멘션 (@사용자)
- 이모지 피커

**완료 기준**: 네이버 카페 수준의 에디터 기능

#### Phase 22: 이미지 최적화 (WebP, AVIF)

- 업로드 시 자동 WebP/AVIF 변환
- 반응형 이미지 (srcset)
- 썸네일 자동 생성
- 이미지 레이지 로딩

**완료 기준**: Lighthouse 이미지 점수 90+

#### Phase 23: 검색 UI

- 통합 검색 페이지 (게시글/댓글/회원)
- 자동완성 (디바운스)
- 검색 필터 (게시판, 기간, 작성자)
- 검색 결과 하이라이팅

**완료 기준**: 검색어 입력 → 결과 표시 ≤500ms

#### Phase 24: 모바일 반응형 최적화

- 모바일 퍼스트 레이아웃 재정비
- 터치 제스처 (스와이프 네비게이션)
- 하단 네비게이션 바
- 이미지 갤러리 (핀치 줌)

**완료 기준**: 모바일 Lighthouse 90+ 성능 점수

#### Phase 25: 접근성 (a11y) 개선

- WCAG 2.1 AA 준수
- 키보드 네비게이션 완성
- 스크린 리더 호환성
- 고대비 모드
- Focus 관리

**완료 기준**: axe-core 자동 검사 통과

---

### 고급 기능 (Phase 26-30)

#### Phase 26: PWA 지원

- Service Worker (오프라인 지원)
- 앱 설치 프롬프트
- 푸시 알림 (Web Push)
- 캐시 전략 (네트워크 우선)

**완료 기준**: PWA 설치 후 오프라인 읽기 가능

#### Phase 27: SEO 최적화

- 메타 태그 동적 생성
- Open Graph / Twitter Card
- JSON-LD 구조화 데이터
- sitemap.xml 자동 생성
- 정규화 URL (canonical)

**완료 기준**: Google 검색 결과 리치 스니펫 표시

#### Phase 28: 성능 최적화

- 코드 스플리팅 (라우트 기반)
- 번들 크기 최적화
- 크리티컬 CSS 인라인
- Prefetch / Preload 최적화
- Stale-While-Revalidate 캐시

**완료 기준**: Lighthouse 퍼포먼스 95+

#### Phase 29: 다국어 완성 (i18n 100%)

- 7개 언어 번역 100% 완료
- RTL 레이아웃 완성 (아랍어)
- 날짜/시간 로컬라이제이션
- 수/성별 문법 처리
- 언어 전환 UI 개선

**완료 기준**: 전체 UI 문자열 번역률 100%

#### Phase 30: E2E 테스트 완성

- Playwright 테스트 시나리오 30개+
- 크로스 브라우저 테스트 (Chrome, Firefox, Safari)
- 모바일 뷰포트 테스트
- CI 자동 실행
- 시각적 회귀 테스트 (Percy/Chromatic)

**완료 기준**: 핵심 사용자 플로우 E2E 100% 커버

---

### 장기 비전 (Phase 31+)

#### Phase 31: 모바일 앱

- Flutter 또는 React Native 기반
- WebView 하이브리드 → 점진적 네이티브 전환
- 푸시 알림 (FCM/APNs)
- 딥 링크 지원

#### Phase 32: AI 콘텐츠 추천

- 사용자 관심사 분석
- 개인화 피드
- 유사 게시글 추천
- 자동 태그 생성

#### Phase 33: 마켓플레이스 SaaS 호스팅

- 원클릭 커뮤니티 생성
- 커스텀 도메인 연결
- 구독 플랜 관리
- 사용량 대시보드

#### Phase 34: 개발자 생태계

- 플러그인 CLI (scaffolding)
- 위젯 CLI (scaffolding)
- 테마 개발 SDK
- 개발자 문서 사이트
- 플러그인 테스트 프레임워크

---

## 4. 핵심 마일스톤

| 마일스톤 | Phase | 체크포인트 |
|---------|-------|-----------|
| **플러그인 시스템 완성** | Phase 15 완료 | 마켓플레이스에서 설치/관리 가능 |
| **백엔드 완전 연동** | Phase 20 완료 | Mock 코드 0줄, 실시간 알림 동작 |
| **프로덕션 품질** | Phase 25 완료 | a11y AA, 모바일 최적화, 에디터 고도화 |
| **고급 기능 완성** | Phase 30 완료 | PWA, SEO, i18n 100%, E2E 테스트 |
| **SaaS 런칭** | Phase 33 완료 | 외부 사용자 커뮤니티 생성 가능 |

---

## 5. 기술 부채 및 리스크

### 현재 기술 부채

| 항목 | 심각도 | 설명 |
|------|--------|------|
| Mock API 의존 | 높음 | 모든 데이터가 Mock. 백엔드 연동 시 대폭 수정 필요 |
| i18n 미번역 | 중 | 70% 완료. 일부 하드코딩된 한국어 문자열 존재 |
| 테스트 부족 | 중 | 단위 테스트, E2E 테스트 커버리지 낮음 |
| 위젯 동적 로딩 | 하 | 현재 정적 레지스트리. 런타임 로딩 미구현 |

### 리스크

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| 백엔드 API 지연 | 높음 | Mock 유지하며 점진적 전환 |
| Svelte 5 Breaking Change | 중간 | 버전 고정, 업그레이드 별도 Phase |
| 테마 호환성 깨짐 | 중간 | theme.json 스키마 버전 관리 |
| 플러그인 보안 | 높음 | 샌드박스, 권한 시스템, 코드 서명 |

---

## 6. 관련 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 위젯 스펙 v1.0 | [`docs/specs/widget-spec-v1.0.md`](docs/specs/widget-spec-v1.0.md) | 위젯 시스템 규약 |
| 확장 시스템 | [`docs/EXTENSION_SYSTEM.md`](docs/EXTENSION_SYSTEM.md) | 확장/플러그인 아키텍처 |
| Core 스펙 v1.0 | [`../angple-backend/docs/specs/core-spec-v1.0.md`](../angple-backend/docs/specs/core-spec-v1.0.md) | 백엔드 Core 규약 |
| 플러그인 스펙 v1.0 | [`../angple-backend/docs/specs/plugin-spec-v1.0.md`](../angple-backend/docs/specs/plugin-spec-v1.0.md) | 플러그인 개발 규약 |
| 디자인 시스템 | [`docs/design_system.md`](docs/design_system.md) | UI 컴포넌트 가이드 |
| 개발 가이드 | [`CLAUDE.md`](CLAUDE.md) | 코딩 컨벤션, 아키텍처, 명령어 |
| 백엔드 계획 | [`../angple-backend/plan.md`](../angple-backend/plan.md) | 백엔드 Phase 연동 |
| 보안 분석 | [`docs/api/SECURITY_ANALYSIS_REPORT.md`](docs/api/SECURITY_ANALYSIS_REPORT.md) | 보안 감사 보고서 |
