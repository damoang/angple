/**
 * POST /api/plugins/brickang/orders/confirm
 *
 * 단일 트랜잭션:
 *   1. plugins/payment/checkout/complete 내부 호출 (PG 승인)
 *   2. payment_orders 행 조회 → metadata.kind='brickang' 검증
 *   3. building_id FOR UPDATE 잠금
 *   4. quantity 만큼 placement.nextPosition() → (x,y,z)
 *   5. brickang_bricks INSERT × quantity (UNIQUE 충돌 시 재시도)
 *   6. brickang_buildings.current_bricks += quantity
 *   7. brickang_user_stats UPSERT
 *   8. milestone 도달 시 brickang_events INSERT
 *   9. Redis snapshot 무효화
 */

import { json, error, type RequestEvent } from '@sveltejs/kit';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../../server/db.js';
import { requireUser } from '../../server/auth.js';
import {
    getBuildingForUpdate,
    incrementCurrentBricks,
    getOccupiedSet
} from '../../server/buildings.js';
import { getBrickTypeBySlug } from '../../server/brick-types.js';
import { posKey, WallFirstStrategy, pickStrategy } from '../../server/placement.js';
import { consumeLockInTx } from '../../server/locks.js';
import { upsertUserStats, checkAndRecordMilestones } from '../../server/stats-aggregator.js';
import { invalidateBuildingSnapshot, pushRecentBrick } from '../../server/snapshot.js';
import type { BrickangOrderMetadata, BrickPosition } from '../../types/index.js';

interface ConfirmRequestBody {
    order_uid: string;
    pg_order_id: string;
    pg_payment_key?: string;
    amount: number;
}

interface PaymentOrderRow extends RowDataPacket {
    id: number;
    user_id: number;
    order_uid: string;
    amount: string | number;
    currency: string;
    status: string;
    metadata_json: string | null;
}

const MAX_INSERT_RETRY = 3;

