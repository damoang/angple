/**
 * Sidebar Widget Hook
 *
 * This hook adds a promotion posts widget to the sidebar
 */

import type { Widget } from '@angple/types';

interface WidgetConfig {
    title: string;
    limit: number;
    priority: number;
}

const defaultConfig: WidgetConfig = {
    title: '직접홍보 최신글',
    limit: 5,
    priority: 10
};

/**
 * Sidebar widgets filter callback
 */
export function sidebarWidgetsFilter(
    widgets: Widget[],
    config: Partial<WidgetConfig> = {}
): Widget[] {
    const mergedConfig = { ...defaultConfig, ...config };

    // Add promotion widget
    widgets.push({
        id: 'promotion-latest',
        title: mergedConfig.title,
        component: 'PromotionWidget',
        priority: mergedConfig.priority,
        props: {
            limit: mergedConfig.limit
        }
    });

    return widgets;
}

export default sidebarWidgetsFilter;
