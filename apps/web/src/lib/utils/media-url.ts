import { normalizeWebUrl } from '$lib/utils/url-normalizer';

const ABSOLUTE_MEDIA_HOST_REGEX =
    /^https?:\/\/(?:www\.)?(?:damoang\.net|s3\.damoang\.net|cdn\.damoang\.net|r2\.damoang\.net)(\/data\/.+)$/i;

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
            const cdnBase = normalizeCdnBase(cdnBaseUrl, sameMediaPath[1]);
            return `${cdnBase}${sameMediaPath[1]}`;
        }
        return normalizeWebUrl(normalizedRawUrl);
    }

    const trimmedPath = normalizedRawUrl.replace(/^\/+/, '');
    if (trimmedPath.startsWith('data/')) {
        const cdnBase = normalizeCdnBase(cdnBaseUrl, trimmedPath);
        return `${cdnBase}/${trimmedPath}`;
    }

    return normalizedRawUrl;
}
