/**
 * 스크랩 상태 조회 API
 *
 * GET /api/scraps/status?boardId=free&postId=123
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isScraped } from '$lib/server/scrap.js';

export const GET: RequestHandler = async ({ url, locals }) => {
    if (!locals.user?.id) {
        return json({ scrapped: false });
    }

    const boardId = url.searchParams.get('boardId');
    const postId = url.searchParams.get('postId');

    if (!boardId || !postId) {
        return json({ success: false, message: 'boardId와 postId가 필요합니다.' }, { status: 400 });
    }

    const scrapped = await isScraped(locals.user.id, boardId, postId);
    return json({ scrapped });
};
