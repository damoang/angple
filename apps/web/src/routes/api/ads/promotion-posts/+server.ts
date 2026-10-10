import { json } from '@sveltejs/kit';
import { getAdsServerUrl } from '$lib/server/ads/config';
import { maskTitleFields } from '$lib/utils/email-reveal.js';
import type { RequestHandler } from './$types';

// GET /api/ads/promotion-posts
// damoang-ads 서버 프록시 (직접홍보 게시글)
export const GET: RequestHandler = async () => {
    const adsServerUrl = getAdsServerUrl();
    try {
        const response = await fetch(`${adsServerUrl}/api/v1/serve/promotion-posts`);
        if (!response.ok) {
            return json({ success: false, data: { posts: [], count: 0 } });
        }
        // 이메일 주소 수집 방지 — 홍보 글 제목은 「[이메일]」로.
        return json(maskTitleFields(await response.json()));
    } catch {
        return json({ success: false, data: { posts: [], count: 0 } });
    }
};
