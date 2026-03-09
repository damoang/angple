/**
 * 관리자 경험치 관리 API 클라이언트
 */

export interface MemberXPInfo {
    mb_id: string;
    mb_nick: string;
    as_exp: number;
    as_level: number;
    mb_level: number;
}

export interface XPHistoryItem {
    id: number;
    datetime: string;
    content: string;
    point: number;
    rel_table: string;
    rel_id: string;
    rel_action: string;
}

export interface XPSummary {
    total_exp: number;
    current_level: number;
    next_level: number;
    next_level_exp: number;
    exp_to_next: number;
    level_progress: number;
}

export interface MemberXPListParams {
    page?: number;
    limit?: number;
    search?: string;
}

export interface MemberXPListResponse {
    members: MemberXPInfo[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
    };
}

export interface MemberXPHistoryResponse {
    summary: XPSummary;
    items: XPHistoryItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
    };
}

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

import { safeJson } from './safe-json.js';

const API_BASE = '/api/v2/admin/xp';

export async function listMemberXP(params: MemberXPListParams = {}): Promise<MemberXPListResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search) searchParams.set('search', params.search);

    const url = searchParams.toString()
        ? `${API_BASE}/members?${searchParams}`
        : `${API_BASE}/members`;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const result: APIResponse<MemberXPListResponse> = await safeJson(response);
    return (
        result.data ?? {
            members: [],
            pagination: { page: 1, limit: 20, total: 0, total_pages: 0 }
        }
    );
}

export async function getMemberXPHistory(mbId: string, page = 1): Promise<MemberXPHistoryResponse> {
    const response = await fetch(`${API_BASE}/members/${mbId}/history?page=${page}&limit=20`, {
        credentials: 'include'
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const result: APIResponse<MemberXPHistoryResponse> = await safeJson(response);
    return result.data;
}

// ========================================
// XP Config (설정)
// ========================================

export interface XPConfig {
    login_xp: number;
    write_xp: number;
    comment_xp: number;
    login_enabled: boolean;
    write_enabled: boolean;
    comment_enabled: boolean;
}

export async function getXPConfig(): Promise<XPConfig> {
    const response = await fetch(`${API_BASE}/config`, { credentials: 'include' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const result: APIResponse<XPConfig> = await safeJson(response);
    return (
        result.data ?? {
            login_xp: 500,
            write_xp: 100,
            comment_xp: 50,
            login_enabled: true,
            write_enabled: false,
            comment_enabled: false
        }
    );
}

export async function updateXPConfig(config: XPConfig): Promise<void> {
    const response = await fetch(`${API_BASE}/config`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });
    if (!response.ok) {
        const errorResult = await safeJson(response);
        throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
    }
}

// ========================================
// Point Config (포인트 유효기간 설정)
// ========================================

const POINT_API_BASE = '/api/v2/admin/point';

export interface PointConfig {
    expiry_enabled: boolean;
    expiry_days: number;
}

export async function getPointConfig(): Promise<PointConfig> {
    const response = await fetch(`${POINT_API_BASE}/config`, { credentials: 'include' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const result: APIResponse<PointConfig> = await safeJson(response);
    return (
        result.data ?? {
            expiry_enabled: false,
            expiry_days: 180
        }
    );
}

export async function updatePointConfig(config: Partial<PointConfig>): Promise<void> {
    const response = await fetch(`${POINT_API_BASE}/config`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    });
    if (!response.ok) {
        const errorResult = await safeJson(response);
        throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
    }
}

// ========================================
// XP Grant (수동 지급)
// ========================================

export async function grantXP(mbId: string, point: number, content: string): Promise<void> {
    const response = await fetch(`${API_BASE}/members/${mbId}/grant`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ point, content })
    });
    if (!response.ok) {
        const errorResult = await safeJson(response);
        throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
    }
}
