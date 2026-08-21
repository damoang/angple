/**
 * 콘텐츠 변환 유틸리티
 * {emo:filename:size} 또는 {이모티콘:filename:size} 패턴을 <img> 태그로 변환
 * {video: URL} 또는 {동영상: URL} 패턴을 <video>/<iframe> 태그로 변환
 * <oembed url="..."> (CKEditor5 미디어 삽입) → 임베드 플레이어 변환
 */

import { embedUrl } from '$lib/plugins/auto-embed';

const EMOTICON_PATTERN = /\{(이모티콘|emo):([^}]*)\}/gi;
const VIDEO_PATTERN = /\{(동영상|video)\s*:\s*([\s\S]*?)\}/gi;
const CODE_BLOCK_PATTERN = /\[code(?:=([a-zA-Z0-9_+-]+))?\]([\s\S]*?)\[\/code\]/gi;
const BACKTICK_CODE_BLOCK_PATTERN = /```([a-zA-Z0-9_+-]*)(?:\n|<br\s*\/?>)([\s\S]*?)```/gi;
const INLINE_CODE_PATTERN = /`([^`\n]+)`/g;
const SPOILER_PATTERN = /\[spoiler(?:=([^\]]*))?\]([\s\S]*?)\[\/spoiler\]/gi;
const MAX_WIDTH = 200;
const DEFAULT_WIDTH = 50;
const ALLOWED_EXTENSIONS = ['.gif', '.png', '.jpg', '.jpeg', '.webp'];

/**
 * 팩별 기본 표시 폭(px). 접두사가 일치하면 DEFAULT_WIDTH 대신 이 값을 쓴다.
 *
 * 왜 필요한가 (bug#13145, 2026-07-29 실측):
 *   기본 50px 은 정사각형 인라인 이모지에 맞춘 값인데 '밈' 팩은 성격이 다르다.
 *
 *     팩              개수  원본폭 중앙  세로비(h/w)   폭200 렌더높이
 *     damoang-emo      54       60      0.68~1.22   중앙 200 / 최대 245
 *     damoang-meme     49      282      0.12~1.79   중앙 175 / 최대 358
 *     onion           264       50      0.98~1.11   중앙 200 / 최대 222
 *
 *   밈은 원본 중앙값이 282px 인 '그림'이다. 최대 damoang-meme-051.gif 은
 *   2668x1740 인데 폭 50 으로 찍으면 50x33px 이 되어 내용을 알아볼 수 없다.
 *   제보자가 지목한 파일들이 정확히 이 팩이었다.
 *
 * ⛔ 이 값은 MAX_WIDTH(200)와 같다. 즉 밈은 기본이 곧 상한이라 회원은
 *    {emo:파일:80} 처럼 줄일 수만 있고 키울 수는 없다. 의도한 것이다 —
 *    댓글 목록이 밈 하나로 밀려나는 것을 막는다. 더 키워야 한다는 요구가
 *    실제로 나오면 MAX_WIDTH 를 팩별로 나누는 게 다음 수순이다.
 *
 * ⛔ 기존 글에 소급 적용된다. 저장된 본문은 {emo:...} 숏코드 그대로이고
 *    폭은 렌더 시점에 정해지기 때문이다. 데이터 마이그레이션은 없지만
 *    이미 올라간 글의 밈 크기가 한꺼번에 바뀐다(2026-07 자유게시판 기준
 *    이모티콘 사용 글 3,547건 중 크기를 직접 지정한 글은 4건뿐이었다).
 */
/**
 * 2026-08-04 추가 — 원본이 큰데 50px 로 찍히던 팩들.
 *
 * ⛔ **일괄 상향(DEFAULT_WIDTH 50 → 80)은 실측으로 기각했다.** 원본이 작은 팩이 있어
 *    키우면 확대되어 뭉개진다. 팩별 원본 폭 중앙값(2026-08-04, 운영 파일 실측):
 *
 *      팩                개수   원본폭 중앙   판정
 *      onion             264        50 px    ⛔ 그대로 둔다. 50px 표시가 이미 1:1 이다
 *      DINKIssTyle-face   12        64 px    ⛔ 여유 없음
 *      DINKIssTyle-*      33~      128 px    ⛔ 여유 작음
 *      damoang-emo        90       223 px    → 80
 *      damoang-sol        10       360 px    → 100
 *      moon-emo           31       360 px    → 100
 *      president          15       500 px    → 100
 *      lee-president       5       560 px    → 100
 *
 *    `onion` 은 가장 큰 팩(264개)인데 원본이 50px 다. 80px 로 올리면 1.6배 확대라
 *    계단이 보인다. 파일을 키울 방법도 없다 — 원본이 그 크기다.
 *
 * ⛔ 접두사는 **소문자**여야 한다. defaultWidthFor 가 파일명을 lower 로 바꿔 비교한다.
 *    대문자로 적으면 규칙이 조용히 죽는다(예: 'DINKIssTyle-' 은 절대 안 걸린다).
 *
 * ⛔ 접두사 끝의 하이픈을 빼지 말 것. 'president-' 를 'president' 로 적으면
 *    같은 값이라 무해하지만, 반대로 'lee-president-' 를 빠뜨리면 그 팩은 50px 로 남는다
 *    ('president-' 는 'lee-president-001' 을 잡지 못한다 — startsWith 이다).
 *
 * ⛔ 기존 글에 소급 적용된다(아래 damoang-meme 항목의 설명과 같은 이유).
 */
const PACK_DEFAULT_WIDTH: ReadonlyArray<readonly [string, number]> = [
    ['damoang-meme-', 200],
    ['moon-emo-', 100],
    ['lee-president-', 100],
    ['president-', 100],
    ['damoang-sol-', 100],
    ['damoang-emo-', 80]
];

/**
 * 파일명이 속한 팩의 기본 표시 폭을 반환. 일치하는 팩이 없으면 DEFAULT_WIDTH.
 */
function defaultWidthFor(filename: string): number {
    const lower = filename.toLowerCase();
    for (const [prefix, width] of PACK_DEFAULT_WIDTH) {
        if (lower.startsWith(prefix)) return width;
    }
    return DEFAULT_WIDTH;
}

/**
 * 파일명이 허용된 이미지 확장자를 가지는지 확인
 */
function isValidFilename(filename: string): boolean {
    if (!filename || filename.length > 200) return false;
    // 경로 탐색 방지
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return false;
    // null byte 방지
    if (filename.includes('\0')) return false;
    // 허용된 확장자 확인
    const lower = filename.toLowerCase();
    return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * 이모티콘 패턴을 <img> 태그로 변환
 */
export function transformEmoticons(text: string): string {
    if (!text || !text.includes('{')) return text;

    return text.replace(EMOTICON_PATTERN, (_match, _type: string, params: string) => {
        const parts = params.split(':');
        const filename = parts[0]?.trim();
        let width = parseInt(parts[1]?.trim() || '', 10);

        if (!filename || !isValidFilename(filename)) {
            return '😀'; // fallback 이모지
        }

        // 팩별 기본값은 파일명 검증을 통과한 뒤에 구한다.
        if (isNaN(width) || width <= 0) {
            width = defaultWidthFor(filename);
        }
        if (width > MAX_WIDTH) {
            width = MAX_WIDTH;
        }

        return `<img src="/emoticons/${filename}" width="${width}" alt="이모티콘" loading="lazy" class="emoticon-inline">`;
    });
}

/**
 * {video: URL} / {동영상: URL} 패턴을 동영상 플레이어로 변환
 * 레거시 PHP(나리야) na_content() 호환
 */
/**
 * 대괄호 이미지 패턴을 <img> 태그로 변환
 * [https://example.com/image.jpg] → <img src="...">
 * 그누보드/나리야 PHP 호환
 */
export function transformBracketImages(text: string): string {
    if (!text || !text.includes('[')) return text;

    const imgTag = (url: string) =>
        `<img src="${url}" alt="이미지" loading="lazy" class="bracket-image" style="max-width:100%;height:auto;">`;

    // ① 순수 대괄호: [https://…/x.gif]
    let out = text.replace(
        /\[(https?:\/\/[^\]]+\.(?:jpg|jpeg|png|gif|webp|bmp|svg)(?:\?[^\]]*)?)\]/gi,
        (_match, url: string) => imgTag(url)
    );

    // ② 자동링크로 감싸진 대괄호: [<a href="https://…/x.gif" …>…</a>]
    //
    // GIF 피커는 `[${url}]` 로 넣는데(tenor-gif-picker.svelte), #12439 에서 댓글
    // 자동 링크 시각 표시를 강제하면서 tiptap Link 확장이 URL 을 먼저 <a> 로 감싼다.
    // 그러면 ①의 정규식이 매칭되지 않아 대괄호만 남고 이미지가 뜨지 않는다.
    //   저장 형태: <p>[<a href="…gif" data-comment-autolink="true">https://…</a>]</p>
    // 삽입 쪽을 바꾸지 않고 여기서 흡수하면, 이미 저장된 댓글도 함께 살아난다.
    out = out.replace(
        /\[\s*<a\b[^>]*\shref="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp|bmp|svg)(?:\?[^"]*)?)"[^>]*>.*?<\/a>\s*\]/gi,
        (_match, url: string) => imgTag(url)
    );

    return out;
}

/**
 * 유튜브 URL 판정 공통 규칙 — watch / embed / shorts / live / youtu.be, 11자 videoId
 * transformVideos · transformStandaloneYoutubeLinks · extractVideosFromContent(json-ld)가 공유
 */
export const YOUTUBE_URL_ID_PATTERN =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/**
 * "단독 문단 앵커" 공통 패턴 — <p> 안에 공백/&nbsp;/<br> 외에 앵커 하나만 있는 경우.
 * 문장 속 인라인 링크는 매치되지 않는다. 캡처 그룹 1 = href.
 * transformStandaloneYoutubeLinks 와 extractVideosFromContent(json-ld)가 동일 규칙을 사용한다.
 */
export const STANDALONE_ANCHOR_PARAGRAPH_SOURCE = String.raw`<p(?:\s[^>]*)?>(?:\s|&nbsp;|<br\s*/?>)*<a\s[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>[^<]*</a>(?:\s|&nbsp;|<br\s*/?>)*</p>`;

/**
 * 유튜브 URL → 임베드 플레이어 HTML 공통 헬퍼
 * - youtube-nocookie embed, t= → start=, list= 유지, shorts 세로 비율(177.78%)
 * - 유튜브 URL이 아니면 null (출력에는 검증된 videoId·숫자 start·[\w-] list만 삽입되므로 XSS 안전)
 */
export function youtubeUrlToEmbedHtml(url: string): string | null {
    const ytMatch = url.match(YOUTUBE_URL_ID_PATTERN);
    if (!ytMatch) return null;
    const isShorts = url.includes('/shorts/');
    let embedSrc = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
    const embedParams: string[] = [];
    const timeMatch = url.match(/[?&]t=(\d+)/);
    if (timeMatch) embedParams.push(`start=${timeMatch[1]}`);
    const listMatch = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (listMatch) embedParams.push(`list=${listMatch[1]}`);
    if (embedParams.length > 0) embedSrc += '?' + embedParams.join('&');
    const platform = isShorts ? 'youtube-shorts' : 'youtube';
    const aspectRatio = isShorts ? '177.78%' : '56.25%';
    const maxWidth = isShorts ? '400px' : '560px';
    return `<div class="embed-container" data-platform="${platform}" style="--aspect-ratio: ${aspectRatio}; --max-width: ${maxWidth};"><iframe src="${embedSrc}" frameborder="0" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe></div>`;
}

/**
 * 본문 단독 유튜브 링크 자동 임베드 복원
 *
 * 배경: 구 그누보드(나리야)는 본문에 맨 유튜브 링크만 쓰면 자동으로 플레이어로
 * 바꿔줬는데, 신규 변환기는 {video} 마커·oembed 만 처리해 옛 글 수천 개의
 * 동영상이 링크로만 남았다 → GSC "동영상이 보기 페이지에 없음" 1,000건+.
 *
 * 보수적 규칙 (전 글에 적용되는 경로라 오탐 제로가 목표):
 * - "단독 문단"만 변환: <p> 안에 공백/&nbsp;/<br> 외에 유튜브 앵커 하나만 있는 경우
 * - 문장 속 인라인 링크는 절대 건드리지 않음
 * - 앵커 텍스트가 URL이 아닌 제목 텍스트여도 단독 문단이면 임베드
 * - href가 유튜브가 아니면 무변
 */
export function transformStandaloneYoutubeLinks(html: string): string {
    if (!html || !html.includes('youtu')) return html;

    return html.replace(
        new RegExp(STANDALONE_ANCHOR_PARAGRAPH_SOURCE, 'gi'),
        (match, href: string) => {
            // 에디터가 URL 내 & 를 &amp; 로 인코딩하므로 t=/list= 판정 전에 복원
            const url = href.replace(/&amp;/g, '&').trim();
            const embedded = youtubeUrlToEmbedHtml(url);
            return embedded ?? match;
        }
    );
}

export function transformVideos(html: string): string {
    if (!html || (!html.includes('{video') && !html.includes('{동영상'))) return html;

    return html.replace(VIDEO_PATTERN, (_match, _type: string, innerContent: string) => {
        // <a> 태그에서 URL 추출 또는 plain text URL 추출
        let url = '';
        const hrefMatch = innerContent.match(/href=["']([^"']+)["']/);
        if (hrefMatch) {
            url = hrefMatch[1].trim();
        } else {
            // 반복 제거로 중첩 태그 조각 방지 (예: <scr<b>ipt> → <script>)
            let cleaned = innerContent;
            let prev;
            do {
                prev = cleaned;
                cleaned = cleaned.replace(/<[^>]*>/g, '');
            } while (cleaned !== prev);
            url = cleaned.trim();
        }

        if (!url) return '';

        // YouTube (공통 헬퍼 재사용)
        const ytEmbed = youtubeUrlToEmbedHtml(url);
        if (ytEmbed) return ytEmbed;

        // Vimeo
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
            return `<div class="embed-container" data-platform="vimeo" style="--aspect-ratio: 56.25%; --max-width: 100%;"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" frameborder="0" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe></div>`;
        }

        // 직접 비디오 파일 (mp4, webm, mov 등)
        const videoExtMatch = url.match(/\.(mp4|m4v|webm|mov|f4v|flv)(\?.*)?$/i);
        if (videoExtMatch) {
            const ext = videoExtMatch[1].toLowerCase();
            const mimeType = ext === 'mov' || ext === 'm4v' || ext === 'f4v' ? 'mp4' : ext;
            return `<div class="na-video-direct"><video controls preload="none" playsinline style="max-width:100%;"><source src="${url}" type="video/${mimeType}">동영상을 재생할 수 없습니다.</video></div>`;
        }

        // 기타: 링크로 표시
        return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
    });
}

