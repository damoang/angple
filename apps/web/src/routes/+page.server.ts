import type { PageServerLoad } from './$types';
import type { IndexWidgetsData } from '$lib/api/types';

const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:8082/api/v2';

export const load: PageServerLoad = async () => {
    console.log('[SSR] Loading index widgets data');

    try {
        // SvelteKit의 fetch 대신 native fetch 사용 (SSR에서 403 문제 방지)
        const response = await fetch(`${INTERNAL_API_URL}/recommended/index-widgets`, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Angple-Web-SSR/1.0'
            }
        });

        if (!response.ok) {
            console.error('[SSR] API error:', response.status, await response.text());
            return { indexWidgets: null };
        }

        const result = await response.json();
        // API 응답이 { data: IndexWidgetsData } 형태인지 직접 IndexWidgetsData 형태인지 확인
        const indexWidgets: IndexWidgetsData = result.data ?? result;
        console.log('[SSR] Index widgets loaded');
        return { indexWidgets };
    } catch (error) {
        console.error('[SSR] Failed to load index widgets:', error);
        return { indexWidgets: null };
    }
};
