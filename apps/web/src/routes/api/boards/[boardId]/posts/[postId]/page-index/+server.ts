/**
 * GET /api/boards/[boardId]/posts/[postId]/page-index
 *
 * 해당 글이 목록의 몇 페이지에 있는지 (#12430).
 *
 * ⭐ 계산 로직은 `$lib/server/page-index.ts` 에 있다. SSR(`[boardId]/[postId]/+page.server.ts`)이
 *    **같은 함수를 직접** 부르기 때문이다. 예전에는 SSR 이 이 라우트를 `svelteKitFetch` 로
 *    호출해서, 같은 프로세스 안에서 Request/Response 생성과 JSON 왕복이 매 요청 일어났다.
 *
 * ⛔ **이 라우트를 지우지 마라.** `recent-posts.svelte` 에 폴백 호출이 남아 있다
 *    (SSR 이 1페이지를 준 경우에만 발화). 공개 계약은 그대로 유지한다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPageIndex, BOARD_ID_RE, DEFAULT_PAGE_ROWS } from '$lib/server/page-index';

export const GET: RequestHandler = async ({ params, setHeaders }) => {
    const boardId = params.boardId ?? '';
    const postId = parseInt(params.postId ?? '0', 10);

    if (!BOARD_ID_RE.test(boardId) || !Number.isFinite(postId) || postId <= 0) {
        return json({ page: 1, page_rows: DEFAULT_PAGE_ROWS }, { status: 400 });
    }

    const result = await getPageIndex(boardId, postId);

    // 짧은 캐시 (1분) — 페이지 번호가 자주 바뀌지 않음
    setHeaders({ 'Cache-Control': 'public, max-age=60' });

    return json(result);
};
