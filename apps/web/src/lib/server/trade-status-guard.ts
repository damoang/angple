/**
 * 판매상태 변경 API 허용 판정
 *
 * PATCH /api/boards/[boardId]/posts/[postId]/status 는 wr_2 에 판매상태를 쓴다.
 * wr_2 는 게시판마다 용도가 다르므로 중고장터 게시판에서만 허용한다.
 */

/** 판매상태 변경을 허용하는 게시판 (대소문자 정확히 일치) */
export const TRADE_STATUS_BOARDS: readonly string[] = ['trade'];

/** 판매상태 변경이 허용된 게시판인지 판정한다. 정확히 일치할 때만 true. */
export function isTradeStatusBoard(boardId: unknown): boolean {
    return typeof boardId === 'string' && TRADE_STATUS_BOARDS.includes(boardId);
}

/** postId 가 양의 정수 문자열이면 그 값을, 아니면 null 을 돌려준다. */
export function parsePostId(postId: unknown): number | null {
    if (typeof postId !== 'string' || !/^[1-9]\d*$/.test(postId)) return null;
    const id = Number(postId);
    return Number.isSafeInteger(id) ? id : null;
}
