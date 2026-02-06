import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isInstalled, updateSettings } from '$lib/server/install/check-installed';

/**
 * 설치 위저드 Step 3 서버 로직 - 관리자 계정 생성
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

        const adminEmail = formData.get('adminEmail') as string;
        const adminName = formData.get('adminName') as string;
        const adminUsername = formData.get('adminUsername') as string;
        const adminPassword = formData.get('adminPassword') as string;
        const adminPasswordConfirm = formData.get('adminPasswordConfirm') as string;

        // 유효성 검사
        if (!adminEmail || !adminEmail.includes('@')) {
            return {
                success: false,
                error: '올바른 이메일 주소를 입력해주세요.'
            };
        }

        if (!adminName || adminName.trim() === '') {
            return {
                success: false,
                error: '관리자 이름은 필수입니다.'
            };
        }

        if (!adminUsername || adminUsername.trim() === '') {
            return {
                success: false,
                error: '관리자 아이디는 필수입니다.'
            };
        }

        if (!adminPassword || adminPassword.length < 8) {
            return {
                success: false,
                error: '비밀번호는 8자 이상이어야 합니다.'
            };
        }

        if (adminPassword !== adminPasswordConfirm) {
            return {
                success: false,
                error: '비밀번호가 일치하지 않습니다.'
            };
        }

        // TODO: 실제로는 Backend API를 호출하여 관리자 계정 생성
        // await createAdminUser({ email: adminEmail, name: adminName, password: adminPassword });

        // 설치 완료 표시
        const updated = updateSettings({
            installed: true,
            adminEmail: adminEmail.trim(),
            adminName: adminName.trim(),
            adminUsername: adminUsername.trim()
            // 비밀번호는 settings.json에 저장하지 않음 (Backend에서 처리)
        });

        if (!updated) {
            return {
                success: false,
                error: '설정 저장에 실패했습니다.'
            };
        }

        // 완료 페이지로 이동
        throw redirect(302, '/install/complete');
    }
};
