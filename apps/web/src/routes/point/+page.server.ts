import type { PageServerLoad } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface BoardPointRow extends RowDataPacket {
    bo_table: string;
    bo_subject: string;
    bo_write_point: number;
    bo_comment_point: number;
}

export const load: PageServerLoad = async () => {
    let boardPoints: { name: string; slug: string; writePoint: number; commentPoint: number }[] =
        [];

    try {
        const [rows] = await pool.query<BoardPointRow[]>(
            `SELECT bo_table, bo_subject, bo_write_point, bo_comment_point
             FROM g5_board
             WHERE bo_use_search = 1 AND bo_count_write > 0
               AND (bo_write_point != 0 OR bo_comment_point != 0)
             ORDER BY bo_write_point DESC, bo_subject ASC`
        );
        boardPoints = rows.map((r) => ({
            name: r.bo_subject,
            slug: r.bo_table,
            writePoint: r.bo_write_point,
            commentPoint: r.bo_comment_point
        }));
    } catch {
        // DB 오류 시 빈 배열
    }

    return { boardPoints };
};
