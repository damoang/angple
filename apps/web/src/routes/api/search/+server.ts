/**
 * 글로벌 검색 API — Sphinx 기반
 *
 * GET /api/search?q=키워드&sfl=title_content&limit=5
 *
 * sfl: title | content | title_content | author
 * limit: 게시판당 최대 결과 수 (기본 5)
 *
 * SphinxQL로 all_boards_unified_dist 인덱스 검색 후
 * 게시판별로 그룹핑하여 GlobalSearchResponse 형태로 반환.
 *
 * NOTE: SphinxQL은 prepared statement를 지원하지 않으므로
 *       pool.query()를 사용하고 MATCH 표현식은 수동 이스케이프.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import sphinxPool from '$lib/server/sphinx.js';
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

interface SphinxRow extends RowDataPacket {
    id: number;
    bo_table: string;
    wr_id: number;
    wr_subject: string;
    wr_content: string;
    wr_hit: number;
    wr_good: number;
    wr_comment: number;
    wr_datetime: number;
    wr_is_comment: number;
    wr_parent?: number;
}

interface BoardRow extends RowDataPacket {
    bo_table: string;
    bo_subject: string;
}

interface PostAuthorRow extends RowDataPacket {
    wr_id: number;
    wr_name: string;
    mb_id: string;
}

interface BoardFileRow extends RowDataPacket {
    wr_id: number;
}

/** SphinxQL MATCH용 이스케이프 */
function escapeSphinxMatch(str: string): string {
    return str.replace(/([\\()|\-!@~"&/^$=<>])/g, '\\$1');
}

/** CJK 문자 포함 여부 확인 (한글, 한자, 일본어) */
function containsCJK(s: string): boolean {
    return /[\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF]/.test(s);
}

// 검색 필드별 Sphinx MATCH 표현식
// CJK 토큰은 구문 검색("*token*")으로 인접 ngram 강제
function buildMatchExpr(query: string, field: string): string {
    const escaped = escapeSphinxMatch(query);
    const tokens = escaped.split(/\s+/).filter(Boolean);
    const wildcarded = tokens
        .map((t) => {
            if (containsCJK(t) && [...t].length >= 2) {
                return `"*${t}*"`;
            }
            return `*${t}*`;
        })
        .join(' ');

    switch (field) {
        case 'title':
            return `@wr_subject ${wildcarded}`;
        case 'content':
            return `@wr_content ${wildcarded}`;
        case 'author':
            return `@(mb_id,wr_name) ${wildcarded}`;
        case 'comment':
            return `@wr_content ${wildcarded}`;
        case 'comment_author':
            return `@(mb_id,wr_name) ${wildcarded}`;
        case 'title_content':
        default:
            return `@(wr_subject,wr_content) ${wildcarded}`;
    }
}

export const GET: RequestHandler = async ({ url, locals }) => {
    if (!locals.user) {
        return json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const query = url.searchParams.get('q')?.trim();
    const field = url.searchParams.get('sfl') || 'title_content';
    const limitPerBoard = Math.min(Number(url.searchParams.get('limit')) || 5, 20);

    if (!query || query.length < 2) {
        return json({
            success: true,
            data: { results: [], total: 0, query: query || '' }
        });
    }

    try {
        const matchExpr = buildMatchExpr(query, field);

        // 1) Sphinx에서 검색 (최대 200건)
        // mb_id, wr_name은 full-text field only (stored attribute 아님) → SELECT 불가
        // 싱글쿼트 이스케이프 for SphinxQL
        const isCommentSearch = field === 'comment' || field === 'comment_author';
        const safeMatch = matchExpr.replace(/'/g, "\\'");
        const sphinxSql =
            `SELECT id, bo_table, wr_id, wr_subject, wr_content, ` +
            `wr_hit, wr_good, wr_comment, wr_datetime, wr_is_comment, wr_parent ` +
            `FROM all_boards_unified_dist ` +
            `WHERE MATCH('${safeMatch}') AND wr_is_comment = ${isCommentSearch ? 1 : 0} ` +
            `ORDER BY wr_datetime DESC ` +
            `LIMIT 200`;

        const [sphinxRows] = await sphinxPool.query<SphinxRow[]>(sphinxSql);

        if (!sphinxRows.length) {
            return json({
                success: true,
                data: { results: [], total: 0, query }
            });
        }

        // 2) 게시판별 그룹핑
        const boardMap = new Map<string, SphinxRow[]>();
        for (const row of sphinxRows) {
            const boardId = row.bo_table;
            if (!boardMap.has(boardId)) {
                boardMap.set(boardId, []);
            }
            boardMap.get(boardId)!.push(row);
        }

        // 3) 게시판 이름 조회 + 작성자 정보 + 첨부파일 병렬 조회
        const boardIds = [...boardMap.keys()];

        // 게시판 이름 조회
        const placeholders = boardIds.map(() => '?').join(',');
        const boardNamePromise = readPool
            .execute<
                BoardRow[]
            >(`SELECT bo_table, bo_subject FROM g5_board WHERE bo_table IN (${placeholders})`, boardIds)
            .then(([rows]) => {
                const map = new Map<string, string>();
                for (const b of rows) map.set(b.bo_table, b.bo_subject);
                return map;
            });

        // 게시판별 작성자 정보 + 첨부파일 병렬 조회
        const authorMap = new Map<string, { wr_name: string; mb_id: string }>();
        const fileSet = new Set<string>();

        const perBoardPromises = boardIds.map(async (boardId) => {
            const rows = boardMap.get(boardId)!;
            const wrIds = rows.slice(0, limitPerBoard).map((r) => r.wr_id);
            if (!wrIds.length) return;

            const ph = wrIds.map(() => '?').join(',');

            // 작성자 정보 조회
            try {
                const [authorRows] = await readPool.execute<PostAuthorRow[]>(
                    `SELECT wr_id, wr_name, mb_id FROM g5_write_${boardId} WHERE wr_id IN (${ph})`,
                    wrIds
                );
                for (const a of authorRows) {
                    authorMap.set(`${boardId}:${a.wr_id}`, {
                        wr_name: a.wr_name,
                        mb_id: a.mb_id
                    });
                }
            } catch {
                // 테이블 없는 경우 무시
            }

            // 첨부파일 존재 여부
            try {
                const [fileRows] = await readPool.execute<BoardFileRow[]>(
                    `SELECT DISTINCT wr_id FROM g5_board_file WHERE bo_table = ? AND wr_id IN (${ph})`,
                    [boardId, ...wrIds]
                );
                for (const f of fileRows) {
                    fileSet.add(`${boardId}:${f.wr_id}`);
                }
            } catch {
                // 무시
            }
        });

        const [boardNameMap] = await Promise.all([boardNamePromise, ...perBoardPromises]);

        // 4) 결과 조립 (게시판별 limitPerBoard개, 총 결과 수 기준 내림차순)
        const results = boardIds
            .map((boardId) => {
                const rows = boardMap.get(boardId)!;
                return {
                    board_id: boardId,
                    board_name: boardNameMap.get(boardId) || boardId,
                    total: rows.length,
                    is_comment: isCommentSearch,
                    posts: rows.slice(0, limitPerBoard).map((row) => {
                        const author = authorMap.get(`${boardId}:${row.wr_id}`);
                        return {
                            id: row.wr_id,
                            title: isCommentSearch ? '' : row.wr_subject,
                            content: stripHtml(row.wr_content).slice(0, 200),
                            author: author?.wr_name || '',
                            author_id: author?.mb_id || '',
                            board_id: boardId,
                            views: row.wr_hit,
                            likes: row.wr_good,
                            comments_count: row.wr_comment,
                            created_at: new Date(row.wr_datetime * 1000).toISOString(),
                            has_file: fileSet.has(`${boardId}:${row.wr_id}`),
                            parent_id: isCommentSearch ? row.wr_parent || 0 : undefined
                        };
                    })
                };
            })
            .sort((a, b) => b.total - a.total);

        return json({
            success: true,
            data: {
                results,
                total: sphinxRows.length,
                query
            }
        });
    } catch (err) {
        const isConnectionError = err instanceof Error && err.message.includes('ECONNREFUSED');
        if (!isConnectionError) {
            console.error('Sphinx search error:', err);
        }
        return json({ success: false, error: '검색 중 오류가 발생했습니다.' }, { status: 500 });
    }
};

/** HTML 태그 제거 */
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]+>/g, '')
        .replace(/&[^;]+;/g, ' ')
        .trim();
}
