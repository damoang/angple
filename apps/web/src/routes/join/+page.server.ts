import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getCertConfig } from '$lib/server/auth/cert-inicis.js';

export const load: PageServerLoad = async ({ locals, cookies }) => {
    // 로그인 상태면 홈으로 리다이렉트
    if (locals.user) {
        redirect(302, '/');
    }

    // 실명인증 설정 로드
    const certConfig = await getCertConfig();

    // 인증 완료 데이터가 쿠키에 있는지 확인
    let certData = null;
    const pendingCert = cookies.get('pending_cert_data');
    if (pendingCert) {
        try {
            certData = JSON.parse(pendingCert);
        } catch {
            // 잘못된 데이터 무시
        }
    }

    return {
        certEnabled: certConfig.certUse > 0,
        certRequired: certConfig.certReq === 1,
        certData
    };
};
