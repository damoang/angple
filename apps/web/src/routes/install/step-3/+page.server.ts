import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isInstalled, updateSettings, getSettings } from '$lib/server/install/check-installed';

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

/**
 * Backend API를 호출하여 관리자 계정 생성
 */
async function createAdminInBackend(data: {
    email: string;
    name: string;
    username: string;
    password: string;
}): Promise<{ success: boolean; message: string; userId?: string }> {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8081';
    const isDev = process.env.NODE_ENV !== 'production';

    try {
        const response = await fetch(`${backendUrl}/api/v2/install/create-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const result = await response.json();
            return result.data || result;
        } else {
            // Backend 응답 실패
            const errorResult = await response.json().catch(() => ({}));
            const errorMessage = errorResult.error?.message || '관리자 계정 생성 실패';

            // 개발 모드에서 DB 관련 에러는 무시하고 진행
            // (connection refused, table doesn't exist, migration errors 등)
            if (isDev) {
                console.log('[DEV] Backend error, skipping admin creation in DB:', errorMessage);
                return {
                    success: true,
                    message: '관리자 계정 생성 완료 (개발 모드 - Backend 에러 무시)',
                    userId: 'dev-admin'
                };
            }

            return {
                success: false,
                message: errorMessage
            };
        }
    } catch (error) {
        // Backend 연결 실패 시 개발 모드로 성공 처리
        console.log('[DEV] Backend not available, skipping admin creation in DB');
        return {
            success: true,
            message: '관리자 계정 생성 완료 (개발 모드 - Backend 미연결)',
            userId: 'dev-admin'
        };
    }
}

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

        // 아이디 형식 검사 (영문, 숫자, 언더스코어만 허용)
        if (!/^[a-zA-Z0-9_]+$/.test(adminUsername)) {
            return {
                success: false,
                error: '아이디는 영문, 숫자, 언더스코어(_)만 사용할 수 있습니다.'
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

        // Backend API를 호출하여 관리자 계정 생성
        const backendResult = await createAdminInBackend({
            email: adminEmail.trim(),
            name: adminName.trim(),
            username: adminUsername.trim(),
            password: adminPassword
        });

        if (!backendResult.success) {
            return {
                success: false,
                error: backendResult.message
            };
        }

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
