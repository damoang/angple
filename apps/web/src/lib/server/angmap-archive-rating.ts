/**
 * 앙지도(angmap) 레거시 평점 아카이브 조회 — 읽기 전용.
 *
 * gnuboard 시절 `g5_board_rate_average`(10점 척도)에 쌓인 과거 집계다. 신규 5점
 * `angple_post_ratings` 와는 **개인식별 매핑이 없어 합칠 수 없다**(합치려면 가짜 투표자를
 * 지어내야 하고 그건 날조). 이 테이블은 현재 코드베이스에서 쓰기가 완전히 죽은 동결 상태라,
 * 신규 평점 재계산(COUNT/AVG over 개인행)에 절대 덮이지 않는다. 그래서 "과거 평점"으로
 * **별도 표시만** 한다 — 10점을 2로 나눠 5점 척도로 환산.
 *
 * ⛔ 쓰기 금지. ⛔ 신규 rating(post.rating)과 합치지 말 것 — 나란히 두 숫자로만 보여준다.
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import type { ArchiveRating } from '$lib/api/types.js';

interface RateRow extends RowDataPacket {
    rate_average: number | string;
    rate_count: number | string;
}

/**
 * 주어진 앙지도 글의 레거시 평점을 반환. 과거 평가가 없으면(또는 조회 실패) undefined.
 * 아카이브는 부가정보이므로 조회 실패가 페이지 렌더를 깨선 안 된다 → 항상 undefined 로 흡수.
 */
export async function fetchAngmapArchiveRating(wrId: number): Promise<ArchiveRating | undefined> {
    if (!Number.isFinite(wrId) || wrId <= 0) return undefined;
    try {
        const [rows] = await readPool.query<RateRow[]>(
            `SELECT rate_average, rate_count
             FROM g5_board_rate_average
             WHERE bo_table = 'angmap' AND wr_id = ?
             LIMIT 1`,
            [wrId]
        );
        const row = rows[0];
        const count = Number(row?.rate_count ?? 0);
        if (!row || count < 1) return undefined;
        // 10점 → 5점 환산, 소수 1자리
        const avg5 = Math.round((Number(row.rate_average) / 2) * 10) / 10;
        return { avg5, count };
    } catch {
        return undefined;
    }
}
