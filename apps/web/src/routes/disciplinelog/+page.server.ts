/**
 * 이용제한 기록 목록 - SSR 데이터 로드
 */
import type { PageServerLoad } from './$types';
import { backendFetch } from '$lib/server/backend-fetch.js';
import { safeJson } from '$lib/api/safe-json.js';

export const load: PageServerLoad = async ({ url }) => {
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;
    const memberId = url.searchParams.get('member_id')?.trim() || '';

    let endpoint = `/api/v1/discipline-logs?page=${page}&limit=${limit}`;
    if (memberId) {
        endpoint += `&member_id=${encodeURIComponent(memberId)}`;
    }

    try {
        const response = await backendFetch(endpoint, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Angple-Web-SSR/1.0'
            }
        });

        if (!response.ok) {
            return { logs: [], total: 0, page, limit, memberId };
        }

        const result = await safeJson(response);
        return {
            logs: result.data || [],
            total: result.meta?.total || 0,
            page,
            limit,
            memberId
        };
    } catch {
        return { logs: [], total: 0, page, limit, memberId };
    }
};
