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

    // 차단된 게시판 접근 거부
    const blockedBoards = ['black', 'archive', 'cp_qna', 'cp_forum', 'cp_forum2', 'piano'];
    const boardMatch = path.match(/^boards\/([^/]+)/);
    if (boardMatch && blockedBoards.includes(boardMatch[1])) {
        return new Response(JSON.stringify({ success: false, error: '접근할 수 없는 게시판입니다' }), {
            status: 403, headers: { 'Content-Type': 'application/json' }
        });
    }

    // 이미지 업로드 가로채기 (muzia 전용 — core 프록시 대신 직접 처리)
    if (path.match(/^boards\/[^/]+\/upload\/image$/) && method === 'POST') {
        try {
            const { getUserFromRequest, getMbId } = await import('$lib/server/db/auth');
            const crypto = await import('crypto');
            const fs = await import('fs');
            const pathMod = await import('path');
            const user = getUserFromRequest(request);
            if (!user) return new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: '로그인 필요' } }), { status: 401, headers: { 'Content-Type': 'application/json' } });
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            if (!file || !file.size) return new Response(JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: '파일 없음' } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const dateDir = new Date().toISOString().slice(0, 7).replace('-', '');
            const fileName = `cmt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
            const UPLOAD_DIR = '/app/gnuboard-data/editor';
            const dirPath = pathMod.join(UPLOAD_DIR, dateDir);
            if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
            fs.writeFileSync(pathMod.join(dirPath, fileName), Buffer.from(await file.arrayBuffer()));
            const fileUrl = `https://muzia.net/data/editor/${dateDir}/${fileName}`;
            return new Response(JSON.stringify({ success: true, data: { url: fileUrl, filename: fileName, size: file.size } }), { headers: { 'Content-Type': 'application/json' } });
        } catch (e: any) {
            console.error('[Upload via Proxy] error:', e?.message);
            return new Response(JSON.stringify({ success: false, error: { code: 'SERVER_ERROR', message: '업로드 실패' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    // v2 boards/posts → v1로 리라이팅 (v2 스키마 미지원 시)
    const isV1Board = path.startsWith('boards/') && !path.startsWith('boards/create');
    const apiVersion = isV1Board ? 'v1' : 'v2';
    const targetUrl = `${BACKEND_URL}/api/${apiVersion}/${path}${url.search}`;

    console.log(`[API Proxy] ${method} ${url.pathname} → ${targetUrl}`);

    try {
        // 헤더 복사 (hop-by-hop 헤더 제외)
        const headers = new Headers();
        const skipHeaders = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'origin', 'referer']);
        request.headers.forEach((value, key) => {
            if (!skipHeaders.has(key.toLowerCase())) {
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

        // OAuth 리다이렉트는 따라가지 않고 클라이언트에 전달
        const isOAuth = path.startsWith('auth/oauth');

        const response = await fetch(targetUrl, {
            method,
            headers,
            body,
            redirect: isOAuth ? 'manual' : 'follow',
            // @ts-expect-error - Node.js fetch specific option
            duplex: body instanceof ReadableStream ? 'half' : undefined
        });

        // OAuth 리다이렉트 → 클라이언트에 302로 전달 (모든 Set-Cookie 포함)
        if (isOAuth && (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308)) {
            const location = response.headers.get('location');
            if (location) {
                const redirectHeaders = new Headers({ 'Location': location });
                // getSetCookie()로 모든 Set-Cookie 헤더 전달 (oauth_state 등)
                const cookies = response.headers.getSetCookie?.() ?? [];
                if (cookies.length > 0) {
                    cookies.forEach(c => redirectHeaders.append('Set-Cookie', c));
                } else {
                    const fallback = response.headers.get('set-cookie');
                    if (fallback) redirectHeaders.append('Set-Cookie', fallback);
                }
                return new Response(null, { status: 302, headers: redirectHeaders });
            }
        }

        // OAuth 콜백 성공 → access_token을 쿠키에 저장하고 홈으로 리다이렉트
        if (isOAuth && path.includes('/callback') && response.status === 200) {
            try {
                const data = await response.json();
                if (data?.data?.access_token) {
                    const token = data.data.access_token;
                    // XSS 방지: JSON.stringify로 안전하게 토큰 삽입
                    const safeToken = JSON.stringify(token);

                    const html = `<!DOCTYPE html><html><head><title>로그인 중...</title></head><body>
                        <script>
                            try {
                                var t = ${safeToken};
                                localStorage.setItem('access_token', t);
                                document.cookie = 'damoang_jwt=' + t + '; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax';
                            } catch(e) { console.error('Token storage failed:', e); }
                            window.location.replace('/');
                        </script>
                        <p>로그인 중입니다...</p>
                    </body></html>`;

                    const respHeaders = new Headers({
                        'Content-Type': 'text/html; charset=utf-8',
                    });
                    // damoang_jwt 쿠키도 서버 측에서 설정 (JS 차단 대비)
                    respHeaders.append('Set-Cookie', `damoang_jwt=${token}; Path=/; Max-Age=${7 * 24 * 3600}; SameSite=Lax`);

                    return new Response(html, { status: 200, headers: respHeaders });
                }
            } catch { /* JSON 파싱 실패 시 원본 응답 반환 */ }
        }

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
