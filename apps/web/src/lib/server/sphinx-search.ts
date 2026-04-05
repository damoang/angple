/**
 * Sphinx 보드별 검색 유틸리티
 *
 * SphinxQL로 g5_write_{boardId}_dist 인덱스 검색.
 * 글로벌 검색(/api/search)과 보드별 검색(+page.server.ts) 양쪽에서 재사용.
 */
import sphinxPool from '$lib/server/sphinx.js';
import type { RowDataPacket } from 'mysql2';

interface SphinxSearchRow extends RowDataPacket {
    wr_id: number;
    wr_parent: number;
    wr_is_comment: number;
}

interface SphinxMetaRow extends RowDataPacket {
    Variable_name: string;
    Value: string;
}

export interface SphinxSearchResult {
    ids: number[];
    parentIds?: number[]; // 댓글 검색 시 부모 글 ID
    total: number;
}

/** SphinxQL MATCH용 특수문자 이스케이프 */
export function escapeSphinxMatch(str: string): string {
    return str.replace(/([\\()|\-!@~"&/^$=<>])/g, '\\$1');
}

/** CJK 문자 포함 여부 확인 (한글, 한자, 일본어) */
export function containsCJK(s: string): boolean {
    return /[\u4E00-\u9FFF\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF]/.test(s);
}

/**
 * 검색 필드별 Sphinx MATCH 표현식 생성
 * CJK 토큰은 구문 검색("*token*")으로 인접 ngram 매칭 강제
 */
export function buildMatchExpr(query: string, field: string): string {
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

/**
 * 보드별 Sphinx 검색
 *
 * g5_write_{boardId}_dist 인덱스에서 검색하여 post ID 목록 반환.
 * 댓글 검색 시 parentIds도 함께 반환.
 */
export async function searchByBoard(
    boardId: string,
    field: string,
    query: string,
    page: number,
    limit: number,
    sort: 'date' | 'relevance' = 'date'
): Promise<SphinxSearchResult> {
    const matchExpr = buildMatchExpr(query, field);
    const isCommentSearch = field === 'comment' || field === 'comment_author';

    const safeMatch = matchExpr.replace(/'/g, "\\'");
    const offset = (page - 1) * limit;

    const orderBy = sort === 'relevance' ? 'WEIGHT() DESC, wr_datetime DESC' : 'wr_datetime DESC';

    // 보드별 distributed 인덱스 사용 (main + delta)
    const indexName = `g5_write_${boardId}_dist`;

    const sphinxSql =
        `SELECT wr_id, wr_parent, wr_is_comment ` +
        `FROM ${indexName} ` +
        `WHERE MATCH('${safeMatch}') AND wr_is_comment = ${isCommentSearch ? 1 : 0} ` +
        `ORDER BY ${orderBy} ` +
        `LIMIT ${offset}, ${limit} ` +
        `OPTION ranker=expr('sum(lcs*user_weight)*1000+bm25')`;

    try {
        const [rows] = await sphinxPool.query<SphinxSearchRow[]>(sphinxSql);

        // SHOW META로 전체 결과 수 조회
        const [metaRows] = await sphinxPool.query<SphinxMetaRow[]>('SHOW META');
        const totalRow = metaRows.find((r) => r.Variable_name === 'total_found');
        const total = totalRow ? parseInt(totalRow.Value, 10) : rows.length;

        const ids = rows.map((r) => r.wr_id);
        const parentIds = isCommentSearch ? rows.map((r) => r.wr_parent) : undefined;

        return { ids, parentIds, total };
    } catch (err) {
        // 인덱스가 없는 보드는 빈 결과 반환 (에러 로그만)
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('ECONNREFUSED')) {
            console.error(`Sphinx search error [${indexName}]:`, msg);
        }
        return { ids: [], total: 0 };
    }
}

/**
 * 글로벌 Sphinx 검색 (all_boards_unified_dist)
 *
 * /api/search에서 사용. 전체 보드 대상 검색.
 */
export async function searchAllBoards(
    field: string,
    query: string,
    maxResults: number = 200
): Promise<{
    rows: Array<{
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
        wr_parent: number;
    }>;
    total: number;
}> {
    const matchExpr = buildMatchExpr(query, field);
    const isCommentSearch = field === 'comment' || field === 'comment_author';
    const safeMatch = matchExpr.replace(/'/g, "\\'");

    const sphinxSql =
        `SELECT id, bo_table, wr_id, wr_subject, wr_content, ` +
        `wr_hit, wr_good, wr_comment, wr_datetime, wr_is_comment, wr_parent ` +
        `FROM all_boards_unified_dist ` +
        `WHERE MATCH('${safeMatch}') AND wr_is_comment = ${isCommentSearch ? 1 : 0} ` +
        `ORDER BY wr_datetime DESC ` +
        `LIMIT ${maxResults}`;

    const [rows] = await sphinxPool.query<RowDataPacket[]>(sphinxSql);
    return { rows: rows as any[], total: rows.length };
}
