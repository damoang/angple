/**
 * S3 이미지 URL → Lambda 생성 썸네일 URL 변환
 *
 * data/file/ 경로: -400x225.webp 썸네일 사용 (Lambda가 업로드 시 자동 생성)
 * data/editor/ 경로: 원본 유지 (Lambda 썸네일 미생성)
 */
export function toThumbnailUrl(url: string | undefined | null, size = '400x225'): string {
    if (!url) return '';

    // data/file/ S3 URL만 변환 (Lambda 썸네일 존재 확인됨)
    const match = url.match(
        /^(https?:\/\/s3\.damoang\.net\/data\/file\/.+)\.(jpg|jpeg|png|gif|webp)$/i
    );
    if (match) {
        return `${match[1]}-${size}.webp`;
    }

    return url;
}
