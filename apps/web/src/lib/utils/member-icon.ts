/**
 * 회원 프로필 이미지 URL 유틸리티
 * DB(mb_image_url)에 저장된 S3 경로만 사용. 추측 경로 없음.
 */

const CDN_BASE_URL = 'https://s3.damoang.net';

/**
 * mb_image_url(DB)로 전체 URL 생성
 * @param imageUrl API에서 받은 mb_image / author_image (예: data/member_image/ad/admin_1760156943.webp)
 * @returns 전체 URL 또는 null
 */
export function getAvatarUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;

    // 이미 전체 URL이면 그대로 반환
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }

    // 상대 경로면 CDN 베이스 추가
    return `${CDN_BASE_URL}/${imageUrl}`;
}
