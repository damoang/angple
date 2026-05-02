/**
 * GET /api/plugins/brickang/buildings/:id/rankings
 * 건축물별 사용자 기여도 랭킹 (벽돌 수 기준).
 */
import { json, error, type RequestEvent } from '@sveltejs/kit';
import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from '../../server/db.js';

interface RankRow extends RowDataPacket {
    user_id: number;
    nickname: string;
    bricks: number;
    spent_krw: number;
}

export async function GET(event: RequestEvent): Promise<Response> {
    const id = Number(event.params.id);
    if (!id) throw error(400, 'invalid building id');

    const limit = Math.min(100, Math.max(1, Number(event.url.searchParams.get('limit') ?? 30)));

    // 익명 행은 user_id 별로도 모이지만 닉네임은 '익명' 으로 통일하므로 group by user_id + nickname
    const [rows] = await readPool.query<RankRow[]>(
        `SELECT br.user_id, br.nickname,
                COUNT(*) AS bricks,
                COALESCE(SUM(po.amount), 0) AS spent_krw
         FROM brickang_bricks br
         INNER JOIN payment_orders po ON po.id = br.payment_order_id
         WHERE br.building_id = ?
         GROUP BY br.user_id, br.nickname
         ORDER BY bricks DESC
         LIMIT ?`,
        [id, limit]
    );

    return json({
        building_id: id,
        rankings: rows.map((r, idx) => ({
            rank: idx + 1,
            user_id: r.user_id,
            nickname: r.nickname,
            bricks: Number(r.bricks),
            spent_krw: Number(r.spent_krw)
        }))
    });
}
