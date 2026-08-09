import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

/**
 * 투표 플러그인 API 프록시
 *
 * /api/plugins/poll/* 요청을 Go 백엔드 /api/plugins/poll/* 으로 포워딩.
 * giving 프록시와 같은 골격 — 인증(Bearer + X-Internal-*)을 SSR 세션에서 주입한다.
 * 백엔드가 미배포·다운이어도 위젯이 글 읽기를 막지 않도록 실패는 200 { exists:false } 로 흡수.
 */

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';

function pollFallback(): Response {
    return new Response(
        JSON.stringify({ success: true, data: { exists: false, can_create: false } }),
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }
    );
}

async function proxyRequest(
    method: string,
    params: { path: string },
    request: Request,
    locals: App.Locals
): Promise<Response> {
    const path = params.path || '';
    const url = new URL(request.url);
    // ⛔ path 가 빈 경우(투표 생성 POST /api/plugins/poll)에 슬래시를 붙이면
    //    백엔드 라우트(POST "/api/plugins/poll")와 어긋나 Gin 이 307 리다이렉트를 내고,
    //    리다이렉트를 타며 인증 헤더가 유실돼 생성이 실패한다(실사용자 오류로 확인, 2026-08-09).
    const targetUrl = path
        ? `${BACKEND_URL}/api/plugins/poll/${path}${url.search}`
        : `${BACKEND_URL}/api/plugins/poll${url.search}`;

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

        // SSR 인증 정보 주입 (giving 프록시와 동일)
        if (!headers.has('authorization') && locals.accessToken) {
            headers.set('Authorization', `Bearer ${locals.accessToken}`);
        }
        if (locals.user?.id && locals.sessionId) {
            headers.set('X-Internal-User-ID', locals.user.id);
            headers.set('X-Internal-User-Level', String(locals.user.level || 0));
            headers.set('X-Internal-Auth', 'sveltekit-session');
            headers.set('X-Internal-Secret', env.INTERNAL_SECRET || '');
        }

        let body: BodyInit | null = null;
        if (method !== 'GET' && method !== 'HEAD') {
            body = await request.text();
        }

        const response = await fetch(targetUrl, {
            method,
            headers,
            body,
            signal: AbortSignal.timeout(10_000)
        });

        const responseHeaders = new Headers();
        response.headers.forEach((value, key) => {
            const k = key.toLowerCase();
            if (
                !['content-encoding', 'transfer-encoding', 'connection', 'set-cookie'].includes(k)
            ) {
                responseHeaders.set(key, value);
            }
        });

        return new Response(response.body, {
            status: response.status,
            headers: responseHeaders
        });
    } catch {
        // 백엔드 불가 시: 조회는 무해한 부재 응답, 쓰기는 오류를 그대로 알린다
        if (method === 'GET' && path.startsWith('by-post/')) {
            return pollFallback();
        }
        return new Response(
            JSON.stringify({
                success: false,
                error: { message: '잠시 후 다시 시도해 주세요.' }
            }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

export const GET: RequestHandler = ({ params, request, locals }) =>
    proxyRequest('GET', params, request, locals);
export const POST: RequestHandler = ({ params, request, locals }) =>
    proxyRequest('POST', params, request, locals);
export const DELETE: RequestHandler = ({ params, request, locals }) =>
    proxyRequest('DELETE', params, request, locals);
