import { normalizeMediaUrl } from '$lib/utils/media-url';

/**
 * 회원 프로필 이미지 URL 유틸리티
 * DB(mb_image_url)에 저장된 S3 경로만 사용. 추측 경로 없음.
 */

const CDN_BASE_URL = (import.meta.env.VITE_S3_URL || 'https://s3.damoang.net').replace(/\/$/, '');

/**
 * mb_image_url(DB)로 전체 URL 생성
 * @param imageUrl API에서 받은 mb_image / author_image (예: data/member_image/ad/admin_1760156943.webp)
 * @param updatedAt mb_image_updated_at (Unix timestamp 또는 ISO 문자열) — 캐시 버스팅용
 * @returns 전체 URL 또는 null
 */
export function getAvatarUrl(
    imageUrl: string | null | undefined,
    updatedAt?: number | string | null
): string | null {
    if (!imageUrl) return null;

    const url = normalizeMediaUrl(imageUrl, CDN_BASE_URL);
    if (!url) return null;

    // 캐시 버스팅: ?v=timestamp 추가
    if (updatedAt) {
        const v =
            typeof updatedAt === 'number'
                ? updatedAt
                : Math.floor(new Date(updatedAt).getTime() / 1000);
        if (v > 0) {
            return `${url}${url.includes('?') ? '&' : '?'}v=${v}`;
        }
    }

    return url;
}
