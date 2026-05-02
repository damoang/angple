/**
 * GET /api/plugins/brickang/me/bricks
 * 내 벽돌 목록.
 */
import { json, type RequestEvent } from '@sveltejs/kit';
import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from '../../server/db.js';
import { requireUser } from '../../server/auth.js';

interface MyBrickRow extends RowDataPacket {
    id: number;
    building_id: number;
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
    const user = requireUser(event);
    const limit = Math.min(500, Math.max(1, Number(event.url.searchParams.get('limit') ?? 100)));
    const offset = Math.max(0, Number(event.url.searchParams.get('offset') ?? 0));

    const [rows] = await readPool.query<MyBrickRow[]>(
        `SELECT br.id, br.building_id, br.nickname, br.message,
                br.position_x, br.position_y, br.position_z,
                br.placed_at, br.color, bt.slug
         FROM brickang_bricks br
         INNER JOIN brickang_brick_types bt ON bt.id = br.brick_type_id
         WHERE br.user_id = ?
         ORDER BY br.id DESC
         LIMIT ? OFFSET ?`,
        [user.userId, limit, offset]
    );

    return json({
        limit,
        offset,
        bricks: rows.map((r) => ({
            id: r.id,
            building_id: r.building_id,
            nickname: r.nickname,
            message: r.message, // 본인 행이므로 익명도 노출 (어뷰징 추적 차원에서 본인은 볼 수 있음)
            position: { x: r.position_x, y: r.position_y, z: r.position_z },
            placed_at: r.placed_at,
            brick_type_slug: r.slug,
            color: r.color
        }))
    });
}
