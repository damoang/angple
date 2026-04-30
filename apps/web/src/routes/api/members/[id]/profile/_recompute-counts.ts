/**
 * 프로필 통계 — g5_member_board_status 의 stale 한 누적값(레거시 PHP)
 * 대신 실시간 COUNT 를 사용하기 위한 헬퍼.
 *
 * 배경:
 *   g5_member_board_status.delete_post_count 는 갱신하는 cron / sync 가 없어서
 *   레거시 PHP 시절 누적된 값에서 멈춰있다 (#12113).
 *   재계산 가능한 카운트만이라도 실시간으로 보강한다.
 *
 * 비용:
 *   bo_use_search = 1 인 보드 리스트(~30개)에 대해 UNION ALL 단일 쿼리.
 *   wr_deleted_at 인덱스 + mb_id 인덱스 활용 시 50ms 미만.
 */
export interface QueryFn {
    <T>(sql: string, params?: unknown[]): Promise<[T[], unknown]>;
}

interface BoardRow {
    bo_table: string;
}

interface CountRow {
    cnt: number;
}

/**
 * 회원의 "삭제된 글" 건수를 모든 검색 가능 보드에 대해 실시간 합산한다.
 * - 댓글 제외 (wr_is_comment = 0)
 * - 소프트삭제 판단: wr_deleted_at IS NOT NULL AND wr_deleted_at != '0000-00-00 00:00:00'
 *
 * @param query  pool.query 호환 함수 (테스트에서 mock 가능)
 * @param mbId   회원 ID (caller 가 이미 검증했다고 가정 — 영숫자/_/- 만)
 * @returns      삭제 글 수. 보드 조회 실패 / 개별 보드 쿼리 실패 시 0 또는 부분합 반환.
 */
export async function calculateDeletePostCount(query: QueryFn, mbId: string): Promise<number> {
    // 1. 검색 가능 보드 목록 조회
    let boards: BoardRow[];
    try {
        const [rows] = await query<BoardRow>(
            'SELECT bo_table FROM g5_board WHERE bo_use_search = 1 ORDER BY bo_order'
        );
        boards = rows;
    } catch {
        return 0;
    }
    if (boards.length === 0) return 0;

    // 2. bo_table 화이트리스트 검증 (식별자 escape 대비 영숫자/_ 만 허용)
    const safeBoards = boards
        .map((b) => b.bo_table)
        .filter((t) => typeof t === 'string' && /^[a-zA-Z0-9_]+$/.test(t));
    if (safeBoards.length === 0) return 0;

    // 3. UNION ALL 단일 쿼리로 합산
    //    각 보드 SELECT 는 (mb_id, wr_is_comment, wr_deleted_at) 조건 — 인덱스 활용 가능
    const unionSql = safeBoards
        .map(
            (t) =>
                `SELECT COUNT(*) AS cnt FROM g5_write_${t}
                 WHERE mb_id = ? AND wr_is_comment = 0
                   AND wr_deleted_at IS NOT NULL
                   AND wr_deleted_at != '0000-00-00 00:00:00'`
        )
        .join(' UNION ALL ');
    const params = safeBoards.map(() => mbId);

    try {
        const [rows] = await query<CountRow>(unionSql, params);
        return rows.reduce((sum, r) => sum + (Number(r.cnt) || 0), 0);
    } catch {
        // 일부 보드의 g5_write_* 테이블이 없거나 wr_deleted_at 컬럼이 없을 수 있음 →
        // UNION ALL 한 쿼리가 통째로 실패하므로 보수적으로 0 반환 (기존 stale 값 사용 X).
        // 운영 환경에서는 모든 보드가 동일 스키마이므로 문제 없음.
        return 0;
    }
}
