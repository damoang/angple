/**
 * 기본 위젯 레이아웃 상수
 *
 * 메인 영역과 사이드바의 기본 위젯 구성을 정의합니다.
 * 여러 곳에서 참조하므로 단일 소스로 관리합니다.
 *
 * Phase 2: 하드코딩 위젯 → post-list 범용 위젯으로 전환
 */

import type { WidgetConfig } from '$lib/stores/widget-layout.svelte';

/** 기본 메인 위젯 레이아웃 */
export const DEFAULT_WIDGETS: WidgetConfig[] = [
    { id: 'ad-head', type: 'ad', position: 0, enabled: true, settings: { position: 'index-head' } },
    { id: 'recommended', type: 'recommended', position: 1, enabled: true },
    { id: 'ad-top', type: 'ad', position: 2, enabled: true, settings: { position: 'index-top' } },
    {
        id: 'new-board',
        type: 'post-list',
        position: 3,
        enabled: true,
        settings: { boardId: 'notice', layout: 'list', sortBy: 'date', count: 10, showTitle: true }
    },
    {
        id: 'economy',
        type: 'post-list',
        position: 4,
        enabled: true,
        settings: { boardId: 'economy', layout: 'list', sortBy: 'date', count: 10, showTitle: true }
    },
    {
        id: 'ad-middle-1',
        type: 'ad',
        position: 5,
        enabled: true,
        settings: { position: 'index-middle-1' }
    },
    {
        id: 'gallery',
        type: 'post-list',
        position: 6,
        enabled: true,
        settings: { boardId: 'gallery', layout: 'gallery', sortBy: 'date', count: 12, showTitle: true }
    },
    {
        id: 'ad-middle-2',
        type: 'ad',
        position: 7,
        enabled: true,
        settings: { position: 'index-middle-2' }
    },
    {
        id: 'group',
        type: 'post-list',
        position: 8,
        enabled: true,
        settings: { boardId: 'group', layout: 'grid', sortBy: 'date', count: 10, showTitle: true }
    },
    {
        id: 'ad-bottom',
        type: 'ad',
        position: 9,
        enabled: true,
        settings: { position: 'index-bottom' }
    }
];

/** 기본 사이드바 위젯 레이아웃 */
export const DEFAULT_SIDEBAR_WIDGETS: WidgetConfig[] = [
    { id: 'notice', type: 'notice', position: 0, enabled: true },
    { id: 'podcast', type: 'podcast', position: 1, enabled: true },
    {
        id: 'sidebar-ad-1',
        type: 'ad',
        position: 2,
        enabled: true,
        settings: { position: 'sidebar-1', type: 'image', format: 'square' }
    },
    {
        id: 'sidebar-ad-2',
        type: 'ad',
        position: 3,
        enabled: true,
        settings: { position: 'sidebar-2', type: 'image-text', format: 'grid' }
    },
    { id: 'sharing-board', type: 'sharing-board', position: 4, enabled: true },
    { id: 'sticky-ads', type: 'sticky-ads', position: 5, enabled: true }
];

/**
 * 기존 레이아웃 데이터를 Phase 2 형식으로 마이그레이션
 *
 * 저장된 레이아웃에 구 위젯 타입이 있으면 post-list로 변환합니다.
 */
export function migrateWidgetConfig(widget: WidgetConfig): WidgetConfig {
    const migrations: Record<string, Partial<WidgetConfig>> = {
        'new-board': {
            type: 'post-list',
            settings: { boardId: 'notice', layout: 'list', sortBy: 'date', count: 10, showTitle: true }
        },
        economy: {
            type: 'post-list',
            settings: { boardId: 'economy', layout: 'list', sortBy: 'date', count: 10, showTitle: true }
        },
        gallery: {
            type: 'post-list',
            settings: { boardId: 'gallery', layout: 'gallery', sortBy: 'date', count: 12, showTitle: true }
        },
        group: {
            type: 'post-list',
            settings: { boardId: 'group', layout: 'grid', sortBy: 'date', count: 10, showTitle: true }
        },
        'sidebar-ad': {
            type: 'ad',
            settings: { ...widget.settings, position: widget.settings?.position ?? 'sidebar' }
        }
    };

    const migration = migrations[widget.type];
    if (!migration) return widget;

    return {
        ...widget,
        ...migration,
        settings: { ...migration.settings, ...widget.settings, ...migration.settings }
    };
}

/**
 * news-economy-row를 2개의 post-list로 분리
 */
export function migrateNewsEconomyRow(widget: WidgetConfig): WidgetConfig[] {
    if (widget.type !== 'news-economy-row') return [widget];

    return [
        {
            id: `${widget.id}-news`,
            type: 'post-list',
            position: widget.position,
            enabled: widget.enabled,
            settings: { boardId: 'notice', layout: 'list', sortBy: 'date', count: 10, showTitle: true }
        },
        {
            id: `${widget.id}-economy`,
            type: 'post-list',
            position: widget.position + 0.5,
            enabled: widget.enabled,
            settings: { boardId: 'economy', layout: 'list', sortBy: 'date', count: 10, showTitle: true }
        }
    ];
}

/**
 * 위젯 배열 전체를 마이그레이션
 */
export function migrateWidgets(widgets: WidgetConfig[]): WidgetConfig[] {
    const migrated = widgets.flatMap((w) => {
        if (w.type === 'news-economy-row') {
            return migrateNewsEconomyRow(w);
        }
        return [migrateWidgetConfig(w)];
    });

    // position 재정렬
    return migrated
        .sort((a, b) => a.position - b.position)
        .map((w, i) => ({ ...w, position: i }));
}
