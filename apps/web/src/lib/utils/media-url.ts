import { normalizeWebUrl } from '$lib/utils/url-normalizer';

const ABSOLUTE_MEDIA_HOST_REGEX =
    /^https?:\/\/(?:www\.)?(?:damoang\.net|s3\.damoang\.net|cdn\.damoang\.net)(\/data\/.+)$/i;

function normalizeCdnBase(cdnBaseUrl?: string | null): string {
    return (cdnBaseUrl || 'https://s3.damoang.net').replace(/\/$/, '');
}

export function normalizeMediaUrl(
    rawUrl: string | null | undefined,
    cdnBaseUrl?: string | null
): string | null {
    if (!rawUrl) return null;

    const cdnBase = normalizeCdnBase(cdnBaseUrl);
    const normalizedRawUrl = rawUrl.trim().replaceAll('&amp;', '&');

    if (
        normalizedRawUrl.startsWith('//') ||
        normalizedRawUrl.startsWith('http://') ||
        normalizedRawUrl.startsWith('https://')
    ) {
        const sameMediaPath = normalizedRawUrl.match(ABSOLUTE_MEDIA_HOST_REGEX);
        if (sameMediaPath) {
            return `${cdnBase}${sameMediaPath[1]}`;
        }
        return normalizeWebUrl(normalizedRawUrl);
    }

    const trimmedPath = normalizedRawUrl.replace(/^\/+/, '');
    if (trimmedPath.startsWith('data/')) {
        return `${cdnBase}/${trimmedPath}`;
    }

    return normalizedRawUrl;
}
