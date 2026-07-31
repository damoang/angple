/**
 * Sphinx 보드별 검색 유틸리티
 *
 * SphinxQL로 g5_write_{boardId}_dist 인덱스 검색.
 * 글로벌 검색(/api/search)과 보드별 검색(+page.server.ts) 양쪽에서 재사용.
 */
import sphinxPool from '$lib/server/sphinx.js';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

/**
 * 검색에서 제외할 게시판 목록 (`g5_board.bo_use_search = 0`).
 *
 * 통합 인덱스(all_boards_unified_dist)에는 운영자가 "검색 사용 안 함" 으로 설정한 게시판도
 * 일부 섞여 들어가 있다. RSS·사이트맵·포인트 랭킹은 모두 `bo_use_search = 1` 을 지키는데
 * 전체검색만 이 설정을 보지 않아, 소명·익명 게시판 글이 검색 결과에 노출됐다.
 * 인덱스 구성과 무관하게 **설정이 최종 판단 기준**이 되도록 쿼리 단계에서 막는다.
 *
 * 값은 자주 바뀌지 않으므로 캐시하되, 운영자가 설정을 바꾸면 몇 분 안에 반영되게 한다.
 */
const EXCLUDED_BOARDS_TTL_MS = 5 * 60 * 1000;
let excludedBoardsCache: { list: string[]; at: number } | null = null;

async function getSearchExcludedBoards(): Promise<string[]> {
    const now = Date.now();
    if (excludedBoardsCache && now - excludedBoardsCache.at < EXCLUDED_BOARDS_TTL_MS) {
        return excludedBoardsCache.list;
    }
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT bo_table FROM g5_board WHERE bo_use_search = 0'
    );
    const list = rows.map((r) => String(r.bo_table)).filter((t) => /^[a-zA-Z0-9_-]+$/.test(t));
    excludedBoardsCache = { list, at: now };
    return list;
}

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
 * CJK 2자+ 토큰은 strict phrase("token")로 인접 ngram 매칭 강제. 와일드카드("*token*")는
 * Manticore 가 1글자 ngram("산","불") 단독 매칭으로 분해해 "산불"이 "생산 불가"에 오매칭되는
 * #12543/#11791 패턴을 유발하므로 사용하지 않는다 (백엔드 pkg/sphinx/sphinx.go 와 동일 정책).
 */
export function buildMatchExpr(query: string, field: string): string {
    const escaped = escapeSphinxMatch(query);
    const tokens = escaped.split(/\s+/).filter(Boolean);
    const wildcarded = tokens
        .map((t) => {
            if (containsCJK(t) && [...t].length >= 2) {
                return `"${t}"`;
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
        case 'author_nick':
            return `@wr_name ${wildcarded}`;
        case 'author_id':
            return `@mb_id ${wildcarded}`;
        case 'comment':
            return `@wr_content ${wildcarded}`;
        case 'comment_author':
            return `@(mb_id,wr_name) ${wildcarded}`;
        case 'comment_nick':
            return `@wr_name ${wildcarded}`;
        case 'comment_id':
            return `@mb_id ${wildcarded}`;
        case 'title_content':
        default:
            return `@(wr_subject,wr_content) ${wildcarded}`;
    }
}

/** 댓글 인덱스(wr_is_comment=1)를 검색해야 하는 sfl 필드 집합 */
const COMMENT_SEARCH_FIELDS = new Set<string>([
    'comment',
    'comment_author',
    'comment_nick',
    'comment_id'
]);

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
    const isCommentSearch = COMMENT_SEARCH_FIELDS.has(field);

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
    const isCommentSearch = COMMENT_SEARCH_FIELDS.has(field);
    const safeMatch = matchExpr.replace(/'/g, "\\'");

    // 검색 제외 게시판을 쿼리에서 배제한다.
    // 조회에 실패하면 예외를 그대로 올려 검색을 중단시킨다(fail-closed) — 제외 목록을 모르는 채
    // 검색하면 비공개 게시판이 노출되기 때문이다. 어차피 결과 렌더링에도 이 DB 가 필요하다.
    const excluded = await getSearchExcludedBoards();
    const excludeClause = excluded.length
        ? ` AND bo_table NOT IN (${excluded.map((t) => `'${t}'`).join(',')})`
        : '';

    const sphinxSql =
        `SELECT id, bo_table, wr_id, wr_subject, wr_content, ` +
        `wr_hit, wr_good, wr_comment, wr_datetime, wr_is_comment, wr_parent ` +
        `FROM all_boards_unified_dist ` +
        `WHERE MATCH('${safeMatch}') AND wr_is_comment = ${isCommentSearch ? 1 : 0}` +
        `${excludeClause} ` +
        `ORDER BY wr_datetime DESC ` +
        `LIMIT ${maxResults}`;

    const [rows] = await sphinxPool.query<RowDataPacket[]>(sphinxSql);
    return { rows: rows as any[], total: rows.length };
}
