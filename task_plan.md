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
