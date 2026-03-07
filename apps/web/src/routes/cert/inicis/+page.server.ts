/**
 * KG이니시스 간편인증 요청 페이지
 * sa.inicis.com/auth 로 자동 POST하는 폼 데이터 생성
 */
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { buildCertRequest } from '$lib/server/auth/cert-inicis.js';

export const load: PageServerLoad = async ({ locals, url }) => {
    if (!locals.user) {
        redirect(303, '/login');
    }

    const pageType = url.searchParams.get('pageType') || 'register';
    const certData = await buildCertRequest();

    // 결과 수신 URL
    const origin = url.origin;
    const resultUrl = `${origin}/cert/inicis/result`;

    return {
        mid: certData.mid,
        reqSvcCd: certData.reqSvcCd,
        mTxId: certData.mTxId,
        authHash: certData.authHash,
        reservedMsg: certData.reservedMsg,
        mbId: locals.user.mb_id,
        successUrl: resultUrl,
        failUrl: resultUrl,
        pageType
    };
};
