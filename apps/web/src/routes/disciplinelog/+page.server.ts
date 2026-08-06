/**
 * 이용제한 기록 목록 - SSR 데이터 로드
 */
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { backendFetch } from '$lib/server/backend-fetch.js';
import { safeJson } from '$lib/api/safe-json.js';

export const load: PageServerLoad = async ({ url, locals }) => {
    // bug/13348: 이용제한 기록은 회원 전용 — 게스트(검색엔진·봇 포함)에게 노출하지 않는다
    if (!locals.user) {
        redirect(302, `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
    }

    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;
    const memberId = url.searchParams.get('member_id')?.trim() || '';

    let endpoint = `/api/v1/discipline-logs?page=${page}&limit=${limit}`;
    if (memberId) {
        endpoint += `&member_id=${encodeURIComponent(memberId)}`;
    }

    try {
        const headers: Record<string, string> = {
            Accept: 'application/json',
            'User-Agent': 'Angple-Web-SSR/1.0'
        };
        if (locals.accessToken) {
            headers['Authorization'] = `Bearer ${locals.accessToken}`;
        }
        const response = await backendFetch(endpoint, { headers });

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
