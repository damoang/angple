/**
 * GET /api/plugins/brickang/rankings/monthly
 * 월간 랭킹 (당월 1일 ~ 현재). Redis 10분 캐시.
 */
import { json, type RequestEvent } from '@sveltejs/kit';
import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from '../../server/db.js';
import { getRedis } from '$lib/server/redis';

interface MonthRow extends RowDataPacket {
    user_id: number;
    nickname: string;
    bricks: number;
    spent_krw: number;
}

const CACHE_TTL_SEC = 10 * 60;

export async function GET(event: RequestEvent): Promise<Response> {
    const limit = Math.min(100, Math.max(1, Number(event.url.searchParams.get('limit') ?? 50)));

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const cacheKey = `brickang:ranking:monthly:${month}`;

    try {
        const cached = await getRedis().get(cacheKey);
        if (cached) return json(JSON.parse(cached));
    } catch {
        // ignore
    }

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [rows] = await readPool.query<MonthRow[]>(
        `SELECT br.user_id, br.nickname,
                COUNT(*) AS bricks,
                COALESCE(SUM(po.amount), 0) AS spent_krw
         FROM brickang_bricks br
         INNER JOIN payment_orders po ON po.id = br.payment_order_id
         WHERE br.placed_at >= ?
         GROUP BY br.user_id, br.nickname
         ORDER BY bricks DESC
         LIMIT ?`,
        [startOfMonth, limit]
    );

    const payload = {
        scope: 'monthly',
        month,
        rankings: rows.map((r, idx) => ({
            rank: idx + 1,
            user_id: r.user_id,
            nickname: r.nickname,
            bricks: Number(r.bricks),
            spent_krw: Number(r.spent_krw)
        }))
    };

    try {
        await getRedis().set(cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL_SEC);
    } catch {
        // ignore
    }

    return json(payload);
}
