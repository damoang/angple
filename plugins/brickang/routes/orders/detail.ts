/**
 * GET /api/plugins/brickang/orders/:order_uid
 *
 * payment_orders + brickang_bricks 조인하여 주문 상태 + 놓인 벽돌 반환.
 */
import { json, error, type RequestEvent } from '@sveltejs/kit';
import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from '../../server/db.js';
import { requireUser } from '../../server/auth.js';

interface OrderRow extends RowDataPacket {
    id: number;
    user_id: number;
    order_uid: string;
    provider: string;
    amount: string | number;
    currency: string;
    status: string;
    metadata_json: string | null;
    paid_at: Date | null;
    created_at: Date;
}

interface BrickRow extends RowDataPacket {
    id: number;
    building_id: number;
    nickname: string;
    message: string | null;
    position_x: number;
    position_y: number;
    position_z: number;
    placed_at: Date;
    brick_type_id: number;
    color: string | null;
}

export async function GET(event: RequestEvent): Promise<Response> {
    const user = requireUser(event);
    const orderUid = event.params.order_uid;
    if (!orderUid) throw error(400, 'order_uid required');

    const [orderRows] = await readPool.query<OrderRow[]>(
        'SELECT * FROM payment_orders WHERE order_uid = ? LIMIT 1',
        [orderUid]
    );
    const order = orderRows[0];
    if (!order) throw error(404, 'order not found');
    if (order.user_id !== user.userId) throw error(403, 'forbidden');

    const [brickRows] = await readPool.query<BrickRow[]>(
        'SELECT * FROM brickang_bricks WHERE payment_order_id = ? ORDER BY id ASC',
        [order.id]
    );

    return json({
        order_uid: order.order_uid,
        provider: order.provider,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status,
        metadata: order.metadata_json ? JSON.parse(order.metadata_json) : null,
        paid_at: order.paid_at,
        created_at: order.created_at,
        bricks: brickRows.map((b) => ({
            id: b.id,
            building_id: b.building_id,
            nickname: b.nickname,
            message: b.message,
            position: { x: b.position_x, y: b.position_y, z: b.position_z },
            placed_at: b.placed_at,
            brick_type_id: b.brick_type_id,
            color: b.color
        }))
    });
}
