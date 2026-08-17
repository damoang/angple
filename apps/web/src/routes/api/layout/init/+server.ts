/**
 * GET /api/layout/init
 *
 * SSR에서 분리된 layout 공통 데이터 (banners, celebration, plugins, GA4)
 * 클라이언트 hydration 후 1회 호출, 30초 edge 캐시
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedCelebrations } from '$lib/server/celebration';
import { getCachedBannersByPositions } from '$lib/server/ads/banners';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
    const [celebrationResult, bannersResult] = await Promise.allSettled([
        getCachedCelebrations(),
        getCachedBannersByPositions(['index-top', 'board-head', 'sidebar'])
    ]);

    const celebration = celebrationResult.status === 'fulfilled' ? celebrationResult.value : [];
    const banners = bannersResult.status === 'fulfilled' ? bannersResult.value : {};

    return json(
        {
            celebration,
            banners,
            // ⛔ activePlugins 는 이 CDN 캐시(s-maxage=300) 응답에서 분리했다(Option C 3단계).
            //    활성 플러그인은 no-store 인 /api/plugins/active 에서 클라이언트가 별도 fetch 한다.
            //    소비자 회귀 방지를 위해 키 자체는 유지하되 빈 배열로 중립화한다
            //    (applyLayoutInitPayload 는 length 가 있을 때만 initFromServer 하므로 no-op).
            activePlugins: [],
            ga4MeasurementId: env.GA4_MEASUREMENT_ID || ''
        },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800, max-age=60'
            }
        }
    );
};
