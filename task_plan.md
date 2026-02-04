# Task Plan: Frontend Phase 11 — Plugin Loader & Scanner

## Goal

프론트엔드 플러그인 시스템의 기반인 Plugin Loader & Scanner를 구현하여, plugins/와 custom-plugins/ 디렉토리에서 플러그인을 자동 감지하고 메타데이터를 로딩한다.

## Current Phase

Phase 2: Plugin 매니페스트 스키마 정의

## Phases

### Phase 1: 코드베이스 분석

-   [ ] 기존 테마 스캐너 패턴 분석 (theme-scanner.ts 참고)
-   [ ] 확장 시스템 아키텍처 확인 (extension-system/ 패키지)
-   [ ] Hook 시스템 현황 확인 (@angple/hook-system)
-   [ ] 기존 플러그인 디렉토리 구조 확인 (plugins/, extensions/)
-   [ ] findings.md에 분석 결과 기록
-   **Status:** ✅ complete

### Phase 2: Plugin 매니페스트 스키마 정의

-   [ ] plugin.json / extension.json 스키마 확정
-   [ ] Zod 검증 스키마 작성
-   [ ] TypeScript 타입 정의 (@angple/types)
-   **Status:** pending

### Phase 3: Plugin Scanner 구현

-   [ ] 디렉토리 스캔 로직 (plugins/, custom-plugins/)
-   [ ] 매니페스트 파싱 + 검증
-   [ ] 에러 처리 (잘못된 매니페스트 격리)
-   **Status:** pending

### Phase 4: Plugin Registry 구현

-   [ ] 플러그인 레지스트리 (메모리 + settings.json)
-   [ ] 활성/비활성 상태 관리
-   [ ] SSR 데이터 전달 (+layout.server.ts)
-   **Status:** pending

### Phase 5: Plugin Loader 구현

-   [ ] 플러그인 초기화 생명주기 (scan → load → activate)
-   [ ] Hook 시스템 연동 (플러그인 Hook 자동 등록)
-   [ ] 에러 격리 (한 플러그인 오류가 전체에 영향 X)
-   **Status:** pending

### Phase 6: 테스트 및 정리

-   [ ] 샘플 플러그인으로 동작 검증
-   [ ] 기존 extensions/ 샘플과 호환 확인
-   [ ] plan.md Phase 11 완료 표시
-   **Status:** pending

## Key Questions

1. 테마 스캐너의 어떤 패턴을 재사용할 수 있는가?
2. extension.json vs plugin.json — 어떤 매니페스트를 사용하는가?
3. SSR에서 플러그인 메타데이터를 어떻게 전달하는가?
4. 플러그인 Hook 등록은 서버/클라이언트 어디서 하는가?

## Decisions Made

| Decision | Rationale |
| -------- | --------- |
|          |           |

## Errors Encountered

| Error | Attempt | Resolution |
| ----- | ------- | ---------- |
|       | 1       |            |

## Notes

-   테마 시스템 구현 패턴을 최대한 참고하여 일관성 유지
-   Svelte 5 Rune 모드 필수
-   kebab-case 파일명
-   파일 크기 1000줄 제한
