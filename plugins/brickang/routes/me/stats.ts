/**
 * GET /api/plugins/brickang/me/stats
 */
import { json, type RequestEvent } from '@sveltejs/kit';
import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from '../../server/db.js';
import { requireUser } from '../../server/auth.js';

interface StatsRow extends RowDataPacket {
    user_id: number;
    total_bricks: number;
    total_spent_krw: number;
    total_spent_usd: string | number;
    first_brick_at: Date | null;
    last_brick_at: Date | null;
    user_rank: number | null;
}

export async function GET(event: RequestEvent): Promise<Response> {
    const user = requireUser(event);

    const [rows] = await readPool.query<StatsRow[]>(
        'SELECT * FROM brickang_user_stats WHERE user_id = ? LIMIT 1',
        [user.userId]
    );

    if (!rows[0]) {
        return json({
            user_id: user.userId,
            total_bricks: 0,
            total_spent_krw: 0,
            total_spent_usd: 0,
            first_brick_at: null,
            last_brick_at: null,
            user_rank: null
        });
    }

    const r = rows[0];
    return json({
        user_id: r.user_id,
        total_bricks: r.total_bricks,
        total_spent_krw: Number(r.total_spent_krw),
        total_spent_usd: Number(r.total_spent_usd),
        first_brick_at: r.first_brick_at,
        last_brick_at: r.last_brick_at,
        user_rank: r.user_rank
    });
}