/**
 * [code]...[/code] 또는 [code=lang]...[/code] BBCode를 <pre><code>로 변환
 * 그누보드/나리야 레거시 호환
 */
/**
 * ```lang\n...\n``` 백틱 코드 블록을 <pre><code>로 변환
 * 댓글 등 marked.parse를 거치지 않는 plain text 전용
 */
export function transformBacktickCodeBlocks(text: string): string {
    if (!text || !text.includes('```')) return text;

    return text.replace(BACKTICK_CODE_BLOCK_PATTERN, (_match, lang: string, code: string) => {
        let cleaned = code.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?p>/gi, '\n');
        let prev;
        do {
            prev = cleaned;
            cleaned = cleaned.replace(/<[^>]*>/g, '');
        } while (cleaned !== prev);
        const trimmed = cleaned.replace(/^\n+|\n+$/g, '');
        const langAttr = lang ? ` class="language-${lang}"` : '';
        return `<pre><code${langAttr}>${trimmed}</code></pre>`;
    });
}

/**
 * `code` 인라인 백틱을 <code>로 변환
 * 댓글 등 marked.parse를 거치지 않는 plain text 전용
 * 반드시 transformBacktickCodeBlocks 이후에 실행해야 ``` 블록 내부를 오염시키지 않음
 */
