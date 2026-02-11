# 발견 사항 (Findings)

## 1. ASIS 컨텐츠 변환 시스템 구조

### 처리 레이어 (이중 구조)

```
사용자 입력 (게시글/댓글)
    ↓
[PHP 백엔드] na_content() - 서버사이드 변환
    ├── na_url_auto_link()     - <a> 태그 내 URL 처리
    ├── {첨부:ID}              - 첨부파일
    ├── {지도:좌표}            - 구글맵
    ├── {동영상:URL}           - 동영상 iframe
    ├── {아이콘:이름}          - FA 아이콘
    ├── {이모티콘:파일:크기}   - 이모티콘 이미지
    ├── [soundcloud...]        - SoundCloud
    └── [code]...[/code]       - 코드 하이라이팅
    ↓
[JS 프론트엔드] jQuery.naGnuView() - 클라이언트사이드 변환
    ├── youtube()              - YouTube 일반
    ├── youtubeS()             - YouTube Shorts
    ├── instargram()           - Instagram (함수명 오타 있음)
    ├── KakaoPot()             - Kakao TV
    ├── Twitter()              - Twitter/X
    ├── Bluesky()              - Bluesky (async, API 호출)
    ├── Reddit()               - Reddit (async)
    ├── Vimeo()                - Vimeo
    └── Dailymotion()          - Dailymotion
```

### 숏코드 Regex 패턴

```
동영상:  /{(동영상|video)\:([^}]*)}/is
이모티콘: /{(이모티콘|emo)\:([^}]*)}/is
첨부:    /{(첨부|attach)\:([^}]*)}/is
지도:    /{(지도|map)\:([^}]*)}/is
아이콘:  /{(아이콘|icon)\:([^}]*)}/is
이미지:  /{(이미지|img)\:([^}]*)}/is
```

### 자동 임베드 Regex 패턴

| 플랫폼         | Regex                                                                                                     | 소스          |
| -------------- | --------------------------------------------------------------------------------------------------------- | ------------- |
| YouTube        | `%(?:youtube(?:-nocookie)?\.com/(?:[^/]+/.+/\|(?:v\|e(?:mbed)?)/\|.*[?&]v=)\|youtu\.be/)([^"&?/ ]{11})%i` | video.lib.php |
| YouTube Shorts | `/\/shorts\//i`                                                                                           | video.lib.php |
| Instagram      | `/https?:\/\/(www\.)?instagram.com\/(p\|reels)\/([a-zA-Z0-9\-_?=&]+)/gi`                                  | nariya.js     |
| Twitter/X      | `/http(s)?:\/\/(.*\.)?(twitter\|x)\.com\/(\w+)\/?status\/(\w+)/gi`                                        | nariya.js     |
| Reddit         | `/http(s)?:\/\/(www\.)?reddit.com\/(r\|user)\/([\w:\.]{2,21})\/comments\/(\w{5,9})\/([\w%\\\-]+)?/gm`     | nariya.js     |
| Bluesky        | `/http(s):\/\/bsky\.app\/profile\/([^/]+)\/post\/(\w+)/gi`                                                | nariya.js     |
| Vimeo          | `/(https?:\/\/\|www\.)vimeo.com\/([A-Za-z0-9]+)/gi`                                                       | nariya.js     |
| Dailymotion    | `/(https?:\/\/www\.)dailymotion.com\/video\/([A-Za-z0-9]+)/gi`                                            | nariya.js     |
| Kakao TV       | `/(http(s)?:\/\/\|www\.)tv.kakao.com\/(v\|l\|channel\/[0-9]+\/(livelink\|cliplink))\/([A-Za-z0-9]+)/gi`   | nariya.js     |

## 2. Angple 기존 구현 현황

### 이미 inline으로 구현된 기능

| 기능          | 파일                   | 함수                     | 적용 대상     |
| ------------- | ---------------------- | ------------------------ | ------------- |
| 이모티콘      | `content-transform.ts` | `transformEmoticons()`   | 게시글 + 댓글 |
| 브라켓 이미지 | `auto-embed/index.ts`  | `processBracketImages()` | 댓글만        |
| URL 임베드    | `auto-embed/index.ts`  | `processEmbeds()`        | 게시글 + 댓글 |

### 지원 플랫폼 (기존 Angple inline)

-   YouTube (일반 + Shorts)
-   Vimeo
-   Instagram
-   Twitter/X
-   Twitch
-   TikTok

### 미지원 (ASIS에는 있음)

-   Reddit
-   Bluesky
-   Dailymotion
-   Kakao TV
-   SoundCloud
-   Facebook Video
-   `{video:URL}` 숏코드 형식
-   `[img URL]` / `[link URL]` 숏코드 형식

## 3. 훅 시스템 연결 상태

### ⚠️ 핵심 발견: 훅이 렌더링에 연결되지 않음

```
현재 상태:
  markdown.svelte    → transformEmoticons() → marked.parse() → processEmbeds() → DOMPurify
  comment-list.svelte → transformEmoticons() → processBracketImages() → processEmbeds() → DOMPurify

필요한 상태:
  markdown.svelte    → applyFilter('post_content', html) → DOMPurify
  comment-list.svelte → applyFilter('comment_content', html) → DOMPurify
```

