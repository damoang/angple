import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';
import { getSession, SESSION_COOKIE_NAME } from '$lib/server/auth/session-store.js';
import { getMemberById } from '$lib/server/auth/oauth/member.js';
import { setDamoangSSOCookie } from '$lib/server/auth/sso-cookie.js';

function corsHeaders(origin: string | null): HeadersInit {
    if (!origin || !origin.endsWith('.damoang.net')) return {};
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin'
    };
}

export const POST: RequestHandler = async ({ cookies, request }) => {
    const headers = corsHeaders(request.headers.get('origin'));
    const sessionId = cookies.get(SESSION_COOKIE_NAME);
    if (!sessionId) {
        return json({ success: false, message: '세션이 없습니다.' }, { status: 401, headers });
    }

    const session = await getSession(sessionId);
    if (!session) {
        return json(
            { success: false, message: '세션이 만료되었습니다.' },
            { status: 401, headers }
        );
    }

    const member = await getMemberById(session.mbId);
    if (!member) {
        return json(
            { success: false, message: '사용자 정보를 찾을 수 없습니다.' },
            { status: 401, headers }
        );
    }

    await setDamoangSSOCookie(cookies, {
        mb_id: member.mb_id,
        mb_level: member.mb_level ?? 0,
        mb_name: member.mb_name || member.mb_nick,
        mb_email: member.mb_email
    });

    return new Response(null, { status: 204, headers });
};
