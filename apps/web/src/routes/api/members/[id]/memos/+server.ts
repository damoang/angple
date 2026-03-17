/**
 * 회원에 대한 전체 메모 조회 API (관리자 전용)
 * GET /api/members/[id]/memos
 *
 * g5_member_memo 테이블에서 target 회원에 대한 모든 메모를 조회
 * 작성자 정보(mb_id, mb_nick) 포함
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface MemoRow extends RowDataPacket {
    id: number;
    member_id: string;
    memo: string;
    memo_detail: string;
    color: string;
    created_at: string;
    mb_nick: string;
}

export const GET: RequestHandler = async ({ params, locals }) => {
    const isAdmin = (locals.user?.level ?? 0) >= 10;
    if (!isAdmin) {
        return json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const memberId = params.id;
    if (!memberId || !/^[a-zA-Z0-9_-]+$/.test(memberId)) {
        return json({ success: false, error: '유효하지 않은 회원 ID입니다.' }, { status: 400 });
    }

    try {
        const [rows] = await pool.query<MemoRow[]>(
            `SELECT m.id, m.member_id, m.memo, m.memo_detail, m.color, m.created_at,
			        g.mb_nick
			 FROM g5_member_memo m
			 LEFT JOIN g5_member g ON g.mb_id = m.member_id
			 WHERE m.target_member_id = ?
			 ORDER BY m.created_at DESC`,
            [memberId]
        );

        return json({
            success: true,
            data: rows.map((r) => ({
                id: r.id,
                mb_id: r.member_id,
                mb_nick: r.mb_nick || '',
                content: r.memo,
                color: r.color || 'yellow',
                created_at: r.created_at
            }))
        });
    } catch (error) {
        console.error('[Member Memos API] error:', error);
        return json({ success: false, error: '메모 조회에 실패했습니다.' }, { status: 500 });
    }
};
