/**
 * 위젯 레이아웃 관리 스토어 (Svelte 5 Runes)
 *
 * 메인 페이지 위젯과 사이드바 위젯을 슬롯 기반으로 통합 관리합니다.
 */

export interface WidgetConfig {
    id: string;
    type: string;
    position: number;
    enabled: boolean;
    settings?: Record<string, unknown>;
}

export interface WidgetLayoutState {
    widgets: WidgetConfig[];
    sidebarWidgets: WidgetConfig[];
    isEditMode: boolean;
    isDragging: boolean;
    isSaving: boolean;
    hasChanges: boolean;
}

export type WidgetZone = 'main' | 'sidebar';

import {
    DEFAULT_WIDGETS,
    DEFAULT_SIDEBAR_WIDGETS,
    migrateWidgets
} from '$lib/constants/default-widgets';

function deepCopy<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

class WidgetLayoutStore {
    // 메인 영역 위젯
    private _widgets = $state<WidgetConfig[]>(deepCopy(DEFAULT_WIDGETS));
    private _originalWidgets = $state<WidgetConfig[]>(deepCopy(DEFAULT_WIDGETS));

    // 사이드바 위젯
    private _sidebarWidgets = $state<WidgetConfig[]>(deepCopy(DEFAULT_SIDEBAR_WIDGETS));
    private _originalSidebarWidgets = $state<WidgetConfig[]>(deepCopy(DEFAULT_SIDEBAR_WIDGETS));

    private _isEditMode = $state(false);
    private _isDragging = $state(false);
    private _isSaving = $state(false);

    // === 존별 접근자 ===

    /** 존에 해당하는 위젯 배열 반환 */
    private _getWidgets(zone: WidgetZone): WidgetConfig[] {
        return zone === 'sidebar' ? this._sidebarWidgets : this._widgets;
    }

    // === Getters (메인) ===

    get widgets() {
        return this._widgets;
    }

    get enabledWidgets() {
        return this._widgets.filter((w) => w.enabled).sort((a, b) => a.position - b.position);
    }

    // === Getters (사이드바) ===

    get sidebarWidgets() {
        return this._sidebarWidgets;
    }

    get enabledSidebarWidgets() {
        return this._sidebarWidgets
            .filter((w) => w.enabled)
            .sort((a, b) => a.position - b.position);
    }

    // === Getters (공통) ===

    get isEditMode() {
        return this._isEditMode;
    }

    get isDragging() {
        return this._isDragging;
    }

    get isSaving() {
        return this._isSaving;
    }

    get hasChanges() {
        const mainChanged = JSON.stringify(this._widgets) !== JSON.stringify(this._originalWidgets);
        const sidebarChanged =
            JSON.stringify(this._sidebarWidgets) !== JSON.stringify(this._originalSidebarWidgets);
        return mainChanged || sidebarChanged;
    }

    // === 초기화 ===

    initFromServer(widgets: WidgetConfig[] | null, sidebarWidgets?: WidgetConfig[] | null) {
        if (widgets && widgets.length > 0) {
            // 기존 레이아웃 마이그레이션 (구 위젯 타입 → post-list 등)
            const migrated = migrateWidgets(deepCopy(widgets));
            this._widgets = migrated;
            this._originalWidgets = deepCopy(migrated);
        } else {
            this._widgets = deepCopy(DEFAULT_WIDGETS);
            this._originalWidgets = deepCopy(DEFAULT_WIDGETS);
        }

        if (sidebarWidgets && sidebarWidgets.length > 0) {
            const migratedSidebar = migrateWidgets(deepCopy(sidebarWidgets));
            this._sidebarWidgets = migratedSidebar;
            this._originalSidebarWidgets = deepCopy(migratedSidebar);
        } else {
            this._sidebarWidgets = deepCopy(DEFAULT_SIDEBAR_WIDGETS);
            this._originalSidebarWidgets = deepCopy(DEFAULT_SIDEBAR_WIDGETS);
        }
    }

