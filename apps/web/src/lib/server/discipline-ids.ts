/**
 * 이용제한 근거 글·댓글 ID 집합 (게시판 단위 캐시)
 *
 * `g5_na_singo.discipline_log_id IS NOT NULL` 인 대상은 화면에 "근거" 표시가 붙는다.
 *
 * ## ⛔ 왜 캐시하는가 — DB 실행시간의 5.0% 였다
 *
 * 댓글 목록을 그릴 때마다 그 글의 댓글 ID 를 통째로 넣어 조회하고 있었다.
 * 2026-08-18 실측(performance_schema, 가동 490시간):
 *
 *   호출 205,449,448회 (초당 116회) · 누적 156,047초 · DB 전체의 5.0%
 *   호출당 스캔 28행 · **반환 0.0행**
 *
 * 한 번이 느린 게 아니라(EXPLAIN `rows: 5`) **부르는 횟수가 문제**다.
 * 그리고 거의 언제나 빈손으로 돌아온다.
 *
 * ⭐ 대상 전체가 작다 — 게시판 전부 합쳐 **3,407개(약 54KB)** 다.
 *   free 3,171 · truthroom 120 · car 32 · hello 25 · …
 *   그래서 게시판별로 **통째로 캐시**하고 메모리에서 판정한다. DB 왕복이 사라진다.
 *
 * ## ⛔ 갱신 쿼리가 비싸면 문제를 옮기는 것일 뿐이다
 *
 * 처음 재보니 갱신 쿼리가 153,626행을 훑고 **0.705초** 였다(그대로 캐시했으면 이득이 2배뿐).
 * `g5_na_singo` 에 `discipline_log_id` 를 포함한 인덱스가 **하나도 없었다.**
 * → `idx_table_disc_id(sg_table, discipline_log_id, sg_id)` 추가(4MB) 후 **0.072초**(10배).
 *   커버링(`Using index`)으로 동작한다. ⛔ 이 인덱스를 지우면 갱신이 다시 비싸진다.
 *
 * ## TTL
 *
 * 제재는 하루 몇 건 수준이라 5분이면 충분하다. 갱신이 늦어도 "근거 표시"가
 * 최대 5분 늦게 붙을 뿐, 글이 잘못 보이지는 않는다.
 */
import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import type { RowDataPacket } from 'mysql2';

const TTL_SEC = 300;

interface IdRow extends RowDataPacket {
    sg_id: number;
}

/**
 * 게시판의 이용제한 근거 대상 ID 집합.
 *
 * ⛔ 실패해도 던지지 않는다. 이 값은 **표시용 부가 정보**라,
 *    못 가져왔다고 댓글 목록 자체가 실패하면 안 된다(기존 동작과 동일하게 빈 집합).
 */
export async function getDisciplineIds(boardId: string): Promise<Set<number>> {
    const key = `disc:ids:${boardId}`;

    try {
        const hit = await getRedis().get(key);
        if (hit !== null) {
            const arr = JSON.parse(hit) as number[];
            return new Set(arr);
        }
    } catch {
        // Redis 장애 → DB 로 간다
    }

    let ids: number[] = [];
    try {
        const [rows] = await pool.query<IdRow[]>(
            `SELECT DISTINCT sg_id FROM g5_na_singo
             WHERE sg_table = ? AND discipline_log_id IS NOT NULL`,
            [boardId]
        );
        ids = rows.map((r) => r.sg_id);
    } catch (e) {
        console.warn('[discipline] id set 조회 실패:', e);
        return new Set();
    }

    try {
        // ⛔ 빈 결과도 캐시한다. 대부분의 게시판이 실제로 0개라, 캐시하지 않으면
        //    그 게시판들은 매 요청마다 DB 를 쳐서 원래 문제가 그대로 남는다.
        await getRedis().setex(key, TTL_SEC, JSON.stringify(ids));
    } catch {
        // Redis 장애 무시
    }

    return new Set(ids);
}
