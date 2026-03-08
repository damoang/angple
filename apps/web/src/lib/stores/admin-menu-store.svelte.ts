/**
 * 메뉴 관리 Store (Svelte 5 Rune 모드)
 */

import { toast } from 'svelte-sonner';
import * as menusApi from '$lib/api/admin-menus';
import type {
    Menu,
    CreateMenuRequest,
    UpdateMenuRequest,
    ReorderMenuItem
} from '$lib/types/admin-menu';
import { flattenMenuTree } from '$lib/types/admin-menu';

class MenuStore {
    private _menus = $state<Menu[]>([]);
    private _originalMenus = $state<Menu[]>([]);
    private _isLoading = $state(false);
    private _isSaving = $state(false);
    private _selectedMenuId = $state<number | null>(null);
    private _editingMenu = $state<Menu | null>(null);

    get menus() {
        return this._menus;
    }
    get isLoading() {
        return this._isLoading;
    }
    get isSaving() {
        return this._isSaving;
    }
    get selectedMenuId() {
        return this._selectedMenuId;
    }
    get editingMenu() {
        return this._editingMenu;
    }

    get selectedMenu(): Menu | null {
        if (!this._selectedMenuId) return null;
        return this.findMenuById(this._menus, this._selectedMenuId);
    }

    get hasChanges(): boolean {
        return JSON.stringify(this._menus) !== JSON.stringify(this._originalMenus);
    }

