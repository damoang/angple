/**
 * 투표 위젯의 by-post 호출 생략 판정 (순수 함수 — 단위 테스트 대상)
 *
 * 상세 로더가 auxiliaryData.hasPoll(true/false/null)을 실어 보낸다.
 * 「확실히 없음(false)」 + 비작성자일 때만 호출을 생략하고, 나머지는 전부 기존 경로(호출).
 */

/**
 * 로더 값이 지금 위젯이 보는 글의 것일 때만 믿는다.
 * SPA 글→글 이동 순간 page.data 가 이전 글 값일 수 있는데, 이전 글의 false 를
 * 새 글에 쓰면 투표가 있는 글에서 위젯이 사라진다 → 짝이 안 맞으면 null(모름).
 */
export function resolveTrustedHasPoll(args: {
    boardId: string;
    postId: number;
    dataBoardId: unknown;
    dataPostId: unknown;
    hasPoll: unknown;
}): boolean | null {
    const { boardId, postId, dataBoardId, dataPostId, hasPoll } = args;
    if (dataBoardId !== boardId || Number(dataPostId) !== postId) return null;
    return typeof hasPoll === 'boolean' ? hasPoll : null;
}

/**
 * 호출할지. 엄격 비교 — false 만 생략 대상이고 null/undefined(구버전·조회 실패)는 호출.
 * 작성자는 「투표 만들기」(can_create)를 받아야 하므로 false 여도 호출한다.
 */
export function shouldFetchPoll(trustedHasPoll: boolean | null, isAuthor: boolean): boolean {
    return !(trustedHasPoll === false && !isAuthor);
}
