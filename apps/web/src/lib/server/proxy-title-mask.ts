/**
 * API 프록시(`/api/v1/*`) 응답의 글 제목 이메일 마스킹.
 *
 * 브라우저가 프록시로 받아 가는 **표시 전용 목록** 응답(게시판 글·공지 목록, 내 글·댓글·추천한 글,
 * 추천·인기·노출 피드, 검색, 회원 활동, 직접홍보 삽입 글)만 대상이다.
 * 단건 조회(`boards/{b}/posts/{id}`)는 수정 화면·다시 쓰기가 원문을 받아야 하므로 절대 바꾸지 않는다
 * — 바꾸면 「[이메일]」 글자가 그대로 저장된다. 수정 이력(`.../revisions`)도 관리자 복원·대조용
 * 원문이라 대상이 아니다.
 */
import { maskTitleFields } from '$lib/utils/email-reveal.js';

const LIST_PATHS: readonly RegExp[] = [
    /^boards\/[^/]{1,100}\/(?:posts|notices)\/?$/,
    /^my\/(?:posts|comments|liked-posts)\/?$/,
    /^recommended(?:\/[^/]{1,100}){0,2}\/?$/,
    /^popular(?:\/[^/]{1,100}){0,2}\/?$/,
    /^(?:expose|notice)\/?$/,
    /^search(?:\/autocomplete)?\/?$/,
    /^members\/[^/]{1,100}\/activity\/?$/,
    /^promotion\/posts\/insert\/?$/
];

/**
 * 프록시 응답에서 제목으로 보고 마스킹하는 필드. 기본 제목 필드에 더해
 * 내 댓글 목록이 싣는 원글 제목(`post_title`)까지.
 */
const PROXY_TITLE_KEYS: readonly string[] = [
    'title',
    'wr_subject',
    'subject',
    'parent_title',
    'post_title'
];

/** 이 프록시 경로(쿼리 제외)의 GET 응답에서 제목을 마스킹하는가. */
export function isTitleMaskedProxyPath(path: string): boolean {
    return LIST_PATHS.some((re) => re.test(path));
}

/**
 * JSON 응답 본문의 제목 필드를 마스킹한 문자열. 주소가 있을 수 없는 본문(`@`·표지 없음)이거나
 * JSON 이 아니면 받은 그대로 돌려준다(같은 문자열 → 호출부가 헤더를 건드리지 않아도 된다).
 */
export function maskProxyJsonTitles(text: string): string {
    if (!text || (text.indexOf('@') === -1 && text.indexOf('{email:') === -1)) return text;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return text;
    }
    return JSON.stringify(maskTitleFields(parsed, PROXY_TITLE_KEYS));
}
