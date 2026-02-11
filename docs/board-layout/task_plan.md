# Board Layout System - Task Plan

## 목표

게시판별 목록/본문 표시 방식을 설정할 수 있는 레이아웃 시스템 구축.
WordPress의 Template Hierarchy처럼 확장 가능한 구조.

## 핵심 설계 원칙

-   **Layout Registry Pattern**: 코어/테마/플러그인이 레이아웃을 등록
-   **Resolution Order**: Plugin > Theme > Core (WordPress template hierarchy와 동일)
-   **Props Contract**: 모든 레이아웃이 동일한 인터페이스 준수
-   **Layout Manifest**: 각 레이아웃의 메타데이터 (이름, 설명, 미리보기 이미지)

## 구현 체크리스트

### Phase 1: 코어 인프라

-   [x] 1. Layout Registry 설계 및 구현
    -   [x] `LayoutRegistry` 클래스 (싱글톤)
    -   [x] `registerList()`, `registerView()` 함수
    -   [x] `resolveList()`, `resolveView()` resolver 함수 (Plugin > Theme > Core)
    -   [x] Layout Manifest 타입 정의
-   [x] 2. 타입 정의 확장
    -   [x] Frontend: ListLayout, ViewLayout, LayoutManifest 타입
    -   [x] Backend: BoardDisplaySettings에 list_layout, view_layout 추가 + 마이그레이션
-   [x] 3. 코어 목록 레이아웃 (5종)
    -   [x] compact (기존 skins/compact.svelte 이동)
    -   [x] card (기존 skins/card.svelte 이동)
    -   [x] detailed (기존 skins/detailed.svelte 이동)
    -   [x] gallery (신규)
    -   [x] webzine (신규)
-   [ ] 4. 코어 본문 레이아웃 (1종) — Phase 2로 연기
    -   [ ] basic (기존 [postId]/+page.svelte 본문 부분)
-   [x] 5. [boardId]/+page.svelte 통합
    -   [x] LayoutRegistry에서 컴포넌트 resolve
    -   [x] 레이아웃별 래퍼 CSS (gallery=grid, 나머지=stack)
-   [x] 6. 빌드 성공 + dev.damoang.net 배포

### Phase 2: 관리자 연동

-   [x] 6. v2_board_display_settings 별도 테이블 + API 엔드포인트
-   [x] 7. Admin view-settings 페이지 API 연동 (GET/PUT)
-   [ ] 8. 레이아웃 미리보기 썸네일

### Phase 3: 테마/플러그인 확장 (추후)

-   [ ] 8. 테마에서 커스텀 레이아웃 등록
-   [ ] 9. 플러그인에서 커스텀 레이아웃 등록

## 결정 사항

| 결정            | 선택             | 이유                                    |
| --------------- | ---------------- | --------------------------------------- |
| 명칭            | "Board Layout"   | 스킨은 PHP 레거시, Layout이 국제적 표준 |
| 저장 위치       | DB (bo_1 JSON)   | SaaS에서 파일 기반 설정은 부적절        |
| 레지스트리 패턴 | Hook System 연동 | 기존 @angple/hook-system 활용           |
| 폴백            | compact          | 가장 범용적, 데이터 요구사항 최소       |
