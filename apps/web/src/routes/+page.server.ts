import type { PageServerLoad } from './$types';
import { readSettings } from '$lib/server/settings';
import { DEFAULT_WIDGETS, DEFAULT_SIDEBAR_WIDGETS } from '$lib/constants/default-widgets';
import { buildIndexWidgets } from '$lib/server/index-widgets-builder';
import { getDefaultPeriod, loadRecommendedData } from '$lib/server/recommended-loader';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8090';

export const load: PageServerLoad = async () => {
    // 위젯 데이터, 레이아웃, 추천글을 병렬로 로드
    const [indexWidgetsResult, layoutResult, recommendedResult] = await Promise.allSettled([
        buildIndexWidgets(BACKEND_URL),
        (async () => {
            const settings = await readSettings();
            return {
                widgetLayout: settings.widgetLayout ?? DEFAULT_WIDGETS,
                sidebarWidgetLayout: settings.sidebarWidgetLayout ?? DEFAULT_SIDEBAR_WIDGETS
            };
        })(),
        // 추천글 기본 탭 SSR 프리페치 (로딩 없이 즉시 표시)
        loadRecommendedData(getDefaultPeriod())
    ]);

    const indexWidgets =
        indexWidgetsResult.status === 'fulfilled' ? indexWidgetsResult.value : null;
    const layoutData =
        layoutResult.status === 'fulfilled'
            ? layoutResult.value
            : { widgetLayout: DEFAULT_WIDGETS, sidebarWidgetLayout: DEFAULT_SIDEBAR_WIDGETS };
    const recommendedData =
        recommendedResult.status === 'fulfilled' ? recommendedResult.value : null;

    if (indexWidgetsResult.status === 'rejected') {
        console.error('[SSR] Failed to load index widgets:', indexWidgetsResult.reason);
    }

    return {
        indexWidgets,
        widgetLayout: layoutData.widgetLayout,
        sidebarWidgetLayout: layoutData.sidebarWidgetLayout,
        recommendedData,
        recommendedPeriod: getDefaultPeriod()
    };
};
