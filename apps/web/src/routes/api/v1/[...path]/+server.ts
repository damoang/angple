import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import pool from '$lib/server/db';
import type { RowDataPacket } from 'mysql2';
import { invalidateBoardCache } from '$lib/server/ssr-cache.js';
import { internalOnlyErrorResponse, isInternalAppRequest } from '$lib/server/internal-api.js';

/**
 * API v1 프록시 핸들러
 *
 * 모든 /api/v1/* 요청을 Backend 서버로 프록시합니다.
 * - SSR accessToken 자동 주입
 * - Set-Cookie 헤더 전달 (httpOnly refreshToken)
 */

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';
const INTERNAL_ONLY_V1_PREFIXES = ['my/', 'admin/'];

function isExternalBoardReadPath(path: string, method: string): boolean {
    if (method !== 'GET') return false;

    return (
        /^boards\/[a-zA-Z0-9_-]+$/.test(path) ||
        /^boards\/[a-zA-Z0-9_-]+\/display-settings$/.test(path) ||
        /^boards\/[a-zA-Z0-9_-]+\/notices$/.test(path) ||
        /^boards\/[a-zA-Z0-9_-]+\/posts$/.test(path) ||
        /^boards\/[a-zA-Z0-9_-]+\/posts\/\d+$/.test(path) ||
        /^boards\/[a-zA-Z0-9_-]+\/posts\/\d+\/files$/.test(path) ||
        /^boards\/[a-zA-Z0-9_-]+\/posts\/\d+\/likers$/.test(path) ||
        /^boards\/[a-zA-Z0-9_-]+\/posts\/\d+\/revisions$/.test(path)
    );
}

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

/**
 * message 게시판 글 수정 시 celebration_banners 동기화
 * wr_subject(날짜), wr_content, wr_9(이미지) → celebration_banners
 */
async function syncCelebrationBanner(path: string): Promise<void> {
    const match = path.match(/^boards\/message\/posts\/(\d+)$/);
    if (!match) return;

    const wrId = parseInt(match[1], 10);

    // g5_write_message에서 최신 데이터 조회
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT wr_subject, wr_content, wr_9 FROM g5_write_message WHERE wr_id = ?`,
        [wrId]
    );
    if (!rows[0]) return;

    const { wr_subject, wr_content, wr_9 } = rows[0];

    // wr_subject → display_date (2026.03.07 → 2026-03-07)
    const displayDate = wr_subject?.replace(/\./g, '-');
    if (!displayDate || !/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) return;

    // wr_content에서 텍스트만 추출 (HTML 태그 제거)
    const textContent = wr_content
        ?.replace(/<img[^>]*>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();

    // celebration_banners 업데이트
    await pool.execute(
        `UPDATE celebration_banners
         SET display_date = ?, content = ?, image_url = COALESCE(NULLIF(?, ''), image_url),
             title = COALESCE(NULLIF(?, ''), title), updated_at = CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00')
         WHERE source_wr_id = ?`,
        [displayDate, textContent || '', wr_9 || '', textContent || '', wrId]
    );
}

/**
 * 글/댓글 작성 성공 시 g5_board_new에 INSERT
 * angple-backend의 Create()에 이 로직이 빠져있어 SvelteKit에서 보완
 */
async function insertBoardNew(path: string, response: Response, locals: App.Locals): Promise<void> {
    // 글 작성: boards/{boardId}/posts (댓글 아닌 원글만)
    const postMatch = path.match(/^boards\/([a-zA-Z0-9_-]+)\/posts$/);
    // 댓글 작성: boards/{boardId}/posts/{postId}/comments
    const commentMatch = path.match(/^boards\/([a-zA-Z0-9_-]+)\/posts\/(\d+)\/comments$/);

    if (!postMatch && !commentMatch) return;

    let data: { data?: { id?: number; wr_id?: number } };
    try {
        data = await response.json();
    } catch {
        return;
    }

    const wrId = data?.data?.id || data?.data?.wr_id;
    if (!wrId) return;

    const boardId = (postMatch || commentMatch)![1];
    const mbId = locals.user?.id || '';

    if (postMatch) {
        // 원글: wr_parent = wr_id
        await pool.execute(
            `INSERT IGNORE INTO g5_board_new (bo_table, wr_id, wr_parent, bn_datetime, mb_id) VALUES (?, ?, ?, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00'), ?)`,
            [boardId, wrId, wrId, mbId]
        );
    } else if (commentMatch) {
        // 댓글: wr_parent = 원글 ID
        const parentId = parseInt(commentMatch[2], 10);
        await pool.execute(
            `INSERT IGNORE INTO g5_board_new (bo_table, wr_id, wr_parent, bn_datetime, mb_id, wr_is_comment) VALUES (?, ?, ?, NOW(), ?, 1)`,
            [boardId, wrId, parentId, mbId]
        );
    }
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
    const isInternalRequest = isInternalAppRequest(request);

    if (
        INTERNAL_ONLY_V1_PREFIXES.some(
            (prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix)
        )
    ) {
        if (!isInternalRequest) {
            return internalOnlyErrorResponse();
        }
    }

    if (!isInternalRequest && isExternalBoardReadPath(path, method)) {
        return internalOnlyErrorResponse(
            '외부 요청은 게시판 목록/상세 API를 직접 호출할 수 없습니다.'
        );
    }

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
            'transfer-encoding',
            'origin'
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
            headers.set('X-Internal-Secret', env.INTERNAL_SECRET || '');
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

        // CORS는 hooks.server.ts에서 통합 처리 (여기서 중복 설정 제거)
        responseHeaders.set(
            'Access-Control-Allow-Methods',
            'GET, POST, PUT, DELETE, PATCH, OPTIONS'
        );
        responseHeaders.set(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, X-CSRF-Token'
        );

        // 글/댓글 작성 성공 시 g5_board_new에 INSERT (angple-backend에 누락된 로직 보완)
        if (method === 'POST' && response.status >= 200 && response.status < 300) {
            insertBoardNew(path, response.clone(), locals).catch((err) => {
                console.error('[API Proxy] g5_board_new insert error:', err);
            });
        }

        // message 게시판 글 수정 시 celebration_banners 동기화
        if (method === 'PUT' && response.status >= 200 && response.status < 300) {
            syncCelebrationBanner(path).catch((err) => {
                console.error('[API Proxy] celebration sync error:', err);
            });
        }

        // 글/댓글 작성·수정·삭제 성공 시 SSR 캐시 무효화 (비로그인 사용자도 즉시 반영)
        if (
            (method === 'POST' || method === 'PUT' || method === 'DELETE') &&
            response.status >= 200 &&
            response.status < 300
        ) {
            const boardMatch = path.match(/^boards\/([a-zA-Z0-9_-]+)\/posts/);
            if (boardMatch) {
                const postIdMatch = path.match(/^boards\/[a-zA-Z0-9_-]+\/posts\/(\d+)/);
                invalidateBoardCache(
                    boardMatch[1],
                    postIdMatch ? parseInt(postIdMatch[1], 10) : undefined
                );
            }
        }

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
