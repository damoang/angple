/**
 * GET /api/boards/[boardId]/posts/[postId]/page-index
 *
 * 해당 글이 자유게시판 등에서 N페이지에 위치하는지 계산.
 * RecentPosts (글 상세 하단 목록) 가 URL `?page` 없이 진입했을 때
 * 자기 글이 속한 페이지로 자동 이동하기 위한 endpoint (#12430).
 *
 * 페이지 계산: 더 최신 (wr_id 가 더 큰) 정상 글 개수 / page_rows + 1.
 *   - prior = COUNT(wr_id > targetId, wr_is_comment=0, wr_deleted_at IS NULL)
 *   - page  = floor(prior / page_rows) + 1
 *
 * page_rows 는 게시판 목록과 동일한 BOARD_LIST_PAGE_SIZE 를 사용한다(#12571).
 * 목록 페이지/하단 RecentPosts 가 bo_page_rows 가 아니라 이 상수로 페이지네이션하므로,
 * 여기서 bo_page_rows(미설정 시 25)를 쓰면 글 위치가 목록과 어긋나 페이지가 넘어갈수록
 * 차이가 누적돼 놓치는 글이 생긴다. 세 곳을 같은 상수로 통일한다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import type { RowDataPacket } from 'mysql2';
import { BOARD_LIST_PAGE_SIZE } from '$lib/constants/board.js';

const BOARD_ID_RE = /^[a-zA-Z0-9_]{1,40}$/;

export const GET: RequestHandler = async ({ params, setHeaders }) => {
    const boardId = params.boardId ?? '';
    const postId = parseInt(params.postId ?? '0', 10);

    if (!BOARD_ID_RE.test(boardId) || !Number.isFinite(postId) || postId <= 0) {
        return json({ page: 1, page_rows: BOARD_LIST_PAGE_SIZE }, { status: 400 });
    }

    try {
        const pageRows = BOARD_LIST_PAGE_SIZE;

        // 해당 글보다 최신인 정상 글 개수 (1페이지에 최신 글이 옴)
        const tableName = `g5_write_${boardId}`;
        const [countRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS c FROM \`${tableName}\`
             WHERE wr_is_comment = 0 AND wr_id > ? AND wr_deleted_at IS NULL`,
            [postId]
        );
        const prior = (countRows[0]?.c as number) ?? 0;
        const page = Math.floor(prior / pageRows) + 1;

        // 짧은 캐시 (1분) — 페이지 번호가 자주 바뀌지 않음
        setHeaders({ 'Cache-Control': 'public, max-age=60' });

        return json({ page, page_rows: pageRows, prior });
    } catch (err) {
        // DB 오류 시 1페이지 fallback (사용자 흐름 방해 X)
        console.error('[page-index] DB error:', err);
        return json({ page: 1, page_rows: BOARD_LIST_PAGE_SIZE });
    }
};