export function transformInlineCode(text: string): string {
    if (!text || !text.includes('`')) return text;

    return text.replace(INLINE_CODE_PATTERN, (_match, code: string) => {
        return `<code>${code}</code>`;
    });
}

/**
 * 간단한 인라인 마크다운을 HTML로 변환
 * **bold**, *italic*, ~~strikethrough~~
 * <code>, <pre> 내부는 변환하지 않음
 */
export function transformInlineMarkdown(text: string): string {
    if (!text || (!text.includes('*') && !text.includes('~~'))) return text;

    // <pre>...</pre>, <code>...</code> 블록을 보호하면서 나머지만 변환
    // 취소선(~~)은 GFM flanking 규칙 적용: 여는 ~~ 뒤·닫는 ~~ 앞이 모두 비공백일 때만 <del>.
    // (예: "~~ 부드러운 ~~"처럼 안쪽에 공백이 있으면 취소선이 아닌 리터럴로 둔다)
    // lookbehind 미사용 — 경계 문자를 캡처 그룹으로 강제해 구형 브라우저 호환.
    // 개행/틸드를 넘지 않도록 . 대신 [^~\n] 사용(catastrophic backtracking 회피).
    return text.replace(
        /(<pre[\s>][\s\S]*?<\/pre>|<code[\s>][\s\S]*?<\/code>)|(\*\*(.+?)\*\*|\*(.+?)\*|~~([^~\s](?:[^~\n]*[^~\s])?)~~)/g,
        (match, codeBlock, _md, bold, italic, strike) => {
            if (codeBlock) return codeBlock;
            if (bold) return `<strong>${bold}</strong>`;
            if (italic) return `<em>${italic}</em>`;
            if (strike) return `<del>${strike}</del>`;
            return match;
        }
    );
}

