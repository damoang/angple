/**
 * 프로필 이미지 업로드/삭제 프록시
 * POST /api/members/me/image → Go 백엔드 /api/v2/members/me/image
 * DELETE /api/members/me/image → Go 백엔드 /api/v2/members/me/image
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { getAuthUser, verifyToken } from '$lib/server/auth/index.js';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';

async function getAccessToken(
    request: Request,
    cookies: import('@sveltejs/kit').Cookies
): Promise<string> {
    // 1순위: Authorization 헤더
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const payload = await verifyToken(token);
        if (payload?.sub) return token;
    }

    // 2순위: 쿠키 기반 인증 → access_token 쿠키 사용
    const accessToken = cookies.get('access_token');
    if (accessToken) {
        const payload = await verifyToken(accessToken);
        if (payload?.sub) return accessToken;
    }

    // 3순위: getAuthUser fallback
    const authUser = await getAuthUser(cookies);
    if (authUser) {
        // access_token 쿠키가 있으면 사용
        const at = cookies.get('access_token');
        if (at) return at;
    }

    return '';
}

export const POST: RequestHandler = async ({ request, cookies }) => {
    const token = await getAccessToken(request, cookies);
    if (!token) {
        error(401, '로그인이 필요합니다.');
    }

    const formData = await request.formData();
    const file = formData.get('image');
    if (!file || !(file instanceof File)) {
        error(400, '이미지 파일이 필요합니다.');
    }

    // Go 백엔드로 프록시
    const proxyForm = new FormData();
    proxyForm.append('image', file);

    const res = await fetch(`${BACKEND_URL}/api/v2/members/me/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: proxyForm
    });

    const body = await res.json();
    if (!res.ok) {
        error(res.status, body.error || '이미지 업로드에 실패했습니다.');
    }

    return json(body);
};

export const DELETE: RequestHandler = async ({ request, cookies }) => {
    const token = await getAccessToken(request, cookies);
    if (!token) {
        error(401, '로그인이 필요합니다.');
    }

    const res = await fetch(`${BACKEND_URL}/api/v2/members/me/image`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
    });

    const body = await res.json();
    if (!res.ok) {
        error(res.status, body.error || '이미지 삭제에 실패했습니다.');
    }

    return json(body);
};
