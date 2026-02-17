/**
 * 위젯 컴포넌트 로더
 *
 * import.meta.glob으로 widgets/ 및 custom-widgets/ 디렉토리에서
 * 위젯 컴포넌트와 매니페스트를 자동 발견합니다.
 */

import type { Component } from 'svelte';
import type { WidgetManifest } from '$lib/types/widget-manifest';
import { safeValidateWidgetManifest } from '$lib/types/widget-manifest';

export interface ScannedWidget {
    manifest: WidgetManifest;
    isCustom: boolean;
    /** 위젯 컴포넌트를 lazy load하는 함수 */
    load: () => Promise<{ default: Component }>;
}

// Vite import.meta.glob으로 빌트인 위젯 발견
const builtinComponents = import.meta.glob('../../../../../widgets/*/index.svelte');
const builtinManifests = import.meta.glob('../../../../../widgets/*/widget.json', { eager: true });

// 커스텀 위젯 발견
const customComponents = import.meta.glob('../../../../../custom-widgets/*/index.svelte');
const customManifests = import.meta.glob('../../../../../custom-widgets/*/widget.json', {
    eager: true
});

/**
 * glob 경로에서 위젯 ID 추출
 * 예: "../../../../widgets/recommended/index.svelte" → "recommended"
 */
function extractWidgetId(path: string): string {
    const parts = path.split('/');
    // index.svelte 또는 widget.json 바로 앞 디렉토리명
    return parts[parts.length - 2];
}

/**
 * 모든 위젯 스캔 결과를 반환
 */
function scanWidgets(): Map<string, ScannedWidget> {
    const widgets = new Map<string, ScannedWidget>();

    // 빌트인 위젯 스캔
    for (const [path, module] of Object.entries(builtinManifests)) {
        const id = extractWidgetId(path);
        const raw = (module as { default?: WidgetManifest }).default ?? (module as WidgetManifest);

        // enabled: false인 위젯은 건너뛰기
        if ((raw as WidgetManifest & { enabled?: boolean }).enabled === false) continue;

        // Zod 스키마 검증
        const result = safeValidateWidgetManifest({ ...raw, id });
        if (!result.success) {
            continue;
        }

        const componentPath = path.replace('widget.json', 'index.svelte');

        if (builtinComponents[componentPath]) {
            widgets.set(id, {
                manifest: result.data,
                isCustom: false,
                load: builtinComponents[componentPath] as () => Promise<{ default: Component }>
            });
        }
    }

    // 커스텀 위젯 스캔
    for (const [path, module] of Object.entries(customManifests)) {
        const id = extractWidgetId(path);
        const raw = (module as { default?: WidgetManifest }).default ?? (module as WidgetManifest);

        // enabled: false인 위젯은 건너뛰기
        if ((raw as WidgetManifest & { enabled?: boolean }).enabled === false) continue;

        // Zod 스키마 검증
        const result = safeValidateWidgetManifest({ ...raw, id });
        if (!result.success) {
            continue;
        }

        const componentPath = path.replace('widget.json', 'index.svelte');

        if (customComponents[componentPath]) {
            widgets.set(id, {
                manifest: result.data,
                isCustom: true,
                load: customComponents[componentPath] as () => Promise<{ default: Component }>
            });
        }
    }

    return widgets;
}

/** 스캔된 위젯 캐시 */
let _scannedWidgets: Map<string, ScannedWidget> | null = null;

/**
 * 스캔된 전체 위젯 맵 반환 (캐시)
 */
export function getScannedWidgets(): Map<string, ScannedWidget> {
    if (!_scannedWidgets) {
        _scannedWidgets = scanWidgets();
    }
    return _scannedWidgets;
}

/**
 * 위젯 컴포넌트를 동적으로 로드
 */
export async function loadWidgetComponent(type: string): Promise<Component | null> {
    const widgets = getScannedWidgets();
    const widget = widgets.get(type);

    if (!widget) {
        return null;
    }

    try {
        const module = await widget.load();
        return module.default;
    } catch (error) {
        console.error('[Widget Loader] 위젯 로드 실패:', type, error);
        return null;
    }
}

/**
 * 위젯 매니페스트 조회
 */
export function getWidgetManifest(type: string): WidgetManifest | null {
    const widgets = getScannedWidgets();
    return widgets.get(type)?.manifest ?? null;
}

/**
 * 위젯 이름 조회
 */
export function getWidgetName(type: string): string {
    return getWidgetManifest(type)?.name ?? type;
}

/**
 * 위젯 아이콘 조회
 */
export function getWidgetIcon(type: string): string {
    return getWidgetManifest(type)?.icon ?? 'Box';
}

/**
 * 슬롯별 사용 가능한 위젯 목록
 */
export function getWidgetsBySlot(slot: 'main' | 'sidebar' | 'header' | 'footer'): ScannedWidget[] {
    const widgets = getScannedWidgets();
    return Array.from(widgets.values()).filter((w) => w.manifest.slots.includes(slot));
}

/**
 * 추가 가능한 위젯 목록 (현재 레이아웃 고려)
 */
export function getAddableWidgets(
    currentWidgetTypes: string[],
    slot: 'main' | 'sidebar'
): string[] {
    const widgets = getScannedWidgets();
    return Array.from(widgets.entries())
        .filter(([type, w]) => {
            if (!w.manifest.slots.includes(slot)) return false;
            if (w.manifest.allowMultiple) return true;
            return !currentWidgetTypes.includes(type);
        })
        .map(([type]) => type);
}

/**
 * 카테고리별 위젯 목록
 */
export function getWidgetsByCategory(
    category: string
): Array<{ type: string; widget: ScannedWidget }> {
    const widgets = getScannedWidgets();
    return Array.from(widgets.entries())
        .filter(([, w]) => w.manifest.category === category)
        .map(([type, widget]) => ({ type, widget }));
}

/**
 * 전체 위젯 레지스트리 (매니페스트 기반)
 * 기존 WIDGET_REGISTRY 호환용
 */
export function getWidgetRegistry(): Record<
    string,
    {
        name: string;
        icon: string;
        description: string;
        category: string;
        allowMultiple: boolean;
        defaultSettings?: Record<string, unknown>;
        slots: string[];
    }
> {
    const widgets = getScannedWidgets();
    const registry: Record<
        string,
        {
            name: string;
            icon: string;
            description: string;
            category: string;
            allowMultiple: boolean;
            defaultSettings?: Record<string, unknown>;
            slots: string[];
        }
    > = {};

    for (const [type, w] of widgets) {
        const defaultSettings: Record<string, unknown> = {};
        if (w.manifest.settings) {
            for (const [key, field] of Object.entries(w.manifest.settings)) {
                defaultSettings[key] = field.default;
            }
        }

        registry[type] = {
            name: w.manifest.name,
            icon: w.manifest.icon ?? 'Box',
            description: w.manifest.description ?? '',
            category: w.manifest.category,
            allowMultiple: w.manifest.allowMultiple ?? false,
            slots: w.manifest.slots,
            ...(Object.keys(defaultSettings).length > 0 && { defaultSettings })
        };
    }

    return registry;
}
