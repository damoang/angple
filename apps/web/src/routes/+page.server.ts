import type { PageServerLoad } from './$types';
import { getWidgetLayout, getSidebarWidgetLayout } from '$lib/server/settings/index';
import { DEFAULT_WIDGETS, DEFAULT_SIDEBAR_WIDGETS } from '$lib/constants/default-widgets';
import { buildIndexWidgets } from '$lib/server/index-widgets-builder';
import { getDefaultPeriod, loadRecommendedData } from '$lib/server/recommended-loader';
import { getCachedCelebrations } from '$lib/server/celebration';
import { env } from '$env/dynamic/private';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';
const HOME_PAGE_CACHE_TTL_MS = 30_000;

interface HomePageData {
    indexWidgets: Awaited<ReturnType<typeof buildIndexWidgets>> | null;
    widgetLayout: typeof DEFAULT_WIDGETS;
    sidebarWidgetLayout: typeof DEFAULT_SIDEBAR_WIDGETS;
    recommendedData: Awaited<ReturnType<typeof loadRecommendedData>> | null;
    recommendedPeriod: ReturnType<typeof getDefaultPeriod>;
    exploreData: null;
    celebrationRecent: Awaited<ReturnType<typeof getCachedCelebrations>> | null;
}

// Phase 14 — multi-tenant: cache 를 host 별로 격리 (module singleton 이 SSR 요청 간
// 공유되어 첫 host 의 home data 가 후속 host 를 오염하는 문제 해결).
const homeCacheByHost = new Map<string, { data: HomePageData; at: number }>();
const pendingByHost = new Map<string, Promise<HomePageData>>();

async function buildHomePageData(): Promise<HomePageData> {
    const recommendedPeriod = getDefaultPeriod();
    // 메인 SSR 페이로드를 줄이기 위해 explore는 클라이언트 fallback에 맡긴다.
    const [indexWidgetsResult, layoutResult, celebrationResult, recommendedResult] =
        await Promise.allSettled([
            buildIndexWidgets(BACKEND_URL),
            (async () => {
                const [widgetLayout, sidebarWidgetLayout] = await Promise.all([
                    getWidgetLayout(),
                    getSidebarWidgetLayout()
                ]);
                return {
                    widgetLayout: widgetLayout ?? DEFAULT_WIDGETS,
                    sidebarWidgetLayout: sidebarWidgetLayout ?? DEFAULT_SIDEBAR_WIDGETS
                };
            })(),
            // 인덱스 전용: 최근 축하메시지 (오늘뿐 아니라 최근 8건)
            getCachedCelebrations(true),
            // 공감글 SSR 프리페치 (스켈레톤 제거)
            loadRecommendedData(recommendedPeriod)
        ]);

    const indexWidgets =
        indexWidgetsResult.status === 'fulfilled' ? indexWidgetsResult.value : null;
    const layoutData =
        layoutResult.status === 'fulfilled'
            ? layoutResult.value
            : { widgetLayout: DEFAULT_WIDGETS, sidebarWidgetLayout: DEFAULT_SIDEBAR_WIDGETS };
    const celebrationRecent =
        celebrationResult.status === 'fulfilled' ? celebrationResult.value : null;

    if (indexWidgetsResult.status === 'rejected') {
        console.error('[SSR] Failed to load index widgets:', indexWidgetsResult.reason);
    }

    return {
        indexWidgets,
        widgetLayout: layoutData.widgetLayout,
        sidebarWidgetLayout: layoutData.sidebarWidgetLayout,
        recommendedData: recommendedResult.status === 'fulfilled' ? recommendedResult.value : null,
        recommendedPeriod,
        exploreData: null,
        celebrationRecent
    };
}

/**
 * Phase 14 Tier 1 T1.3 — multi-tenant graceful fallback.
 *
 * 빈 사이트 (ipyang/nuna/tektok 등 신규 도메인) 의 transitive 의존성
 * (g5_write_message / celebration_banners / legacy-data cache file 등) 누락 시
 * buildHomePageData 가 unexpected throw 해도 SSR 가 정상 응답하도록 보강.
 *
 * 모든 fail = empty defaults 로 fallback. damoang regression 0
 * (정상 데이터는 그대로 반환).
 */
function emptyHomePageData(): HomePageData {
    return {
        indexWidgets: null,
        widgetLayout: DEFAULT_WIDGETS,
        sidebarWidgetLayout: DEFAULT_SIDEBAR_WIDGETS,
        recommendedData: null,
        recommendedPeriod: getDefaultPeriod(),
        exploreData: null,
        celebrationRecent: null
    };
}

export const load: PageServerLoad = async ({ url }) => {
    // Phase 14 — host 별 cache key (multi-tenant: 사이트마다 다른 home data)
    const host = url.host;
    const now = Date.now();

    const cached = homeCacheByHost.get(host);
    if (cached && now - cached.at < HOME_PAGE_CACHE_TTL_MS) {
        return cached.data;
    }

    let pending = pendingByHost.get(host);
    if (!pending) {
        pending = buildHomePageData()
            .then((data) => {
                homeCacheByHost.set(host, { data, at: Date.now() });
                return data;
            })
            .catch((err) => {
                // Phase 14 — 빈 사이트 graceful fallback
                console.error(
                    '[SSR Home] buildHomePageData failed, returning empty defaults:',
                    err
                );
                const fallback = emptyHomePageData();
                homeCacheByHost.set(host, { data: fallback, at: Date.now() });
                return fallback;
            })
            .finally(() => {
                pendingByHost.delete(host);
            });
        pendingByHost.set(host, pending);
    }

    return pending;
};
