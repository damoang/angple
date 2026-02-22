/**
 * 새글 모아보기 (g5_board_new 테이블)
 * PHP /bbs/new.php 호환
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

export interface NewPostItem {
    bn_id: number;
    bo_table: string;
    wr_id: number;
    wr_parent: number;
    bn_datetime: string;
    bo_subject: string;
    wr_subject: string;
    mb_id: string;
    wr_name: string;
    wr_comment: number;
    wr_hit: number;
}

export interface NewPostsResult {
    items: NewPostItem[];
    total: number;
}

/**
 * 새글 목록 조회
 * @param view - 'w' 원글만, 'c' 댓글만, '' 전체
 * @param grId - 그룹 필터 (optional)
 * @param page - 페이지 번호
 * @param perPage - 페이지당 항목 수
 */
export async function getNewPosts(
    view: string,
    grId: string,
    page: number,
    perPage: number = 30
): Promise<NewPostsResult> {
    const offset = (page - 1) * perPage;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    // 원글/댓글 필터
    if (view === 'w') {
        conditions.push('bn.wr_id = bn.wr_parent');
    } else if (view === 'c') {
        conditions.push('bn.wr_id != bn.wr_parent');
    }

    // 그룹 필터
    if (grId) {
        conditions.push('b.gr_id = ?');
        params.push(grId);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // 카운트 쿼리
    const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total
		 FROM g5_board_new bn
		 JOIN g5_board b ON bn.bo_table = b.bo_table
		 ${whereClause}`,
        params
    );
    const total = countRows[0]?.total || 0;

    // 게시글 조회 (g5_board_new + g5_board + 각 게시판 테이블)
    // g5_board_new에는 wr_subject가 없으므로 개별 테이블 JOIN 필요
    // 성능을 위해 서브쿼리로 처리
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT bn.bn_id, bn.bo_table, bn.wr_id, bn.wr_parent, bn.bn_datetime,
		        b.bo_subject, bn.mb_id
		 FROM g5_board_new bn
		 JOIN g5_board b ON bn.bo_table = b.bo_table
		 ${whereClause}
		 ORDER BY bn.bn_datetime DESC
		 LIMIT ?, ?`,
        [...params, offset, perPage]
    );

    // 각 게시글의 제목/작성자/댓글수/조회수 조회
    const items: NewPostItem[] = [];
    for (const row of rows) {
        try {
            const tableName = `g5_write_${row.bo_table}`;
            // 테이블명은 bo_table에서 오므로 안전 (영문+숫자만 허용)
            if (!/^[a-zA-Z0-9_]+$/.test(row.bo_table)) continue;

            const [writeRows] = await pool.query<RowDataPacket[]>(
                `SELECT wr_subject, wr_name, wr_comment, wr_hit
				 FROM \`${tableName}\`
				 WHERE wr_id = ? LIMIT 1`,
                [row.wr_id]
            );

            if (writeRows[0]) {
                items.push({
                    bn_id: row.bn_id,
                    bo_table: row.bo_table,
                    wr_id: row.wr_id,
                    wr_parent: row.wr_parent,
                    bn_datetime: row.bn_datetime,
                    bo_subject: row.bo_subject,
                    wr_subject: writeRows[0].wr_subject,
                    mb_id: row.mb_id,
                    wr_name: writeRows[0].wr_name,
                    wr_comment: writeRows[0].wr_comment,
                    wr_hit: writeRows[0].wr_hit
                });
            }
        } catch {
            // 삭제된 게시판 등 오류 무시
        }
    }

    return { items, total };
}

/** 그룹 목록 조회 */
export async function getBoardGroups(): Promise<{ gr_id: string; gr_subject: string }[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT gr_id, gr_subject FROM g5_group ORDER BY gr_order, gr_id'
    );
    return rows as { gr_id: string; gr_subject: string }[];
}
