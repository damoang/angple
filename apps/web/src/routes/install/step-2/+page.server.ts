import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isInstalled, updateSettings } from '$lib/server/install/check-installed';

/**
 * 설치 위저드 Step 2 서버 로직 - 데이터베이스 설정
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

        const dbHost = formData.get('dbHost') as string;
        const dbPort = formData.get('dbPort') as string;
        const dbName = formData.get('dbName') as string;
        const dbUser = formData.get('dbUser') as string;
        const dbPassword = formData.get('dbPassword') as string;

        // 유효성 검사
        if (!dbHost || dbHost.trim() === '') {
            return {
                success: false,
                error: '데이터베이스 호스트는 필수입니다.'
            };
        }

        if (!dbPort || isNaN(parseInt(dbPort))) {
            return {
                success: false,
                error: '올바른 포트 번호를 입력해주세요.'
            };
        }

        if (!dbName || dbName.trim() === '') {
            return {
                success: false,
                error: '데이터베이스 이름은 필수입니다.'
            };
        }

        if (!dbUser || dbUser.trim() === '') {
            return {
                success: false,
                error: '데이터베이스 사용자 이름은 필수입니다.'
            };
        }

        // DB 설정 저장
        const updated = updateSettings({
            database: {
                host: dbHost.trim(),
                port: parseInt(dbPort),
                name: dbName.trim(),
                user: dbUser.trim(),
                // 비밀번호는 환경변수나 별도 보안 저장소에 저장하는 것이 좋음
                // 여기서는 일단 settings.json에 저장 (개발/데모용)
                password: dbPassword || ''
            }
        });

        if (!updated) {
            return {
                success: false,
                error: '설정 저장에 실패했습니다.'
            };
        }

        // Step 3 (관리자 계정)로 이동
        throw redirect(302, '/install/step-3');
    }
};
