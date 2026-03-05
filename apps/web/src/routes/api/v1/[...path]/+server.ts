import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import pool from '$lib/server/db';
import type { RowDataPacket } from 'mysql2';

/**
 * API v1 프록시 핸들러
 *
 * 모든 /api/v1/* 요청을 Backend 서버로 프록시합니다.
 * - SSR accessToken 자동 주입
 * - Set-Cookie 헤더 전달 (httpOnly refreshToken)
 */

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';

// 쿠키 도메인: Go 백엔드 cookieDomain()과 일치 (쿠키 충돌 방지)
const COOKIE_DOMAIN = env.COOKIE_DOMAIN || '';

/**
 * 댓글 수정 시 대댓글 존재 여부 확인
 * 대댓글이 달린 댓글은 수정 불가 (삭제는 허용)
 */
async function checkCommentHasReplies(path: string): Promise<Response | null> {
    const commentMatch = path.match(/^boards\/([a-zA-Z0-9_-]+)\/posts\/(\d+)\/comments\/(\d+)$/);
    if (!commentMatch) return null;

    const [, boardId, postId, commentId] = commentMatch;
    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    try {
        // 그누보드: 같은 wr_parent(글 ID) 아래에서 wr_comment(댓글 그룹)와 wr_comment_reply로 계층 구조
        // 해당 댓글의 wr_comment 값을 가져와서 같은 그룹에 wr_comment_reply가 더 긴 댓글이 있는지 확인
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT wr_comment, wr_comment_reply FROM ?? WHERE wr_id = ? AND wr_is_comment >= 1`,
            [`g5_write_${safeBoardId}`, parseInt(commentId, 10)]
        );
        if (!rows[0]) return null;

        const { wr_comment, wr_comment_reply } = rows[0];
        const replyPrefix = wr_comment_reply || '';

        // 같은 댓글 그룹(wr_comment)에서 wr_comment_reply가 현재보다 긴(자식) 댓글 존재 확인
        const [replyRows] = await pool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as cnt FROM ?? WHERE wr_parent = ? AND wr_comment = ? AND wr_comment_reply LIKE ? AND wr_comment_reply != ? AND wr_is_comment >= 1`,
            [
                `g5_write_${safeBoardId}`,
                parseInt(postId, 10),
                wr_comment,
                `${replyPrefix}%`,
                replyPrefix
            ]
        );
        if (replyRows[0]?.cnt > 0) {
            return new Response(
                JSON.stringify({ error: '답글이 달린 댓글은 수정할 수 없습니다.' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }
    } catch {
        // DB 조회 실패 시 백엔드에 위임
    }
    return null;
}

/**
 * 글/댓글 수정·삭제 시 본인 확인
 * 경로 패턴: boards/{boardId}/posts/{postId} 또는 boards/{boardId}/posts/{postId}/comments/{commentId}
 * 본인이 아니면 403 Response 반환, 본인이면 null 반환
 */
async function checkWriteAuthor(path: string, userId: string): Promise<Response | null> {
    // boards/{boardId}/posts/{postId}/comments/{commentId} — 댓글 수정/삭제
    const commentMatch = path.match(/^boards\/([a-zA-Z0-9_-]+)\/posts\/\d+\/comments\/(\d+)$/);
    if (commentMatch) {
        const [, boardId, commentId] = commentMatch;
        const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT mb_id FROM ?? WHERE wr_id = ? AND wr_is_comment >= 1`,
                [`g5_write_${safeBoardId}`, parseInt(commentId, 10)]
            );
            if (rows[0] && rows[0].mb_id !== userId) {
                return new Response(
                    JSON.stringify({ error: '본인이 작성한 댓글만 수정/삭제할 수 있습니다.' }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                );
            }
        } catch {
            // DB 조회 실패 시 백엔드에 위임
        }
        return null;
    }

    // boards/{boardId}/posts/{postId} — 글 수정/삭제
    const postMatch = path.match(/^boards\/([a-zA-Z0-9_-]+)\/posts\/(\d+)$/);
    if (postMatch) {
        const [, boardId, postId] = postMatch;
        const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT mb_id FROM ?? WHERE wr_id = ? AND wr_is_comment = 0`,
                [`g5_write_${safeBoardId}`, parseInt(postId, 10)]
            );
            if (rows[0] && rows[0].mb_id !== userId) {
                return new Response(
                    JSON.stringify({ error: '본인이 작성한 글만 수정/삭제할 수 있습니다.' }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                );
            }
        } catch {
            // DB 조회 실패 시 백엔드에 위임
        }
        return null;
    }

    return null;
}

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
    const targetUrl = `${BACKEND_URL}/api/v1/${path}${url.search}`;

    // 댓글 수정 시 대댓글 존재 확인 (관리자 포함 모두 차단)
    if (method === 'PUT') {
        const replyCheckResult = await checkCommentHasReplies(path);
        if (replyCheckResult) {
            return replyCheckResult; // 403 Response
        }
    }

    // 글/댓글 수정/삭제 시 본인 확인 (관리자 레벨 10 이상은 통과)
    if ((method === 'PUT' || method === 'DELETE') && locals.user?.id) {
        const userLevel = locals.user.level ?? 0;
        if (userLevel < 10) {
            const authorCheckResult = await checkWriteAuthor(path, locals.user.id);
            if (authorCheckResult) {
                return authorCheckResult; // 403 Response
            }
        }
    }

    try {
        // 헤더 복사 (프록시 관련 헤더 제외)
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

        // SSR 인증 정보 주입 (두 가지 방식)
        // 1. JWT Authorization 헤더 (기존 방식)
        if (!headers.has('authorization') && locals.accessToken) {
            headers.set('Authorization', `Bearer ${locals.accessToken}`);
        }

        // 2. 내부 신뢰 헤더 (세션 인증을 거친 SvelteKit → 백엔드 통신용)
        // 공유 시크릿 포함 (CloudFront가 직접 백엔드로 라우팅하는 경우 대비)
        if (locals.user?.id && locals.sessionId) {
            headers.set('X-Internal-User-ID', locals.user.id);
            headers.set('X-Internal-User-Level', String(locals.user.level || 0));
            headers.set('X-Internal-Auth', 'sveltekit-session');
            headers.set('X-Internal-Secret', 'angple-internal-dev-2026');
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
            signal: AbortSignal.timeout(10_000),
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
                maxAge: value ? 60 * 60 * 24 * 7 : 0,
                ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {})
            });
        }

        // CORS 헤더 (credentials: include 지원을 위해 구체적인 origin 사용)
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
