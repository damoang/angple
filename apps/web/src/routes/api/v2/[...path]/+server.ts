import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

/**
 * API v2 프록시 핸들러
 *
 * 모든 /api/v2/* 요청을 Backend 서버로 프록시합니다.
 * - SSR accessToken 자동 주입
 * - Set-Cookie 헤더 전달 (httpOnly refreshToken)
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8090';

// 공통 프록시 로직
async function proxyRequest(
    method: string,
    params: { path: string },
    request: Request,
    locals: App.Locals,
    cookies: import('@sveltejs/kit').Cookies
): Promise<Response> {
    const path = params.path || '';
    const url = new URL(request.url);
    const targetUrl = `${BACKEND_URL}/api/v2/${path}${url.search}`;

    try {
        // 헤더 복사 (host 제외)
        const headers = new Headers();
        request.headers.forEach((value, key) => {
            if (key.toLowerCase() !== 'host') {
                headers.set(key, value);
            }
        });

        // SSR accessToken 주입 (클라이언트에서 Authorization 헤더가 없을 때)
        if (!headers.has('authorization') && locals.accessToken) {
            headers.set('Authorization', `Bearer ${locals.accessToken}`);
        }

        // Body 처리 (GET, HEAD는 body 없음)
        let body: BodyInit | null = null;
        if (method !== 'GET' && method !== 'HEAD') {
            const contentType = request.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                body = await request.text();
            } else if (contentType?.includes('multipart/form-data')) {
                body = await request.formData();
                headers.delete('content-type');
            } else {
                body = await request.text();
            }
        }

        const response = await fetch(targetUrl, {
            method,
            headers,
            body,
            // @ts-expect-error - Node.js fetch specific option
            duplex: body instanceof ReadableStream ? 'half' : undefined
        });

        // 응답 헤더 복사 (set-cookie 제외 — SvelteKit cookies API로 별도 처리)
        const responseHeaders = new Headers();
        response.headers.forEach((value, key) => {
            const k = key.toLowerCase();
            if (
                !['content-encoding', 'transfer-encoding', 'connection', 'set-cookie'].includes(k)
            ) {
                responseHeaders.set(key, value);
            }
        });

        // Backend Set-Cookie → SvelteKit cookies API로 전달
        const setCookies = response.headers.getSetCookie?.() ?? [];
        for (const sc of setCookies) {
            const match = sc.match(/^([^=]+)=([^;]*)/);
            if (!match) continue;
            const [, name, value] = match;
            const isRefresh = name === 'refresh_token';
            cookies.set(name, value, {
                path: '/',
                httpOnly: isRefresh,
                sameSite: 'lax',
                secure: !dev,
                maxAge: value ? 60 * 60 * 24 * 7 : 0
            });
        }

        // CORS 헤더
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set(
            'Access-Control-Allow-Methods',
            'GET, POST, PUT, DELETE, PATCH, OPTIONS'
        );
        responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
        });
    } catch (error) {
        console.error('[API Proxy] Error:', error);

        return new Response(
            JSON.stringify({
                error: 'Backend 서버에 연결할 수 없습니다.',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
            {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// HTTP 메서드 핸들러
export const GET: RequestHandler = async ({ params, request, locals, cookies }) => {
    return proxyRequest('GET', params, request, locals, cookies);
};

export const POST: RequestHandler = async ({ params, request, locals, cookies }) => {
    return proxyRequest('POST', params, request, locals, cookies);
};

export const PUT: RequestHandler = async ({ params, request, locals, cookies }) => {
    return proxyRequest('PUT', params, request, locals, cookies);
};

export const PATCH: RequestHandler = async ({ params, request, locals, cookies }) => {
    return proxyRequest('PATCH', params, request, locals, cookies);
};

export const DELETE: RequestHandler = async ({ params, request, locals, cookies }) => {
    return proxyRequest('DELETE', params, request, locals, cookies);
};

export const OPTIONS: RequestHandler = async () => {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    });
};
