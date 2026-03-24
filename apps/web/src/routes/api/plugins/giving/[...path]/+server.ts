import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

/**
 * 나눔 플러그인 API 프록시
 *
 * /api/plugins/giving/* 요청을 Go 백엔드 /api/plugins/giving/* 으로 포워딩
 */

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';
const COOKIE_DOMAIN = env.COOKIE_DOMAIN || '';

function buildGivingFallback(path: string): Response | null {
    if (path === 'list' || path.startsWith('list/')) {
        return new Response(JSON.stringify({ success: true, data: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return null;
}

async function proxyRequest(
    method: string,
    params: { path: string },
    request: Request,
    locals: App.Locals,
    cookies: import('@sveltejs/kit').Cookies
): Promise<Response> {
    const path = params.path || '';
    const url = new URL(request.url);
    const targetUrl = `${BACKEND_URL}/api/plugins/giving/${path}${url.search}`;

    try {
        const headers = new Headers();
        const skipHeaders = new Set([
            'host',
            'connection',
            'upgrade',
            'keep-alive',
            'transfer-encoding'
        ]);
        request.headers.forEach((value, key) => {
            if (!skipHeaders.has(key.toLowerCase())) {
                headers.set(key, value);
            }
        });

        // SSR 인증 정보 주입
        if (!headers.has('authorization') && locals.accessToken) {
            headers.set('Authorization', `Bearer ${locals.accessToken}`);
        }

        if (locals.user?.id && locals.sessionId) {
            headers.set('X-Internal-User-ID', locals.user.id);
            headers.set('X-Internal-User-Level', String(locals.user.level || 0));
            headers.set('X-Internal-Auth', 'sveltekit-session');
            headers.set('X-Internal-Secret', env.INTERNAL_SECRET || '');
        }

        // Body 처리
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
            signal: AbortSignal.timeout(10_000),
            // @ts-expect-error - Node.js fetch specific option
            duplex: body instanceof ReadableStream ? 'half' : undefined
        });

        // 응답 헤더 복사
        const responseHeaders = new Headers();
        response.headers.forEach((value, key) => {
            const k = key.toLowerCase();
            if (
                !['content-encoding', 'transfer-encoding', 'connection', 'set-cookie'].includes(k)
            ) {
                responseHeaders.set(key, value);
            }
        });

        // Backend Set-Cookie → SvelteKit cookies API
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
                maxAge: value ? 60 * 60 * 24 * 7 : 0,
                ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {})
            });
        }

        // CORS 헤더
        const origin = request.headers.get('origin');
        if (origin) {
            responseHeaders.set('Access-Control-Allow-Origin', origin);
            responseHeaders.set('Access-Control-Allow-Credentials', 'true');
        } else {
            responseHeaders.set('Access-Control-Allow-Origin', '*');
        }
        responseHeaders.set(
            'Access-Control-Allow-Methods',
            'GET, POST, PUT, DELETE, PATCH, OPTIONS'
        );
        responseHeaders.set(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, X-CSRF-Token'
        );

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
        });
    } catch (error) {
        console.error('[Giving API Proxy] Error:', error);

        const fallback = method === 'GET' ? buildGivingFallback(path) : null;
        if (fallback) {
            return fallback;
        }

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

export const GET: RequestHandler = async ({ params, request, locals, cookies }) => {
    return proxyRequest('GET', params, request, locals, cookies);
};

export const POST: RequestHandler = async ({ params, request, locals, cookies }) => {
    return proxyRequest('POST', params, request, locals, cookies);
};

export const PUT: RequestHandler = async ({ params, request, locals, cookies }) => {
    return proxyRequest('PUT', params, request, locals, cookies);
};

export const DELETE: RequestHandler = async ({ params, request, locals, cookies }) => {
    return proxyRequest('DELETE', params, request, locals, cookies);
};

export const OPTIONS: RequestHandler = async ({ request }) => {
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
        'Access-Control-Max-Age': '86400'
    };
    if (origin) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
    } else {
        headers['Access-Control-Allow-Origin'] = '*';
    }
    return new Response(null, { status: 204, headers });
};
