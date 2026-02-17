/**
 * 관리자 라이선스 관리 API 클라이언트
 */

import type { LicenseKey, LicenseCreateRequest, LicenseStatus } from '$lib/types/license.js';
import type { PaginatedResponse } from '$lib/types/admin-commerce.js';

const API_BASE = '/api/admin/licenses';

export async function getLicenses(
    page = 1,
    limit = 20,
    status?: LicenseStatus
): Promise<PaginatedResponse<LicenseKey>> {
    const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (status) params.append('status', status);
    const res = await fetch(`${API_BASE}?${params}`);
    if (!res.ok) throw new Error('라이선스 목록 조회 실패');
    return res.json();
}

export async function createLicense(data: LicenseCreateRequest): Promise<LicenseKey> {
    const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('라이선스 생성 실패');
    return res.json();
}

export async function revokeLicense(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/${id}/revoke`, { method: 'POST' });
    if (!res.ok) throw new Error('라이선스 해지 실패');
}

export async function suspendLicense(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/${id}/suspend`, { method: 'POST' });
    if (!res.ok) throw new Error('라이선스 정지 실패');
}

export async function reactivateLicense(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/${id}/reactivate`, { method: 'POST' });
    if (!res.ok) throw new Error('라이선스 재활성화 실패');
}

export async function removeDomain(id: number, domain: string): Promise<void> {
    const res = await fetch(`${API_BASE}/${id}/domains`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
    });
    if (!res.ok) throw new Error('도메인 제거 실패');
}
