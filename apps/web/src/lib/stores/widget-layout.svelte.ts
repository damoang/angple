/**
 * 위젯 레이아웃 관리 스토어 (Svelte 5 Runes)
 *
 * 메인 페이지 위젯의 순서, 활성화 상태, 설정을 관리합니다.
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

// 기본 위젯 레이아웃 (메인 영역)
const DEFAULT_WIDGETS: WidgetConfig[] = [
    { id: 'ad-head', type: 'ad', position: 0, enabled: true, settings: { position: 'index-head' } },
    { id: 'recommended', type: 'recommended', position: 1, enabled: true },
    { id: 'ad-top', type: 'ad', position: 2, enabled: true, settings: { position: 'index-top' } },
    { id: 'news-economy-row', type: 'news-economy-row', position: 3, enabled: true },
    { id: 'ad-middle-1', type: 'ad', position: 4, enabled: true, settings: { position: 'index-middle-1' } },
    { id: 'gallery', type: 'gallery', position: 5, enabled: true },
    { id: 'ad-middle-2', type: 'ad', position: 6, enabled: true, settings: { position: 'index-middle-2' } },
    { id: 'group', type: 'group', position: 7, enabled: true },
    { id: 'ad-bottom', type: 'ad', position: 8, enabled: true, settings: { position: 'index-bottom' } }
];

// 기본 사이드바 위젯 레이아웃
const DEFAULT_SIDEBAR_WIDGETS: WidgetConfig[] = [
    { id: 'notice', type: 'notice', position: 0, enabled: true },
    { id: 'podcast', type: 'podcast', position: 1, enabled: true },
    {
        id: 'sidebar-ad-1',
        type: 'sidebar-ad',
        position: 2,
        enabled: true,
        settings: { type: 'image', format: 'square' }
    },
    {
        id: 'sidebar-ad-2',
        type: 'sidebar-ad',
        position: 3,
        enabled: true,
        settings: { type: 'image-text', format: 'grid' }
    },
    { id: 'sharing-board', type: 'sharing-board', position: 4, enabled: true },
    { id: 'sticky-ads', type: 'sticky-ads', position: 5, enabled: true }
];

class WidgetLayoutStore {
    // 메인 영역 위젯 (deep copy로 변경 감지 정확히)
    private _widgets = $state<WidgetConfig[]>(JSON.parse(JSON.stringify(DEFAULT_WIDGETS)));
    private _originalWidgets = $state<WidgetConfig[]>(JSON.parse(JSON.stringify(DEFAULT_WIDGETS)));

    // 사이드바 위젯
    private _sidebarWidgets = $state<WidgetConfig[]>(JSON.parse(JSON.stringify(DEFAULT_SIDEBAR_WIDGETS)));
    private _originalSidebarWidgets = $state<WidgetConfig[]>(JSON.parse(JSON.stringify(DEFAULT_SIDEBAR_WIDGETS)));

    private _isEditMode = $state(false);
    private _isDragging = $state(false);
    private _isSaving = $state(false);

    // Derived state - 메인 위젯
    get widgets() {
        return this._widgets;
    }

    get enabledWidgets() {
        return this._widgets.filter((w) => w.enabled).sort((a, b) => a.position - b.position);
    }

    // Derived state - 사이드바 위젯
    get sidebarWidgets() {
        return this._sidebarWidgets;
    }

    get enabledSidebarWidgets() {
        return this._sidebarWidgets.filter((w) => w.enabled).sort((a, b) => a.position - b.position);
    }

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

    /**
     * 서버 데이터로 초기화 (메인 + 사이드바)
     */
    initFromServer(
        widgets: WidgetConfig[] | null,
        sidebarWidgets?: WidgetConfig[] | null
    ) {
        // 메인 위젯 초기화 (deep copy로 변경 감지 정확히)
        if (widgets && widgets.length > 0) {
            this._widgets = JSON.parse(JSON.stringify(widgets));
            this._originalWidgets = JSON.parse(JSON.stringify(widgets));
        } else {
            this._widgets = JSON.parse(JSON.stringify(DEFAULT_WIDGETS));
            this._originalWidgets = JSON.parse(JSON.stringify(DEFAULT_WIDGETS));
        }

        // 사이드바 위젯 초기화
        if (sidebarWidgets && sidebarWidgets.length > 0) {
            this._sidebarWidgets = JSON.parse(JSON.stringify(sidebarWidgets));
            this._originalSidebarWidgets = JSON.parse(JSON.stringify(sidebarWidgets));
        } else {
            this._sidebarWidgets = JSON.parse(JSON.stringify(DEFAULT_SIDEBAR_WIDGETS));
            this._originalSidebarWidgets = JSON.parse(JSON.stringify(DEFAULT_SIDEBAR_WIDGETS));
        }
    }

    /**
     * 편집 모드 토글
     */
    toggleEditMode() {
        this._isEditMode = !this._isEditMode;
        if (!this._isEditMode) {
            // 편집 모드 종료 시 변경사항 없으면 원본 복원
            if (this.hasChanges) {
                // 변경사항이 있으면 유지 (저장 안 된 상태)
            }
        }
    }

    /**
     * 편집 모드 진입
     */
    enterEditMode() {
        this._isEditMode = true;
    }

    /**
     * 편집 모드 종료
     */
    exitEditMode(discardChanges = false) {
        this._isEditMode = false;
        if (discardChanges) {
            this._widgets = JSON.parse(JSON.stringify(this._originalWidgets));
            this._sidebarWidgets = JSON.parse(JSON.stringify(this._originalSidebarWidgets));
        }
    }

    /**
     * 드래그 상태 설정
     */
    setDragging(dragging: boolean) {
        this._isDragging = dragging;
    }

    /**
     * 위젯 순서 업데이트 (드래그앤드롭 후)
     */
    updateWidgetOrder(newWidgets: WidgetConfig[]) {
        this._widgets = newWidgets.map((w, index) => ({
            ...w,
            position: index
        }));
    }

    /**
     * 위젯 활성화/비활성화 토글
     */
    toggleWidget(widgetId: string) {
        const widget = this._widgets.find((w) => w.id === widgetId);
        if (widget) {
            widget.enabled = !widget.enabled;
        }
    }

    /**
     * 위젯 삭제
     */
    removeWidget(widgetId: string) {
        const index = this._widgets.findIndex((w) => w.id === widgetId);
        if (index !== -1) {
            this._widgets = this._widgets.filter((w) => w.id !== widgetId);
            // 위치 재정렬
            this._widgets = this._widgets.map((w, i) => ({ ...w, position: i }));
        }
    }

    /**
     * 메인 위젯 추가
     */
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

    // ==================== 사이드바 위젯 메서드 ====================

    /**
     * 사이드바 위젯 순서 업데이트 (드래그앤드롭 후)
     */
    updateSidebarWidgetOrder(newWidgets: WidgetConfig[]) {
        this._sidebarWidgets = newWidgets.map((w, index) => ({
            ...w,
            position: index
        }));
    }

    /**
     * 사이드바 위젯 활성화/비활성화 토글
     */
    toggleSidebarWidget(widgetId: string) {
        const widget = this._sidebarWidgets.find((w) => w.id === widgetId);
        if (widget) {
            widget.enabled = !widget.enabled;
        }
    }

    /**
     * 사이드바 위젯 삭제
     */
    removeSidebarWidget(widgetId: string) {
        const index = this._sidebarWidgets.findIndex((w) => w.id === widgetId);
        if (index !== -1) {
            this._sidebarWidgets = this._sidebarWidgets.filter((w) => w.id !== widgetId);
            this._sidebarWidgets = this._sidebarWidgets.map((w, i) => ({ ...w, position: i }));
        }
    }

    /**
     * 사이드바 위젯 추가
     */
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

    /**
     * 변경사항 저장
     */
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
                throw new Error('레이아웃 저장 실패');
            }

            this._originalWidgets = JSON.parse(JSON.stringify(this._widgets));
            this._originalSidebarWidgets = JSON.parse(JSON.stringify(this._sidebarWidgets));
            this._isEditMode = false;
            return true;
        } catch (error) {
            console.error('❌ 레이아웃 저장 실패:', error);
            return false;
        } finally {
            this._isSaving = false;
        }
    }

    /**
     * 변경사항 취소
     */
    discardChanges() {
        this._widgets = JSON.parse(JSON.stringify(this._originalWidgets));
        this._sidebarWidgets = JSON.parse(JSON.stringify(this._originalSidebarWidgets));
    }

    /**
     * 기본 레이아웃으로 초기화
     */
    resetToDefault() {
        this._widgets = JSON.parse(JSON.stringify(DEFAULT_WIDGETS));
        this._sidebarWidgets = JSON.parse(JSON.stringify(DEFAULT_SIDEBAR_WIDGETS));
    }
}

export const widgetLayoutStore = new WidgetLayoutStore();
