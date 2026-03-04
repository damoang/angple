import type { PageServerLoad } from './$types.js';
import type { ExpSummary, ExpHistoryResponse } from '$lib/api/types.js';
import { env } from '$env/dynamic/private';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';

export const load: PageServerLoad = async ({ url, locals }) => {
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;
    const filter = (url.searchParams.get('filter') as 'all' | 'earned' | 'used') || 'all';

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Angple-Web-SSR/1.0'
    };
    if (locals.accessToken) {
        headers['Authorization'] = `Bearer ${locals.accessToken}`;
    }

    let expSummary: ExpSummary | null = null;
    let expHistory: ExpHistoryResponse | null = null;

    try {
        const backendFetch = globalThis.fetch;

        const [summaryRes, historyRes] = await Promise.all([
            backendFetch(`${BACKEND_URL}/api/v1/my/exp`, { headers }),
            backendFetch(`${BACKEND_URL}/api/v1/my/exp/history?page=${page}&limit=${limit}`, {
                headers
            })
        ]);

        if (summaryRes.ok) {
            expSummary = (await summaryRes.json()).data;
        }
        if (historyRes.ok) {
            const raw = (await historyRes.json()).data;
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