export function transformCodeBlocks(html: string): string {
    if (!html || !html.toLowerCase().includes('[code')) return html;

    return html.replace(CODE_BLOCK_PATTERN, (_match, lang: string | undefined, code: string) => {
        // HTML 태그 제거 (에디터가 삽입한 <br>, <p> 등)
        let cleaned = code.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?p>/gi, '\n');
        let prevC;
        do {
            prevC = cleaned;
            cleaned = cleaned.replace(/<[^>]*>/g, '');
        } while (cleaned !== prevC);

        // 앞뒤 빈 줄 제거
        const trimmed = cleaned.replace(/^\n+|\n+$/g, '');

        const langAttr = lang ? ` class="language-${lang}"` : '';
        return `<pre><code${langAttr}>${trimmed}</code></pre>`;
    });
}

/**
 * CKEditor5 <oembed url="..."> 태그를 임베드 플레이어로 변환
 * Gnuboard5의 CKEditor5 미디어 삽입 시 생성되는 형식:
 * - <figure class="media"><oembed url="..."></oembed></figure>
 * - <oembed url="..."></oembed> (단독)
 */
export function transformOembed(html: string): string {
    if (!html || !html.includes('oembed')) return html;

    // <figure class="media">로 감싸진 oembed 또는 단독 oembed 처리
    return html.replace(
        /(?:<figure[^>]*class="[^"]*media[^"]*"[^>]*>\s*)?<oembed\s+url=["']([^"']+)["'][^>]*>\s*<\/oembed>\s*(?:<\/figure>)?/gi,
        (_match, url: string) => {
            if (!url) return '';
            const embedded = embedUrl(url.trim());
            if (embedded) return embedded;
            // fallback: 링크로 표시
            return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
        }
    );
}

