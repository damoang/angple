import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ url }) => {
    const kind = (url.searchParams.get('kind') as 'recv' | 'send') || 'recv';
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;

    return {
        kind,
        page,
        limit
    };
};
