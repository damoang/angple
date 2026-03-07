/**
 * KG이니시스 실명인증 요청 페이지 (팝업)
 * PHP ini_request.php 대응
 */
import type { PageServerLoad } from './$types';
import { generateRequestParams, getCertConfig } from '$lib/server/auth/cert-inicis.js';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ url }) => {
    const config = await getCertConfig();

    // 인증 비활성화 체크
    if (!config.certUse) {
        error(403, '실명인증이 비활성화되어 있습니다.');
    }

    const pageType = url.searchParams.get('pageType') || 'register';

    // 콜백 URL 결정 (리버스 프록시 뒤에서 http로 잡히는 경우 https로 강제)
    const origin = url.origin.replace(/^http:\/\//, 'https://');
    const callbackUrl = `${origin}/cert/inicis/result?pageType=${pageType}`;

    const params = await generateRequestParams(callbackUrl);

    return {
        params,
        pageType
    };
};
