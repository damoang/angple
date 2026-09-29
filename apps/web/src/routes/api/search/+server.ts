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
import { readPool } from '$lib/server/db.js';
import { searchAllBoards, buildMatchExpr } from '$lib/server/sphinx-search.js';
import { findDisciplinedIds, DISCIPLINED_TITLE } from '$lib/server/discipline-mask.js';
import { isSecretOption } from '$lib/server/secret-option.js';
import type { RowDataPacket } from 'mysql2';

/** 본문(wr_content)을 매칭하지 않는 검색 필드 — sphinx-search.ts buildMatchExpr 와 일치 */
const NON_BODY_FIELDS = new Set([
    'title',
    'author',
    'author_nick',
    'author_id',
    'comment_author',
    'comment_nick',
    'comment_id'
]);

interface BoardRow extends RowDataPacket {
    bo_table: string;
    bo_subject: string;
}

interface PostAuthorRow extends RowDataPacket {
    wr_id: number;
    wr_name: string;
    mb_id: string;
    wr_parent: number;
    wr_option: string | null;
    wr_deleted_at: string | null;
}

interface PostOptionRow extends RowDataPacket {
    wr_id: number;
    wr_option: string | null;
}

interface BoardFileRow extends RowDataPacket {
    wr_id: number;
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
        const isCommentSearch =
            field === 'comment' ||
            field === 'comment_author' ||
            field === 'comment_nick' ||
            field === 'comment_id';
        // 본문을 대상으로 매칭하는 검색 — 비밀글·비밀댓글은 결과에서 아예 뺀다
        // (발췌를 비워도 「이 단어가 들어 있다」는 사실 자체가 드러나므로).
        // ⛔ 허용 목록 방식: buildMatchExpr 는 모르는 sfl 을 제목+본문으로 보내므로,
        //    본문을 보지 않는 필드만 명시하고 나머지(알 수 없는 값 포함)는 본문 매칭으로 본다.
        const matchesBody = !NON_BODY_FIELDS.has(field);

        // 1) Sphinx에서 검색 (최대 200건)
        const { rows: sphinxRows } = await searchAllBoards(field, query, 200);

        if (!sphinxRows.length) {
            return json({
                success: true,
                data: { results: [], total: 0, query }
            });
        }

        // 2) 게시판별 그룹핑
        const boardMap = new Map<string, typeof sphinxRows>();
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
        // Sphinx 인덱스가 소프트 삭제된 글을 즉시 반영하지 못해 검색 결과에 노출되는 문제(#12173)
        // 방지를 위해 MySQL 에서 wr_deleted_at 가 설정되었거나 행이 사라진 글을 추적해 제외한다.
        const deletedSet = new Set<string>();
        // 이용제한 근거 글: 검색 결과에서도 제목·본문을 원문 노출 없이 치환(#12908).
        const disciplinedSet = new Set<string>();
        // 비밀글·비밀댓글(비밀글에 달린 댓글 포함): 본문 발췌를 싣지 않는다.
        const secretSet = new Set<string>();

