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

// 신고 사유 라벨 매핑 (nariya 플러그인 sg_type 코드 21~40)
const REASON_LABELS: Record<number, string> = {
    21: '회원비하',
    22: '예의없음',
    23: '부적절한 표현',
    24: '차별행위',
    25: '분란유도/갈등조장',
    26: '여론조성',
    27: '회원기만',
    28: '이용방해',
    29: '용도위반',
    30: '거래금지위반',
    31: '구걸',
    32: '권리침해',
    33: '외설',
    34: '위법행위',
    35: '광고/홍보',
    36: '운영정책부정',
    37: '다중이',
    38: '기타사유',
    39: '뉴스펌글누락',
    40: '뉴스전문전재'
};

interface ReportRow extends RowDataPacket {
    sg_id: number;
    mb_id: string;
    mb_name: string;
    sg_type: number;
    sg_time: string;
}

export const GET: RequestHandler = async ({ params, cookies, url }) => {
    const { boardId, postId } = params;
    const includePost = url.searchParams.get('include_post') === '1';

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
        // g5_na_singo 테이블에서 해당 게시판+게시글의 신고 내역 조회
        // include_post=1이면 게시글 자체 신고도 포함, 아니면 댓글 신고만 (sg_id != sg_parent)
        const condition = includePost
            ? 'WHERE r.sg_table = ? AND r.sg_parent = ?'
            : 'WHERE r.sg_table = ? AND r.sg_parent = ? AND r.sg_id != r.sg_parent';

        const [rows] = await pool.query<ReportRow[]>(
            `SELECT r.sg_table, r.sg_id, r.mb_id, m.mb_nick as mb_name, r.sg_type, r.sg_time
             FROM g5_na_singo r
             LEFT JOIN g5_member m ON r.mb_id = m.mb_id
             ${condition}
             ORDER BY r.sg_time DESC`,
            [safeBoardId, safePostId]
        );

        const data = rows.map((row) => ({
            comment_id: row.sg_id,
            reporter_id: row.mb_id,
            reporter_name: row.mb_name || row.mb_id,
            reason: row.sg_type,
            reason_label: REASON_LABELS[row.sg_type] || `사유 ${row.sg_type}`,
            created_at: row.sg_time
        }));

        return json({ success: true, data });
    } catch (error) {
        console.error('[comment-reports API] error:', error);
        return json({ success: true, data: [] });
    }
};
