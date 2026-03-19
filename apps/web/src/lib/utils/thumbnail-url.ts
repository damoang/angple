/**
 * S3 이미지 URL → Lambda 생성 썸네일 URL 변환
 *
 * data/file/ 및 data/editor/ 경로 모두 Lambda 썸네일 지원
 * Lambda가 raw/ → data/ 변환 시 -400x225.webp, -835x626.webp, -60x60.webp 썸네일 자동 생성
 */
export function toThumbnailUrl(url: string | undefined | null, size = '400x225'): string {
    if (!url) return '';

    // 이미 썸네일 URL이면 이중 변환 방지
    if (/-\d+x\d+\.webp$/i.test(url)) return url;

    // data/file/ 또는 data/editor/ S3 URL → Lambda 썸네일 변환
    const match = url.match(
        /^(https?:\/\/s3\.damoang\.net\/data\/(?:file|editor)\/.+)\.(jpg|jpeg|png|gif|webp)$/i
    );
    if (match) {
        return `${match[1]}-${size}.webp`;
    }

    return url;
}
