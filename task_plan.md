# Task Plan: CPM 회복 + GA4/GAM 정밀화 + CLS 안정화 (2026-03-18)

## 목표

페이지 수가 충분한데도 CPM이 `$0.03` 수준으로 낮은 원인을 구조적으로 분리한다.  
목표는 단순 광고 노출 증가가 아니라, `저가 인벤토리 제거`, `고가 placement 분리`, `GA4/GAM 지표 정합성 확보`, `CLS 0.13 개선`이다.

## Step 1: 현재 상태 고정

-   [x] GA4 이벤트 의미 정리: 클릭/시작 vs 성공 분리
-   [x] 검색어/파일명 원문 전송 축소
-   [x] 게시글 조회/스크롤/다운로드 추적 helper 경로 정리
-   [x] GAM refresh 기본값 30초 재정렬
-   [x] 축하/롤링 배너 회전 30초로 통일
-   [x] 광고 슬롯/배너 높이 예약 보강

## Step 2: 저 CPM 원인 분해

-   [ ] 실제 저가 슬롯 후보 목록 작성
-   [ ] `top / infeed / article / after-comments / sidebar / sticky` 단위로 수익 구조 분리
-   [ ] 모바일 멀티사이즈 슬롯(`320x100`, `300x250`) 혼합 위치 식별
-   [ ] viewability 저하 가능 위치와 과밀 위치 정리

## Step 3: 운영 설계안 문서화

-   [ ] GAM pricing rule / floor 설계안 작성
-   [ ] 유지 슬롯 / 삭제 슬롯 / 분리 슬롯 제안안 작성
-   [ ] `page_type`, `position`, `board_id` 기준 타겟팅 운영안 작성
-   [ ] refresh declaration과 코드 설정 일치 여부 점검 항목 작성

## Step 4: 측정 체계 정리

-   [ ] GA4에서 봐야 할 핵심 이벤트/전환/세그먼트 정의
-   [ ] GAM에서 봐야 할 핵심 지표(Active View, fill, matched requests, eCPM) 정의
-   [ ] GA4 + GAM 같이 보는 진단 표 설계
-   [ ] MCP로 확인할 보고서 목록 작성

## Step 5: CLS 개선 후속

-   [ ] 광고 슬롯별 reserved height 재검토
-   [ ] 홈/상세/사이드바에서 시프트 가능 컴포넌트 점검
-   [ ] 필드 데이터와 Lighthouse 결과 차이 정리

## 이번 단계 산출물

-   [ ] `findings.md`에 저 CPM 원인 가설과 운영안 누적
-   [ ] `progress.md`에 시도/검증/실패 내역 누적
-   [ ] PR/배포 전 최종 체크리스트 정리

---

# Task Plan: 프로덕션 준비 — console.log 정리 + Svelte 5 수정 + 보안 + README

---

# Task Plan: GA4 + CPM 개선 (2026-03-18)

## 목표

GA4 이벤트 설계를 공식 모범사례에 맞게 정리하고, GAM 광고 로딩/리프레시 구조를 수익 친화적으로 개선해 초저 CPM 원인을 줄인다.

## Step 1: 공식 가이드 검토

-   [x] GA4 권장 이벤트, 커스텀 이벤트, PII/고카디널리티 가이드 확인
-   [x] GPT / Ad Manager refresh, SRA, collapse empty divs, viewability 관련 가이드 확인

## Step 2: 현재 구현 분석

-   [x] PR #696 GA4 설계/구현 검토
-   [x] 현재 광고 슬롯 레지스트리, 설정, 배치 위치 분석
-   [x] 초저 CPM 가능 원인 가설 정리

## Step 3: 저위험 코드 개선

-   [x] GA4 공통 sanitize/helper 계층 추가
-   [x] 잘못된 전환 이벤트 명칭 수정 (`login_click`, `sign_up_start`)
-   [x] 검색어/제목/파일명 등 고카디널리티 파라미터 축소
-   [x] GPT 활성 구현에 `collapseEmptyDivs()` / `enableSingleRequest()` 반영
-   [x] 광고 refresh를 viewable impression 기반으로 변경
-   [x] 슬롯 타겟팅 키 추가 (`position`, `slot_key`)
-   [x] 기본 refresh interval 60초로 상향, env override 지원

## Step 4: 운영 액션 정리

-   [ ] pricing rules / floor 구조 재설계안 정리
-   [ ] 멀티사이즈 슬롯 분리 우선순위 정리
-   [ ] 실제 관측 지표(Active View, fill, request RPM, eCPM) 점검 항목 정리

## 목표

프로덕션 배포 전 필수 이슈 해결: console.log 150개+ 삭제, Svelte 5 deprecation 87개 수정, 보안 이슈, README 업데이트

---

## Step 1: console.log 정리

-   [ ] layout.server.ts — SSR 매 요청 3개 로그 삭제
-   [ ] layout.svelte — 14개 로그 삭제
-   [ ] +page.server.ts — 인덱스 2개 로그 삭제
-   [ ] hooks/registry.ts — 6개 로그 삭제
-   [ ] stores/theme.svelte.ts — 5개 로그 삭제
-   [ ] stores/plugin.svelte.ts — 3개 로그 삭제
-   [ ] theme-component-loader.ts — 9개 로그 삭제
-   [ ] plugin-component-loader.ts — 10개 로그 삭제
-   [ ] hooks/plugin-loader.ts — 10개 로그 삭제
-   [ ] hooks/theme-loader.ts — 10개 로그 삭제
-   [ ] components/slot-manager.ts — 6개 로그 삭제
-   [ ] 기타 API 라우트 파일들

## Step 2: Svelte 5 deprecation 수정

-   [ ] 2a: svelte:component → 동적 컴포넌트 (14개)
-   [ ] 2b: slot → @render children() (3개)
-   [ ] 2c: state_referenced_locally (34개) — $state(data.foo) → $derived
-   [ ] 2d: $state() 누락 (3개)
-   [ ] 2e: A11y 경고 수정 (8개)

## Step 3: 보안 이슈 수정

-   [ ] api/layout/+server.ts — PUT 관리자 권한 검증
-   [ ] [boardId]/write/+page.server.ts — JWT 검증 TODO

## Step 4: README.md 업데이트

-   [ ] 전체 재작성

## Step 5: 프로덕션 빌드 검증

-   [ ] pnpm check — 0 errors
-   [ ] pnpm test:unit -- --run — 122+ pass
-   [ ] pnpm build — 성공

## Step 6: 커밋

-   [ ] 모든 변경사항 커밋
