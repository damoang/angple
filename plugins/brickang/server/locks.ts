/**
 * brickang 위치 lock 헬퍼 (Phase 2).
 *
 * 자유 배치(silver/gold/diamond) 흐름:
 *   1. 사용자가 좌표 클릭 → POST /locks/acquire → INSERT brickang_position_locks (5분 TTL)
 *   2. 결제 진행 (lock_id 를 metadata 에 보관)
 *   3. /orders/confirm 시 lock 행 삭제 + brick INSERT (단일 tx)
 *   4. 만료 lock 은 cron / manual cleanup 으로 정리
 *
 * NOTE: `@sveltejs/kit` 직접 import 금지 (auth.ts 동일 함정).
 */

import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool, readPool } from './db.js';
import type { BrickPosition, PositionLock } from '../types/index.js';

const LOCK_TTL_MS = 5 * 60 * 1000; // 5분

interface LockRow extends RowDataPacket {
    id: number;
    building_id: number;
    position_x: number;
    position_y: number;
    position_z: number;
    user_id: number;
    expires_at: Date;
    created_at: Date;
}

function rowToLock(r: LockRow): PositionLock {
    return {
        id: r.id,
        buildingId: r.building_id,
        position: { x: r.position_x, y: r.position_y, z: r.position_z },
        userId: r.user_id,
        expiresAt: r.expires_at,
        createdAt: r.created_at
    };
}

/**
 * 위치 lock 획득. UNIQUE 충돌(다른 사용자 점유) 시 null 반환.
 * 만료된 lock 행이 있으면 사전 cleanup 한 후 재시도한다.
 */
export async function acquireLock(
    userId: number,
    buildingId: number,
    pos: BrickPosition
): Promise<PositionLock | null> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 만료된 lock 사전 정리 (해당 좌표만)
        await conn.query(
            `DELETE FROM brickang_position_locks
             WHERE building_id = ? AND position_x = ? AND position_y = ? AND position_z = ?
               AND expires_at < NOW(6)`,
            [buildingId, pos.x, pos.y, pos.z]
        );

        const expiresAt = new Date(Date.now() + LOCK_TTL_MS);
        try {
            const [result] = await conn.query<ResultSetHeader>(
                `INSERT INTO brickang_position_locks
                    (building_id, position_x, position_y, position_z, user_id, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [buildingId, pos.x, pos.y, pos.z, userId, expiresAt]
            );
            await conn.commit();
            return {
                id: result.insertId,
                buildingId,
                position: pos,
                userId,
                expiresAt,
                createdAt: new Date()
            };
        } catch (err) {
            await conn.rollback();
            const e = err as { code?: string };
            if (e.code === 'ER_DUP_ENTRY') return null;
            throw err;
        }
    } finally {
        conn.release();
    }
}

/**
 * lock 조회 (id 기반).
 */
export async function getLockById(lockId: number): Promise<PositionLock | null> {
    const [rows] = await readPool.query<LockRow[]>(
        'SELECT * FROM brickang_position_locks WHERE id = ? LIMIT 1',
        [lockId]
    );
    return rows[0] ? rowToLock(rows[0]) : null;
}

/**
 * 사용자 본인 lock 만 삭제. 다른 사람 lock 이면 0 반환.
 */
export async function releaseLock(userId: number, lockId: number): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM brickang_position_locks WHERE id = ? AND user_id = ?',
        [lockId, userId]
    );
    return result.affectedRows;
}

/**
 * 트랜잭션 내에서 lock 사용 + 삭제. 만료/소유주 불일치 시 예외 사유 반환.
 *
 * @returns null = 통과 (행 삭제됨), string = 거절 사유
 */
export async function consumeLockInTx(
    conn: PoolConnection,
    userId: number,
    lockId: number
): Promise<string | null> {
    const [rows] = await conn.query<LockRow[]>(
        'SELECT * FROM brickang_position_locks WHERE id = ? FOR UPDATE',
        [lockId]
    );
    const lock = rows[0];
    if (!lock) return 'lock_not_found';
    if (lock.user_id !== userId) return 'lock_not_owner';
    if (lock.expires_at.getTime() < Date.now()) {
        // 만료된 lock 행은 삭제만 하고 caller 가 fallback 하도록 사유 반환
        await conn.query('DELETE FROM brickang_position_locks WHERE id = ?', [lockId]);
        return 'lock_expired';
    }
    await conn.query('DELETE FROM brickang_position_locks WHERE id = ?', [lockId]);
    return null;
}

/**
 * 만료된 모든 lock 정리. cron 또는 admin 트리거가 호출.
 *
 * @returns 삭제된 행 수
 */
export async function cleanExpiredLocks(limit: number = 100): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        'DELETE FROM brickang_position_locks WHERE expires_at < NOW(6) LIMIT ?',
        [limit]
    );
    return result.affectedRows;
}
