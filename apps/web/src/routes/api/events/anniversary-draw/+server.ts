import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { backendFetch, createAuthHeaders } from '$lib/server/backend-fetch.js';
import { safeJson } from '$lib/api/safe-json.js';

export const POST: RequestHandler = async ({ locals }) => {
    if (!locals.accessToken || !locals.user?.id) {
        return json(
            { success: false, error: { message: '로그인이 필요합니다.' } },
            { status: 401 }
        );
    }

    const response = await backendFetch('/api/v1/events/anniversary-draw', {
        method: 'POST',
        headers: {
            ...createAuthHeaders(locals.accessToken),
            'Content-Type': 'application/json'
        },
        timeout: 10_000
    });

    const body = await safeJson(response);
    return json(body, { status: response.status });
};
