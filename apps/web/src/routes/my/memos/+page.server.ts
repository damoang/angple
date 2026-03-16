import type { PageServerLoad } from './$types.js';
import { getMyMemos, getMemoColorDistribution } from '$lib/server/member-memo.js';
import type { MemoSearchParams } from '$lib/server/member-memo.js';

export const load: PageServerLoad = async ({ url, locals, depends }) => {
    depends('app:memos');
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;

    const color = url.searchParams.get('color') || '';
    const memo = url.searchParams.get('memo') || '';
    const detail = url.searchParams.get('detail') || '';
    const target = url.searchParams.get('target') || '';

    const search: MemoSearchParams = {};
    if (color) search.color = color;
    if (memo) search.memo = memo;
    if (detail) search.detail = detail;
    if (target) search.target = target;

    if (!locals.user?.id) {
        return { memos: [], total: 0, page, totalPages: 1, search, colorDist: {} };
    }

    const [result, colorDist] = await Promise.all([
        getMyMemos(locals.user.id, page, limit, search),
        getMemoColorDistribution(locals.user.id)
    ]);
    return {
        memos: result.items,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        search,
        colorDist
    };
};
