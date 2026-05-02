/**
 * GET /api/plugins/brickang/buildings/:id/bricks/recent
 * 최근 N개 (default 10).
 */
import { json, error, type RequestEvent } from '@sveltejs/kit';
import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from '../../server/db.js';

interface BrickRow extends RowDataPacket {
    id: number;
    nickname: string;
    message: string | null;
    position_x: number;
    position_y: number;
    position_z: number;
    placed_at: Date;
    slug: string;
    color: string | null;
}

export async function GET(event: RequestEvent): Promise<Response> {
    const id = Number(event.params.id);
    if (!id) throw error(400, 'invalid building id');

    const limit = Math.min(50, Math.max(1, Number(event.url.searchParams.get('limit') ?? 10)));

    const [rows] = await readPool.query<BrickRow[]>(
        `SELECT br.id, br.nickname, br.message, br.position_x, br.position_y, br.position_z,
                br.placed_at, br.color, bt.slug
         FROM brickang_bricks br
         INNER JOIN brickang_brick_types bt ON bt.id = br.brick_type_id
         WHERE br.building_id = ?
         ORDER BY br.id DESC
         LIMIT ?`,
        [id, limit]
    );

    return json({
        building_id: id,
        limit,
        bricks: rows.map((r) => ({
            id: r.id,
            nickname: r.nickname,
            message: r.slug === 'anonymous' ? null : r.message,
            position: { x: r.position_x, y: r.position_y, z: r.position_z },
            placed_at: r.placed_at,
            brick_type_slug: r.slug,
            color: r.color
        }))
    });
}
