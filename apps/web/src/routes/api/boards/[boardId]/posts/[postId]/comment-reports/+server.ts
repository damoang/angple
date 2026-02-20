/**
 * 댓글 신고 정보 조회 API (관리자 전용)
 *
 * GET /api/boards/[boardId]/posts/[postId]/comment-reports
 * 해당 게시글의 모든 댓글 신고 내역을 조회 (mb_level >= 10 필요)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

// 신고 사유 라벨 매핑
const REASON_LABELS: Record<number, string> = {
    1: '회원비하',
    2: '예의없음',
    3: '부적절한 표현',
    4: '차별행위',
    5: '분란유도',
    6: '여론조성',
    7: '회원기만',
    8: '이용방해',
    9: '용도위반',
    10: '거래금지위반',
    11: '구걸',
    12: '권리침해',
    13: '외설',
    14: '위법행위',
    15: '광고홍보'
};

interface ReportRow extends RowDataPacket {
    wr_id: number;
    mb_id: string;
    mb_name: string;
    singo_reason: number;
    singo_datetime: string;
}

export const GET: RequestHandler = async ({ params, cookies }) => {
    const { boardId, postId } = params;

    if (!boardId || !postId) {
        return json({ success: false, message: 'boardId와 postId가 필요합니다.' }, { status: 400 });
    }

    // 관리자 인증 확인
    const user = await getAuthUser(cookies);
    if (!user || user.mb_level < 10) {
        return json({ success: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safePostId = parseInt(String(postId), 10);

    if (isNaN(safePostId)) {
        return json({ success: false, message: '유효하지 않은 postId입니다.' }, { status: 400 });
    }

    try {
        // g5_board_report 테이블에서 해당 게시판+게시글의 댓글 신고 내역 조회
        // 댓글 wr_id는 게시글의 하위 댓글 (wr_is_comment > 0)
        const [rows] = await pool.query<ReportRow[]>(
            `SELECT r.bo_table, r.wr_id, r.mb_id, m.mb_nick as mb_name, r.singo_reason, r.singo_datetime
             FROM g5_board_report r
             LEFT JOIN g5_member m ON r.mb_id = m.mb_id
             WHERE r.bo_table = ? AND r.wr_parent = ?
             AND r.wr_id != r.wr_parent
             ORDER BY r.singo_datetime DESC`,
            [safeBoardId, safePostId]
        );

        const data = rows.map((row) => ({
            comment_id: row.wr_id,
            reporter_id: row.mb_id,
            reporter_name: row.mb_name || row.mb_id,
            reason: row.singo_reason,
            reason_label: REASON_LABELS[row.singo_reason] || `사유 ${row.singo_reason}`,
            created_at: row.singo_datetime
        }));

        return json({ success: true, data });
    } catch (error) {
        console.error('[comment-reports API] error:', error);
        return json({ success: true, data: [] });
    }
};