    private findMenuById(menus: Menu[], id: number): Menu | null {
        for (const menu of menus) {
            if (menu.id === id) return menu;
            if (menu.children && menu.children.length > 0) {
                const found = this.findMenuById(menu.children, id);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * SSR 데이터로 스토어 초기화
     */
    initFromServer(menus: Menu[]) {
        this._menus = menus;
        this._originalMenus = JSON.parse(JSON.stringify(menus));
        this._isLoading = false;
    }

    async loadMenus() {
        this._isLoading = true;
        try {
            const data = await menusApi.getMenusForAdmin();
            this._menus = data;
            this._originalMenus = JSON.parse(JSON.stringify(data));
        } catch (error) {
            console.error('메뉴 로드 실패:', error);
            // 기존 데이터가 있으면 유지 (SSR fallback 보존)
            if (this._menus.length === 0) {
                toast.error('메뉴를 불러오지 못했습니다.');
            }
        } finally {
            this._isLoading = false;
        }
    }

    selectMenu(menuId: number | null) {
        this._selectedMenuId = menuId;
        this._editingMenu = menuId ? this.findMenuById(this._menus, menuId) : null;
    }

    async createMenu(request: CreateMenuRequest) {
        this._isSaving = true;
        try {
            const newMenu = await menusApi.createMenu(request);
            // 로컬 트리에 삽입
            const menuWithChildren: Menu = { ...newMenu, children: [] };
            if (request.parent_id) {
                const parent = this.findMenuById(this._menus, request.parent_id);
                if (parent) {
                    if (!parent.children) parent.children = [];
                    parent.children.push(menuWithChildren);
                } else {
                    this._menus.push(menuWithChildren);
                }
            } else {
                this._menus.push(menuWithChildren);
            }
            this._originalMenus = JSON.parse(JSON.stringify(this._menus));
            this._selectedMenuId = newMenu.id;
            toast.success('메뉴가 생성되었습니다.');
            // 캐시 무효화 (백그라운드)
            menusApi.invalidateMenuCache().catch(() => {});
            return newMenu;
        } catch (error) {
            console.error('메뉴 생성 실패:', error);
            toast.error('메뉴 생성에 실패했습니다.');
            throw error;
        } finally {
            this._isSaving = false;
        }
    }

    async updateMenu(id: number, request: UpdateMenuRequest) {
        this._isSaving = true;
        try {
            const updatedMenu = await menusApi.updateMenu(id, request);
            // 로컬에서 해당 메뉴 교체
            this.replaceMenuInTree(this._menus, id, updatedMenu);
            this.replaceMenuInTree(this._originalMenus, id, updatedMenu);
            toast.success('메뉴가 수정되었습니다.');
            // 캐시 무효화 (백그라운드)
            menusApi.invalidateMenuCache().catch(() => {});
            return updatedMenu;
        } catch (error) {
            console.error('메뉴 수정 실패:', error);
            toast.error('메뉴 수정에 실패했습니다.');
            throw error;
        } finally {
            this._isSaving = false;
        }
    }

    private replaceMenuInTree(menus: Menu[], id: number, updated: Menu): boolean {
        for (let i = 0; i < menus.length; i++) {
            if (menus[i].id === id) {
                menus[i] = { ...updated, children: menus[i].children };
                return true;
            }
            if (menus[i].children && menus[i].children!.length > 0) {
                if (this.replaceMenuInTree(menus[i].children!, id, updated)) return true;
            }
        }
        return false;
    }

    async deleteMenu(id: number) {
        this._isSaving = true;
        try {
            await menusApi.deleteMenu(id);
            // 로컬에서 재귀 제거
            this._menus = this.removeMenuFromTree(this._menus, id);
            this._originalMenus = JSON.parse(JSON.stringify(this._menus));
            if (this._selectedMenuId === id) {
                this._selectedMenuId = null;
                this._editingMenu = null;
            }
            toast.success('메뉴가 삭제되었습니다.');
            // 캐시 무효화 (백그라운드)
            menusApi.invalidateMenuCache().catch(() => {});
        } catch (error) {
            console.error('메뉴 삭제 실패:', error);
            toast.error('메뉴 삭제에 실패했습니다.');
            throw error;
        } finally {
            this._isSaving = false;
        }
    }

    private removeMenuFromTree(menus: Menu[], id: number): Menu[] {
        return menus
            .filter((m) => m.id !== id)
            .map((m) => ({
                ...m,
                children: m.children ? this.removeMenuFromTree(m.children, id) : []
            }));
    }

    updateMenuOrder(newMenus: Menu[]) {
        this._menus = newMenus;
    }

    async saveReorder() {
        this._isSaving = true;
        try {
            const items: ReorderMenuItem[] = flattenMenuTree(this._menus);
            await menusApi.reorderMenus({ items });
            this._originalMenus = JSON.parse(JSON.stringify(this._menus));
            toast.success('메뉴 순서가 저장되었습니다.');
            // 캐시 무효화 (백그라운드)
            menusApi.invalidateMenuCache().catch(() => {});
        } catch (error) {
            console.error('메뉴 순서 저장 실패:', error);
            toast.error('메뉴 순서 저장에 실패했습니다.');
            throw error;
        } finally {
            this._isSaving = false;
        }
    }

    /**
     * 메뉴 속성 토글 (낙관적 업데이트)
     * 스크롤 위치를 유지하기 위해 loadMenus()를 호출하지 않고 로컬 상태만 업데이트합니다.
     */
    async toggleMenuProperty(
        id: number,
        property: 'show_in_header' | 'show_in_sidebar' | 'is_active'
    ) {
        const menu = this.findMenuById(this._menus, id);
        if (!menu) return;

        const newValue = !menu[property];

        // 낙관적 업데이트: 로컬 상태 즉시 반영
        menu[property] = newValue;
        // originalMenus도 업데이트하여 hasChanges가 false 유지
        const originalMenu = this.findMenuById(this._originalMenus, id);
        if (originalMenu) {
            originalMenu[property] = newValue;
        }

        // 백그라운드에서 API 호출 + 캐시 무효화
        try {
            await menusApi.updateMenu(id, { [property]: newValue });
            await menusApi.invalidateMenuCache();
            toast.success('메뉴가 수정되었습니다.');
        } catch (error) {
            // 실패 시 롤백
            menu[property] = !newValue;
            if (originalMenu) {
                originalMenu[property] = !newValue;
            }
            console.error('메뉴 토글 실패:', error);
            toast.error('메뉴 수정에 실패했습니다.');
        }
    }

    discardChanges() {
        this._menus = JSON.parse(JSON.stringify(this._originalMenus));
        this._selectedMenuId = null;
        this._editingMenu = null;
    }
}

export const menuStore = new MenuStore();
