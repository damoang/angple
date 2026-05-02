/**
 * GET /api/plugins/brickang/rankings/all
 * 전체 누적 랭킹 (Redis 1시간 캐시).
 */
import { json, type RequestEvent } from '@sveltejs/kit';
import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from '../../server/db.js';
import { getRedis } from '$lib/server/redis';

interface RankRow extends RowDataPacket {
    user_id: number;
    total_bricks: number;
    total_spent_krw: number;
    last_brick_at: Date | null;
    nickname: string | null;
}

const CACHE_KEY = 'brickang:ranking:all';
const CACHE_TTL_SEC = 60 * 60;

export async function GET(event: RequestEvent): Promise<Response> {
    const limit = Math.min(100, Math.max(1, Number(event.url.searchParams.get('limit') ?? 50)));

    try {
        const cached = await getRedis().get(CACHE_KEY);
        if (cached) return json(JSON.parse(cached));
    } catch {
        // ignore — fallback to DB
    }

    const [rows] = await readPool.query<RankRow[]>(
        `SELECT us.user_id, us.total_bricks, us.total_spent_krw, us.last_brick_at,
                (SELECT br.nickname FROM brickang_bricks br
                 WHERE br.user_id = us.user_id ORDER BY br.id DESC LIMIT 1) AS nickname
         FROM brickang_user_stats us
         ORDER BY us.total_bricks DESC
         LIMIT ?`,
        [limit]
    );

    const payload = {
        scope: 'all',
        rankings: rows.map((r, idx) => ({
            rank: idx + 1,
            user_id: r.user_id,
            nickname: r.nickname ?? `user-${r.user_id}`,
            total_bricks: r.total_bricks,
            total_spent_krw: Number(r.total_spent_krw),
            last_brick_at: r.last_brick_at
        }))
    };

    try {
        await getRedis().set(CACHE_KEY, JSON.stringify(payload), 'EX', CACHE_TTL_SEC);
    } catch {
        // ignore
    }

    return json(payload);
}
