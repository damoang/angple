import type { PageServerLoad } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface BoardPointRow extends RowDataPacket {
    bo_table: string;
    bo_subject: string;
    gr_id: string;
    bo_write_point: number;
    bo_comment_point: number;
    bo_write_xp: number;
    bo_comment_xp: number;
}

export const load: PageServerLoad = async () => {
    let boardPoints: {
        name: string;
        slug: string;
        writePoint: number;
        commentPoint: number;
        writeXP: number;
        commentXP: number;
    }[] = [];

    try {
        const [rows] = await pool.query<BoardPointRow[]>(
            `SELECT bo_table, bo_subject, gr_id, bo_write_point, bo_comment_point, bo_write_xp, bo_comment_xp
             FROM g5_board
             WHERE bo_use_search = 1 AND bo_count_write > 0
               AND (bo_write_point != 0 OR bo_comment_point != 0)
             ORDER BY bo_write_point DESC, bo_subject ASC`
        );

        // 비공개/특수 게시판 제외
        const hiddenBoards = new Set(['promotion', 'archive']);

        // group 게시판은 "소모임" 1건으로 통합
        let groupAdded = false;
        for (const r of rows) {
            if (hiddenBoards.has(r.bo_table)) continue;
            if (r.gr_id === 'group') {
                if (!groupAdded) {
                    boardPoints.push({
                        name: '소모임 (전체)',
                        slug: 'group',
                        writePoint: r.bo_write_point,
                        commentPoint: r.bo_comment_point,
                        writeXP: r.bo_write_xp,
                        commentXP: r.bo_comment_xp
                    });
                    groupAdded = true;
                }
                continue;
            }
            boardPoints.push({
                name: r.bo_subject,
                slug: r.bo_table,
                writePoint: r.bo_write_point,
                commentPoint: r.bo_comment_point,
                writeXP: r.bo_write_xp,
                commentXP: r.bo_comment_xp
            });
        }
    } catch {
        // DB 오류 시 빈 배열
    }

    return { boardPoints };
};
