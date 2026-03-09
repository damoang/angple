# Task Plan: 프로덕션 준비 — console.log 정리 + Svelte 5 수정 + 보안 + README

## 목표
프로덕션 배포 전 필수 이슈 해결: console.log 150개+ 삭제, Svelte 5 deprecation 87개 수정, 보안 이슈, README 업데이트

---

## Step 1: console.log 정리
- [ ] layout.server.ts — SSR 매 요청 3개 로그 삭제
- [ ] layout.svelte — 14개 로그 삭제
- [ ] +page.server.ts — 인덱스 2개 로그 삭제
- [ ] hooks/registry.ts — 6개 로그 삭제
- [ ] stores/theme.svelte.ts — 5개 로그 삭제
- [ ] stores/plugin.svelte.ts — 3개 로그 삭제
- [ ] theme-component-loader.ts — 9개 로그 삭제
- [ ] plugin-component-loader.ts — 10개 로그 삭제
- [ ] hooks/plugin-loader.ts — 10개 로그 삭제
- [ ] hooks/theme-loader.ts — 10개 로그 삭제
- [ ] components/slot-manager.ts — 6개 로그 삭제
- [ ] 기타 API 라우트 파일들

## Step 2: Svelte 5 deprecation 수정
- [ ] 2a: svelte:component → 동적 컴포넌트 (14개)
- [ ] 2b: slot → @render children() (3개)
- [ ] 2c: state_referenced_locally (34개) — $state(data.foo) → $derived
- [ ] 2d: $state() 누락 (3개)
- [ ] 2e: A11y 경고 수정 (8개)

## Step 3: 보안 이슈 수정
- [ ] api/layout/+server.ts — PUT 관리자 권한 검증
- [ ] [boardId]/write/+page.server.ts — JWT 검증 TODO

## Step 4: README.md 업데이트
- [ ] 전체 재작성

## Step 5: 프로덕션 빌드 검증
- [ ] pnpm check — 0 errors
- [ ] pnpm test:unit -- --run — 122+ pass
- [ ] pnpm build — 성공

## Step 6: 커밋
- [ ] 모든 변경사항 커밋
