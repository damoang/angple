import type { PageServerLoad } from './$types.js';
import { getMyMemos } from '$lib/server/member-memo.js';

export const load: PageServerLoad = async ({ url, locals, depends }) => {
    depends('app:memos');
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;

    if (!locals.user?.id) {
        return { memos: [], total: 0, page, totalPages: 1 };
    }

    const result = await getMyMemos(locals.user.id, page, limit);
    return {
        memos: result.items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages
    };
};
