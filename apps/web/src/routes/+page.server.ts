import type { PageServerLoad } from './$types';
import { getWidgetLayout, getSidebarWidgetLayout } from '$lib/server/settings/index';
import { DEFAULT_WIDGETS, DEFAULT_SIDEBAR_WIDGETS } from '$lib/constants/default-widgets';
import { buildIndexWidgets } from '$lib/server/index-widgets-builder';
import { getDefaultPeriod, loadRecommendedData } from '$lib/server/recommended-loader';
import { getCachedCelebrations } from '$lib/server/celebration';
import { env } from '$env/dynamic/private';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';

export const load: PageServerLoad = async () => {
    // 위젯 데이터, 레이아웃, 추천글, 축하메시지를 병렬로 로드
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
            loadRecommendedData(getDefaultPeriod()),
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
        recommendedPeriod: getDefaultPeriod(),
        celebrationRecent
    };
};