/**
 * HTML 엔티티로 이스케이프된 <video> / <iframe> 태그를 복원
 * 백엔드에서 HTML 태그를 &lt;/&gt;로 이스케이프한 경우 원래 HTML로 변환
 *
 * 보안: video, iframe(허용된 도메인만), source 태그만 복원
 */
export function transformEscapedMedia(html: string): string {
    if (!html || (!html.includes('&lt;video') && !html.includes('&lt;iframe'))) return html;

    // &lt;video ...&gt;...&lt;/video&gt; 복원
    let result = html.replace(
        /&lt;video\s([^]*?)&gt;([^]*?)&lt;\/video&gt;/gi,
        (_match, attrs: string, inner: string) => {
            // 속성에서 위험한 이벤트 핸들러 제거
            const safeAttrs = attrs.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
            // 내부 &lt;source&gt; 태그도 복원
            const safeInner = inner.replace(
                /&lt;source\s([^]*?)(?:\/?)&gt;/gi,
                (_m: string, sAttrs: string) =>
                    `<source ${sAttrs.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')}>`
            );
            return `<video ${safeAttrs}>${safeInner}</video>`;
        }
    );

    return result;
}

/**
 * [spoiler]...[/spoiler] 또는 [spoiler=제목]...[/spoiler] BBCode를 <details> 태그로 변환
 * 클릭하면 내용이 펼쳐지는 스포일러 블록
 */
export function transformSpoilers(html: string): string {
    if (!html || !html.toLowerCase().includes('[spoiler')) return html;

    return html.replace(SPOILER_PATTERN, (_match, title: string | undefined, content: string) => {
        const label = title?.trim() || '스포일러';
        return `<details class="spoiler-block"><summary>${label}</summary><div class="spoiler-content">${content}</div></details>`;
    });
}
