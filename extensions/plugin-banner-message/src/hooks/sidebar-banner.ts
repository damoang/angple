/**
 * Sidebar Banner Hook
 *
 * This hook adds a banner widget to the sidebar
 */

import type { Widget } from '@angple/types';

interface SidebarBannerConfig {
    apiBaseUrl: string;
    priority: number;
}

const defaultConfig: SidebarBannerConfig = {
    apiBaseUrl: '/api/v2',
    priority: 15
};

/**
 * Sidebar widgets filter callback
 */
export function addSidebarBanner(
    widgets: Widget[],
    config: Partial<SidebarBannerConfig> = {}
): Widget[] {
    const mergedConfig = { ...defaultConfig, ...config };

    widgets.push({
        id: 'sidebar-banner',
        title: '',
        component: 'BannerWidget',
        priority: mergedConfig.priority,
        props: {
            position: 'sidebar',
            apiBaseUrl: mergedConfig.apiBaseUrl
        }
    });

    return widgets;
}

export default addSidebarBanner;
