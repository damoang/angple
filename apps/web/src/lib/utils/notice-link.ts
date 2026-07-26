/**
 * 소모임 전역 공지 링크 (소모임 관리자 페이지 안내)
 *
 * 소모임 91곳에 같은 글을 복제하지 않고 원본 글 하나를 모든 소모임 목록 상단에 노출한다.
 * 복제하지 않는 이유는 댓글 때문이다 — 글이 91개로 갈라지면 의견도 91곳에 흩어진다.
 *
 * 대신 글이 하나뿐이라 "어느 소모임 분의 의견인지"를 알 수 없으므로,
 * 링크에 `?from={소모임}` 을 붙여 **유입 경로**를 넘긴다.
 * (회원 다수가 여러 소모임에 가입해 있어 '소속'으로는 특정되지 않는다.)
 *
 * ⚠️ from 은 클라이언트가 만드는 값이라 위조 가능하다. 서버가 소모임 화이트리스트로
 *    검증한 뒤에만 저장하므로, 여기서는 표기 편의만 담당한다.
 */

interface NoticeLike {
    id: number | string;
    /** 소모임 전 게시판 공통 공지인지 */
    global_notice?: boolean;
    /** 원본 글이 실제로 있는 게시판 slug */
    source_board?: string;
}

/**
 * 공지 항목의 링크 주소를 만든다.
 *
 * 일반 공지는 지금 보고 있는 게시판 그대로,
 * 전역 공지는 원본 게시판으로 보내되 어느 소모임에서 눌렀는지 함께 넘긴다.
 */
export function getNoticeHref(notice: NoticeLike, currentBoardId: string): string {
    if (notice.global_notice && notice.source_board) {
        return `/${notice.source_board}/${notice.id}?from=${encodeURIComponent(currentBoardId)}`;
    }
    return `/${currentBoardId}/${notice.id}`;
}

/**
 * 글 상세에서 넘겨받은 `?from=` 값을 정리한다.
 *
 * 게시판 slug 는 영문/숫자/밑줄/하이픈만 쓰므로 그 외 문자가 섞이면 버린다.
 * 서버가 다시 검증하지만, 이상한 값을 굳이 실어 보낼 이유가 없다.
 */
export function sanitizeFromBoard(raw: string | null | undefined): string | undefined {
    if (!raw) return undefined;
    return /^[A-Za-z0-9_-]{1,40}$/.test(raw) ? raw : undefined;
}