export async function POST(event: RequestEvent): Promise<Response> {
    const user = requireUser(event);
    let body: ConfirmRequestBody;
    try {
        body = (await event.request.json()) as ConfirmRequestBody;
    } catch {
        throw error(400, 'invalid json');
    }

    if (!body.order_uid || !body.pg_order_id || !body.amount) {
        throw error(400, 'order_uid/pg_order_id/amount required');
    }

    // 1) plugins/payment/checkout/complete 위임 호출 (PG 승인)
    const completeRes = await event.fetch('/api/plugins/payment/checkout/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            orderUid: body.order_uid,
            pgOrderId: body.pg_order_id,
            pgPaymentKey: body.pg_payment_key,
            amount: body.amount
        })
    });
    if (!completeRes.ok) {
        const text = await completeRes.text();
        console.error('[brickang/confirm] payment complete failed:', completeRes.status, text);
        throw error(completeRes.status, `payment complete failed: ${text}`);
    }

    // 2) payment_orders 행 조회 (raw SQL — payment plugin 의 store 를 dynamic import 하지 않고 동일 풀 사용)
    const [orderRows] = await pool.query<PaymentOrderRow[]>(
        'SELECT * FROM payment_orders WHERE order_uid = ? LIMIT 1',
        [body.order_uid]
    );
    const orderRow = orderRows[0];
    if (!orderRow) throw error(404, 'order not found');
    if (orderRow.status !== 'paid') throw error(400, `order not paid: ${orderRow.status}`);
    if (orderRow.user_id !== user.userId) throw error(403, 'order does not belong to user');

    let metadata: BrickangOrderMetadata;
    try {
        const parsed = orderRow.metadata_json
            ? (JSON.parse(orderRow.metadata_json) as Record<string, unknown>)
            : null;
        if (!parsed || parsed.kind !== 'brickang') {
            throw new Error('not a brickang order');
        }
        metadata = parsed as unknown as BrickangOrderMetadata;
    } catch (err) {
        console.error('[brickang/confirm] metadata parse failed:', err);
        throw error(400, 'order metadata invalid');
    }

    const brickType = await getBrickTypeBySlug(metadata.brick_type_slug);
    if (!brickType) throw error(400, 'unknown brick_type in metadata');

    const buildingId = metadata.building_id;
    const quantity = metadata.quantity;
    const message = metadata.message;
    const nickname = brickType.isAnonymous ? '익명' : metadata.nickname_snapshot;
    const placedAt = new Date();

    // 3) 트랜잭션 시작 — building 잠금 후 placement → INSERT
    const conn = await pool.getConnection();
    const insertedBricks: Array<{
        id: number;
        position: { x: number; y: number; z: number };
        type: string;
        nickname: string;
    }> = [];
    let lockFallback = false;

    try {
        await conn.beginTransaction();

        const building = await getBuildingForUpdate(conn, buildingId);
        if (!building) throw error(404, 'building not found');
        if (building.status !== 'active') throw error(400, 'building not active');

        // race-safe placement: building.currentBricks 는 FOR UPDATE 로 잠긴 최신값
        const occupied = await getOccupiedSet(buildingId);
        let cursor = building.currentBricks;
        const autoStrategy = new WallFirstStrategy();

        // Phase 2: 자유 배치 lock 처리. lock_id 가 있으면 그 좌표 사용 + 행 삭제.
        // lock 만료/없음 → 자동 배치(WallFirst) 로 fallback (결제는 이미 완료되어 환불 회피).
        const picked = pickStrategy(metadata.brick_type_slug);
        let lockedPosition: BrickPosition | null = null;
        if (picked.kind === 'free' && metadata.lock_id) {
            const lockReason = await consumeLockInTx(conn, user.userId, metadata.lock_id);
            if (lockReason) {
                console.warn(
                    `[brickang/confirm] lock fallback for order=${body.order_uid} reason=${lockReason}`
                );
                lockFallback = true;
            } else if (metadata.position) {
                // lock 행 삭제 OK + 좌표 점유 검증 (race: 누가 같은 자리 INSERT 했을 가능성 차단)
                const key = posKey(metadata.position.x, metadata.position.y, metadata.position.z);
                if (occupied.has(key)) {
                    lockFallback = true;
                    console.warn(`[brickang/confirm] lock position already occupied — fallback`);
                } else {
                    lockedPosition = metadata.position;
                }
            }
        }

        for (let i = 0; i < quantity; i++) {
            let inserted = false;
            for (let attempt = 0; attempt < MAX_INSERT_RETRY && !inserted; attempt++) {
                let pos: BrickPosition;
                if (lockedPosition && i === 0 && attempt === 0) {
                    pos = lockedPosition;
                } else {
                    pos = autoStrategy.nextPosition(building, occupied, cursor + attempt);
                }
                try {
                    const [result] = await conn.query<ResultSetHeader>(
                        `INSERT INTO brickang_bricks
                            (building_id, user_id, nickname, message, brick_type_id, color,
                             position_x, position_y, position_z, placed_at, payment_order_id)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            buildingId,
                            user.userId,
                            nickname,
                            message,
                            brickType.id,
                            brickType.colorHex,
                            pos.x,
                            pos.y,
                            pos.z,
                            placedAt,
                            orderRow.id
                        ]
                    );
                    occupied.add(posKey(pos.x, pos.y, pos.z));
                    insertedBricks.push({
                        id: result.insertId,
                        position: pos,
                        type: brickType.slug,
                        nickname
                    });
                    cursor++;
                    inserted = true;
                } catch (err) {
                    const e = err as { code?: string };
                    if (e.code === 'ER_DUP_ENTRY') {
                        // race: 다음 슬롯으로 이동
                        occupied.add(posKey(pos.x, pos.y, pos.z));
                        // lock 좌표가 race 충돌 시 즉시 자동 fallback 으로 전환
                        if (lockedPosition && i === 0) {
                            lockedPosition = null;
                            lockFallback = true;
                        }
                        continue;
                    }
                    throw err;
                }
            }
            if (!inserted) {
                throw error(500, 'placement retry exhausted (UNIQUE conflict)');
            }
        }
        // 6) buildings.current_bricks 증가
        await incrementCurrentBricks(conn, buildingId, quantity);

        // 7) user_stats UPSERT
        const totalSpentKrw = orderRow.currency === 'KRW' ? Number(orderRow.amount) : 0;
        const totalSpentUsd = orderRow.currency === 'USD' ? Number(orderRow.amount) : 0;
        await upsertUserStats(conn, {
            userId: user.userId,
            deltaBricks: quantity,
            deltaSpentKrw: totalSpentKrw,
            deltaSpentUsd: totalSpentUsd,
            placedAt
        });

        // 8) milestone 검사
        const previousCount = building.currentBricks;
        const newCount = previousCount + quantity;
        await checkAndRecordMilestones(conn, buildingId, previousCount, newCount);

        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }

    // 9) 캐시 무효화 + recent push (트랜잭션 밖)
    await invalidateBuildingSnapshot(buildingId);
    for (const b of insertedBricks) {
        await pushRecentBrick(buildingId, {
            id: b.id,
            nickname: b.nickname,
            brickTypeSlug: b.type,
            placedAt: placedAt.toISOString()
        });
    }

    return json({ success: true, bricks: insertedBricks, lock_fallback: lockFallback });
}
