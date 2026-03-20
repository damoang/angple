/**
 * 로고 관리 API 클라이언트
 */
import { apiClient } from '$lib/api';
import { safeJson } from './safe-json.js';

export interface SiteLogo {
    id: number;
    name: string;
    logo_url: string;
    schedule_type: 'recurring' | 'date_range' | 'default';
    recurring_date?: string;
    start_date?: string;
    end_date?: string;
    priority: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateLogoRequest {
    name: string;
    logo_url: string;
    schedule_type: 'recurring' | 'date_range' | 'default';
    recurring_date?: string;
    start_date?: string;
    end_date?: string;
    priority: number;
    is_active?: boolean;
}

export interface UpdateLogoRequest {
    name?: string;
    logo_url?: string;
    schedule_type?: 'recurring' | 'date_range' | 'default';
    recurring_date?: string;
    start_date?: string;
    end_date?: string;
    priority?: number;
    is_active?: boolean;
}

interface APIResponse<T> {
    data: T;
    error?: { code: string; message: string };
}

const API_BASE = '/api/v1/admin/logos';

function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = apiClient.getAccessToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

export async function listLogos(): Promise<SiteLogo[]> {
    const response = await fetch(API_BASE, {
        credentials: 'include',
        headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result: APIResponse<SiteLogo[]> = await safeJson(response);
    return result.data ?? [];
}

export async function createLogo(request: CreateLogoRequest): Promise<SiteLogo> {
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
    const result: APIResponse<SiteLogo> = await safeJson(response);
    return result.data;
}

export async function updateLogo(id: number, request: UpdateLogoRequest): Promise<SiteLogo> {
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
    const result: APIResponse<SiteLogo> = await safeJson(response);
    return result.data;
}

export async function deleteLogo(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders()
    });
    if (!response.ok) {
        const errorResult = await safeJson(response);
        throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
    }
}
