/**
 * KG이니시스 간편인증 요청 페이지
 * sa.inicis.com/auth 로 자동 POST하는 폼 데이터 생성
 */
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { buildCertRequest, storeCertPending } from '$lib/server/auth/cert-inicis.js';
import { resolveOrigin } from '$lib/server/auth/oauth/config.js';

export const load: PageServerLoad = async ({ locals, url, request, cookies }) => {
    if (!locals.user) {
        redirect(303, '/login');
    }

    const mbId = locals.user.id;
    if (!mbId) {
        redirect(303, '/login');
    }

    const pageType = url.searchParams.get('pageType') || 'register';
    const certData = await buildCertRequest();

    // mid 값 검증 - 빈 값이면 경고 로그
    if (!certData.mid) {
        console.error(
            '[Cert:init] ERROR: MID is empty! Check cf_cert_kg_mid in g5_config or CERT_INICIS_TEST_MID env var'
        );
    }

    // mTxId → mbId 매핑을 DB에 저장 (cross-origin POST에서 쿠키 신뢰 불가)
    await storeCertPending(certData.mTxId, mbId);

    // 백업: sameSite=none 쿠키로도 mbId 저장 (third-party cookie 허용 시 사용)
    cookies.set('cert_pending_mbid', mbId, {
        path: '/',
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        maxAge: 60 * 5
    });

    // 결과 수신 URL (dev에서도 HTTPS origin 사용)
    const origin = resolveOrigin(request);
    const resultUrl = `${origin}/cert/inicis/result`;

    return {
        mid: certData.mid,
        reqSvcCd: certData.reqSvcCd,
        mTxId: certData.mTxId,
        authHash: certData.authHash,
        reservedMsg: certData.reservedMsg,
        mbId,
        successUrl: resultUrl,
        failUrl: resultUrl,
        pageType
    };
};