    // === 편집 모드 ===

    toggleEditMode() {
        this._isEditMode = !this._isEditMode;
    }

    enterEditMode() {
        this._isEditMode = true;
    }

    exitEditMode(discardChanges = false) {
        this._isEditMode = false;
        if (discardChanges) {
            this._widgets = deepCopy(this._originalWidgets);
            this._sidebarWidgets = deepCopy(this._originalSidebarWidgets);
        }
    }

    setDragging(dragging: boolean) {
        this._isDragging = dragging;
    }

    // === 통합 위젯 조작 메서드 ===

    /** 위젯 순서 업데이트 (메인) */
    updateWidgetOrder(newWidgets: WidgetConfig[]) {
        this._widgets = newWidgets.map((w, index) => ({ ...w, position: index }));
    }

    /** 위젯 순서 업데이트 (사이드바) */
    updateSidebarWidgetOrder(newWidgets: WidgetConfig[]) {
        this._sidebarWidgets = newWidgets.map((w, index) => ({ ...w, position: index }));
    }

    /** 위젯 활성화/비활성화 토글 (메인) */
    toggleWidget(widgetId: string) {
        const widget = this._widgets.find((w) => w.id === widgetId);
        if (widget) widget.enabled = !widget.enabled;
    }

    /** 위젯 활성화/비활성화 토글 (사이드바) */
    toggleSidebarWidget(widgetId: string) {
        const widget = this._sidebarWidgets.find((w) => w.id === widgetId);
        if (widget) widget.enabled = !widget.enabled;
    }

    /** 위젯 삭제 (메인) */
    removeWidget(widgetId: string) {
        this._widgets = this._widgets
            .filter((w) => w.id !== widgetId)
            .map((w, i) => ({ ...w, position: i }));
    }

    /** 위젯 삭제 (사이드바) */
    removeSidebarWidget(widgetId: string) {
        this._sidebarWidgets = this._sidebarWidgets
            .filter((w) => w.id !== widgetId)
            .map((w, i) => ({ ...w, position: i }));
    }

    /** 위젯 추가 (메인) */
    addWidget(type: string, settings?: Record<string, unknown>) {
        const newWidget: WidgetConfig = {
            id: `${type}-${Date.now()}`,
            type,
            position: this._widgets.length,
            enabled: true,
            settings
        };
        this._widgets = [...this._widgets, newWidget];
    }

    /** 위젯 추가 (사이드바) */
    addSidebarWidget(type: string, settings?: Record<string, unknown>) {
        const newWidget: WidgetConfig = {
            id: `${type}-${Date.now()}`,
            type,
            position: this._sidebarWidgets.length,
            enabled: true,
            settings
        };
        this._sidebarWidgets = [...this._sidebarWidgets, newWidget];
    }

    // === 저장/취소 ===

    async saveLayout(): Promise<boolean> {
        this._isSaving = true;
        try {
            const response = await fetch('/api/layout', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    widgets: this._widgets,
                    sidebarWidgets: this._sidebarWidgets
                })
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || `레이아웃 저장 실패 (${response.status})`);
            }

            this._originalWidgets = deepCopy(this._widgets);
            this._originalSidebarWidgets = deepCopy(this._sidebarWidgets);
            this._isEditMode = false;
            return true;
        } catch (error) {
            console.error('레이아웃 저장 실패:', error);
            return false;
        } finally {
            this._isSaving = false;
        }
    }

    discardChanges() {
        this._widgets = deepCopy(this._originalWidgets);
        this._sidebarWidgets = deepCopy(this._originalSidebarWidgets);
    }

    resetToDefault() {
        this._widgets = deepCopy(DEFAULT_WIDGETS);
        this._sidebarWidgets = deepCopy(DEFAULT_SIDEBAR_WIDGETS);
    }
}

export const widgetLayoutStore = new WidgetLayoutStore();
