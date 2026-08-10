/**
 * 첨부파일 다운로드 카운트 비콘
 *
 * POST /api/boards/[boardId]/posts/[postId]/files/[fileNo]/hit
 * → g5_board_file.bf_download += 1 (해당 파일)
 *
 * 파일은 CDN 직접 URL 로 서빙되어 다운로드가 집계되지 않았다(옛 PHP 값 프리즈).
 * 다운로드 링크 클릭 시 navigator.sendBeacon 으로 이 엔드포인트를 불러 앞으로만 라이브 집계.
 * 익명 허용(그누보드도 익명 카운트). 남용 디듑은 MVP 범위 밖.
 */
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';

export const POST: RequestHandler = async ({ params }) => {
    const safeBoardId = (params.boardId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const wrId = parseInt(params.postId || '', 10);
    const bfNo = parseInt(params.fileNo || '', 10);

    // bo_table·bf_no 는 파라미터 바인딩이라 인젝션 불가. 잘못된 값은 조용히 무시(204).
    if (!safeBoardId || Number.isNaN(wrId) || Number.isNaN(bfNo)) {
        return new Response(null, { status: 204 });
    }

    try {
        await pool.query(
            `UPDATE g5_board_file SET bf_download = bf_download + 1
			  WHERE bo_table = ? AND wr_id = ? AND bf_no = ?`,
            [safeBoardId, wrId, bfNo]
        );
    } catch (e) {
        // 집계 실패해도 다운로드 자체엔 영향 없음(파일은 별도 CDN URL).
        console.error('[files/hit] bf_download 증가 실패:', e);
    }

    return new Response(null, { status: 204 });
};
