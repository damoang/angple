/**
 * 회원 메모 SSR 서버 모듈
 * g5_member_memo JOIN g5_member — 내가 작성한 메모 목록 조회
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

interface MemoRow extends RowDataPacket {
    id: number;
    member_id: string;
    target_member_id: string;
    memo: string;
    memo_detail: string | null;
    color: string;
    created_at: string;
    updated_at: string | null;
    target_mb_nick: string;
    target_mb_icon_path: string;
}

interface CountRow extends RowDataPacket {
    cnt: number;
}

export interface MemoItem {
    id: number;
    member_id: string;
    target_member_id: string;
    memo: string;
    memo_detail: string | null;
    color: string;
    created_at: string;
    updated_at: string | null;
    target_mb_nick: string;
    target_mb_icon_path: string;
}

export interface MemoListResult {
    items: MemoItem[];
    total: number;
    page: number;
    totalPages: number;
}

export async function getMyMemos(
    memberId: string,
    page: number,
    limit: number
): Promise<MemoListResult> {
    const offset = (page - 1) * limit;

    const [[countRows], [rows]] = await Promise.all([
        readPool.query<CountRow[]>(
            'SELECT COUNT(*) AS cnt FROM g5_member_memo WHERE member_id = ?',
            [memberId]
        ),
        readPool.query<MemoRow[]>(
            `SELECT m.id, m.member_id, m.target_member_id, m.memo, m.memo_detail, m.color,
			        m.created_at, m.updated_at,
			        COALESCE(mb.mb_nick, m.target_member_id) AS target_mb_nick,
			        COALESCE(mb.mb_icon_path, '') AS target_mb_icon_path
			 FROM g5_member_memo m
			 LEFT JOIN g5_member mb ON mb.mb_id = m.target_member_id
			 WHERE m.member_id = ?
			 ORDER BY m.updated_at DESC, m.created_at DESC
			 LIMIT ?, ?`,
            [memberId, offset, limit]
        )
    ]);

    const total = countRows[0]?.cnt ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const items: MemoItem[] = rows.map((row) => ({
        id: row.id,
        member_id: row.member_id,
        target_member_id: row.target_member_id,
        memo: row.memo,
        memo_detail: row.memo_detail,
        color: row.color,
        created_at: row.created_at,
        updated_at: row.updated_at,
        target_mb_nick: row.target_mb_nick,
        target_mb_icon_path: row.target_mb_icon_path
    }));

    return { items, total, page, totalPages };
}
