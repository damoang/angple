/**
 * 회원 아이콘 URL 생성 유틸리티
 * 1순위: API에서 받은 avatar_url (mb_image_url)
 * 2순위: S3 경로 기반 폴백 (data/member_image/{prefix}/{mb_id}.gif)
 */

const CDN_BASE_URL = 'https://s3.damoang.net';

/**
 * 이미지 로드 실패한 mb_id 캐시 (세션 내 재요청 방지)
 */
const failedIconCache = new Set<string>();

/**
 * avatar_url 또는 mb_image_url로 전체 URL 생성
 * @param avatarUrl API에서 받은 avatar_url (예: data/member_image/ad/admin_1760156943.webp)
 * @returns 전체 URL 또는 null
 */
export function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
    if (!avatarUrl) return null;

    // 이미 전체 URL이면 그대로 반환
    if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
        return avatarUrl;
    }

    // 상대 경로면 CDN 베이스 추가
    return `${CDN_BASE_URL}/${avatarUrl}`;
}

/**
 * 회원 ID로 아이콘 URL 생성 (폴백용)
 * 이전에 로드 실패한 ID는 null 반환 (불필요한 403 요청 방지)
 * @param mbId 회원 ID (예: google_78ca0772, naver_889808c8)
 * @returns 아이콘 URL 또는 null
 */
export function getMemberIconUrl(mbId: string | null | undefined): string | null {
    if (!mbId || mbId.length < 2) return null;
    if (failedIconCache.has(mbId)) return null;

    const prefix = mbId.substring(0, 2).toLowerCase();
    return `${CDN_BASE_URL}/data/member_image/${prefix}/${mbId}.gif`;
}

/**
 * 아이콘 이미지 로드 실패 시 폴백 처리
 * @param event 이미지 에러 이벤트
 */
export function handleIconError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
        const match = img.src.match(/\/member_image\/\w+\/([^.]+)\.\w+/);
        if (match) {
            failedIconCache.add(match[1]);
        }
        img.style.display = 'none';
    }
}
