/**
 * 게시글 링크(wr_link1/2) 클릭 카운트 비콘
 *
 * POST /api/boards/[boardId]/posts/[postId]/link-hit?n=1  (n = 1 | 2)
 * → g5_write_{board}.wr_link{n}_hit += 1
 *
 * 백엔드 PostResponse 는 link_hit 을 노출/증가시키지 않는다(프리즈). 링크 클릭 시
 * navigator.sendBeacon 으로 이 엔드포인트를 불러 앞으로만 라이브 집계.
 */
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';

export const POST: RequestHandler = async ({ params, url }) => {
    const safeBoardId = (params.boardId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const wrId = parseInt(params.postId || '', 10);
    const which = Number(url.searchParams.get('n'));

    // which 는 1|2 로 제한 후 고정 컬럼명에만 대입 → 문자열 보간이어도 인젝션 불가.
    // 테이블명은 정규식 정화(영숫자·_·- 만).
    if (!safeBoardId || Number.isNaN(wrId) || (which !== 1 && which !== 2)) {
        return new Response(null, { status: 204 });
    }

    const col = which === 1 ? 'wr_link1_hit' : 'wr_link2_hit';
    try {
        await pool.query(
            `UPDATE \`g5_write_${safeBoardId}\` SET ${col} = ${col} + 1 WHERE wr_id = ?`,
            [wrId]
        );
    } catch (e) {
        // 집계 실패해도 링크 이동엔 영향 없음.
        console.error('[link-hit] wr_link_hit 증가 실패:', e);
    }

    return new Response(null, { status: 204 });
};
