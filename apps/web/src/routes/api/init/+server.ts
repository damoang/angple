/**
 * 앱 초기화 API — 여러 공통 데이터를 서버에서 병렬 조회하여 단일 응답으로 반환
 *
 * GET /api/init?positions=index,board-list,sidebar
 * → { celebration: [...], banners: { index: [...], sidebar: [...] } }
 *
 * 주로 SSR에서 +layout.server.ts가 데이터를 로드하므로 이 엔드포인트는
 * SSR 실패 시 fallback 또는 SPA 내비게이션 캐시 만료 시에만 호출됨.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCachedCelebrations } from '$lib/server/celebration';
import { getAdsServerUrl } from '$lib/server/ads/config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchBannersByPositions(positions: string[]): Promise<Record<string, any>> {
    const adsServerUrl = getAdsServerUrl();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any> = {};

    await Promise.all(
        positions.map(async (position) => {
            try {
                const response = await fetch(
                    `${adsServerUrl}/api/v1/serve/banners?position=${encodeURIComponent(position)}&limit=10`
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data?.banners) {
                        result[position] = data.data.banners;
                    }
                }
            } catch {
                // 개별 position 실패는 무시
            }
        })
    );

    return result;
}

export const GET: RequestHandler = async ({ url }) => {
    const positionsParam = url.searchParams.get('positions') || '';
    const positions = positionsParam
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

    try {
        const [celebration, banners] = await Promise.all([
            getCachedCelebrations(),
            positions.length > 0 ? fetchBannersByPositions(positions) : {}
        ]);

        return json(
            { celebration, banners },
            {
                headers: {
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
                }
            }
        );
    } catch (error) {
        console.error('Init API error:', error);
        return json({ celebration: [], banners: {} }, { status: 500 });
    }
};
