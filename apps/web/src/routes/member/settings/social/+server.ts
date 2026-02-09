/**
 * 소셜 계정 연결 해제 API
 */
import { json, error as httpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyToken } from '$lib/server/auth/jwt.js';
import {
    deleteSocialProfile,
    getSocialProfilesByMember
} from '$lib/server/auth/oauth/social-profile.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
    // 인증 확인
    const refreshToken = cookies.get('refresh_token');
    if (!refreshToken) {
        throw httpError(401, '로그인이 필요합니다.');
    }

    const payload = await verifyToken(refreshToken);
    if (!payload?.sub) {
        throw httpError(401, '로그인이 필요합니다.');
    }

    const mbId = payload.sub;

    let mpNo: number;
    try {
        const body = await request.json();
        mpNo = Number(body.mp_no);
        if (!mpNo || !Number.isFinite(mpNo)) {
            throw httpError(400, '잘못된 요청입니다.');
        }
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) throw err;
        throw httpError(400, '잘못된 요청 형식입니다.');
    }

    // 연결된 소셜 프로필이 1개 이하면 해제 불가 (로그인 수단이 없어짐)
    const profiles = await getSocialProfilesByMember(mbId);
    if (profiles.length <= 1) {
        return json(
            { success: false, error: '마지막 소셜 계정은 해제할 수 없습니다.' },
            { status: 400 }
        );
    }

    const result = await deleteSocialProfile(mpNo, mbId);
    if (!result) {
        return json({ success: false, error: '소셜 계정 해제에 실패했습니다.' }, { status: 400 });
    }

    return json({ success: true });
};
