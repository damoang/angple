import type { PageServerLoad } from './$types.js';
import type { ExpSummary, ExpHistoryResponse } from '$lib/api/types.js';
import { backendFetch, createAuthHeaders } from '$lib/server/backend-fetch.js';

export const load: PageServerLoad = async ({ url, locals }) => {
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;
    const filter = (url.searchParams.get('filter') as 'all' | 'earned' | 'used') || 'all';

    const headers = createAuthHeaders(locals.accessToken);

    let expSummary: ExpSummary | null = null;
    let expHistory: ExpHistoryResponse | null = null;

    try {
        const [summaryRes, historyRes] = await Promise.allSettled([
            backendFetch(`/api/v1/my/exp`, { headers }),
            backendFetch(`/api/v1/my/exp/history?page=${page}&limit=${limit}`, {
                headers
            })
        ]);

        if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
            expSummary = (await summaryRes.value.json()).data;
        }
        if (historyRes.status === 'fulfilled' && historyRes.value.ok) {
            const raw = (await historyRes.value.json()).data;
            expHistory = {
                summary: raw.summary,
                items: raw.items || [],
                total: raw.pagination?.total ?? 0,
                page: raw.pagination?.page ?? page,
                limit: raw.pagination?.limit ?? limit,
                total_pages: raw.pagination?.total_pages ?? 0
            };
        }
    } catch (e) {
        console.error('[Exp] Failed to load:', e);
    }

    return { page, limit, filter, expSummary, expHistory };
};
