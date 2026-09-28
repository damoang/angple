/**
 * KG이니시스 간편인증 요청 페이지
 * sa.inicis.com/auth 로 자동 POST하는 폼 데이터 생성
 */
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import {
    buildCertRequest,
    storeCertPending,
    getMemberCertStateLive,
    logCertAttempt
} from '$lib/server/auth/cert-inicis.js';
import { resolveOrigin } from '$lib/server/auth/oauth/config.js';
import { resolveClientIp } from '$lib/server/rate-limit.js';

export const load: PageServerLoad = async ({ locals, url, request, cookies, getClientAddress }) => {
    if (!locals.user) {
        redirect(303, '/login');
    }

    const mbId = locals.user.id;
    if (!mbId) {
        redirect(303, '/login');
    }

    const pageType = url.searchParams.get('pageType') || 'register';

    // ⭐ 이미 인증된 회원은 인증 창을 열지 않는다 — 실명인증은 **완료 건당 과금**이다.
    //    설정 화면은 인증 완료 회원에게 버튼을 숨기지만 URL 직접 진입은 막지 못했다.
    //    판정은 캐시(locals.user)가 아니라 DB 직독.
    //    「인증됨」 = DI 보유 **그리고** mb_certify 표시 있음. 둘을 함께 보는 이유:
    //    - 탈퇴 처리가 mb_certify 를 비우고 DI 는 남기므로, 복귀한 회원은 「DI 있음·미인증」이 된다.
    //      이들은 재인증으로 mb_certify 를 되살려야 인증 필수 게시판·쪽지·승급이 풀린다 → 열어 둔다
    //      (같은 DI 라 명의불일치 가드를 통과하고, 결과 저장이 mb_certify 를 복구한다).
    //    - 해외인증(abroad)·레거시 회원은 DI 가 없어 어차피 걸리지 않는다.
    //    - 명의가 다른 재인증은 결과 단계의 명의불일치 가드가 거부한다.
    const certState = await getMemberCertStateLive(mbId);
    if (certState?.hasDupinfo && certState.certify !== '') {
        await logCertAttempt({
            mb_id: mbId,
            result: 'already_cert', // ⛔ 컬럼 VARCHAR(16): 'already_certified'(17자)는 조용히 잘렸다
            result_msg: `entry gate pageType=${pageType} certify=${certState.certify}`,
            ip: resolveClientIp(getClientAddress, request) ?? '',
            user_agent: request.headers.get('user-agent') ?? ''
        }).catch(() => {});
        return {
            alreadyCertified: true as const,
            mid: '',
            reqSvcCd: '',
            mTxId: '',
            authHash: '',
            reservedMsg: '',
            mbId,
            successUrl: '',
            failUrl: '',
            pageType
        };
    }

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
        alreadyCertified: false as const,
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
