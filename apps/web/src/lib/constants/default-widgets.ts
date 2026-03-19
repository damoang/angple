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
    { id: 'tag-nav', type: 'tag-nav', position: 0, enabled: true },
    { id: 'empathy-explore-row', type: 'empathy-explore-row', position: 1, enabled: true },
    {
        id: 'ad-top',
        type: 'ad-slot',
        position: 2,
        enabled: true,
        settings: { position: 'index-top' }
    },
    { id: 'news-economy-row', type: 'news-economy-row', position: 3, enabled: true },
    {
        id: 'ad-middle-1',
        type: 'ad-slot',
        position: 4,
        enabled: true,
        settings: { position: 'index-middle-1' }
    },
    {
        id: 'gallery',
        type: 'post-list',
        position: 5,
        enabled: true,
        settings: {
            boardId: 'gallery',
            layout: 'gallery',
            sortBy: 'date',
            count: 12,
            showTitle: true
        }
    },
    {
        id: 'ad-middle-2',
        type: 'ad-slot',
        position: 6,
        enabled: true,
        settings: { position: 'index-middle-2' }
    },
    {
        id: 'group',
        type: 'post-list',
        position: 7,
        enabled: true,
        settings: { boardId: 'group', layout: 'grid', sortBy: 'date', count: 10, showTitle: true }
    },
    {
        id: 'celebration',
        type: 'celebration',
        position: 8,
        enabled: true
    },
    {
        id: 'ad-bottom',
        type: 'ad-slot',
        position: 9,
        enabled: true,
        settings: { position: 'index-bottom' }
    }
];

/** 기본 사이드바 위젯 레이아웃 */
export const DEFAULT_SIDEBAR_WIDGETS: WidgetConfig[] = [
    { id: 'notice', type: 'notice', position: 0, enabled: true },
    {
        id: 'sidebar-ad-2',
        type: 'ad-slot',
        position: 1,
        enabled: true,
        settings: { position: 'sidebar-2', type: 'image-text', format: 'grid' }
    }
];

/**
 * 기존 레이아웃 데이터를 Phase 2 형식으로 마이그레이션
 *
 * 저장된 레이아웃에 구 위젯 타입이 있으면 post-list로 변환합니다.
 */
export function migrateWidgetConfig(widget: WidgetConfig): WidgetConfig {
    const migrations: Record<string, Partial<WidgetConfig>> = {
        ad: {
            type: 'ad-slot',
            settings: { ...widget.settings }
        },
        'new-board': {
            type: 'post-list',
            settings: {
                boardId: 'notice',
                layout: 'list',
                sortBy: 'date',
                count: 10,
                showTitle: true
            }
        },
        economy: {
            type: 'post-list',
            settings: {
                boardId: 'economy',
                layout: 'list',
                sortBy: 'date',
                count: 10,
                showTitle: true
            }
        },
        gallery: {
            type: 'post-list',
            settings: {
                boardId: 'gallery',
                layout: 'gallery',
                sortBy: 'date',
                count: 12,
                showTitle: true
            }
        },
        group: {
            type: 'post-list',
            settings: {
                boardId: 'group',
                layout: 'grid',
                sortBy: 'date',
                count: 10,
                showTitle: true
            }
        },
        'sidebar-ad': {
            type: 'ad-slot',
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
 * new-board + economy 개별 위젯을 news-economy-row로 결합
 */
export function migrateNewsEconomyRow(widgets: WidgetConfig[]): WidgetConfig[] {
    const hasNewBoard = widgets.some(
        (w) => w.id === 'new-board' || (w.type === 'post-list' && w.settings?.boardId === 'notice')
    );
    const hasEconomy = widgets.some(
        (w) => w.id === 'economy' || (w.type === 'post-list' && w.settings?.boardId === 'economy')
    );
    const hasCombined = widgets.some((w) => w.type === 'news-economy-row');

    if (!hasNewBoard || !hasEconomy || hasCombined) return widgets;

    const newBoard = widgets.find(
        (w) => w.id === 'new-board' || (w.type === 'post-list' && w.settings?.boardId === 'notice')
    )!;
    const result = widgets.filter(
        (w) =>
            w.id !== 'new-board' &&
            w.id !== 'economy' &&
            !(w.type === 'post-list' && w.settings?.boardId === 'notice') &&
            !(w.type === 'post-list' && w.settings?.boardId === 'economy')
    );
    result.push({
        id: 'news-economy-row',
        type: 'news-economy-row',
        position: newBoard.position,
        enabled: newBoard.enabled
    });
    return result;
}

/**
 * recommended + explore를 empathy-explore-row로 결합
 */
export function migrateEmpathyExploreRow(widgets: WidgetConfig[]): WidgetConfig[] {
    const hasRecommended = widgets.some((w) => w.type === 'recommended');
    const hasExplore = widgets.some((w) => w.type === 'explore');
    const hasCombined = widgets.some((w) => w.type === 'empathy-explore-row');

    if (!hasRecommended || !hasExplore || hasCombined) return widgets;

    const recommended = widgets.find((w) => w.type === 'recommended')!;
    const result = widgets.filter((w) => w.type !== 'recommended' && w.type !== 'explore');
    result.push({
        id: 'empathy-explore-row',
        type: 'empathy-explore-row',
        position: recommended.position,
        enabled: recommended.enabled
    });
    return result;
}

/**
 * 위젯 배열 전체를 마이그레이션
 */
export function migrateWidgets(widgets: WidgetConfig[]): WidgetConfig[] {
    let migrated = widgets.map((w) => migrateWidgetConfig(w));

    // recommended + explore → empathy-explore-row
    migrated = migrateEmpathyExploreRow(migrated);

    // new-board + economy → news-economy-row
    migrated = migrateNewsEconomyRow(migrated);

    // position 재정렬
    return migrated.sort((a, b) => a.position - b.position).map((w, i) => ({ ...w, position: i }));
}
