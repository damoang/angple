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
import { getActivePlugins } from '$lib/server/plugins';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
    const [celebrationResult, bannersResult, pluginsResult] = await Promise.allSettled([
        getCachedCelebrations(),
        getCachedBannersByPositions(['index-top', 'board-head', 'sidebar']),
        getActivePlugins()
    ]);

    const celebration = celebrationResult.status === 'fulfilled' ? celebrationResult.value : [];
    const banners = bannersResult.status === 'fulfilled' ? bannersResult.value : {};
    const activePlugins =
        pluginsResult.status === 'fulfilled'
            ? pluginsResult.value.map((plugin) => ({
                  id: plugin.manifest.id,
                  name: plugin.manifest.name,
                  version: plugin.manifest.version,
                  hooks: plugin.manifest.hooks || [],
                  components: plugin.manifest.components || [],
                  settings: plugin.currentSettings || {}
              }))
            : [];

    return json(
        {
            celebration,
            banners,
            activePlugins,
            ga4MeasurementId: env.GA4_MEASUREMENT_ID || ''
        },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60, max-age=0'
            }
        }
    );
};
