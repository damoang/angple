/**
 * 글에 투표가 달려 있는지 (상세 SSR → 투표 위젯 힌트)
 *
 * 투표는 극소수 글에만 달리는데 위젯은 모든 글 상세에서 by-post 를 불렀다.
 * 로더가 이 값을 실어 보내고, false + 비작성자면 위젯이 호출을 생략한다.
 *
 * ⛔ 반환값은 3상태다. 조회 실패·잘못된 인자는 반드시 null(=모름) — false(=없음)로
 *    떨어뜨리면 투표가 있는 글에서도 위젯이 사라진다(fail-open 이 깨짐).
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

export async function fetchHasPoll(boTable: string, wrId: number): Promise<boolean | null> {
    if (!boTable || !Number.isInteger(wrId) || wrId <= 0) return null;
    try {
        // uq_post(bo_table, wr_id) 유니크 인덱스 1건 조회
        const [rows] = await readPool.query<RowDataPacket[]>(
            'SELECT 1 FROM angple_polls WHERE bo_table = ? AND wr_id = ? LIMIT 1',
            [boTable, wrId]
        );
        return rows.length > 0;
    } catch {
        return null;
    }
}
