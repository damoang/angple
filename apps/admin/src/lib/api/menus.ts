/**
 * 백엔드 메뉴 관리 API 클라이언트
 *
 * Admin에서 Go 백엔드의 메뉴 API를 호출합니다.
 */

import type {
    Menu,
    CreateMenuRequest,
    UpdateMenuRequest,
    ReorderMenusRequest
} from '$lib/types/menu';

// 백엔드 API 기본 URL (환경변수로 설정 가능)
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8081';

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

/**
 * 모든 메뉴 조회 (Admin용 - 비활성 메뉴 포함)
 */
export async function getMenusForAdmin(): Promise<Menu[]> {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/v2/admin/menus`, {
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

/**
 * 메뉴 생성
 */
export async function createMenu(request: CreateMenuRequest): Promise<Menu> {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/v2/admin/menus`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }

        const result: APIResponse<Menu> = await response.json();
        console.log('✅ 메뉴 생성 성공:', result.data);
        return result.data;
    } catch (error) {
        console.error('❌ 메뉴 생성 실패:', error);
        throw error;
    }
}

/**
 * 메뉴 수정
 */
export async function updateMenu(id: number, request: UpdateMenuRequest): Promise<Menu> {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/v2/admin/menus/${id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }

        const result: APIResponse<Menu> = await response.json();
        console.log('✅ 메뉴 수정 성공:', result.data);
        return result.data;
    } catch (error) {
        console.error('❌ 메뉴 수정 실패:', error);
        throw error;
    }
}

/**
 * 메뉴 삭제
 */
export async function deleteMenu(id: number): Promise<void> {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/v2/admin/menus/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }

        console.log('✅ 메뉴 삭제 성공');
    } catch (error) {
        console.error('❌ 메뉴 삭제 실패:', error);
        throw error;
    }
}

/**
 * 메뉴 순서 변경
 */
export async function reorderMenus(request: ReorderMenusRequest): Promise<void> {
    try {
        const response = await fetch(`${BACKEND_API_URL}/api/v2/admin/menus/reorder`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }

        console.log('✅ 메뉴 순서 변경 성공');
    } catch (error) {
        console.error('❌ 메뉴 순서 변경 실패:', error);
        throw error;
    }
}
