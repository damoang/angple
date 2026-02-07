/**
 * 위젯 관리 Store (Svelte 5 Rune 모드)
 *
 * Web API를 통해 위젯 레이아웃을 로드하고 관리합니다.
 */

import { SvelteMap } from 'svelte/reactivity';
import { toast } from 'svelte-sonner';
import * as widgetsApi from '$lib/api/widgets';
import type { WidgetConfig } from '$lib/types/widget';

export type WidgetZone = 'main' | 'sidebar';

/** 매니페스트에서 가져온 설정 필드 타입 */
export interface ManifestSettingField {
    label: string;
    type: 'text' | 'color' | 'boolean' | 'number' | 'select';
    default: unknown;
    description?: string;
    placeholder?: string;
    options?: { label: string; value: unknown }[];
    min?: number;
    max?: number;
    step?: number;
    dynamic?: boolean;
    dynamicEndpoint?: string;
}

export interface WidgetManifestInfo {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    category: string;
    settings?: Record<string, ManifestSettingField>;
    allowMultiple?: boolean;
    slots?: string[];
}

/**
 * 위젯 관리 Store
 */
class WidgetStore {
    // 메인 영역 위젯
    private _widgets = $state<WidgetConfig[]>([]);
    private _originalWidgets = $state<WidgetConfig[]>([]);

    // 사이드바 위젯
    private _sidebarWidgets = $state<WidgetConfig[]>([]);
    private _originalSidebarWidgets = $state<WidgetConfig[]>([]);

    // UI 상태
    private _isLoading = $state(false);
    private _isSaving = $state(false);
    private _selectedWidgetId = $state<string | null>(null);
    private _selectedZone = $state<WidgetZone>('main');

    // 매니페스트 캐시 (위젯 타입 → 매니페스트)
    private _manifests = $state<SvelteMap<string, WidgetManifestInfo>>(new SvelteMap());

    // Getters - 메인 위젯
    get widgets() {
        return this._widgets;
    }

    get enabledWidgets() {
        return this._widgets.filter((w) => w.enabled).sort((a, b) => a.position - b.position);
    }

    // Getters - 사이드바 위젯
    get sidebarWidgets() {
        return this._sidebarWidgets;
    }

    get enabledSidebarWidgets() {
        return this._sidebarWidgets
            .filter((w) => w.enabled)
            .sort((a, b) => a.position - b.position);
    }

    // Getters - UI 상태
    get isLoading() {
        return this._isLoading;
    }

    get isSaving() {
        return this._isSaving;
    }

    get selectedWidgetId() {
        return this._selectedWidgetId;
    }

