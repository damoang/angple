import type { PageServerLoad } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface BoardPointRow extends RowDataPacket {
    bo_table: string;
    bo_subject: string;
    gr_id: string;
    bo_write_point: number;
    bo_comment_point: number;
}

interface SettingsRow extends RowDataPacket {
    settings_json: string;
}

export const load: PageServerLoad = async () => {
    let boardPoints: { name: string; slug: string; writePoint: number; commentPoint: number }[] =
        [];
    let writeXP = 100;
    let commentXP = 50;

    try {
        // XP 전역 설정 조회
        const [settingsRows] = await pool.query<SettingsRow[]>(
            `SELECT settings_json FROM site_settings WHERE site_id = 'default' LIMIT 1`
        );
        if (settingsRows.length > 0 && settingsRows[0].settings_json) {
            try {
                const settings = JSON.parse(settingsRows[0].settings_json);
                if (settings.xp_config) {
                    writeXP = settings.xp_config.write_xp ?? 100;
                    commentXP = settings.xp_config.comment_xp ?? 50;
                }
            } catch {
                // 파싱 실패 시 기본값
            }
        }
    } catch {
        // 테이블 없으면 기본값
    }

    try {
        const [rows] = await pool.query<BoardPointRow[]>(
            `SELECT bo_table, bo_subject, gr_id, bo_write_point, bo_comment_point
             FROM g5_board
             WHERE bo_use_search = 1 AND bo_count_write > 0
               AND (bo_write_point != 0 OR bo_comment_point != 0)
             ORDER BY bo_write_point DESC, bo_subject ASC`
        );

        // group 게시판은 "소모임" 1건으로 통합
        let groupAdded = false;
        for (const r of rows) {
            if (r.gr_id === 'group') {
                if (!groupAdded) {
                    boardPoints.push({
                        name: '소모임 (전체)',
                        slug: 'group',
                        writePoint: r.bo_write_point,
                        commentPoint: r.bo_comment_point
                    });
                    groupAdded = true;
                }
                continue;
            }
            boardPoints.push({
                name: r.bo_subject,
                slug: r.bo_table,
                writePoint: r.bo_write_point,
                commentPoint: r.bo_comment_point
            });
        }
    } catch {
        // DB 오류 시 빈 배열
    }

    return { boardPoints, writeXP, commentXP };
};
