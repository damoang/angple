/**
 * GET /api/plugins/brickang/bricks/recent
 * 전역 최근 벽돌 (모든 건축물).
 */
import { json, type RequestEvent } from '@sveltejs/kit';
import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from '../../server/db.js';

interface RecentRow extends RowDataPacket {
    id: number;
    building_id: number;
    nickname: string;
    message: string | null;
    placed_at: Date;
    slug: string;
    color: string | null;
}

export async function GET(event: RequestEvent): Promise<Response> {
    const limit = Math.min(50, Math.max(1, Number(event.url.searchParams.get('limit') ?? 20)));

    const [rows] = await readPool.query<RecentRow[]>(
        `SELECT br.id, br.building_id, br.nickname, br.message, br.placed_at, br.color, bt.slug
         FROM brickang_bricks br
         INNER JOIN brickang_brick_types bt ON bt.id = br.brick_type_id
         ORDER BY br.id DESC
         LIMIT ?`,
        [limit]
    );

    return json({
        limit,
        bricks: rows.map((r) => ({
            id: r.id,
            building_id: r.building_id,
            nickname: r.nickname,
            message: r.slug === 'anonymous' ? null : r.message,
            placed_at: r.placed_at,
            brick_type_slug: r.slug,
            color: r.color
        }))
    });
}
