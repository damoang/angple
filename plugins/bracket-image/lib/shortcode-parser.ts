/**
 * 숏코드 파서
 *
 * [https://s3.damoang.net/image.jpg] → <img> 태그
 * {video:URL} / {동영상:URL} → 플랫폼별 iframe
 *
 * 보안:
 * - 허용된 도메인만 이미지로 변환
 * - 이미지 확장자만 허용
 * - XSS 방지를 위한 URL 검증
 *
 * 주의: marked.parse()가 URL을 <a> 태그로 자동 변환하므로
 *       raw text와 HTML 두 형태 모두 처리해야 합니다.
 */

/** 허용된 이미지 도메인 목록 */
const ALLOWED_IMAGE_DOMAINS = [
    's3.damoang.net',
    'damoang.net',
    'cdn.damoang.net',
    'i.imgur.com',
    'imgur.com',
    'media.tenor.com',
    'tenor.com',
    'c.tenor.com',
    'media.giphy.com',
    'i.giphy.com',
    'giphy.com',
    'pbs.twimg.com',
    'upload.wikimedia.org'
];

/** 허용된 이미지 확장자 */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

/**
 * HTML에서 실제 URL 추출
 * marked가 자동 링크한 경우: <a href="URL">URL</a> → URL
 * 원본 텍스트인 경우: URL → URL
 */
function extractUrlFromHtml(content: string): string {
    const trimmed = content.trim();
    // marked autolink: <a href="URL">URL</a> 형태에서 href 추출
    const hrefMatch = trimmed.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
    if (hrefMatch) {
        return hrefMatch[1];
    }
    return trimmed;
}

/**
 * URL이 허용된 이미지 도메인인지 확인
 */
function isAllowedImageDomain(url: string): boolean {
    try {
        const urlObj = new URL(url);
        return ALLOWED_IMAGE_DOMAINS.some(
            (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
}

/**
 * URL이 이미지 확장자를 가지는지 확인
 */
function hasImageExtension(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
    } catch {
        return false;
    }
}

/**
 * 이미지 URL 검증 (XSS 방지)
 */
function isValidImageUrl(url: string): boolean {
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
        return false;
    }
    if (url.includes('javascript:') || url.includes('data:')) {
        return false;
    }
    return isAllowedImageDomain(url) && hasImageExtension(url);
}

/**
 * 파일명에서 alt 텍스트 추출
 */
function extractAltText(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop() || '';
        return filename.replace(/\.[^.]+$/, '') || '이미지';
    } catch {
        return '이미지';
    }
}

/**
 * YouTube 영상 ID 추출
 */
function extractYouTubeId(url: string): { id: string; isShorts: boolean } | null {
    const patterns = [
        { regex: /(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/, shorts: true },
        { regex: /(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/, shorts: false },
        { regex: /youtu\.be\/([a-zA-Z0-9_-]{11})/, shorts: false },
        { regex: /(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/, shorts: false },
        { regex: /(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, shorts: false }
    ];

    for (const { regex, shorts } of patterns) {
        const match = url.match(regex);
        if (match) {
            return { id: match[1], isShorts: shorts };
        }
    }
    return null;
}

/**
 * 동영상 URL을 iframe으로 변환
 */
function renderVideoEmbed(url: string): string | null {
    // YouTube
    const yt = extractYouTubeId(url);
    if (yt) {
        const aspectRatio = yt.isShorts ? '177.78%' : '56.25%';
        const maxWidth = yt.isShorts ? '400px' : '100%';
        const platform = yt.isShorts ? 'youtube-shorts' : 'youtube';

        // 시작 시간 추출
        const timeMatch = url.match(/[?&]t=(\d+)/);
        const startParam = timeMatch ? `?start=${timeMatch[1]}` : '';

        return `<div class="embed-container" data-platform="${platform}" style="--aspect-ratio: ${aspectRatio}; --max-width: ${maxWidth};"><iframe src="https://www.youtube.com/embed/${yt.id}${startParam}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
    }

    // Vimeo
    const vimeoMatch = url.match(/(?:www\.)?vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
        return `<div class="embed-container" data-platform="vimeo" style="--aspect-ratio: 56.25%; --max-width: 100%;"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" title="Vimeo video player" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
    }

    return null;
}

/**
 * 대괄호 이미지 처리: [https://...image.jpg] → <img>
 * marked autolink 후: [<a href="URL">URL</a>] 형태도 처리
 */
function processBracketImages(content: string): string {
    // 1) raw text: [https://...image.jpg]
    const rawPattern = /\[(https?:\/\/[^\]\s]+)\]/gi;
    let result = content.replace(rawPattern, (match, url) => {
        if (!isValidImageUrl(url)) {
            return match;
        }
        const alt = extractAltText(url);
        return `<img src="${url}" alt="${alt}" class="bracket-image" loading="lazy" />`;
    });

    // 2) autolinked: [<a href="URL">URL</a>]
    const linkedPattern = /\[<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>[^<]*<\/a>\]/gi;
    result = result.replace(linkedPattern, (match, url) => {
        if (!isValidImageUrl(url)) {
            return match;
        }
        const alt = extractAltText(url);
        return `<img src="${url}" alt="${alt}" class="bracket-image" loading="lazy" />`;
    });

    return result;
}

/**
 * 동영상 숏코드 처리: {video:URL} 또는 {동영상:URL} → iframe
 * marked autolink 후: {video: <a href="URL">URL</a> } 형태도 처리
 */
function processVideoShortcodes(content: string): string {
    const pattern = /\{(video|동영상)\s*:\s*([^}]+)\}/gi;

    return content.replace(pattern, (match, _type: string, rawContent: string) => {
        // <a> 태그가 포함된 경우 href에서 URL 추출
        const url = extractUrlFromHtml(rawContent);

        if (!url.startsWith('https://') && !url.startsWith('http://')) {
            return match;
        }
        if (url.includes('javascript:') || url.includes('data:')) {
            return match;
        }

        const embed = renderVideoEmbed(url);
        return embed || match;
    });
}

/**
 * 모든 숏코드를 처리하는 메인 함수
 *
 * 처리 순서:
 * 1. 대괄호 이미지: [https://...jpg] → <img>
 * 2. 동영상 숏코드: {video:URL} → iframe
 */
export function processBracketShortcodes(content: string): string {
    if (!content) return content;

    let result = content;

    // 1. 대괄호 이미지 처리
    result = processBracketImages(result);

    // 2. 동영상 숏코드 처리
    result = processVideoShortcodes(result);

    return result;
}
