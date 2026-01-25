import type { RequestHandler } from './$types';

/**
 * API v2 프록시 핸들러
 *
 * 모든 /api/v2/* 요청을 Backend 서버(localhost:8081)로 프록시합니다.
 * WordPress 스타일로 단일 URL에서 모든 것을 제공하기 위함입니다.
 *
 * 예시:
 * - /api/v2/health → http://localhost:8081/api/v2/health
 * - /api/v2/boards/free/posts → http://localhost:8081/api/v2/boards/free/posts
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8081';

// 공통 프록시 로직
async function proxyRequest(
    method: string,
    params: { path: string },
    request: Request
): Promise<Response> {
    const path = params.path || '';
    const url = new URL(request.url);
    const targetUrl = `${BACKEND_URL}/api/v2/${path}${url.search}`;

    console.log(`[API Proxy] ${method} ${url.pathname} → ${targetUrl}`);

    try {
        // 헤더 복사 (host 제외)
        const headers = new Headers();
        request.headers.forEach((value, key) => {
            if (key.toLowerCase() !== 'host') {
                headers.set(key, value);
            }
        });

        // Body 처리 (GET, HEAD는 body 없음)
        let body: BodyInit | null = null;
        if (method !== 'GET' && method !== 'HEAD') {
            const contentType = request.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                body = await request.text();
            } else if (contentType?.includes('multipart/form-data')) {
                // FormData는 그대로 전달 (Content-Type 헤더 제거하여 fetch가 자동 설정)
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

        // 응답 헤더 복사
        const responseHeaders = new Headers();
        response.headers.forEach((value, key) => {
            // CORS 및 일부 hop-by-hop 헤더 제외
            if (
                !['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())
            ) {
                responseHeaders.set(key, value);
            }
        });

        // CORS 헤더 추가
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
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
}

// HTTP 메서드 핸들러
export const GET: RequestHandler = async ({ params, request }) => {
    return proxyRequest('GET', params, request);
};

export const POST: RequestHandler = async ({ params, request }) => {
    return proxyRequest('POST', params, request);
};

export const PUT: RequestHandler = async ({ params, request }) => {
    return proxyRequest('PUT', params, request);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
    return proxyRequest('PATCH', params, request);
};

export const DELETE: RequestHandler = async ({ params, request }) => {
    return proxyRequest('DELETE', params, request);
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
