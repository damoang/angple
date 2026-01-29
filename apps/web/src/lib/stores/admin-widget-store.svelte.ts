/**
 * 위젯 관리 Store (Svelte 5 Rune 모드)
 */

import { toast } from 'svelte-sonner';
import * as widgetsApi from '$lib/api/admin-widgets';
import type { WidgetConfig } from '$lib/types/admin-widget';

export type WidgetZone = 'main' | 'sidebar';

class WidgetStore {
    private _widgets = $state<WidgetConfig[]>([]);
    private _originalWidgets = $state<WidgetConfig[]>([]);
    private _sidebarWidgets = $state<WidgetConfig[]>([]);
    private _originalSidebarWidgets = $state<WidgetConfig[]>([]);
    private _isLoading = $state(false);
    private _isSaving = $state(false);
    private _selectedWidgetId = $state<string | null>(null);
    private _selectedZone = $state<WidgetZone>('main');

    get widgets() { return this._widgets; }
    get enabledWidgets() { return this._widgets.filter((w) => w.enabled).sort((a, b) => a.position - b.position); }
    get sidebarWidgets() { return this._sidebarWidgets; }
    get enabledSidebarWidgets() { return this._sidebarWidgets.filter((w) => w.enabled).sort((a, b) => a.position - b.position); }
    get isLoading() { return this._isLoading; }
    get isSaving() { return this._isSaving; }
    get selectedWidgetId() { return this._selectedWidgetId; }
    get selectedZone() { return this._selectedZone; }

    get selectedWidget(): WidgetConfig | null {
        if (!this._selectedWidgetId) return null;
        if (this._selectedZone === 'main') {
            return this._widgets.find((w) => w.id === this._selectedWidgetId) ?? null;
        } else {
            return this._sidebarWidgets.find((w) => w.id === this._selectedWidgetId) ?? null;
        }
    }

    get hasChanges(): boolean {
        const mainChanged = JSON.stringify(this._widgets) !== JSON.stringify(this._originalWidgets);
        const sidebarChanged = JSON.stringify(this._sidebarWidgets) !== JSON.stringify(this._originalSidebarWidgets);
        return mainChanged || sidebarChanged;
    }

    get currentWidgets(): WidgetConfig[] {
        return this._selectedZone === 'main' ? this._widgets : this._sidebarWidgets;
    }

    async loadWidgets() {
        this._isLoading = true;
        try {
            const data = await widgetsApi.getWidgetLayout();
            this._widgets = data.widgets ?? [];
            this._originalWidgets = JSON.parse(JSON.stringify(this._widgets));
            this._sidebarWidgets = data.sidebarWidgets ?? [];
            this._originalSidebarWidgets = JSON.parse(JSON.stringify(this._sidebarWidgets));
        } catch (error) {
            console.error('❌ 위젯 레이아웃 로드 실패:', error);
            toast.error('위젯 레이아웃을 불러오지 못했습니다.');
            this._widgets = [];
            this._sidebarWidgets = [];
        } finally {
            this._isLoading = false;
        }
    }

    async saveWidgets() {
        this._isSaving = true;
        try {
            await widgetsApi.saveWidgetLayout(this._widgets, this._sidebarWidgets);
            this._originalWidgets = JSON.parse(JSON.stringify(this._widgets));
            this._originalSidebarWidgets = JSON.parse(JSON.stringify(this._sidebarWidgets));
            toast.success('위젯 레이아웃이 저장되었습니다.', {
                description: '페이지를 새로고침하면 변경사항이 적용됩니다.'
            });
        } catch (error) {
            console.error('❌ 위젯 레이아웃 저장 실패:', error);
            toast.error('위젯 레이아웃 저장에 실패했습니다.');
        } finally {
            this._isSaving = false;
        }
    }

    selectZone(zone: WidgetZone) {
        this._selectedZone = zone;
        this._selectedWidgetId = null;
    }

    selectWidget(widgetId: string | null) {
        this._selectedWidgetId = widgetId;
    }

    updateWidgetOrder(newWidgets: WidgetConfig[]) {
        const reordered = newWidgets.map((w, index) => ({ ...w, position: index }));
        if (this._selectedZone === 'main') {
            this._widgets = reordered;
        } else {
            this._sidebarWidgets = reordered;
        }
    }

    toggleWidget(widgetId: string) {
        const widgets = this._selectedZone === 'main' ? this._widgets : this._sidebarWidgets;
        const widget = widgets.find((w) => w.id === widgetId);
        if (widget) { widget.enabled = !widget.enabled; }
    }

    removeWidget(widgetId: string) {
        if (this._selectedZone === 'main') {
            this._widgets = this._widgets.filter((w) => w.id !== widgetId);
            this._widgets = this._widgets.map((w, i) => ({ ...w, position: i }));
        } else {
            this._sidebarWidgets = this._sidebarWidgets.filter((w) => w.id !== widgetId);
            this._sidebarWidgets = this._sidebarWidgets.map((w, i) => ({ ...w, position: i }));
        }
        if (this._selectedWidgetId === widgetId) { this._selectedWidgetId = null; }
    }

    addWidget(type: string, settings?: Record<string, unknown>) {
        const widgets = this._selectedZone === 'main' ? this._widgets : this._sidebarWidgets;
        const newWidget: WidgetConfig = {
            id: `${type}-${Date.now()}`,
            type,
            position: widgets.length,
            enabled: true,
            settings
        };
        if (this._selectedZone === 'main') {
            this._widgets = [...this._widgets, newWidget];
        } else {
            this._sidebarWidgets = [...this._sidebarWidgets, newWidget];
        }
        this._selectedWidgetId = newWidget.id;
    }

    updateWidgetSettings(widgetId: string, settings: Record<string, unknown>) {
        const widgets = this._selectedZone === 'main' ? this._widgets : this._sidebarWidgets;
        const widget = widgets.find((w) => w.id === widgetId);
        if (widget) { widget.settings = { ...widget.settings, ...settings }; }
    }

    discardChanges() {
        this._widgets = JSON.parse(JSON.stringify(this._originalWidgets));
        this._sidebarWidgets = JSON.parse(JSON.stringify(this._originalSidebarWidgets));
        this._selectedWidgetId = null;
    }

    isWidgetSelected(widgetId: string): boolean {
        return this._selectedWidgetId === widgetId;
    }
}

export const widgetStore = new WidgetStore();
