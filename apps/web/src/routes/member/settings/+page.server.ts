/**
 * 회원 설정 페이지 - 소셜 계정 관리
 */
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { verifyToken } from '$lib/server/auth/jwt.js';
import { getSocialProfilesByMember } from '$lib/server/auth/oauth/social-profile.js';

export const load: PageServerLoad = async ({ cookies }) => {
    // 인증 확인 (refresh_token에서 사용자 정보 추출)
    const refreshToken = cookies.get('refresh_token');
    if (!refreshToken) {
        redirect(302, '/login?redirect=/member/settings');
    }

    const payload = await verifyToken(refreshToken);
    if (!payload?.sub) {
        redirect(302, '/login?redirect=/member/settings');
    }

    const mbId = payload.sub;

    // 연결된 소셜 프로필 조회
    const profiles = await getSocialProfilesByMember(mbId);

    return {
        mbId,
        socialProfiles: profiles.map((p) => ({
            mpNo: p.mp_no,
            provider: p.provider,
            displayname: p.displayname,
            identifier: p.identifier,
            registeredAt: p.mp_register_day,
            latestAt: p.mp_latest_day
        }))
    };
};
