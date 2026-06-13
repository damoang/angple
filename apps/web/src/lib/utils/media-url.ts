import { normalizeWebUrl } from '$lib/utils/url-normalizer';

// 호스트 직후 path. `\/{1,}` 로 leading 다중슬래시(`//data/...`)까지 매치 — 레거시
// 네이버에디터 마이그레이션 글에 `damoang.net//data/...` 더블슬래시가 박혀 있다(#12697).
const ABSOLUTE_MEDIA_HOST_REGEX =
    /^https?:\/\/(?:www\.)?(?:damoang\.net|s3\.damoang\.net|cdn\.damoang\.net|r2\.damoang\.net)(\/{1,}data\/.+)$/i;

// 본문/댓글 HTML 에서 <img src> 추출용 (markdown.svelte 의 이미지 정규식과 동일 패턴).
const IMG_SRC_REGEX = /<img\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi;

/** path 의 연속 슬래시(`//`+)를 하나로 축소. 프로토콜(`://`)을 포함하지 않는 path 조각에만 적용. */
function collapseSlashes(path: string): string {
    return path.replace(/\/{2,}/g, '/');
}

// R2 origin (Cloudflare 자체 storage, egress 무료, Sippy 가 S3 fallback)
const R2_BASE = 'https://r2.damoang.net';

// R2 사용 prefix 화이트리스트 (Phase B1 시작: content/, 점진 확대 예정)
const R2_PREFIXES: readonly string[] = ['data/content/'];

function isR2Prefix(path: string): boolean {
    const trimmed = path.replace(/^\/+/, '');
    return R2_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

function normalizeCdnBase(cdnBaseUrl?: string | null, path?: string): string {
    if (path && isR2Prefix(path)) {
        return R2_BASE;
    }
    return (cdnBaseUrl || 'https://s3.damoang.net').replace(/\/$/, '');
}

export function normalizeMediaUrl(
    rawUrl: string | null | undefined,
    cdnBaseUrl?: string | null
): string | null {
    if (!rawUrl) return null;

    const normalizedRawUrl = rawUrl.trim().replaceAll('&amp;', '&');

    if (
        normalizedRawUrl.startsWith('//') ||
        normalizedRawUrl.startsWith('http://') ||
        normalizedRawUrl.startsWith('https://')
    ) {
        const sameMediaPath = normalizedRawUrl.match(ABSOLUTE_MEDIA_HOST_REGEX);
        if (sameMediaPath) {
            // 더블슬래시 collapse 후 CDN 호스트로 정규화 (#12697 깨진 레거시 URL 복구).
            const path = collapseSlashes(sameMediaPath[1]);
            const cdnBase = normalizeCdnBase(cdnBaseUrl, path);
            return `${cdnBase}${path}`;
        }
        return normalizeWebUrl(normalizedRawUrl);
    }

    const trimmedPath = collapseSlashes(normalizedRawUrl.replace(/^\/+/, ''));
    if (trimmedPath.startsWith('data/')) {
        const cdnBase = normalizeCdnBase(cdnBaseUrl, trimmedPath);
        return `${cdnBase}/${trimmedPath}`;
    }

    return normalizedRawUrl;
}

/**
 * HTML 문자열 안의 모든 `<img src>` 를 normalizeMediaUrl 로 정규화.
 * 더블슬래시 collapse + damoang 미디어/상대경로 → CDN 호스트 재호스팅(#12697).
 * 멱등 — 이미 정규화된 URL·외부 이미지는 그대로 통과.
 */
export function normalizeHtmlMediaUrls(html: string, cdnBaseUrl?: string | null): string {
    if (!html) return html;
    return html.replace(IMG_SRC_REGEX, (match, before, quote, src, after) => {
        const normalized = normalizeMediaUrl(src, cdnBaseUrl);
        if (!normalized || normalized === src) return match;
        return `<img${before}src=${quote}${normalized}${quote}${after}>`;
    });
}
