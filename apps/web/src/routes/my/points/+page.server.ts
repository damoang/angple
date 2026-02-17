import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ url }) => {
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;
    const filter = (url.searchParams.get('filter') as 'all' | 'earned' | 'used') || 'all';

    return {
        page,
        limit,
        filter
    };
};
