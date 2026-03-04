/**
 * 제휴 링크 일괄 변환 API
 * POST /api/affiliate/batch
 *
 * 공유 라이브러리(plugins/affiliate-link)를 사용하여 중복 코드 제거
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convertAffiliateUrls } from '$plugins/affiliate-link/lib/affiliate-api.server';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { urls, bo_table, wr_id } = body;

        if (!urls || !Array.isArray(urls)) {
            return json({ error: 'urls array is required' }, { status: 400 });
        }

        // 최대 50개로 제한
        const limitedUrls = urls.slice(0, 50);

        const result = await convertAffiliateUrls(limitedUrls, { bo_table, wr_id });
        return json(result);
    } catch (error) {
        console.error('[Affiliate Batch] Error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