        const perBoardPromises = boardIds.map(async (boardId) => {
            const rows = boardMap.get(boardId)!;
            const wrIds = rows.slice(0, limitPerBoard).map((r) => r.wr_id);
            if (!wrIds.length) return;

            const ph = wrIds.map(() => '?').join(',');

            // 이용제한 근거 글 집합 조회
            const disciplined = await findDisciplinedIds(boardId, wrIds);
            for (const id of disciplined) disciplinedSet.add(`${boardId}:${id}`);

            // 작성자 정보 + 삭제 상태 조회
            try {
                const [authorRows] = await readPool.execute<PostAuthorRow[]>(
                    `SELECT wr_id, wr_name, mb_id, wr_parent, wr_option, wr_deleted_at FROM g5_write_${boardId} WHERE wr_id IN (${ph})`,
                    wrIds
                );
                const seen = new Set<number>();
                // 댓글행 → 원글 id (원글 비밀 여부 확인용)
                const parentOf = new Map<number, number>();
                for (const a of authorRows) {
                    seen.add(a.wr_id);
                    if (isSecretOption(a.wr_option)) {
                        secretSet.add(`${boardId}:${a.wr_id}`);
                    } else if (a.wr_parent && a.wr_parent !== a.wr_id) {
                        parentOf.set(a.wr_id, a.wr_parent);
                    }
                    const deletedAt = a.wr_deleted_at;
                    const isDeleted =
                        deletedAt !== null &&
                        deletedAt !== undefined &&
                        String(deletedAt) !== '0000-00-00 00:00:00' &&
                        String(deletedAt) !== '';
                    if (isDeleted) {
                        deletedSet.add(`${boardId}:${a.wr_id}`);
                        continue;
                    }
                    authorMap.set(`${boardId}:${a.wr_id}`, {
                        wr_name: a.wr_name,
                        mb_id: a.mb_id
                    });
                }
                // MySQL 에 존재하지 않는 wr_id (이미 hard delete 된 글)도 노출하지 않는다.
                for (const id of wrIds) {
                    if (!seen.has(id)) deletedSet.add(`${boardId}:${id}`);
                }
                // 비밀글에 달린 댓글도 비밀로 본다.
                const parentIds = [...new Set(parentOf.values())];
                if (parentIds.length) {
                    const pph = parentIds.map(() => '?').join(',');
                    const [parentRows] = await readPool.execute<PostOptionRow[]>(
                        `SELECT wr_id, wr_option FROM g5_write_${boardId} WHERE wr_id IN (${pph})`,
                        parentIds
                    );
                    const parentOption = new Map<number, string | null>();
                    for (const p of parentRows) parentOption.set(p.wr_id, p.wr_option);
                    for (const [childId, parentId] of parentOf) {
                        // 원글을 확인하지 못하면 비밀로 간주한다.
                        if (
                            !parentOption.has(parentId) ||
                            isSecretOption(parentOption.get(parentId))
                        ) {
                            secretSet.add(`${boardId}:${childId}`);
                        }
                    }
                }
            } catch {
                // 테이블 없는 경우 등 — 상태를 확인하지 못한 글은 노출하지 않는다.
                for (const id of wrIds) deletedSet.add(`${boardId}:${id}`);
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
        //    Sphinx 인덱스가 소프트 삭제 반영 전이거나 hard delete 직후인 wr_id 는 deletedSet 으로 걸러낸다 (#12173).
        //    본문 매칭 검색에서는 비밀글·비밀댓글도 같은 방식으로 뺀다.
        const isHidden = (boardId: string, wrId: number) =>
            deletedSet.has(`${boardId}:${wrId}`) ||
            (matchesBody && secretSet.has(`${boardId}:${wrId}`));
        let totalAfterFilter = 0;
        const results = boardIds
            .map((boardId) => {
                const rows = boardMap.get(boardId)!;
                const liveRows = rows
                    .slice(0, limitPerBoard)
                    .filter((row) => !isHidden(boardId, row.wr_id));
                const liveTotal = rows.filter((row) => !isHidden(boardId, row.wr_id)).length;
                totalAfterFilter += liveTotal;
                return {
                    board_id: boardId,
                    board_name: boardNameMap.get(boardId) || boardId,
                    total: liveTotal,
                    is_comment: isCommentSearch,
                    posts: liveRows.map((row) => {
                        const author = authorMap.get(`${boardId}:${row.wr_id}`);
                        const isDisciplined = disciplinedSet.has(`${boardId}:${row.wr_id}`);
                        const isSecret = secretSet.has(`${boardId}:${row.wr_id}`);
                        return {
                            id: row.wr_id,
                            title: isCommentSearch
                                ? ''
                                : isDisciplined
                                  ? DISCIPLINED_TITLE
                                  : row.wr_subject,
                            content:
                                isDisciplined || isSecret
                                    ? ''
                                    : stripHtml(row.wr_content).slice(0, 200),
                            author: author?.wr_name || '',
                            author_id: author?.mb_id || '',
                            board_id: boardId,
                            views: row.wr_hit,
                            likes: row.wr_good,
                            comments_count: row.wr_comment,
                            // #12522: Sphinx wr_datetime epoch 는 KST naive datetime 을
                            // UTC 로 잘못 해석한 값(RDS time_zone=UTC SYSTEM). 9시간 보정 →
                            // KST 15시 이후 글이 다음 날로 표시되던 버그 수정.
                            created_at: new Date((row.wr_datetime - 9 * 3600) * 1000).toISOString(),
                            has_file: fileSet.has(`${boardId}:${row.wr_id}`),
                            parent_id: isCommentSearch ? row.wr_parent || 0 : undefined
                        };
                    })
                };
            })
            .filter((board) => board.posts.length > 0)
            .sort((a, b) => b.total - a.total);

        return json({
            success: true,
            data: {
                results,
                total: totalAfterFilter,
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
