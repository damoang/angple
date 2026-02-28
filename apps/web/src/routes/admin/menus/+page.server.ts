import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import type { Menu } from '$lib/types/admin-menu';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8090';

export const load: PageServerLoad = async ({ locals }) => {
    // 로그인 확인
    if (!locals.user) {
        throw redirect(302, '/login?redirect=/admin/menus');
    }

    // 관리자 권한 확인 (레벨 10 이상)
    if ((locals.user.level ?? 0) < 10) {
        throw redirect(302, '/?error=forbidden');
    }

    // 메뉴 데이터 로드 (서버에서)
    let menus: Menu[] = [];

    if (locals.accessToken) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/v1/admin/menus`, {
                headers: {
                    Authorization: `Bearer ${locals.accessToken}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                menus = result.data ?? [];
            }
        } catch (error) {
            console.error('[Admin Menus] Failed to load menus:', error);
        }
    }

    return {
        menus,
        user: locals.user
    };
};
