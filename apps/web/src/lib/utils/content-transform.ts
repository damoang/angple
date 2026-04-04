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

        if (isNaN(width) || width <= 0) {
            width = DEFAULT_WIDTH;
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
    if (!text || !text.includes('[http')) return text;

    return text.replace(
        /\[(https?:\/\/[^\]]+\.(?:jpg|jpeg|png|gif|webp|bmp|svg)(?:\?[^\]]*)?)\]/gi,
        (_match, url: string) => {
            return `<img src="${url}" alt="이미지" loading="lazy" class="bracket-image" style="max-width:100%;height:auto;">`;
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

        // YouTube
        const ytMatch = url.match(
            /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        if (ytMatch) {
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
            const maxWidth = isShorts ? '400px' : '100%';
            return `<div class="embed-container" data-platform="${platform}" style="--aspect-ratio: ${aspectRatio}; --max-width: ${maxWidth};"><iframe src="${embedSrc}" frameborder="0" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe></div>`;
        }

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
    return text.replace(
        /(<pre[\s>][\s\S]*?<\/pre>|<code[\s>][\s\S]*?<\/code>)|(\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~)/g,
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
