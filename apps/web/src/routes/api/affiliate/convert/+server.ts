/**
 * 제휴 링크 단일 변환 API
 * POST /api/affiliate/convert
 *
 * 공유 라이브러리(plugins/affiliate-link)를 사용하여 중복 코드 제거
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { convertAffiliateUrl } from '$plugins/affiliate-link/lib/affiliate-api.server';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { url, bo_table, wr_id } = body;

        if (!url) {
            return json({ error: 'URL is required' }, { status: 400 });
        }

        const result = await convertAffiliateUrl(url, { bo_table, wr_id });
        return json(result);
    } catch (error) {
        console.error('[Affiliate Convert] Error:', error);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
};
