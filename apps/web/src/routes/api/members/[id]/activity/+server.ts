/**
 * 작성자 활동 API
 * GET /api/members/[id]/activity?limit=5
 *
 * 특정 회원의 최근 글/최근 댓글을 g5_board_new 테이블에서 조회.
 * 게시판별 배치 쿼리로 N+1 문제 방지.
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

/** HTML 태그, 이모지 코드, HTML 엔티티 제거 후 프리뷰 생성 */
function stripHtmlPreview(content: string, maxLen = 80): string {
    const entityMap: Record<string, string> = {
        '&nbsp;': ' ',
        '&lt;': '<',
        '&gt;': '>',
        '&amp;': '&'
    };
    let stripped = content;
    let prev;
    do {
        prev = stripped;
        stripped = stripped.replace(/<[^>]*>/g, '');
    } while (stripped !== prev);
    return stripped
        .replace(/\{emo:[^}]+\}/g, '')
        .replace(/&(?:nbsp|lt|gt|amp);/g, (m) => entityMap[m])
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
}

/** 행을 bo_table 기준으로 그룹화 (유효한 테이블만) */
function groupByTable(
    rows: BoardNewRow[],
    boardSubjects: Map<string, string>
): Map<string, BoardNewRow[]> {
    const map = new Map<string, BoardNewRow[]>();
    for (const row of rows) {
        if (!/^[a-zA-Z0-9_]+$/.test(row.bo_table)) continue;
        if (!boardSubjects.has(row.bo_table)) continue;
        let arr = map.get(row.bo_table);
        if (!arr) {
            arr = [];
            map.set(row.bo_table, arr);
        }
        arr.push(row);
    }
    return map;
}

export const GET: RequestHandler = async ({ params, url }) => {
    const memberId = params.id;

    if (!memberId || !/^[a-zA-Z0-9_]+$/.test(memberId)) {
        return json({ success: false, error: '유효하지 않은 회원 ID입니다.' }, { status: 400 });
    }

    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '5')), 20);

    try {
        // 1. g5_board_new에서 최근 활동 조회 (충분한 버퍼)
        const [newRows] = await pool.query<BoardNewRow[]>(
            `SELECT bn_id, bo_table, wr_id, wr_is_comment, bn_datetime
             FROM g5_board_new
             WHERE mb_id = ?
             ORDER BY bn_id DESC
             LIMIT ?`,
            [memberId, limit * 10]
        );

        // 글/댓글 분리 (필터링 전이므로 limit 미적용)
        const postCandidates = newRows.filter((r) => r.wr_is_comment === 0);
        const commentCandidates = newRows.filter((r) => r.wr_is_comment === 1);

        // 2. 필요한 게시판명 조회 (1회 쿼리)
        const allTables = [
            ...new Set([
                ...postCandidates.map((r) => r.bo_table),
                ...commentCandidates.map((r) => r.bo_table)
            ])
        ];

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

        // 3. 게시판별 배치 쿼리 (N+1 → K 쿼리, K=고유 게시판 수)
        const postsByTable = groupByTable(postCandidates, boardSubjects);
        const commentsByTable = groupByTable(commentCandidates, boardSubjects);

        // 글과 댓글을 병렬로 조회
        const [recentPosts, recentComments] = await Promise.all([
            fetchRecentPosts(postsByTable, boardSubjects, limit),
            fetchRecentComments(commentsByTable, boardSubjects, limit)
        ]);

        // 원래 순서(bn_id DESC = 최신순) 유지 + limit 적용 전 정렬
        const postOrder = postCandidates.map((r) => r.wr_id);
        const commentOrder = commentCandidates.map((r) => r.wr_id);
        recentPosts.sort((a, b) => postOrder.indexOf(a.wr_id) - postOrder.indexOf(b.wr_id));
        recentPosts.splice(limit);
        recentComments.sort(
            (a, b) => commentOrder.indexOf(a.wr_id) - commentOrder.indexOf(b.wr_id)
        );
        recentComments.splice(limit);

        return json({ recentPosts, recentComments });
    } catch (error) {
        console.error('[activity API] error:', error);
        return json({ recentPosts: [], recentComments: [] });
    }
};

