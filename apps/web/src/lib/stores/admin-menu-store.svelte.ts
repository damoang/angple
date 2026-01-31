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

    async loadMenus() {
        this._isLoading = true;
        try {
            const data = await menusApi.getMenusForAdmin();
            this._menus = data;
            this._originalMenus = JSON.parse(JSON.stringify(data));
        } catch (error) {
            console.error('❌ 메뉴 로드 실패:', error);
            toast.error('메뉴를 불러오지 못했습니다. 백엔드 서버가 실행 중인지 확인하세요.');
            this._menus = [];
        } finally {
            this._isLoading = false;
        }
    }

    private countMenus(menus: Menu[]): number {
        let count = menus.length;
        for (const menu of menus) {
            if (menu.children && menu.children.length > 0) {
                count += this.countMenus(menu.children);
            }
        }
        return count;
    }

    selectMenu(menuId: number | null) {
        this._selectedMenuId = menuId;
        this._editingMenu = menuId ? this.findMenuById(this._menus, menuId) : null;
    }

    async createMenu(request: CreateMenuRequest) {
        this._isSaving = true;
        try {
            const newMenu = await menusApi.createMenu(request);
            await this.loadMenus();
            this._selectedMenuId = newMenu.id;
            toast.success('메뉴가 생성되었습니다.');
            return newMenu;
        } catch (error) {
            console.error('❌ 메뉴 생성 실패:', error);
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
            await this.loadMenus();
            toast.success('메뉴가 수정되었습니다.');
            return updatedMenu;
        } catch (error) {
            console.error('❌ 메뉴 수정 실패:', error);
            toast.error('메뉴 수정에 실패했습니다.');
            throw error;
        } finally {
            this._isSaving = false;
        }
    }

    async deleteMenu(id: number) {
        this._isSaving = true;
        try {
            await menusApi.deleteMenu(id);
            await this.loadMenus();
            if (this._selectedMenuId === id) {
                this._selectedMenuId = null;
                this._editingMenu = null;
            }
            toast.success('메뉴가 삭제되었습니다.');
        } catch (error) {
            console.error('❌ 메뉴 삭제 실패:', error);
            toast.error('메뉴 삭제에 실패했습니다.');
            throw error;
        } finally {
            this._isSaving = false;
        }
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
        } catch (error) {
            console.error('❌ 메뉴 순서 저장 실패:', error);
            toast.error('메뉴 순서 저장에 실패했습니다.');
            throw error;
        } finally {
            this._isSaving = false;
        }
    }

    async toggleMenuProperty(
        id: number,
        property: 'show_in_header' | 'show_in_sidebar' | 'is_active'
    ) {
        const menu = this.findMenuById(this._menus, id);
        if (!menu) return;
        const newValue = !menu[property];
        await this.updateMenu(id, { [property]: newValue });
    }

    discardChanges() {
        this._menus = JSON.parse(JSON.stringify(this._originalMenus));
        this._selectedMenuId = null;
        this._editingMenu = null;
    }
}

export const menuStore = new MenuStore();
