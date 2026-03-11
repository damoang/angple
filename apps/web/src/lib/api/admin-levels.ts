/**
 * 관리자 등급/승급 설정 API 클라이언트
 */

import { safeJson } from './safe-json.js';

export interface PromotionRule {
    fromLevel: number;
    toLevel: number;
    minLoginDays: number;
    minXP: number;
}

export interface PromotionCandidate {
    mb_id: string;
    mb_nick: string;
    mb_level: number;
    as_exp: number;
    login_days: number;
    eligible_for: number;
}

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

const API_BASE = '/api/admin/levels';

/**
 * 승급 규칙 조회
 */
export async function getPromotionRules(): Promise<PromotionRule[]> {
    const response = await fetch(`${API_BASE}/rules`, { credentials: 'include' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const result: APIResponse<{ rules: PromotionRule[] }> = await safeJson(response);
    return result.data?.rules ?? [];
}

/**
 * 승급 규칙 저장
 */
export async function savePromotionRules(rules: PromotionRule[]): Promise<void> {
    const response = await fetch(`${API_BASE}/rules`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules })
    });
    if (!response.ok) {
        const errorResult = await safeJson(response);
        throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
    }
}

/**
 * 승급 대상 회원 목록 조회
 */
export async function getPromotionCandidates(): Promise<PromotionCandidate[]> {
    const response = await fetch(`${API_BASE}/candidates`, { credentials: 'include' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const result: APIResponse<{ candidates: PromotionCandidate[] }> = await safeJson(response);
    return result.data?.candidates ?? [];
}

/**
 * 모든 대상 일괄 승급
 */
export async function promoteAllEligible(): Promise<{ promoted: number; failed: number }> {
    const response = await fetch(`${API_BASE}/promote-all`, {
        method: 'POST',
        credentials: 'include'
    });
    if (!response.ok) {
        const errorResult = await safeJson(response);
        throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
    }
    const result: APIResponse<{ promoted: number; failed: number }> = await safeJson(response);
    return result.data;
}

/**
 * 특정 회원 승급
 */
export async function promoteMember(
    mbId: string
): Promise<{ promoted: boolean; newLevel?: number }> {
    const response = await fetch(`${API_BASE}/promote`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mb_id: mbId })
    });
    if (!response.ok) {
        const errorResult = await safeJson(response);
        throw new Error(errorResult.error?.message || `HTTP ${response.status}`);
    }
    const result: APIResponse<{ promoted: boolean; newLevel?: number }> = await safeJson(response);
    return result.data;
}