/** 게시판별 배치로 최근 글 조회 */
async function fetchRecentPosts(
    postsByTable: Map<string, BoardNewRow[]>,
    boardSubjects: Map<string, string>,
    _limit: number
) {
    const results: Array<{
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        wr_subject: string;
        wr_datetime: string;
        href: string;
    }> = [];

    const queries = [];
    for (const [boTable, rows] of postsByTable) {
        queries.push(
            (async () => {
                const table = `g5_write_${boTable}`;
                const wrIds = rows.map((r) => r.wr_id);
                const placeholders = wrIds.map(() => '?').join(', ');
                try {
                    const [writeRows] = await pool.query<WriteRow[]>(
                        `SELECT wr_id, wr_subject, wr_datetime
                         FROM \`${table}\`
                         WHERE wr_id IN (${placeholders}) AND wr_is_comment = 0
                           AND (wr_option NOT LIKE '%secret%' OR wr_option IS NULL)
                           AND (wr_7 IS NULL OR wr_7 != 'lock')
                           AND (wr_deleted_at IS NULL OR wr_deleted_at = '0000-00-00 00:00:00')`,
                        wrIds
                    );
                    for (const w of writeRows) {
                        results.push({
                            bo_table: boTable,
                            bo_subject: boardSubjects.get(boTable) || boTable,
                            wr_id: w.wr_id,
                            wr_subject: w.wr_subject,
                            wr_datetime: w.wr_datetime,
                            href: `/${boTable}/${w.wr_id}`
                        });
                    }
                } catch {
                    // 테이블 없으면 스킵
                }
            })()
        );
    }
    await Promise.all(queries);

    return results;
}

/** 게시판별 배치로 최근 댓글 조회 (원글 비밀글/잠금 체크 포함) */
async function fetchRecentComments(
    commentsByTable: Map<string, BoardNewRow[]>,
    boardSubjects: Map<string, string>,
    _limit: number
) {
    const results: Array<{
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        parent_wr_id: number;
        preview: string;
        wr_datetime: string;
        href: string;
    }> = [];

    const queries = [];
    for (const [boTable, rows] of commentsByTable) {
        queries.push(
            (async () => {
                const table = `g5_write_${boTable}`;
                const wrIds = rows.map((r) => r.wr_id);
                const placeholders = wrIds.map(() => '?').join(', ');
                try {
                    // 배치: 댓글 내용 조회
                    const [writeRows] = await pool.query<WriteRow[]>(
                        `SELECT wr_id, wr_content, wr_parent, wr_datetime
                         FROM \`${table}\`
                         WHERE wr_id IN (${placeholders}) AND wr_is_comment = 1
                           AND (wr_deleted_at IS NULL OR wr_deleted_at = '0000-00-00 00:00:00')`,
                        wrIds
                    );
                    if (writeRows.length === 0) return;

                    // 배치: 원글 비밀글/잠금 체크 (고유 parent ID만)
                    const parentIds = [...new Set(writeRows.map((w) => w.wr_parent))];
                    const parentPlaceholders = parentIds.map(() => '?').join(', ');
                    const [parentRows] = await pool.query<WriteRow[]>(
                        `SELECT wr_id FROM \`${table}\`
                         WHERE wr_id IN (${parentPlaceholders}) AND wr_is_comment = 0
                           AND (wr_option NOT LIKE '%secret%' OR wr_option IS NULL)
                           AND (wr_7 IS NULL OR wr_7 != 'lock')
                           AND (wr_deleted_at IS NULL OR wr_deleted_at = '0000-00-00 00:00:00')`,
                        parentIds
                    );
                    const validParentIds = new Set(parentRows.map((p) => p.wr_id));

                    for (const w of writeRows) {
                        if (!validParentIds.has(w.wr_parent)) continue;
                        results.push({
                            bo_table: boTable,
                            bo_subject: boardSubjects.get(boTable) || boTable,
                            wr_id: w.wr_id,
                            parent_wr_id: w.wr_parent,
                            preview: stripHtmlPreview(w.wr_content),
                            wr_datetime: w.wr_datetime,
                            href: `/${boTable}/${w.wr_parent}#c_${w.wr_id}`
                        });
                    }
                } catch {
                    // 테이블 없으면 스킵
                }
            })()
        );
    }
    await Promise.all(queries);

    return results;
}
