import type { PageServerLoad } from './$types';
import type { IndexWidgetsData } from '$lib/api/types';
import { readSettings, type WidgetConfig } from '$lib/server/settings';

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8082/api/v2';

// 기본 메인 위젯 레이아웃
const DEFAULT_WIDGETS: WidgetConfig[] = [
    { id: 'ad-head', type: 'ad', position: 0, enabled: true, settings: { position: 'index-head' } },
    { id: 'recommended', type: 'recommended', position: 1, enabled: true },
    { id: 'ad-top', type: 'ad', position: 2, enabled: true, settings: { position: 'index-top' } },
    { id: 'news-economy-row', type: 'news-economy-row', position: 3, enabled: true },
    {
        id: 'ad-middle-1',
        type: 'ad',
        position: 4,
        enabled: true,
        settings: { position: 'index-middle-1' }
    },
    { id: 'gallery', type: 'gallery', position: 5, enabled: true },
    {
        id: 'ad-middle-2',
        type: 'ad',
        position: 6,
        enabled: true,
        settings: { position: 'index-middle-2' }
    },
    { id: 'group', type: 'group', position: 7, enabled: true },
    { id: 'ad-bottom', type: 'ad', position: 8, enabled: true, settings: { position: 'index-bottom' } }
];

// 기본 사이드바 위젯 레이아웃
const DEFAULT_SIDEBAR_WIDGETS: WidgetConfig[] = [
    { id: 'notice', type: 'notice', position: 0, enabled: true },
    { id: 'podcast', type: 'podcast', position: 1, enabled: true },
    {
        id: 'sidebar-ad-1',
        type: 'sidebar-ad',
        position: 2,
        enabled: true,
        settings: { type: 'image', format: 'square' }
    },
    {
        id: 'sidebar-ad-2',
        type: 'sidebar-ad',
        position: 3,
        enabled: true,
        settings: { type: 'image-text', format: 'grid' }
    },
    { id: 'sharing-board', type: 'sharing-board', position: 4, enabled: true },
    { id: 'sticky-ads', type: 'sticky-ads', position: 5, enabled: true }
];

export const load: PageServerLoad = async () => {
    console.log('[SSR] Loading index widgets data');

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

    console.log('[SSR] Index widgets loaded');
    return {
        indexWidgets,
        widgetLayout: layoutData.widgetLayout,
        sidebarWidgetLayout: layoutData.sidebarWidgetLayout
    };
};
