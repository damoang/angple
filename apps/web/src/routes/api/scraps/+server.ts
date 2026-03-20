/**
 * 스크랩 추가/삭제 API
 *
 * POST   /api/scraps  body: { boardId, postId }
 * DELETE /api/scraps  body: { boardId, postId }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addScrap, removeScrap } from '$lib/server/scrap.js';
import { getAuthUser, isRestrictedUser } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
    if (!locals.user?.id) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const user = await getAuthUser(cookies);
    if (isRestrictedUser(user)) {
        return json(
            { success: false, message: '이용제한 중에는 이 기능을 사용할 수 없습니다.' },
            { status: 403 }
        );
    }

    const body = await request.json();
    const { boardId, postId } = body;

    if (!boardId || !postId) {
        return json({ success: false, message: 'boardId와 postId가 필요합니다.' }, { status: 400 });
    }

    const added = await addScrap(locals.user.id, String(boardId), String(postId));
    return json({ success: true, added });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
    if (!locals.user?.id) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { boardId, postId } = body;

    if (!boardId || !postId) {
        return json({ success: false, message: 'boardId와 postId가 필요합니다.' }, { status: 400 });
    }

    const removed = await removeScrap(locals.user.id, String(boardId), String(postId));
    return json({ success: true, removed });
};
