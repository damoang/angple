# Board Layout System - Progress

## 작업 기록

### 2026-02-08: 연구 및 설계 완료
- [x] PHP Nariya 스킨 시스템 분석
- [x] 주요 플랫폼 비교 연구 (Reddit, Facebook, Discourse, XenForo)
- [x] 명칭 결정: "Board Layout"
- [x] 2축 아키텍처 설계 (Board Layout + Board Type)
- [x] 기존 Admin view-settings 페이지 발견
- [x] Task Manager에 태스크 6개 생성

### 2026-02-08: 구현 완료
- [x] Layout Registry 구현 (Plugin > Theme > Core 우선순위)
- [x] 타입 정의 확장 (TS: ListLayout, ViewLayout + Go: list_layout, view_layout)
- [x] 코어 목록 레이아웃 5종 (compact, card, detailed, gallery, webzine)
- [x] [boardId]/+page.svelte 통합 (레이아웃별 래퍼 클래스)
- [x] Go 백엔드 빌드 성공
- [x] pnpm build 성공
- [x] pnpm check 통과 (googletag 기존 에러만 남음)

### 2026-02-08: 별도 테이블 + API + Admin 연동
- [x] `v2_board_display_settings` 테이블 생성 (RDS)
- [x] Go 도메인 모델 (`board_display_settings.go`)
- [x] Repository 메서드 (`FindDisplaySettings`, `SaveDisplaySettings`)
- [x] Service 메서드 (`GetBoardDisplaySettings`, `SaveBoardDisplaySettings`)
- [x] Handler 메서드 (`GetDisplaySettings`, `UpdateDisplaySettings`)
- [x] API 엔드포인트 등록 (GET/PUT `/api/v1/boards/:board_id/display-settings`)
- [x] `board_handler.go` GetBoard 응답에 v2 테이블 설정 적용
- [x] Admin API 클라이언트 (`board-display-settings.ts`)
- [x] Admin view-settings 페이지 전면 개편 (레이아웃 5종 + 표시 옵션)
- [x] Admin 빌드 성공 + Web 빌드 성공

## 에러/실패 기록

### card.svelte memo-badge 경로 깨짐
- **원인**: skins/ → layouts/list/로 1단계 더 깊은 곳으로 이동 시 상대경로 불일치
- **해결**: `../../../../../../../../` → `../../../../../../../../../` (1단계 추가)

## 주의사항
- `apps/web/src/lib/plugins/auto-embed/embedder.ts`는 빌드에 사용되지 않음
  → 실제 빌드 파일: `plugins/auto-embed/lib/embed-engine.ts`
  → 경로 확인 필수!
- skins/ 파일 이동 시 import 경로 깨질 수 있음 → re-export 필수
