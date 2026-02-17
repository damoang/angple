import type { PageServerLoad } from './$types';
import type { IndexWidgetsData } from '$lib/api/types';
import { readSettings } from '$lib/server/settings';
import { DEFAULT_WIDGETS, DEFAULT_SIDEBAR_WIDGETS } from '$lib/constants/default-widgets';

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8082/api/v1';

export const load: PageServerLoad = async () => {
    // 위젯 데이터와 레이아웃을 병렬로 로드
    const [indexWidgetsResult, layoutResult] = await Promise.allSettled([
        // 위젯 데이터 로드
        (async () => {
            const response = await fetch(`${INTERNAL_API_URL}/recommended/index-widgets`, {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'Angple-Web-SSR/1.0'
                }
            });

            if (!response.ok) {
                console.error('[SSR] API error:', response.status, await response.text());
                return null;
            }

            const result = await response.json();
            return (result.data ?? result) as IndexWidgetsData;
        })(),
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
