# Board Layout System - Findings

## 1. 현재 구현 분석

### PHP 레거시 (Nariya 스킨)

-   설정 위치: `/data/nariya/board/board-{TABLE}-{DEVICE}.php`
-   목록 스킨 10종, 본문 스킨 5종
-   124/141 게시판이 `list` (compact) 사용
-   기능+레이아웃 혼합 (분리 안 됨)

### Go 백엔드 현재

-   `BoardDisplaySettings`: bo_1(Extra1) JSON 필드
-   현재: `list_style` (compact|card|detailed), `show_preview`, `preview_length`, `show_thumbnail`
-   `Skin`, `MobileSkin` 필드 존재하나 미활용

### Angple 프론트엔드 현재

-   3개 목록 스킨: `skins/compact.svelte`, `skins/card.svelte`, `skins/detailed.svelte`
-   `[boardId]/+page.svelte`에서 `skinComponents[listStyle]`로 동적 선택
-   Props 인터페이스: `{post: FreePost, displaySettings?: BoardDisplaySettings, onclick: () => void}`

### Admin 현재

-   `/boards/[boardId]/view-settings` 존재 (5개 모드: list, card, gallery, compact, timeline)
-   API 연동 TODO 상태
-   게시판 목록/생성 관리 페이지 없음

## 2. 플랫폼 비교 연구

| 플랫폼    | 명칭                     | 특징                                       |
| --------- | ------------------------ | ------------------------------------------ |
| Reddit    | View Mode                | Card/Classic/Compact — 사용자 선택         |
| Facebook  | Group Type               | 기능적 차이                                |
| XenForo   | Forum Type + Thread Type | 2축 시스템                                 |
| Discourse | Category Page Style      | 카테고리별 오버라이드                      |
| WordPress | Template Hierarchy       | Plugin > Child Theme > Parent Theme > Core |

## 3. PHP 스킨 → Angple 레이아웃 매핑

| PHP list_skin | 사용수 | → Angple list_layout        |
| ------------- | ------ | --------------------------- |
| list          | 124    | compact                     |
| plyr-gallery  | 5      | gallery                     |
| s3-gallery    | 4      | gallery                     |
| webzine       | 3      | webzine                     |
| gallery       | 1      | gallery                     |
| giving        | 1      | card (→ 추후 board_type)    |
| disciplinelog | 1      | compact (→ 추후 board_type) |
| angtt         | 1      | compact (→ 추후 board_type) |
| map           | 1      | compact (→ 추후 별도)       |
| message       | 1      | compact (→ 추후 별도)       |

## 4. WordPress Template Hierarchy 참고

```
WordPress:
  Plugin Template > Child Theme > Parent Theme > Core Template

Angple 적용:
  Plugin Layout > Theme Layout > Core Layout

  Resolution: layoutRegistry.resolve('gallery')
    1. 플러그인이 등록한 'gallery' 있으면 → 사용
    2. 활성 테마가 등록한 'gallery' 있으면 → 사용
    3. 코어 'gallery' → 사용
    4. 없으면 → 코어 'compact' 폴백
```