**결정 필요**: 기존 inline 코드를 제거하고 플러그인으로 대체할지, 플러그인이 추가 기능만 담당할지

## 4. 플러그인 구조 레퍼런스 (emoticon 플러그인)

```
plugins/emoticon/
├── plugin.json                     # 매니페스트
├── hooks/
│   ├── emoticon-content-filter.ts  # export default function(content: string): string
│   └── emoticon-comment-filter.ts  # export default function(content: string): string
├── lib/
│   ├── types.ts                    # TypeScript 인터페이스
│   ├── api.ts                      # API 클라이언트
│   └── parser.ts                   # 핵심 파싱 로직
└── components/
    ├── emoticon-image.svelte       # 이모티콘 이미지 컴포넌트
    └── emoticon-picker.svelte      # 이모티콘 선택기
```

### 필터 훅 콜백 패턴

```typescript
// hooks/xxx-content-filter.ts
export default function filterName(content: string): string {
    if (!content) return content;
    return transformFunction(content);
}
```

## 5. 외부 스크립트 의존성

| 플랫폼    | 스크립트 URL                        | 로딩 방식   |
| --------- | ----------------------------------- | ----------- |
| Instagram | `//www.instagram.com/embed.js`      | async defer |
| Twitter/X | `//platform.twitter.com/widgets.js` | async       |
| Reddit    | `//embed.reddit.com/widgets.js`     | async       |
| Bluesky   | `//embed.bsky.app/static/embed.js`  | async       |

**주의**: SvelteKit SSR 환경에서 외부 스크립트 로딩은 클라이언트 사이드에서만 가능

## 6. 보안 고려사항

### ASIS ShortcodeHelper 보안 조치

-   URL 검증: `filter_var(FILTER_VALIDATE_URL)`
-   쿼리스트링 차단: `?`, `#` 포함 URL 거부
-   확장자 화이트리스트: gif, jpeg, jpg, png, svg, webp
-   단축 URL 필터링: bit.ly, tinyurl 등
-   CDN 호스트 치환: `replaceCdnHost()`

### Angple에서 적용할 보안

-   DOMPurify로 최종 sanitize
-   URL 검증 (new URL() 사용)
-   경로 탐색 방지 (.., /, \ 차단)
-   iframe src 화이트리스트 (youtube.com, vimeo.com 등만 허용)

## 7. 임베드 출력 형식

### YouTube 일반 (16:9)

```html
<div class="ratio ratio-16x9">
    <iframe
        src="//www.youtube.com/embed/{CODE}"
        frameborder="0"
        width="640"
        height="360"
        allowfullscreen
    ></iframe>
</div>
```

### YouTube Shorts (9:16)

```html
<div class="ratio" style="--bs-aspect-ratio: 177.78%; max-width: 360px">
    <iframe
        src="//www.youtube.com/embed/{CODE}"
        frameborder="0"
        width="360"
        height="640"
        allowfullscreen
    ></iframe>
</div>
```

### Instagram

```html
<blockquote
    class="instagram-media"
    data-instgrm-captioned
    data-instgrm-permalink="https://www.instagram.com/{TYPE}/{CODE}"
    data-instgrm-version="14"
></blockquote>
<script async defer src="//www.instagram.com/embed.js"></script>
```

### Twitter/X

```html
<blockquote class="twitter-tweet" data-lang="ko">
    <a href="//twitter.com/{USER}/status/{ID}"></a>
</blockquote>
<script async src="//platform.twitter.com/widgets.js"></script>
```

### Reddit

```html
<blockquote class="reddit-embed-bq" style="height:500px" data-embed-height="740">
    <a href="{POST_URL}">레딧 포스트 로딩중</a>
</blockquote>
<script async src="//embed.reddit.com/widgets.js"></script>
```

### Bluesky

```html
<blockquote class="bluesky-embed" data-bluesky-uri="{URI}" data-bluesky-cid="{CID}">
    <p>{text}</p>
    <a href="https://bsky.app/profile/{DID}/post/{ID}">View Post</a>
</blockquote>
<script async src="//embed.bsky.app/static/embed.js"></script>
```

## 8. Admin 플러그인 페이지 구조

-   **경로**: `/admin/plugins`
-   **파일**: `apps/web/src/routes/admin/plugins/+page.svelte`
-   **두 탭**: Frontend (파일 기반) / Backend (API 기반)
-   **플러그인 카드**: 이름, 버전, 상태 배지, 태그, 통계, 액션 버튼
-   **설정 페이지**: `/admin/plugins/{id}/settings` - plugin.json의 settings 스키마로 자동 생성
-   **활성화 상태**: `data/plugin-settings.json`에 저장

## 9. DOMPurify 허용 태그 (현재)

### 게시글 (markdown.svelte)

```
h1-h6, p, a, strong, em, ul, ol, li, blockquote, pre, code,
img, video, source, iframe, br, hr, table, thead, tbody, tr, th, td,
div, span, sup, sub, del, s, details, summary, figure, figcaption, picture
```

### 댓글 (comment-list.svelte)

```
img, br, div, iframe, video, audio, source
```

**주의**: 댓글의 DOMPurify 설정이 제한적 → blockquote 태그 허용 필요 (Instagram, Twitter 임베드용)
