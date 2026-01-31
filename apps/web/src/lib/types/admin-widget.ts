/**
 * 위젯 관련 타입 정의
 *
 * WIDGET_REGISTRY는 이제 widget-component-loader의 스캐너 기반으로 동작합니다.
 * 이 파일은 하위 호환성을 위해 유지됩니다.
 */

export interface WidgetConfig {
    id: string;
    type: string;
    position: number;
    enabled: boolean;
    settings?: Record<string, unknown>;
}

export interface WidgetRegistryEntry {
    name: string;
    icon: string;
    description: string;
    category: string;
    allowMultiple: boolean;
    defaultSettings?: Record<string, unknown>;
    /** @deprecated slots[] 기반으로 전환됨 */
    sidebarOnly?: boolean;
    slots?: string[];
}

// 스캐너 기반 레지스트리 re-export
import {
    getWidgetRegistry,
    getWidgetIcon as _getIcon,
    getWidgetName as _getName,
    getAddableWidgets as _getAddable,
    getWidgetsBySlot
} from '$lib/utils/widget-component-loader';

/**
 * 위젯 레지스트리 (스캐너 기반)
 */
export const WIDGET_REGISTRY: Record<string, WidgetRegistryEntry> = getWidgetRegistry();

export function getWidgetIcon(type: string): string {
    return _getIcon(type);
}

export function getWidgetName(type: string): string {
    return _getName(type);
}

export function getWidgetsByCategory(category: string): string[] {
    const registry = getWidgetRegistry();
    return Object.entries(registry)
        .filter(([, entry]) => entry.category === category)
        .map(([type]) => type);
}

export function getAddableWidgets(
    currentWidgetTypes: string[],
    forSidebar: boolean = false
): string[] {
    return _getAddable(currentWidgetTypes, forSidebar ? 'sidebar' : 'main');
}

export function isSidebarWidget(type: string): boolean {
    const registry = getWidgetRegistry();
    return registry[type]?.slots?.includes('sidebar') ?? false;
}

export function getMainWidgetTypes(): string[] {
    return getWidgetsBySlot('main').map((w) => w.manifest.id);
}

export function getSidebarWidgetTypes(): string[] {
    return getWidgetsBySlot('sidebar').map((w) => w.manifest.id);
}

export type WidgetZone = 'main' | 'sidebar';
