/**
 * S3 이미지 URL → Lambda 생성 썸네일 URL 변환
 *
 * data/file/ 및 data/editor/ 경로 모두 Lambda 썸네일 지원
 * Lambda가 raw/ → data/ 변환 시 -400x225.webp, -835x626.webp, -60x60.webp 썸네일 자동 생성
 */
export function toThumbnailUrl(url: string | undefined | null, size = '400x225'): string {
    if (!url) return '';

    // 이미 요청한 크기와 동일하면 스킵
    if (url.endsWith(`-${size}.webp`)) return url;

    // 다른 크기 썸네일이면 크기 교체
    const thumbMatch = url.match(/^(.+)-\d+x\d+\.webp$/i);
    if (thumbMatch) {
        return `${thumbMatch[1]}-${size}.webp`;
    }

    // 일반 이미지 URL → 썸네일 변환
    const match = url.match(
        /^(https?:\/\/s3\.damoang\.net\/data\/(?:file|editor)\/.+)\.(jpg|jpeg|png|gif|webp)$/i
    );
    if (match) {
        return `${match[1]}-${size}.webp`;
    }

    return url;
}
