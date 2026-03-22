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
    recommendedData: Awaited<ReturnType<typeof loadRecommendedData>>;
    recommendedPeriod: ReturnType<typeof getDefaultPeriod>;
    exploreData: null;
    celebrationRecent: Awaited<ReturnType<typeof getCachedCelebrations>> | null;
}

let cachedHomePageData: HomePageData | null = null;
let cachedHomePageDataAt = 0;
let pendingHomePageLoad: Promise<HomePageData> | null = null;

async function buildHomePageData(): Promise<HomePageData> {
    const recommendedPeriod = getDefaultPeriod();
    // 메인 SSR 페이로드를 줄이기 위해 explore는 클라이언트 fallback에 맡긴다.
    const [indexWidgetsResult, layoutResult, recommendedResult, celebrationResult] =
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
            // 추천글 기본 탭 SSR 프리페치 (로딩 없이 즉시 표시)
            loadRecommendedData(recommendedPeriod),
            // 인덱스 전용: 최근 축하메시지 (오늘뿐 아니라 최근 8건)
            getCachedCelebrations(true)
        ]);

    const indexWidgets =
        indexWidgetsResult.status === 'fulfilled' ? indexWidgetsResult.value : null;
    const layoutData =
        layoutResult.status === 'fulfilled'
            ? layoutResult.value
            : { widgetLayout: DEFAULT_WIDGETS, sidebarWidgetLayout: DEFAULT_SIDEBAR_WIDGETS };
    const recommendedData =
        recommendedResult.status === 'fulfilled' ? recommendedResult.value : null;
    const celebrationRecent =
        celebrationResult.status === 'fulfilled' ? celebrationResult.value : null;

    if (indexWidgetsResult.status === 'rejected') {
        console.error('[SSR] Failed to load index widgets:', indexWidgetsResult.reason);
    }

    return {
        indexWidgets,
        widgetLayout: layoutData.widgetLayout,
        sidebarWidgetLayout: layoutData.sidebarWidgetLayout,
        recommendedData,
        recommendedPeriod,
        exploreData: null,
        celebrationRecent
    };
}

export const load: PageServerLoad = async () => {
    const now = Date.now();
    if (cachedHomePageData && now - cachedHomePageDataAt < HOME_PAGE_CACHE_TTL_MS) {
        return cachedHomePageData;
    }

    if (!pendingHomePageLoad) {
        pendingHomePageLoad = buildHomePageData()
            .then((data) => {
                cachedHomePageData = data;
                cachedHomePageDataAt = Date.now();
                return data;
            })
            .finally(() => {
                pendingHomePageLoad = null;
            });
    }

    return pendingHomePageLoad;
};
