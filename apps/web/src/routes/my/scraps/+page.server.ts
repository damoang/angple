import type { PageServerLoad } from './$types.js';
import { getScraps } from '$lib/server/scrap.js';

export const load: PageServerLoad = async ({ url, locals, depends }) => {
    depends('app:scraps');
    const page = Number(url.searchParams.get('page')) || 1;
    const query = url.searchParams.get('q')?.trim() || '';
    const limit = 20;

    if (!locals.user?.id) {
        return { scraps: [], total: 0, page, totalPages: 1, query };
    }

    const result = await getScraps(locals.user.id, page, limit, query || undefined);
    return {
        scraps: result.items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        query
    };
};
