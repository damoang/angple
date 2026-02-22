import type { PageServerLoad } from './$types';
import { readSettings } from '$lib/server/settings';
import { DEFAULT_WIDGETS, DEFAULT_SIDEBAR_WIDGETS } from '$lib/constants/default-widgets';
import { buildIndexWidgets } from '$lib/server/index-widgets-builder';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8090';

export const load: PageServerLoad = async () => {
    // 위젯 데이터와 레이아웃을 병렬로 로드
    const [indexWidgetsResult, layoutResult] = await Promise.allSettled([
        // 개별 게시판 API 병렬 호출로 위젯 데이터 조립
        buildIndexWidgets(BACKEND_URL),
        // 위젯 레이아웃 로드 (메인 + 사이드바)
        (async () => {
            const settings = await readSettings();
            return {
                widgetLayout: settings.widgetLayout ?? DEFAULT_WIDGETS,
                sidebarWidgetLayout: settings.sidebarWidgetLayout ?? DEFAULT_SIDEBAR_WIDGETS
            };
        })()
    ]);

    const indexWidgets =
        indexWidgetsResult.status === 'fulfilled' ? indexWidgetsResult.value : null;
    const layoutData =
        layoutResult.status === 'fulfilled'
            ? layoutResult.value
            : { widgetLayout: DEFAULT_WIDGETS, sidebarWidgetLayout: DEFAULT_SIDEBAR_WIDGETS };

    if (indexWidgetsResult.status === 'rejected') {
        console.error('[SSR] Failed to load index widgets:', indexWidgetsResult.reason);
    }

    return {
        indexWidgets,
        widgetLayout: layoutData.widgetLayout,
        sidebarWidgetLayout: layoutData.sidebarWidgetLayout
    };
};
