/**
 * 회원 아이콘 URL 생성 유틸리티
 * 그누보드 회원 아이콘 경로: /data/member_image/{mb_id 앞 2글자}/{mb_id}.gif
 */

const LEGACY_BASE_URL = 'https://damoang.net';

/**
 * 회원 ID로 아이콘 URL 생성
 * @param mbId 회원 ID (예: google_78ca0772, naver_889808c8)
 * @returns 아이콘 URL 또는 null
 */
export function getMemberIconUrl(mbId: string | null | undefined): string | null {
    if (!mbId || mbId.length < 2) return null;

    const prefix = mbId.substring(0, 2).toLowerCase();
    return `${LEGACY_BASE_URL}/data/member_image/${prefix}/${mbId}.gif`;
}

/**
 * 아이콘 이미지 로드 실패 시 폴백 처리
 * @param event 이미지 에러 이벤트
 */
export function handleIconError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
        img.style.display = 'none';
    }
}
