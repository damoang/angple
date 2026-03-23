import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { backfillAffiliateLinks } from '$lib/server/affiliate-links';
import { internalOnlyErrorResponse, isInternalAppRequest } from '$lib/server/internal-api';

export const POST: RequestHandler = async ({ request }) => {
    if (!isInternalAppRequest(request)) {
        return internalOnlyErrorResponse();
    }

    try {
        const body = (await request.json()) as {
            boardId?: string;
            postIdFrom?: number;
            postIdTo?: number;
            limit?: number;
            entity?: 'post' | 'comment' | 'both';
        };

        if (!body.boardId) {
            return json({ success: false, message: 'boardId가 필요합니다.' }, { status: 400 });
        }

        const result = await backfillAffiliateLinks({
            boardId: body.boardId,
            postIdFrom: body.postIdFrom,
            postIdTo: body.postIdTo,
            limit: body.limit,
            entity: body.entity
        });

        return json({ success: true, data: result });
    } catch (error) {
        console.error('[AffiliateBackfill] error:', error);
        return json(
            { success: false, message: '어필리에이트 백필에 실패했습니다.' },
            { status: 500 }
        );
    }
};
