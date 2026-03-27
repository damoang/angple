import type { PageServerLoad } from './$types.js';
import type { AnniversaryDrawResponse } from '$lib/api/types.js';
import { safeJson } from '$lib/api/safe-json.js';
import { backendFetch, createAuthHeaders } from '$lib/server/backend-fetch.js';

export const load: PageServerLoad = async ({ locals }) => {
    let drawEntry: AnniversaryDrawResponse | null = null;

    if (locals.accessToken) {
        try {
            const response = await backendFetch('/api/v1/events/anniversary-draw', {
                headers: createAuthHeaders(locals.accessToken),
                timeout: 5_000
            });
            if (response.ok) {
                const json = await safeJson<{ data: AnniversaryDrawResponse | null }>(response);
                drawEntry = json.data ?? null;
            }
        } catch (error) {
            console.error('[2nd-anniversary] Failed to load draw status:', error);
        }
    }

    return {
        title: '다모앙 2주년',
        isLoggedIn: Boolean(locals.user?.id),
        memberId: locals.user?.id ?? null,
        nickname: locals.user?.nickname ?? null,
        drawEntry
    };
};
