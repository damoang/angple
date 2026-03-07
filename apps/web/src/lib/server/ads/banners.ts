/**
 * 배너 데이터 공유 모듈
 *
 * +layout.server.ts, /api/init 에서 공유.
 * 60초 인메모리 캐시 + singleflight 포함.
 */
import { createCache } from '$lib/server/cache';
import { getAdsServerUrl } from './config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bannerCache = createCache<Record<string, any[]>>({ ttl: 60_000, maxSize: 10 });

/** ads 서버에서 배너 데이터 조회 (60초 캐시, singleflight) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCachedBannersByPositions(
    positions: string[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any[]>> {
    const cacheKey = [...positions].sort().join(',');
    return bannerCache.getOrSet(cacheKey, async () => {
        const adsServerUrl = getAdsServerUrl();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: Record<string, any[]> = {};

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
    });
}
