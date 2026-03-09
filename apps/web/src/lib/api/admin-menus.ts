/**
 * 백엔드 메뉴 관리 API 클라이언트
 */

import type {
    Menu,
    CreateMenuRequest,
    UpdateMenuRequest,
    ReorderMenusRequest
} from '$lib/types/admin-menu';
import { apiClient } from '$lib/api';
import { safeJson } from './safe-json.js';

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

/**
 * SvelteKit 프록시(/api/v1/[...path])를 통해 백엔드에 요청합니다.
 * 같은 origin이므로 CORS 문제가 발생하지 않습니다.
 */
const API_BASE = '/api/v1/admin/menus';

/**
 * 인증 헤더 생성 (쿠키 + Authorization 백업)
 * CloudFront가 쿠키를 전달하지 않을 경우를 대비하여 Authorization 헤더도 포함
 */
function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = apiClient.getAccessToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

export async function getMenusForAdmin(): Promise<Menu[]> {
    try {
        const response = await fetch(API_BASE, {
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const result: APIResponse<Menu[]> = await safeJson(response);
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
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            const errorResult = await safeJson(response);
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
        const result: APIResponse<Menu> = await safeJson(response);
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
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            const errorResult = await safeJson(response);
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
        const result: APIResponse<Menu> = await safeJson(response);
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
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            const errorResult = await safeJson(response);
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
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            const errorResult = await safeJson(response);
            throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 메뉴 순서 변경 실패:', error);
        throw error;
    }
}

/**
 * SSR 메뉴 캐시 무효화
 * 메뉴 변경 후 호출하여 사이트에 즉시 반영되도록 합니다.
 */
export async function invalidateMenuCache(): Promise<void> {
    try {
        const response = await fetch('/api/admin/invalidate-menu-cache', {
            method: 'POST',
            credentials: 'include',
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            console.warn('메뉴 캐시 무효화 실패:', response.status);
        }
    } catch (error) {
        console.warn('메뉴 캐시 무효화 요청 실패:', error);
    }
}
