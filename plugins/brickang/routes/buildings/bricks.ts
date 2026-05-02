/**
 * GET /api/plugins/brickang/buildings/:id/bricks
 *
 * Phase 1: 직접 SELECT (전체 벽돌). offset/limit 페이지네이션.
 * Phase 2 에서는 snapshot 우선 + 닉네임/메시지 lazy-load 로 마이그레이션.
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
    brick_type_id: number;
    slug: string;
    color: string | null;
}

const MAX_LIMIT = 5000;

export async function GET(event: RequestEvent): Promise<Response> {
    const id = Number(event.params.id);
    if (!id) throw error(400, 'invalid building id');

    const url = event.url;
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit') ?? 1000)));
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));

    const [rows] = await readPool.query<BrickRow[]>(
        `SELECT br.id, br.nickname, br.message, br.position_x, br.position_y, br.position_z,
                br.placed_at, br.brick_type_id, br.color, bt.slug
         FROM brickang_bricks br
         INNER JOIN brickang_brick_types bt ON bt.id = br.brick_type_id
         WHERE br.building_id = ?
         ORDER BY br.id ASC
         LIMIT ? OFFSET ?`,
        [id, limit, offset]
    );

    return json({
        building_id: id,
        limit,
        offset,
        bricks: rows.map((r) => ({
            id: r.id,
            nickname: r.nickname,
            // 익명 등급은 메시지 미노출
            message: r.slug === 'anonymous' ? null : r.message,
            position: { x: r.position_x, y: r.position_y, z: r.position_z },
            placed_at: r.placed_at,
            brick_type_slug: r.slug,
            color: r.color
        }))
    });
}
