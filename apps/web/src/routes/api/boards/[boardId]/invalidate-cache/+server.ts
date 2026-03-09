import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { invalidateBoardCache } from '$lib/server/board-cache.js';

/** POST /api/boards/:boardId/invalidate-cache — 보드 캐시 무효화 */
export const POST: RequestHandler = async ({ params }) => {
    const { boardId } = params;
    invalidateBoardCache(boardId);
    return json({ ok: true });
};
