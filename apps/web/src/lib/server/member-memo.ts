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
    target_mb_image_url: string;
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
    target_mb_image_url: string;
}

export interface MemoListResult {
    items: MemoItem[];
    total: number;
    page: number;
    totalPages: number;
}

export interface MemoSearchParams {
    color?: string;
    memo?: string;
    detail?: string;
    target?: string;
}

const VALID_COLORS = new Set(['yellow', 'green', 'purple', 'red', 'blue']);

export async function getMyMemos(
    memberId: string,
    page: number,
    limit: number,
    search?: MemoSearchParams
): Promise<MemoListResult> {
    const offset = (page - 1) * limit;

    const conditions = ['m.member_id = ?'];
    const params: (string | number)[] = [memberId];

    if (search?.color && VALID_COLORS.has(search.color)) {
        conditions.push('m.color = ?');
        params.push(search.color);
    }
    if (search?.memo) {
        conditions.push('m.memo LIKE ?');
        params.push(`%${search.memo}%`);
    }
    if (search?.detail) {
        conditions.push('m.memo_detail LIKE ?');
        params.push(`%${search.detail}%`);
    }
    if (search?.target) {
        conditions.push('(m.target_member_id LIKE ? OR mb.mb_nick LIKE ?)');
        params.push(`%${search.target}%`, `%${search.target}%`);
    }

    const where = conditions.join(' AND ');

    const countQuery = search?.target
        ? `SELECT COUNT(*) AS cnt FROM g5_member_memo m LEFT JOIN g5_member mb ON mb.mb_id = m.target_member_id WHERE ${where}`
        : `SELECT COUNT(*) AS cnt FROM g5_member_memo m WHERE ${where}`;

    const [[countRows], [rows]] = await Promise.all([
        readPool.query<CountRow[]>(countQuery, params),
        readPool.query<MemoRow[]>(
            `SELECT m.id, m.member_id, m.target_member_id, m.memo, m.memo_detail, m.color,
			        m.created_at, m.updated_at,
			        COALESCE(mb.mb_nick, m.target_member_id) AS target_mb_nick,
			        COALESCE(mb.mb_image_url, '') AS target_mb_image_url
			 FROM g5_member_memo m
			 LEFT JOIN g5_member mb ON mb.mb_id = m.target_member_id
			 WHERE ${where}
			 ORDER BY m.updated_at DESC, m.created_at DESC
			 LIMIT ?, ?`,
            [...params, offset, limit]
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
        target_mb_image_url: row.target_mb_image_url
    }));

    return { items, total, page, totalPages };
}

export type ColorDistribution = Record<string, number>;

interface ColorCountRow extends RowDataPacket {
    color: string;
    cnt: number;
}

export async function getMemoColorDistribution(memberId: string): Promise<ColorDistribution> {
    const [rows] = await readPool.query<ColorCountRow[]>(
        'SELECT color, COUNT(*) AS cnt FROM g5_member_memo WHERE member_id = ? GROUP BY color',
        [memberId]
    );

    const dist: ColorDistribution = {};
    for (const row of rows) {
        dist[row.color] = row.cnt;
    }
    return dist;
}
