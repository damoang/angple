/**
 * 위젯 레지스트리 (스캐너 기반)
 *
 * widget-component-loader에서 스캔된 매니페스트 데이터를 사용합니다.
 * 기존 WIDGET_REGISTRY 호환 API를 제공합니다.
 */

export {
    getWidgetRegistry as _getRegistry,
    getWidgetName,
    getWidgetIcon,
    getAddableWidgets,
    getWidgetsByCategory,
    getWidgetsBySlot,
    getWidgetManifest
} from '$lib/utils/widget-component-loader';

import { getWidgetRegistry, getWidgetsBySlot } from '$lib/utils/widget-component-loader';

/**
 * 스캐너 기반 위젯 레지스트리
 */
export const WIDGET_REGISTRY = getWidgetRegistry();

/**
 * 사이드바 위젯인지 확인
 */
export function isSidebarWidget(type: string): boolean {
    const entry = WIDGET_REGISTRY[type];
    return entry?.slots?.includes('sidebar') ?? false;
}

/**
 * 메인 영역 위젯 목록
 */
export function getMainWidgetTypes(): string[] {
    return getWidgetsBySlot('main').map((w) => w.manifest.id);
}

/**
 * 사이드바 위젯 목록
 */
export function getSidebarWidgetTypes(): string[] {
    return getWidgetsBySlot('sidebar').map((w) => w.manifest.id);
}
