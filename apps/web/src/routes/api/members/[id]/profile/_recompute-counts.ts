/**
 * 프로필 통계 — 실시간 재계산 헬퍼.
 *
 * 배경:
 *   `g5_member_board_status` 의 누적값은 갱신하는 cron/sync 가 없어 레거시 PHP 시절에
 *   멈춰 있다(#12113). 그래서 삭제 수만 실시간으로 세어 보강해 왔는데, 그것이
 *   **더 큰 왜곡**을 만들었다(bug/13341):
 *     - 총계는 stale(349), 삭제는 실시간(291) → 생존 = 349-291 = 58 로 표시되지만
 *       실제 생존 글은 2건. 시점도 모집단도 다른 두 수를 뺀 값이었다.
 *     - 재계산이 `bo_use_search=1`(122개) 보드만 훑어 실제 삭제 311건 중 20건 누락.
 *     - 댓글은 재계산조차 없어 전부 stale.
 *
 *   → 이제 **총계·삭제를 같은 쿼리에서 함께** 센다. 뺄셈이 성립하고, 보드 모집단도
 *     하나다. 대상 보드는 `bo_use_search` 와 무관하게 **글이 있는 모든 보드**.
 *
 * ⛔ 레거시 하드삭제(행 자체가 없는 옛 삭제분)는 셀 수 없다 — 그건 총계에도 없으므로
 *    "총계-삭제=생존" 관계는 여전히 성립한다(과거 값보다 총계가 작아 보일 뿐 일관적).
 */
export interface QueryFn {
    <T>(sql: string, params?: unknown[]): Promise<[T[], unknown]>;
}

interface BoardRow {
    bo_table: string;
}

interface CountRow {
    total: number;
    deleted: number;
}

export interface MemberCounts {
    totalPosts: number;
    deletedPosts: number;
    totalComments: number;
    deletedComments: number;
}

/** 실존하는 g5_write_* 테이블만 돌려준다 — 보드 행만 있고 테이블이 없는 경우가 있다. */
async function listWritableBoards(query: QueryFn): Promise<string[]> {
    try {
        // information_schema 로 실존 테이블을 직접 확인한다.
        // ⛔ g5_board 목록만 믿으면 안 된다: `promotion_my` 처럼 보드 행은 있는데
        //    g5_write_* 가 없는 경우가 실재하고, UNION ALL 한 방이 통째로 실패해
        //    모든 회원의 삭제 수가 0 이 된다(과거 "삭제율 0%" 표시의 한 원인).
        const [rows] = await query<BoardRow>(
            `SELECT SUBSTRING(t.TABLE_NAME, 10) AS bo_table
               FROM information_schema.TABLES t
               JOIN g5_board b ON b.bo_table = SUBSTRING(t.TABLE_NAME, 10)
              WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME LIKE 'g5\\_write\\_%'`
        );
        return rows
            .map((r) => r.bo_table)
            .filter((t) => typeof t === 'string' && /^[a-zA-Z0-9_]+$/.test(t));
    } catch {
        return [];
    }
}

/**
 * 회원의 글·댓글 총계와 삭제 수를 한 번에 센다.
 * 실패 시 null — 호출부는 stale 값을 쓰지 말고 통계를 숨기는 편이 낫다.
 */
export async function calculateMemberCounts(
    query: QueryFn,
    mbId: string
): Promise<MemberCounts | null> {
    const boards = await listWritableBoards(query);
    if (boards.length === 0) return null;

    const isDeleted = `wr_deleted_at IS NOT NULL AND wr_deleted_at != '0000-00-00 00:00:00'`;
    const unionSql = boards
        .map(
            (t) =>
                `SELECT
                   SUM(wr_is_comment = 0) AS total,
                   SUM(wr_is_comment = 0 AND ${isDeleted}) AS deleted,
                   SUM(wr_is_comment = 1) AS c_total,
                   SUM(wr_is_comment = 1 AND ${isDeleted}) AS c_deleted
                 FROM g5_write_${t} WHERE mb_id = ?`
        )
        .join(' UNION ALL ');
    const params = boards.map(() => mbId);

    try {
        const [rows] = await query<CountRow & { c_total: number; c_deleted: number }>(
            unionSql,
            params
        );
        return rows.reduce<MemberCounts>(
            (acc, r) => ({
                totalPosts: acc.totalPosts + (Number(r.total) || 0),
                deletedPosts: acc.deletedPosts + (Number(r.deleted) || 0),
                totalComments: acc.totalComments + (Number(r.c_total) || 0),
                deletedComments: acc.deletedComments + (Number(r.c_deleted) || 0)
            }),
            { totalPosts: 0, deletedPosts: 0, totalComments: 0, deletedComments: 0 }
        );
    } catch {
        return null;
    }
}

/**
 * @deprecated calculateMemberCounts 를 쓸 것. 총계와 삭제를 따로 세면 뺄셈이 어긋난다.
 */
export async function calculateDeletePostCount(query: QueryFn, mbId: string): Promise<number> {
    const counts = await calculateMemberCounts(query, mbId);
    return counts?.deletedPosts ?? 0;
}
