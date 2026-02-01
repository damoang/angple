import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * 마이페이지 보호 레이아웃
 * 미인증 시 /login?redirect=... 으로 리다이렉트
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
    if (!locals.user) {
        throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
    }

    return {
        user: locals.user
    };
};
