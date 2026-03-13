/**
 * g5_member_memo 테이블 조회
 * 회원이 다른 회원에 대해 남긴 메모 목록 조회
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

interface MemoRow extends RowDataPacket {
    id: number;
    member_id: string;
    target_member_id: string;
    memo: string;
    memo_detail: string;
    color: string;
    created_at: string;
    updated_at: string;
    target_mb_nick: string;
    target_mb_level: number;
    target_mb_leave_date: string;
}

interface CountRow extends RowDataPacket {
    cnt: number;
}

export interface MemberMemoItem {
    id: number;
    target_member_id: string;
    target_member_nickname: string;
    target_member_level: number;
    target_member_left: boolean;
    memo: string;
    memo_detail: string;
    color: string;
    created_at: string;
}

export interface MemberMemoListResult {
    items: MemberMemoItem[];
    total: number;
    page: number;
    totalPages: number;
}

export async function getMyMemos(
    memberId: string,
    page: number,
    limit: number
): Promise<MemberMemoListResult> {
    const offset = (page - 1) * limit;

    const [[countResult], [rows]] = await Promise.all([
        readPool.query<CountRow[]>(
            `SELECT COUNT(*) AS cnt FROM g5_member_memo WHERE member_id = ?`,
            [memberId]
        ),
        readPool.query<MemoRow[]>(
            `SELECT m.id, m.target_member_id, m.memo, m.memo_detail, m.color,
                    m.created_at, m.updated_at,
                    g.mb_nick AS target_mb_nick,
                    g.mb_level AS target_mb_level,
                    g.mb_leave_date AS target_mb_leave_date
             FROM g5_member_memo m
             LEFT JOIN g5_member g ON g.mb_id = m.target_member_id
             WHERE m.member_id = ?
             ORDER BY m.updated_at DESC
             LIMIT ? OFFSET ?`,
            [memberId, limit, offset]
        )
    ]);

    const total = countResult[0]?.cnt ?? 0;

    return {
        items: rows.map((r) => ({
            id: r.id,
            target_member_id: r.target_member_id,
            target_member_nickname: r.target_mb_nick || r.target_member_id,
            target_member_level: r.target_mb_level ?? 0,
            target_member_left: !!r.target_mb_leave_date,
            memo: r.memo ?? '',
            memo_detail: r.memo_detail ?? '',
            color: r.color || 'yellow',
            created_at: r.created_at
        })),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit))
    };
}
