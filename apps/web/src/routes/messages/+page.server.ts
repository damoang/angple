import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ url, locals }) => {
    if (!locals.user) {
        redirect(302, `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
    }
    const kind = (url.searchParams.get('kind') as 'recv' | 'send') || 'recv';
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;
    const to = url.searchParams.get('to') || '';

    return {
        kind,
        page,
        limit,
        to
    };
};
