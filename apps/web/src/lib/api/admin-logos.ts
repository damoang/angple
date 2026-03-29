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

export interface SeasonalPreset {
    key: string;
    label: string;
    recurring_date: string;
    default_name: string;
}

export interface CreatePresetLogoItemRequest {
    name: string;
    recurring_date: string;
}

export interface CreatePresetLogosRequest {
    logo_url: string;
    priority: number;
    is_active?: boolean;
    items: CreatePresetLogoItemRequest[];
}

export interface CreatePresetLogoSkipped {
    name: string;
    recurring_date: string;
    reason: string;
}

export interface CreatePresetLogosResult {
    created: SiteLogo[];
    skipped: CreatePresetLogoSkipped[];
}

export const SEASONAL_PRESETS: SeasonalPreset[] = [
    { key: 'samiljeol', label: '삼일절', recurring_date: '03-01', default_name: '삼일절 로고' },
    {
        key: 'remember-0416',
        label: '4.16 기억일',
        recurring_date: '04-16',
        default_name: '4.16 기억 로고'
    },
    {
        key: 'childrens-day',
        label: '어린이날',
        recurring_date: '05-05',
        default_name: '어린이날 로고'
    },
    { key: 'memorial-day', label: '현충일', recurring_date: '06-06', default_name: '현충일 로고' },
    {
        key: 'liberation-day',
        label: '광복절',
        recurring_date: '08-15',
        default_name: '광복절 로고'
    },
    {
        key: 'foundation-day',
        label: '개천절',
        recurring_date: '10-03',
        default_name: '개천절 로고'
    },
    { key: 'hangul-day', label: '한글날', recurring_date: '10-09', default_name: '한글날 로고' },
    {
        key: 'christmas',
        label: '크리스마스',
        recurring_date: '12-25',
        default_name: '크리스마스 로고'
    }
];

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

export async function createPresetLogos(
    request: CreatePresetLogosRequest
): Promise<CreatePresetLogosResult> {
    const response = await fetch(`${API_BASE}/presets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(request)
    });
    if (!response.ok) {
        const errorResult = await safeJson(response);
        throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
    }
    const result: APIResponse<CreatePresetLogosResult> = await safeJson(response);
    return result.data;
}
