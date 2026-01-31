/**
 * 백엔드 메뉴 관리 API 클라이언트
 */

import type {
    Menu,
    CreateMenuRequest,
    UpdateMenuRequest,
    ReorderMenusRequest
} from '$lib/types/admin-menu';

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

/**
 * SvelteKit 프록시(/api/v2/[...path])를 통해 백엔드에 요청합니다.
 * 같은 origin이므로 CORS 문제가 발생하지 않습니다.
 */
const API_BASE = '/api/v2/admin/menus';

export async function getMenusForAdmin(): Promise<Menu[]> {
    try {
        const response = await fetch(API_BASE, {
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<Menu[]> = await response.json();
        return result.data ?? [];
    } catch (error) {
        console.error('❌ 메뉴 조회 실패:', error);
        throw error;
    }
}

export async function createMenu(request: CreateMenuRequest): Promise<Menu> {
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
        const result: APIResponse<Menu> = await response.json();
        return result.data;
    } catch (error) {
        console.error('❌ 메뉴 생성 실패:', error);
        throw error;
    }
}

export async function updateMenu(id: number, request: UpdateMenuRequest): Promise<Menu> {
    try {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
        const result: APIResponse<Menu> = await response.json();
        return result.data;
    } catch (error) {
        console.error('❌ 메뉴 수정 실패:', error);
        throw error;
    }
}

export async function deleteMenu(id: number): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 메뉴 삭제 실패:', error);
        throw error;
    }
}

export async function reorderMenus(request: ReorderMenusRequest): Promise<void> {
    try {
        const response = await fetch(`${API_BASE}/reorder`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 메뉴 순서 변경 실패:', error);
        throw error;
    }
}