    get selectedZone() {
        return this._selectedZone;
    }

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
        const sidebarChanged =
            JSON.stringify(this._sidebarWidgets) !== JSON.stringify(this._originalSidebarWidgets);
        return mainChanged || sidebarChanged;
    }

    get currentWidgets(): WidgetConfig[] {
        return this._selectedZone === 'main' ? this._widgets : this._sidebarWidgets;
    }

    /**
     * 위젯 타입의 매니페스트 반환
     */
    getManifest(type: string): WidgetManifestInfo | null {
        return this._manifests.get(type) ?? null;
    }

    /**
     * 위젯 매니페스트의 settings 정의 반환
     */
    getSettingsSchema(type: string): Record<string, ManifestSettingField> | null {
        return this._manifests.get(type)?.settings ?? null;
    }

    /**
     * Web API에서 위젯 레이아웃 로드
     */
    async loadWidgets() {
        this._isLoading = true;
        try {
            const data = await widgetsApi.getWidgetLayout();

            this._widgets = data.widgets ?? [];
            this._originalWidgets = JSON.parse(JSON.stringify(this._widgets));

            this._sidebarWidgets = data.sidebarWidgets ?? [];
            this._originalSidebarWidgets = JSON.parse(JSON.stringify(this._sidebarWidgets));

            console.log(
                `✅ 위젯 로드됨: 메인 ${this._widgets.length}개, 사이드바 ${this._sidebarWidgets.length}개`
            );

            // 매니페스트 로드
            await this.loadManifests();
        } catch (error) {
            console.error('❌ 위젯 레이아웃 로드 실패:', error);
            toast.error('위젯 레이아웃을 불러오지 못했습니다. Web 앱이 실행 중인지 확인하세요.');
            this._widgets = [];
            this._sidebarWidgets = [];
        } finally {
            this._isLoading = false;
        }
    }

    /**
     * 매니페스트 로드 (Web API에서)
     */
    async loadManifests() {
        try {
            const data = await widgetsApi.getInstalledWidgets();
            const map = new SvelteMap<string, WidgetManifestInfo>();
            for (const w of data.widgets) {
                map.set(w.id, w as WidgetManifestInfo);
            }
            this._manifests = map;
            console.log(`✅ 매니페스트 로드됨: ${map.size}개`);
        } catch (error) {
            console.warn('⚠️ 매니페스트 로드 실패 (WIDGET_REGISTRY 폴백 사용):', error);
        }
    }

    /**
     * 위젯 레이아웃 저장
     */
    async saveWidgets() {
        this._isSaving = true;
        try {
            await widgetsApi.saveWidgetLayout(this._widgets, this._sidebarWidgets);

            this._originalWidgets = JSON.parse(JSON.stringify(this._widgets));
            this._originalSidebarWidgets = JSON.parse(JSON.stringify(this._sidebarWidgets));

            // Cookie에 레이아웃 변경 플래그 기록 (Web 앱 감지용)
            try {
                const timestamp = Date.now();
                document.cookie = `widget-reload-trigger=layout:${timestamp}; path=/; max-age=60`;
                console.log('🔄 위젯 레이아웃 변경 플래그 설정:', timestamp);
            } catch (e) {
                console.warn('Cookie 저장 실패:', e);
            }

            toast.success('위젯 레이아웃이 저장되었습니다.', {
                description: 'Web 앱을 새로고침하면 변경사항이 적용됩니다.',
                action: {
                    label: 'Web 앱 열기',
                    onClick: () => window.open('http://localhost:5173', '_blank')
                }
            });
        } catch (error) {
            console.error('❌ 위젯 레이아웃 저장 실패:', error);
            toast.error('위젯 레이아웃 저장에 실패했습니다.');
        } finally {
            this._isSaving = false;
        }
    }

    /**
     * 영역 선택
     */
    selectZone(zone: WidgetZone) {
        this._selectedZone = zone;
        this._selectedWidgetId = null;
    }

    /**
     * 위젯 선택
     */
    selectWidget(widgetId: string | null) {
        this._selectedWidgetId = widgetId;
    }

    /**
     * 위젯 순서 업데이트 (드래그앤드롭 후)
     */
    updateWidgetOrder(newWidgets: WidgetConfig[]) {
        const reordered = newWidgets.map((w, index) => ({
            ...w,
            position: index
        }));

        if (this._selectedZone === 'main') {
            this._widgets = reordered;
        } else {
            this._sidebarWidgets = reordered;
        }
    }

    /**
     * 위젯 활성화/비활성화 토글
     */
    toggleWidget(widgetId: string) {
        const widgets = this._selectedZone === 'main' ? this._widgets : this._sidebarWidgets;
        const widget = widgets.find((w) => w.id === widgetId);
        if (widget) {
            widget.enabled = !widget.enabled;
        }
    }

    /**
     * 위젯 삭제
     */
    removeWidget(widgetId: string) {
        if (this._selectedZone === 'main') {
            this._widgets = this._widgets.filter((w) => w.id !== widgetId);
            this._widgets = this._widgets.map((w, i) => ({ ...w, position: i }));
        } else {
            this._sidebarWidgets = this._sidebarWidgets.filter((w) => w.id !== widgetId);
            this._sidebarWidgets = this._sidebarWidgets.map((w, i) => ({ ...w, position: i }));
        }

        if (this._selectedWidgetId === widgetId) {
            this._selectedWidgetId = null;
        }
    }

    /**
     * 위젯 추가
     */
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

        // 새 위젯 선택
        this._selectedWidgetId = newWidget.id;
    }

    /**
     * 위젯 설정 업데이트
     */
    updateWidgetSettings(widgetId: string, settings: Record<string, unknown>) {
        const widgets = this._selectedZone === 'main' ? this._widgets : this._sidebarWidgets;
        const widget = widgets.find((w) => w.id === widgetId);
        if (widget) {
            widget.settings = { ...widget.settings, ...settings };
        }
    }

    /**
     * 변경사항 취소
     */
    discardChanges() {
        this._widgets = JSON.parse(JSON.stringify(this._originalWidgets));
        this._sidebarWidgets = JSON.parse(JSON.stringify(this._originalSidebarWidgets));
        this._selectedWidgetId = null;
    }

    /**
     * 위젯이 로딩 중인지 확인
     */
    isWidgetSelected(widgetId: string): boolean {
        return this._selectedWidgetId === widgetId;
    }
}

/**
 * 전역 위젯 Store 인스턴스
 */
export const widgetStore = new WidgetStore();
