import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ url }) => {
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;

    return {
        page,
        limit
    };
};
