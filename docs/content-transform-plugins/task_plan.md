# 컨텐츠 변환 플러그인 개발

## 목표

ASIS(그누보드5/나리야) 시스템의 컨텐츠 변환 기능을 Angple 플러그인 2개로 구현하여 `/admin/plugins`에서 관리 가능하게 함

## 플러그인 목록

### 플러그인 1: `bracket-image` (숏코드 변환)

| 기능   | 입력                           | 출력                    |
| ------ | ------------------------------ | ----------------------- |
| 이미지 | `[img URL]` / `[image URL]`    | `<img src="URL" />`     |
| 링크   | `[link URL]` / `[a URL]`       | `<a href="URL">URL</a>` |
| 동영상 | `{video:URL}` / `{동영상:URL}` | 플랫폼별 iframe 임베드  |

### 플러그인 2: `auto-embed` (자동 임베드)

| 플랫폼      | URL 패턴                              | 출력                    |
| ----------- | ------------------------------------- | ----------------------- |
| YouTube     | youtu.be, youtube.com/watch, /shorts/ | iframe 16:9 / 9:16      |
| Instagram   | instagram.com/p/, /reels/             | blockquote + embed.js   |
| Twitter/X   | twitter.com/status, x.com/status      | blockquote + widgets.js |
| Reddit      | reddit.com/r/.../comments/            | blockquote + widgets.js |
| Bluesky     | bsky.app/profile/.../post/            | blockquote + embed.js   |
| Vimeo       | vimeo.com/ID                          | iframe 16:9             |
| Dailymotion | dailymotion.com/video/                | iframe 16:9             |
| Kakao TV    | tv.kakao.com/v/                       | iframe 16:9             |

## 체크리스트

### Phase 0: 사전 작업

-   [ ] 훅 시스템이 컨텐츠 렌더링에 연결되어 있는지 확인
    -   현재 `applyFilter('post_content', ...)` 가 markdown.svelte에서 호출되지 않음
    -   comment-list.svelte에서도 호출되지 않음
    -   **주의**: 기존 코드에 이미 inline으로 구현된 부분이 있음 (processEmbeds, processBracketImages, transformEmoticons)
    -   이것을 훅 시스템으로 전환할지, 플러그인이 별도로 처리할지 결정 필요

### Phase 1: `bracket-image` 플러그인

-   [ ] `plugins/bracket-image/plugin.json` 매니페스트 작성
-   [ ] `plugins/bracket-image/lib/parser.ts` - 숏코드 파싱 로직
    -   `[img URL]` → `<img>` 변환
    -   `[link URL]` → `<a>` 변환
    -   URL 검증 (filter_var 대응)
    -   확장자 화이트리스트 (gif, jpg, jpeg, png, svg, webp)
    -   경로 탐색 방지 (?, #, ..)
-   [ ] `plugins/bracket-image/lib/video-parser.ts` - 동영상 숏코드 파싱
    -   `{video:URL}` / `{동영상:URL}` 패턴 감지
    -   플랫폼별 iframe 생성 (YouTube, Vimeo 등)
    -   옵션 지원: `{video:URL|start=10}`
-   [ ] `plugins/bracket-image/hooks/content-filter.ts` - post_content 필터
-   [ ] `plugins/bracket-image/hooks/comment-filter.ts` - comment_content 필터
-   [ ] `/admin/plugins`에서 활성화/비활성화 확인

### Phase 2: `auto-embed` 플러그인

-   [ ] `plugins/auto-embed/plugin.json` 매니페스트 작성
-   [ ] `plugins/auto-embed/lib/platforms/` - 플랫폼별 임베더
    -   `youtube.ts` - YouTube (일반 + Shorts + Live)
    -   `instagram.ts` - Instagram (Posts + Reels)
    -   `twitter.ts` - Twitter/X
    -   `reddit.ts` - Reddit
    -   `bluesky.ts` - Bluesky (API 호출 필요)
    -   `vimeo.ts` - Vimeo
    -   `dailymotion.ts` - Dailymotion
    -   `kakao-tv.ts` - Kakao TV
-   [ ] `plugins/auto-embed/lib/embed-engine.ts` - 메인 임베드 엔진
    -   bare URL 감지 (기존 `<a>` 태그 내부 URL)
    -   플랫폼 매칭 및 iframe/blockquote 생성
-   [ ] `plugins/auto-embed/hooks/content-filter.ts` - post_content 필터 (priority: 10)
-   [ ] `plugins/auto-embed/hooks/comment-filter.ts` - comment_content 필터 (priority: 10)
-   [ ] 외부 스크립트 로딩 처리 (Instagram embed.js, Twitter widgets.js 등)
-   [ ] `/admin/plugins`에서 활성화/비활성화 확인

### Phase 3: 기존 inline 코드 정리

-   [ ] `content-transform.ts`의 `transformEmoticons()` → emoticon 플러그인과 중복 확인
-   [ ] `auto-embed/index.ts`의 `processEmbeds()` → auto-embed 플러그인과 중복 확인
-   [ ] `processBracketImages()` → bracket-image 플러그인과 중복 확인
-   [ ] comment-list.svelte의 `renderCommentContent()` 정리
-   [ ] markdown.svelte의 inline 변환 정리

### Phase 4: 테스트

-   [ ] 게시글 본문에 숏코드 테스트 (`[img ...]`, `{video:...}`)
-   [ ] 댓글에 URL 자동 임베드 테스트
-   [ ] YouTube Shorts (9:16 비율) 렌더링 확인
-   [ ] 플러그인 비활성화 시 원본 텍스트 유지 확인
-   [ ] XSS 방어 테스트 (악의적 URL)

## 관련 파일

### 수정 대상

-   `apps/web/src/lib/components/ui/markdown/markdown.svelte` - 훅 연결
-   `apps/web/src/lib/components/features/board/comment-list.svelte` - 훅 연결

### 참조 (ASIS 소스)

-   `/home/damoang/www/lib/damoang/src/Helper/ShortcodeHelper.php` - 숏코드 파서
-   `/home/damoang/www/plugin/nariya/lib/video.lib.php` - 동영상 임베드
-   `/home/damoang/www/plugin/nariya/lib/content.lib.php` - 컨텐츠 처리
-   `/home/damoang/www/theme/damoang/js/nariya.js` - 프론트엔드 임베드

### 참조 (Angple 기존)

-   `plugins/emoticon/` - 플러그인 구조 레퍼런스
-   `apps/web/src/lib/hooks/registry.ts` - 훅 시스템
-   `apps/web/src/lib/hooks/plugin-loader.ts` - 플러그인 로더
-   `apps/web/src/lib/plugins/auto-embed/index.ts` - 기존 임베드 코드
-   `apps/web/src/lib/utils/content-transform.ts` - 기존 변환 코드

## 의존성

-   emoticon 플러그인 패턴 (`plugins/emoticon/`)
-   훅 시스템 (`@angple/hook-system`)
-   DOMPurify (보안 필터링)
-   외부: Instagram embed.js, Twitter widgets.js, Reddit widgets.js, Bluesky embed.js

## 우선순위 (Hook Priority)

| 플러그인      | Priority | 이유                                 |
| ------------- | -------- | ------------------------------------ |
| emoticon      | 5        | 이모티콘이 먼저 (단순 치환)          |
| bracket-image | 7        | 숏코드 다음 (명시적 변환)            |
| auto-embed    | 10       | URL 자동 임베드는 마지막 (오탐 방지) |
