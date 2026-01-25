import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isInstalled } from '$lib/server/install/check-installed';

/**
 * 설치 완료 페이지 서버 로직
 */

export const load: PageServerLoad = async () => {
    // 설치가 완료되지 않은 경우 Step 1로 리다이렉트
    if (!isInstalled()) {
        throw redirect(302, '/install');
    }

    return {};
};
