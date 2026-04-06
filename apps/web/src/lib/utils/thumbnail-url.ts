const THUMBNAIL_SOURCE_REGEX =
    /^(https?:\/\/(?:cdn|s3)\.damoang\.net\/data\/(?:file|editor)\/.+)\.(jpg|jpeg|png|webp)$/i;

/**
 * data/file/ 및 data/editor/ 경로 모두 Lambda 썸네일 지원
 * Lambda가 raw/ → data/ 변환 시 -400x225.webp, -835x626.webp, -60x60.webp 썸네일 자동 생성
 */
export function toThumbnailUrl(url: string | undefined | null, size = '400x225'): string {
    if (!url) return '';

    if (url.endsWith(`-${size}.webp`)) return url;

    const thumbMatch = url.match(/^(.+)-\d+x\d+\.webp$/i);
    if (thumbMatch) {
        return `${thumbMatch[1]}-${size}.webp`;
    }

    const match = url.match(THUMBNAIL_SOURCE_REGEX);
    if (match) {
        return `${match[1]}-${size}.webp`;
    }

    return url;
}

export function isTransformableMediaImage(url: string | undefined | null): url is string {
    return Boolean(url && THUMBNAIL_SOURCE_REGEX.test(url));
}

export function buildThumbnailSrcSet(url: string | undefined | null, sizes: string[]): string {
    if (!isTransformableMediaImage(url)) return '';

    return sizes
        .map((size) => {
            const [width] = size.split('x');
            return `${toThumbnailUrl(url, size)} ${width}w`;
        })
        .join(', ');
}
