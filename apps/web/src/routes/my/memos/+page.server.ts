import type { PageServerLoad } from './$types.js';
import { loadPluginServerLib } from '$lib/server/plugin-server-loader.js';

/**
 * Phase 1D-prep: member-memo plugin lib을 dynamic import로 전환.
 * 오픈소스 빌드 (member-memo plugin 없음) 시 plugin lib null → empty page.
 * damoang 빌드: install.sh로 premium 복사 후 정상 동작.
 */
type MemoSearchParams = {
    color?: string;
    memo?: string;
    detail?: string;
    target?: string;
};

interface MemoModule {
    getMyMemos: (
        memberId: string,
        page: number,
        limit: number,
        search?: MemoSearchParams
    ) => Promise<{
        items: unknown[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getMemoColorDistribution: (memberId: string) => Promise<Record<string, number>>;
}

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

    // Phase 1D-prep: 직접 import 대신 plugin lib loader 사용.
    // member-memo plugin 미설치 시 null → 빈 페이지.
    const queries = await loadPluginServerLib<MemoModule>('member-memo', 'queries');
    if (!queries) {
        return { memos: [], total: 0, page, totalPages: 1, search, colorDist: {} };
    }

    const [result, colorDist] = await Promise.all([
        queries.getMyMemos(locals.user.id, page, limit, search),
        queries.getMemoColorDistribution(locals.user.id)
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
