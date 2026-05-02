/**
 * 사용자 누적 통계(`brickang_user_stats`) UPSERT + 마일스톤 검사.
 *
 * `confirm.ts` 의 트랜잭션 안에서 호출되므로 conn(트랜잭션 connection)을 인자로 받는다.
 */

import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { MILESTONES } from '../types/index.js';

export async function upsertUserStats(
    conn: PoolConnection,
    input: {
        userId: number;
        deltaBricks: number;
        deltaSpentKrw: number;
        deltaSpentUsd: number;
        placedAt: Date;
    }
): Promise<void> {
    await conn.query(
        `INSERT INTO brickang_user_stats
            (user_id, total_bricks, total_spent_krw, total_spent_usd, first_brick_at, last_brick_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            total_bricks = total_bricks + VALUES(total_bricks),
            total_spent_krw = total_spent_krw + VALUES(total_spent_krw),
            total_spent_usd = total_spent_usd + VALUES(total_spent_usd),
            first_brick_at = COALESCE(first_brick_at, VALUES(first_brick_at)),
            last_brick_at = VALUES(last_brick_at)`,
        [
            input.userId,
            input.deltaBricks,
            input.deltaSpentKrw,
            input.deltaSpentUsd,
            input.placedAt,
            input.placedAt
        ]
    );
}

export async function checkAndRecordMilestones(
    conn: PoolConnection,
    buildingId: number,
    previousCount: number,
    newCount: number
): Promise<number[]> {
    const reached: number[] = [];
    for (const m of MILESTONES) {
        if (previousCount < m && newCount >= m) {
            reached.push(m);
            await conn.query(
                `INSERT INTO brickang_events
                    (building_id, event_type, milestone_count, title, description)
                 VALUES (?, 'milestone', ?, ?, ?)`,
                [
                    buildingId,
                    m,
                    `${m.toLocaleString()}개 벽돌 달성!`,
                    `${m.toLocaleString()}번째 벽돌이 놓였습니다.`
                ]
            );
        }
    }
    return reached;
}

export async function getUserStats(conn: PoolConnection, userId: number): Promise<unknown> {
    const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM brickang_user_stats WHERE user_id = ?',
        [userId]
    );
    return rows[0] ?? null;
}
