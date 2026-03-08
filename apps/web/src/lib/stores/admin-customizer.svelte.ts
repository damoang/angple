/**
 * 관리자 커스터마이저 상태 관리 스토어
 *
 * 오른쪽 슬라이드 패널의 열림/닫힘, 활성 섹션 등을 관리합니다.
 * 실제 데이터 변경은 기존 widgetLayoutStore, admin-menu-store에 위임합니다.
 */

import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
import { menuStore as adminMenuStore } from '$lib/stores/admin-menu-store.svelte';
import { menuStore } from '$lib/stores/menu.svelte';
import type { MenuItem } from '$lib/api/types';
import type { Menu } from '$lib/types/admin-menu';
import { toast } from 'svelte-sonner';

export type CustomizerSection = 'header' | 'sidebar' | 'mega' | 'widgets';

class AdminCustomizerStore {
    private _isOpen = $state(false);
    private _activeSection = $state<CustomizerSection>('header');
    private _isSaving = $state(false);

    get isOpen() {
        return this._isOpen;
    }

    get activeSection() {
        return this._activeSection;
    }

    get isSaving() {
        return this._isSaving;
    }

    get hasChanges(): boolean {
        return widgetLayoutStore.hasChanges || adminMenuStore.hasChanges;
    }

    open(section?: CustomizerSection) {
        this._isOpen = true;
        if (section) {
            this._activeSection = section;
        }
        // 즉시 SSR 메뉴 데이터로 초기화 (빈 화면 방지)
        if (adminMenuStore.menus.length === 0 && menuStore.menus.length > 0) {
            // MenuItem → Menu 변환 (is_active 등 누락 필드 보완)
            const fallbackMenus: Menu[] = menuStore.menus.map((m) => ({
                ...m,
                parent_id: m.parent_id ?? null,
                view_level: 0,
                is_active: true,
                children: m.children?.map((c) => ({
                    ...c,
                    parent_id: c.parent_id ?? null,
                    view_level: 0,
                    is_active: true,
                    children: c.children?.map((gc) => ({
                        ...gc,
                        parent_id: gc.parent_id ?? null,
                        view_level: 0,
                        is_active: true,
                        children: []
                    })) as Menu[]
                })) as Menu[]
            })) as Menu[];
            adminMenuStore.initFromServer(fallbackMenus);
        }
        // 관리자 API로 전체 메뉴 로드 (성공 시 덮어쓰기, 실패 시 SSR 데이터 유지)
        adminMenuStore.loadMenus();
        // 위젯 섹션이면 편집 모드 진입
        if (this._activeSection === 'widgets') {
            widgetLayoutStore.enterEditMode();
        }
    }

    close() {
        if (this.hasChanges) {
            if (!confirm('저장하지 않은 변경사항이 있습니다. 정말 닫으시겠습니까?')) {
                return;
            }
            this.discardAll();
        }
        this._isOpen = false;
        widgetLayoutStore.exitEditMode();
    }

    forceClose() {
        this._isOpen = false;
        widgetLayoutStore.exitEditMode();
    }

    setSection(section: CustomizerSection) {
        this._activeSection = section;
        // 위젯 섹션 진입/퇴장 시 편집 모드 토글
        if (section === 'widgets') {
            widgetLayoutStore.enterEditMode();
        } else {
            widgetLayoutStore.exitEditMode();
        }
    }

    async saveAll(): Promise<boolean> {
        this._isSaving = true;
        try {
            const promises: Promise<unknown>[] = [];

            if (widgetLayoutStore.hasChanges) {
                promises.push(widgetLayoutStore.saveLayout());
            }

            if (adminMenuStore.hasChanges) {
                promises.push(adminMenuStore.saveReorder());
            }

            const results = await Promise.allSettled(promises);
            const allSuccess = results.every((r) => r.status === 'fulfilled' && r.value !== false);

            if (allSuccess) {
                toast.success('변경사항이 저장되었습니다.');
                // 저장 후 프론트 메뉴 갱신
                this.refreshFrontMenus();
                return true;
            } else {
                toast.error('일부 저장에 실패했습니다.');
                return false;
            }
        } catch {
            toast.error('저장 중 오류가 발생했습니다.');
            return false;
        } finally {
            this._isSaving = false;
        }
    }

    discardAll() {
        widgetLayoutStore.discardChanges();
        adminMenuStore.discardChanges();
    }

    /**
     * 프론트 표시용 메뉴를 SSR API에서 다시 fetch하여 갱신
     * (adminMenuStore와 menuStore는 타입이 다르므로 직접 대입 금지)
     */
    async refreshFrontMenus(): Promise<void> {
        try {
            const response = await fetch('/api/v1/menus/sidebar');
            if (!response.ok) return;
            const result = await response.json();
            const menus: MenuItem[] = result.data ?? [];
            menuStore.initFromServer(menus);
        } catch {
            // 갱신 실패 시 무시 (다음 페이지 로드에서 갱신됨)
        }
    }
}

export const customizerStore = new AdminCustomizerStore();
