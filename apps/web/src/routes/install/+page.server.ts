import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isInstalled, updateSettings } from '$lib/server/install/check-installed';

/**
 * 설치 위저드 Step 1 서버 로직
 */

export const load: PageServerLoad = async () => {
    // 이미 설치 완료된 경우 홈으로 리다이렉트
    if (isInstalled()) {
        throw redirect(302, '/');
    }

    return {};
};

export const actions: Actions = {
    default: async ({ request }) => {
        const formData = await request.formData();

        const siteName = formData.get('siteName') as string;
        const siteDescription = formData.get('siteDescription') as string;
        const siteUrl = formData.get('siteUrl') as string;

        if (!siteName || siteName.trim() === '') {
            return {
                success: false,
                error: '사이트 이름은 필수입니다.'
            };
        }

        // 설정 저장 (Step 1 데이터)
        const updated = updateSettings({
            siteName: siteName.trim(),
            siteDescription: siteDescription?.trim() || '',
            siteUrl: siteUrl?.trim() || ''
        });

        if (!updated) {
            return {
                success: false,
                error: '설정 저장에 실패했습니다.'
            };
        }

        // Step 2로 이동
        throw redirect(302, '/install/step-2');
    }
};
