import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { readPool } from '$lib/server/db.js';

export const LEVEL_HISTORY_TABLE = 'g5_member_level_history';

export const LEVEL_HISTORY_REASONS = {
    AUTO_PROMOTE_LOGIN_WEB: 'auto_promote_login_web',
    AUTO_PROMOTE_SOCIAL: 'auto_promote_login_social',
    ADMIN_MANUAL: 'admin_manual',
    ADMIN_MANUAL_BULK: 'admin_manual_bulk'
} as const;

export type MemberLevelHistoryReason =
    (typeof LEVEL_HISTORY_REASONS)[keyof typeof LEVEL_HISTORY_REASONS];

export interface MemberLevelHistoryEntry {
    mbId: string;
    oldMbLevel: number;
    newMbLevel: number;
    reason: MemberLevelHistoryReason;
    snapshotAsLevel: number;
    snapshotAsExp: number;
    snapshotLoginDays: number;
    snapshotMbCertify: string;
    memberCreatedAt: Date | null;
}

export interface RecentPromotionHistoryItem {
    mb_id: string;
    mb_nick: string;
    old_mb_level: number;
    new_mb_level: number;
    reason: string;
    snapshot_as_level: number;
    snapshot_as_exp: number;
    snapshot_login_days: number;
    snapshot_mb_certify: string;
    member_created_at: Date | null;
    created_at: Date;
}

interface RecentPromotionHistoryRow extends RowDataPacket, RecentPromotionHistoryItem {}

export function isMissingLevelHistoryTableError(err: unknown): boolean {
    if (!err || typeof err !== 'object') {
        return false;
    }

    const mysqlErr = err as { code?: string; message?: string };
    return (
        mysqlErr.code === 'ER_NO_SUCH_TABLE' &&
        (mysqlErr.message || '').includes(LEVEL_HISTORY_TABLE)
    );
}

export async function insertMemberLevelHistory(
    conn: Pick<PoolConnection, 'query'>,
    entry: MemberLevelHistoryEntry
): Promise<void> {
    await conn.query<ResultSetHeader>(
        `INSERT INTO ${LEVEL_HISTORY_TABLE}
            (mb_id, old_mb_level, new_mb_level, reason, snapshot_as_level, snapshot_as_exp,
             snapshot_login_days, snapshot_mb_certify, member_created_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
            entry.mbId,
            entry.oldMbLevel,
            entry.newMbLevel,
            entry.reason,
            entry.snapshotAsLevel,
            entry.snapshotAsExp,
            entry.snapshotLoginDays,
            entry.snapshotMbCertify,
            entry.memberCreatedAt
        ]
    );
}

export async function getRecentPromotionHistory(
    days = 4,
    limit = 100
): Promise<RecentPromotionHistoryItem[]> {
    const safeDays = Number.isFinite(days) ? Math.min(Math.max(Math.trunc(days), 1), 30) : 4;
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 200) : 100;
    const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const [rows] = await readPool.query<RecentPromotionHistoryRow[]>(
        `SELECT h.mb_id,
                COALESCE(m.mb_nick, '') as mb_nick,
                h.old_mb_level,
                h.new_mb_level,
                h.reason,
                h.snapshot_as_level,
                h.snapshot_as_exp,
                h.snapshot_login_days,
                h.snapshot_mb_certify,
                h.member_created_at,
                h.created_at
         FROM ${LEVEL_HISTORY_TABLE} h
         LEFT JOIN g5_member m ON m.mb_id = h.mb_id
         WHERE h.created_at >= ?
         ORDER BY h.created_at DESC
         LIMIT ?`,
        [cutoff, safeLimit]
    );

    return rows;
}
