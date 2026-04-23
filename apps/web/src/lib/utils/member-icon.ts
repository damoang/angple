import { normalizeMediaUrl } from '$lib/utils/media-url';

/**
 * 회원 프로필 이미지 URL 유틸리티
 * DB(mb_image_url)에 저장된 S3 경로만 사용. 추측 경로 없음.
 */

const CDN_BASE_URL = (import.meta.env.VITE_S3_URL || 'https://s3.damoang.net').replace(/\/$/, '');

/** Lambda 가 생성하는 variant 크기 (avatar-resize) */
export type AvatarSize = 32 | 64 | 96 | 192;

const VARIANT_PREFIX = 'data/member_image/_resized/';

/**
 * size 파라미터가 주어지면 Lambda resize variant path로 재작성.
 *   data/member_image/ab/admin_1760156943.webp  →
 *   data/member_image/_resized/ab/admin_1760156943_96.jpg
 *
 * size 미지정 시 원본 경로 유지 (하위 호환).
 */
function toVariantPath(imageUrl: string, size: AvatarSize | undefined): string {
    if (!size) return imageUrl;
    // 이미 variant 경로면 그대로
    if (imageUrl.includes('/_resized/')) return imageUrl;

    const match = imageUrl.match(/^data\/member_image\/([^/]+)\/(.+)\.(jpe?g|png|gif|webp)$/i);
    if (!match) return imageUrl; // 패턴 불일치 — 원본 그대로
    const [, ab, name] = match;
    return `${VARIANT_PREFIX}${ab}/${name}_${size}.jpg`;
}

/**
 * mb_image_url(DB)로 전체 URL 생성
 * @param imageUrl API에서 받은 mb_image / author_image (예: data/member_image/ad/admin_1760156943.webp)
 * @param updatedAt mb_image_updated_at (Unix timestamp 또는 ISO 문자열) — 캐시 버스팅용
 * @param size Lambda variant 크기 (32/64/96/192). 미지정 시 원본.
 * @returns 전체 URL 또는 null
 */
export function getAvatarUrl(
    imageUrl: string | null | undefined,
    updatedAt?: number | string | null,
    size?: AvatarSize
): string | null {
    if (!imageUrl) return null;

    const path = toVariantPath(imageUrl, size);
    const url = normalizeMediaUrl(path, CDN_BASE_URL);
    if (!url) return null;

    // Variant URL은 path에 version 포함 (Lambda 재생성 시 다른 원본 = 다른 name) →
    // 원본 변경 시 mb_image_url 전체가 달라지므로 cache-bust 쿼리 불필요.
    // size 미지정(원본) 경로는 기존 방식으로 ?v=timestamp 유지.
    if (!size && updatedAt) {
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
