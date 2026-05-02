/**
 * GET /api/plugins/brickang/buildings/active
 *
 * shop 위젯 등에서 사용. 활성 건축물 1개(가장 최근 active) + recent 5개.
 */
import { json, type RequestEvent } from '@sveltejs/kit';
import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from '../../server/db.js';
import { listActiveBuildings } from '../../server/buildings.js';

interface BrickRow extends RowDataPacket {
    id: number;
    nickname: string;
    message: string | null;
    placed_at: Date;
    brick_type_id: number;
    slug: string | null;
    color: string | null;
}

export async function GET(_event: RequestEvent): Promise<Response> {
    const buildings = await listActiveBuildings();
    if (buildings.length === 0) return json({ building: null, recent: [] });

    const b = buildings[0];
    const [recent] = await readPool.query<BrickRow[]>(
        `SELECT br.id, br.nickname, br.message, br.placed_at, br.brick_type_id, br.color, bt.slug
         FROM brickang_bricks br
         INNER JOIN brickang_brick_types bt ON bt.id = br.brick_type_id
         WHERE br.building_id = ?
         ORDER BY br.id DESC
         LIMIT 5`,
        [b.id]
    );

    return json({
        building: {
            id: b.id,
            name: b.name,
            target_bricks: b.targetBricks,
            current_bricks: b.currentBricks,
            progress_percent:
                b.targetBricks > 0 ? Math.min(100, (b.currentBricks / b.targetBricks) * 100) : 0,
            status: b.status
        },
        recent: recent.map((r) => ({
            id: r.id,
            nickname: r.nickname,
            message: r.slug === 'anonymous' ? null : r.message,
            placed_at: r.placed_at,
            brick_type_slug: r.slug
        }))
    });
}
