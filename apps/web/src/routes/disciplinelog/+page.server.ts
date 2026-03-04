/**
 * 이용제한 기록 목록 - SSR 데이터 로드
 */
import type { PageServerLoad } from './$types';
import { backendFetch } from '$lib/server/backend-fetch.js';

export const load: PageServerLoad = async ({ url }) => {
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;

    try {
        const response = await backendFetch(`/api/v1/discipline-logs?page=${page}&limit=${limit}`, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Angple-Web-SSR/1.0'
            }
        });

        if (!response.ok) {
            return { logs: [], total: 0, page, limit };
        }

        const result = await response.json();
        return {
            logs: result.data || [],
            total: result.meta?.total || 0,
            page,
            limit
        };
    } catch {
        return { logs: [], total: 0, page, limit };
    }
};
