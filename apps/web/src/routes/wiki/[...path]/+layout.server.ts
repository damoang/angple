import type { LayoutServerLoad } from './$types';
import { getPageTree } from '$lib/server/wiki';

// 위키 좌측 페이지 트리 (모든 위키 페이지 공통). 실패해도 빈 트리로 graceful.
export const load: LayoutServerLoad = async () => {
    const pageTree = await getPageTree().catch(() => []);
    return { pageTree };
};
