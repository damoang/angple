import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types.js';

const COMMERCE_API =
    env.DAMOANG_BACKEND_URL || 'http://damoang-backend-svc.damoang.svc.cluster.local:8090';

/** Commerce API 프록시 — damoang-backend로 전달 */
export const GET: RequestHandler = async ({ params, request, url }) => {
    return proxyRequest('GET', params.path, request, url);
};

export const POST: RequestHandler = async ({ params, request, url }) => {
    return proxyRequest('POST', params.path, request, url);
};

export const PUT: RequestHandler = async ({ params, request, url }) => {
    return proxyRequest('PUT', params.path, request, url);
};

export const PATCH: RequestHandler = async ({ params, request, url }) => {
    return proxyRequest('PATCH', params.path, request, url);
};

export const DELETE: RequestHandler = async ({ params, request, url }) => {
    return proxyRequest('DELETE', params.path, request, url);
};

async function proxyRequest(
    method: string,
    path: string,
    request: Request,
    url: URL
): Promise<Response> {
    const targetUrl = `${COMMERCE_API}/api/plugins/commerce/${path}${url.search}`;

    const headers = new Headers();
    headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');

    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
        headers.set('Authorization', authHeader);
    }

    const cookie = request.headers.get('Cookie');
    if (cookie) {
        headers.set('Cookie', cookie);
    }

    const init: RequestInit = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') {
        init.body = await request.text();
    }

    try {
        const res = await fetch(targetUrl, init);
        return new Response(res.body, {
            status: res.status,
            headers: {
                'Content-Type': res.headers.get('Content-Type') || 'application/json'
            }
        });
    } catch {
        return new Response(JSON.stringify({ error: 'Commerce API unavailable' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
