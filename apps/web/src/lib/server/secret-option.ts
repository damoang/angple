/**
 * 비밀글·비밀댓글 판정.
 *
 * 그누보드 호환 `wr_option` 은 `html1,secret,mail` 처럼 콤마로 이어진 플래그 문자열이다.
 * 목록·검색·피드처럼 여러 사람이 한꺼번에 보는 응답에는 비밀글·비밀댓글 본문(및 본문에서
 * 뽑은 이미지)을 싣지 않는다. 본문 열람 권한 판정은 글 상세 경로가 맡는다.
 */
export function isSecretOption(wrOption: unknown): boolean {
    if (typeof wrOption !== 'string' || wrOption === '') return false;
    return wrOption
        .split(',')
        .map((s) => s.trim())
        .includes('secret');
}

/** 목록형 응답에서 비밀댓글 본문 대신 보여줄 문구 */
export const SECRET_COMMENT_PLACEHOLDER = '비밀 댓글입니다.';
