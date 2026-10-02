/**
 * 프로필 사진(회원 이미지) 업로드 클라이언트 검사
 *
 * 전용 API(/api/members/me/image)와 같은 기준을 쓴다.
 * - 형식: JPEG/PNG/GIF/WebP 네 가지만 (SVG·HEIC 등 제외)
 * - 크기: 5MB 이하 (서버 상한과 같은 값·같은 문구)
 */

/** 파일 입력 accept 값 */
export const MEMBER_IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';

/** 허용 MIME 형식 */
export const MEMBER_IMAGE_TYPES: readonly string[] = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
];

/** 최대 크기 (바이트) */
export const MEMBER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** 크기 초과 문구 — 서버 응답 문구와 맞춘다 */
export const MEMBER_IMAGE_SIZE_ERROR = '파일 크기가 너무 큽니다 (최대 5MB)';

/** 형식 오류 문구 */
export const MEMBER_IMAGE_TYPE_ERROR = 'JPG, PNG, GIF, WebP 이미지만 업로드할 수 있습니다.';

/**
 * 업로드 전 파일 검사
 * @returns 오류 문구, 통과하면 null
 */
export function validateMemberImageFile(file: { type: string; size: number }): string | null {
    if (!MEMBER_IMAGE_TYPES.includes((file.type || '').toLowerCase())) {
        return MEMBER_IMAGE_TYPE_ERROR;
    }
    if (file.size > MEMBER_IMAGE_MAX_BYTES) {
        return MEMBER_IMAGE_SIZE_ERROR;
    }
    return null;
}
