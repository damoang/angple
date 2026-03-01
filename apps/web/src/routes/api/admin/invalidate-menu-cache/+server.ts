import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { invalidateMenuCache } from '$lib/server/menu-loader';

/**
 * 메뉴 캐시 무효화 API
 * 관리자가 메뉴를 변경한 후 호출하여 SSR 캐시를 즉시 갱신합니다.
 */
export const POST: RequestHandler = async ({ locals }) => {
    if (!locals.user || locals.user.level < 10) {
        return json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    invalidateMenuCache();
    return json({ success: true });
};
