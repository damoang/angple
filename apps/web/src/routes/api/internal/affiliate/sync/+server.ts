import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    deleteCommentAffiliateLinks,
    deletePostAffiliateLinks,
    syncCommentAffiliateLinks,
    syncPostAffiliateLinks
} from '$lib/server/affiliate-links';
import { internalOnlyErrorResponse, isInternalAppRequest } from '$lib/server/internal-api';

export const POST: RequestHandler = async ({ request }) => {
    if (!isInternalAppRequest(request)) {
        return internalOnlyErrorResponse();
    }

    try {
        const body = (await request.json()) as {
            action?: 'sync' | 'delete';
            entity?: 'post' | 'comment';
            boardId?: string;
            postId?: number;
            commentId?: number;
        };

        if (!body.action || !body.entity || !body.boardId || !body.postId) {
            return json(
                { success: false, message: '필수 파라미터가 누락되었습니다.' },
                { status: 400 }
            );
        }

        if (body.entity === 'post') {
            if (body.action === 'sync') {
                await syncPostAffiliateLinks(body.boardId, body.postId);
            } else {
                await deletePostAffiliateLinks(body.boardId, body.postId);
            }
            return json({ success: true });
        }

        if (!body.commentId) {
            return json({ success: false, message: 'commentId가 필요합니다.' }, { status: 400 });
        }

        if (body.action === 'sync') {
            await syncCommentAffiliateLinks(body.boardId, body.postId, body.commentId);
        } else {
            await deleteCommentAffiliateLinks(body.boardId, body.postId, body.commentId);
        }

        return json({ success: true });
    } catch (error) {
        console.error('[AffiliateSync] error:', error);
        return json(
            { success: false, message: '어필리에이트 동기화에 실패했습니다.' },
            { status: 500 }
        );
    }
};
