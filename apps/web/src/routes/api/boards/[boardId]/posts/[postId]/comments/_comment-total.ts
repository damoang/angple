/**
 * 댓글 목록의 전체 개수(total) 결정.
 *
 * 첫 페이지에서 받은 행 수가 한도(limit)보다 적으면 그 수가 곧 전체 개수이므로
 * COUNT 쿼리를 생략한다. 그 외(첫 페이지가 한도만큼 찼거나 2페이지 이상)는
 * 기존과 같이 COUNT 로 센다.
 */
export async function resolveCommentTotal(
    page: number,
    limit: number,
    rowCount: number,
    countAll: () => Promise<number>
): Promise<number> {
    if (page === 1 && rowCount < limit) {
        return rowCount;
    }
    return countAll();
}
