/**
 * 축하메시지 배너 API
 * 공유 모듈 사용: $lib/server/celebration
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedCelebrations } from '$lib/server/celebration';

export const GET: RequestHandler = async ({ url }) => {
    const mode = url.searchParams.get('mode');
    const isRecent = mode === 'recent';

    try {
        const banners = await getCachedCelebrations(isRecent);

        return json(
            {
                success: true,
                data: banners
            },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
                }
            }
        );
    } catch (error) {
        console.error('Banner API error:', error);
        return json(
            {
                success: false,
                data: [],
                error: 'Failed to fetch banners'
            },
            { status: 500 }
        );
    }
};
