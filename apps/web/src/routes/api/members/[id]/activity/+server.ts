/**
 * 작성자 활동 API
 * GET /api/members/[id]/activity?limit=5
 *
 * 특정 회원의 최근 글/최근 댓글을 g5_board_new 테이블에서 조회.
 *
 * 쿼리 파라미터:
 * - limit: 각 카테고리별 최대 개수 (기본: 5, 최대: 20)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface BoardNewRow extends RowDataPacket {
    bn_id: number;
    bo_table: string;
    wr_id: number;
    wr_is_comment: number;
    bn_datetime: string;
}

interface BoardRow extends RowDataPacket {
    bo_table: string;
    bo_subject: string;
}

interface WriteRow extends RowDataPacket {
    wr_id: number;
    wr_subject: string;
    wr_content: string;
    wr_parent: number;
    wr_datetime: string;
}

export const GET: RequestHandler = async ({ params, url }) => {
    const memberId = params.id;

    // 알파뉴메릭 + 언더스코어만 허용 (보안)
    if (!memberId || !/^[a-zA-Z0-9_]+$/.test(memberId)) {
        return json({ success: false, error: '유효하지 않은 회원 ID입니다.' }, { status: 400 });
    }

    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '5')), 20);

    try {
        // g5_board_new에서 최근 활동 조회
        // pool.query 사용: pool.execute의 prepared statement는 LIMIT 파라미터 타입 오류 발생
        const [newRows] = await pool.query<BoardNewRow[]>(
            `SELECT bn_id, bo_table, wr_id, wr_is_comment, bn_datetime
             FROM g5_board_new
             WHERE mb_id = ?
             ORDER BY bn_id DESC
             LIMIT ?`,
            [memberId, limit * 4] // 여유있게 가져와서 필터링
        );

        // 글/댓글 분리
        const postRows = newRows.filter((r) => r.wr_is_comment === 0).slice(0, limit);
        const commentRows = newRows.filter((r) => r.wr_is_comment === 1).slice(0, limit);

        // 필요한 bo_table 목록
        const allTables = [
            ...new Set([...postRows.map((r) => r.bo_table), ...commentRows.map((r) => r.bo_table)])
        ];

        // 게시판명 조회
        const boardSubjects = new Map<string, string>();
        if (allTables.length > 0) {
            const placeholders = allTables.map(() => '?').join(', ');
            const [boardRows] = await pool.query<BoardRow[]>(
                `SELECT bo_table, bo_subject FROM g5_board WHERE bo_table IN (${placeholders}) AND bo_use_search = 1`,
                allTables
            );
            for (const b of boardRows) {
                boardSubjects.set(b.bo_table, b.bo_subject);
            }
        }

        // 최근 글 상세 조회
        const recentPosts = [];
        for (const row of postRows) {
            const table = `g5_write_${row.bo_table}`;
            if (!/^[a-zA-Z0-9_]+$/.test(row.bo_table)) continue;
            if (!boardSubjects.has(row.bo_table)) continue;
            try {
                const [writeRows] = await pool.execute<WriteRow[]>(
                    `SELECT wr_id, wr_subject, wr_datetime
                     FROM \`${table}\`
                     WHERE wr_id = ? AND wr_is_comment = 0
                       AND (wr_option NOT LIKE '%secret%' OR wr_option IS NULL)
                       AND (wr_deleted_at IS NULL OR wr_deleted_at = '0000-00-00 00:00:00')`,
                    [row.wr_id]
                );
                if (writeRows.length === 0) continue;
                const w = writeRows[0];
                recentPosts.push({
                    bo_table: row.bo_table,
                    bo_subject: boardSubjects.get(row.bo_table) || row.bo_table,
                    wr_id: w.wr_id,
                    wr_subject: w.wr_subject,
                    wr_datetime: w.wr_datetime,
                    href: `/${row.bo_table}/${w.wr_id}`
                });
            } catch {
                // 테이블 없으면 스킵
            }
        }

        // 최근 댓글 상세 조회
        const recentComments = [];
        for (const row of commentRows) {
            const table = `g5_write_${row.bo_table}`;
            if (!/^[a-zA-Z0-9_]+$/.test(row.bo_table)) continue;
            if (!boardSubjects.has(row.bo_table)) continue;
            try {
                const [writeRows] = await pool.execute<WriteRow[]>(
                    `SELECT wr_id, wr_content, wr_parent, wr_datetime
                     FROM \`${table}\`
                     WHERE wr_id = ? AND wr_is_comment = 1
                       AND (wr_deleted_at IS NULL OR wr_deleted_at = '0000-00-00 00:00:00')`,
                    [row.wr_id]
                );
                if (writeRows.length === 0) continue;
                const w = writeRows[0];
                // 원글이 비밀글인지 확인
                const [parentRows] = await pool.execute<WriteRow[]>(
                    `SELECT wr_id FROM \`${table}\`
                     WHERE wr_id = ? AND wr_is_comment = 0
                       AND (wr_option NOT LIKE '%secret%' OR wr_option IS NULL)
                       AND (wr_deleted_at IS NULL OR wr_deleted_at = '0000-00-00 00:00:00')`,
                    [w.wr_parent]
                );
                if (parentRows.length === 0) continue;
                // HTML 태그, 이모지 코드, HTML 엔티티 제거
                const entityMap: Record<string, string> = {
                    '&nbsp;': ' ',
                    '&lt;': '<',
                    '&gt;': '>',
                    '&amp;': '&'
                };
                let contentStripped = w.wr_content;
                let prevContent;
                do {
                    prevContent = contentStripped;
                    contentStripped = contentStripped.replace(/<[^>]*>/g, '');
                } while (contentStripped !== prevContent);
                const preview = contentStripped
                    .replace(/\{emo:[^}]+\}/g, '') // 이모지 코드 {emo:xxx} 제거
                    .replace(/&(?:nbsp|lt|gt|amp);/g, (m) => entityMap[m])
                    .replace(/\s+/g, ' ') // 연속 공백 정리
                    .trim()
                    .slice(0, 80);
                recentComments.push({
                    bo_table: row.bo_table,
                    bo_subject: boardSubjects.get(row.bo_table) || row.bo_table,
                    wr_id: w.wr_id,
                    parent_wr_id: w.wr_parent,
                    preview,
                    wr_datetime: w.wr_datetime,
                    href: `/${row.bo_table}/${w.wr_parent}#c_${w.wr_id}`
                });
            } catch {
                // 테이블 없으면 스킵
            }
        }

        return json({ recentPosts, recentComments });
    } catch (error) {
        console.error('[activity API] error:', error);
        // DB 연결 실패 등의 에러 시 빈 결과 반환 (500 대신 graceful degradation)
        return json({ recentPosts: [], recentComments: [] });
    }
};
