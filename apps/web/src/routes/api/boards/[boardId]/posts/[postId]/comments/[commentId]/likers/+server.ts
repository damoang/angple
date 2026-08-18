/**
 * 댓글 추천자 목록 API
 * GET /api/boards/[boardId]/posts/[postId]/comments/[commentId]/likers
 *
 * g5_board_good 테이블에서 해당 댓글의 추천자 목록 조회
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { checkRateLimit, recordAttempt, resolveClientIp } from '$lib/server/rate-limit.js';
import { getAuthUser } from '$lib/server/auth';
import { getRedis } from '$lib/server/redis';
import { isInternalAppRequest } from '$lib/server/internal-api.js';
import { getCommentLikersVersion } from '$lib/server/member-activity-cache';

const COMMENT_LIKERS_CACHE_TTL_SEC = 15;
// 공감자 목록 페이지 크기. **요청자와 무관하게 동일하다.**
// ⛔ 예전에는 외부 요청을 5페이지까지로 막았다(MAX_EXTERNAL_COMMENT_LIKERS_PAGE).
//    댓글·좋아요배치와 같은 이유로 걷어낸다 — 절단은 캐시 오염으로 이미 무력했고
//    헤더가 제거되는 정상 클라이언트만 막고 있었다. 남용은 rate-limit 으로 막는다.
const COMMENT_LIKERS_LIMIT = 50;

// 외부 요청 rate-limit — 댓글·글 목록과 같은 기준.
// ⚠️ checkRateLimit 은 파드 in-memory 라 실효 한도는 (이 값 × 파드 수) 다.
const EXTERNAL_LIKERS_RATE_LIMIT = 60; // 분당 60회
const EXTERNAL_LIKERS_RATE_WINDOW_MS = 60_000;

// bg_datetime 이 null / '' / '0000-...' 일 때 Invalid Date 로 렌더되어
// "va.id.Da" (minified "Invalid Date") 로 보이는 버그 방지.
function toSafeIso(raw: unknown): string {
    const s = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
    if (!s || s.startsWith('0000')) return '';
    return s.replace(' ', 'T') + 'Z';
}

/** IP 마스킹: 두 번째 옥텟을 ♡로 (예: 222.114.55.158 → 222.♡.55.158) */
function maskIp(ip: string | null | undefined): string {
    if (!ip) return '';
    const parts = ip.split('.');
    if (parts.length === 4) {
        parts[1] = '♡';
        return parts.join('.');
    }
    return ip.slice(0, 3) + '.♡';
}

interface LikerRow extends RowDataPacket {
    mb_id: string;
    mb_nick: string;
    mb_image_url: string;
    mb_image_updated_at: string | null;
    bg_ip: string;
    bg_datetime: string;
}

interface CountRow extends RowDataPacket {
    total: number;
}

export const GET: RequestHandler = async ({ params, url, cookies, request, getClientAddress }) => {
    const { boardId, commentId } = params;

    if (!boardId || !commentId) {
        return json(
            { success: false, message: 'boardId와 commentId가 필요합니다.' },
            { status: 400 }
        );
    }

    // boardId 유효성 검사
    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeCommentId = parseInt(commentId, 10);

    if (isNaN(safeCommentId)) {
        return json({ success: false, message: '유효하지 않은 commentId입니다.' }, { status: 400 });
    }

    const isInternalRequest = isInternalAppRequest(request);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const requestedLimit = Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10));
    const limit = Math.min(requestedLimit, COMMENT_LIKERS_LIMIT);

    // 외부 요청은 페이지를 막지 않고 rate-limit 으로 억제한다(위 주석 참조).
    if (!isInternalRequest) {
        // ⛔ getClientAddress() 를 직접 부르면 안 된다 — x-real-ip 가 없으면 throw 하고
        //    그대로 500 이 된다. SSR 이 event.fetch 로 이 API 를 부를 때가 정확히 그 경우다.
        //    IP 를 못 구하면 제한을 **건너뛴다**(키 없이는 못 거는 게 정상이다).
        const ip = resolveClientIp(getClientAddress, request);
        if (ip) {
            const rl = checkRateLimit(
                ip,
                'comment-likers',
                EXTERNAL_LIKERS_RATE_LIMIT,
                EXTERNAL_LIKERS_RATE_WINDOW_MS
            );
            if (!rl.allowed) {
                return json(
                    { success: false, message: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' },
                    {
                        status: 429,
                        headers: rl.retryAfter ? { 'Retry-After': String(rl.retryAfter) } : {}
                    }
                );
            }
            recordAttempt(ip, 'comment-likers');
        }
    }

    const effectivePage = page;
    const offset = (effectivePage - 1) * limit;

    try {
        const user = await getAuthUser(cookies);
        const isAuthenticated = !!user;
        const version = await getCommentLikersVersion(safeBoardId, safeCommentId);
        const cacheKey = `comment_likers:${safeBoardId}:${safeCommentId}:${effectivePage}:${limit}:${isAuthenticated ? 1 : 0}:v${version}`;

        try {
            const cached = await getRedis().get(cacheKey);
            if (cached) {
                return new Response(cached, {
                    status: 200,
                    headers: { 'content-type': 'application/json; charset=utf-8' }
                });
            }
        } catch {
            // Redis 장애 시 DB fallback
        }

        // 총 추천자 수
        const [countRows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS total FROM g5_board_good
			 WHERE bo_table = ? AND wr_id = ? AND bg_flag = 'good'`,
            [safeBoardId, safeCommentId]
        );
        const total = countRows[0]?.total ?? 0;

        // 추천자 목록 (최신순)
        // ⛔ 2026-08-08 개인정보 전수점검: mb_name(실명)은 응답에 싣지 않는다.
        //    표시는 닉네임이고, 닉네임이 비면 mb_id 로 폴백한다(실명 대신).
        const [likerRows] = await pool.query<LikerRow[]>(
            `SELECT g.mb_id, m.mb_nick, COALESCE(m.mb_image_url, '') as mb_image_url, m.mb_image_updated_at, g.bg_ip, g.bg_datetime
			 FROM g5_board_good g
			 JOIN g5_member m ON g.mb_id = m.mb_id
			 WHERE g.bo_table = ? AND g.wr_id = ? AND g.bg_flag = 'good'
			 ORDER BY g.bg_datetime DESC
			 LIMIT ? OFFSET ?`,
            [safeBoardId, safeCommentId, limit, offset]
        );

        const likers = likerRows.map((row) => ({
            mb_id: row.mb_id,
            mb_nick: row.mb_nick,
            mb_image: row.mb_image_url || '',
            mb_image_updated_at: row.mb_image_updated_at || undefined,
            bg_ip: isAuthenticated ? maskIp(row.bg_ip) : '',
            liked_at: toSafeIso(row.bg_datetime)
        }));

        const payload = {
            success: true,
            data: {
                likers,
                total
            }
        };

        try {
            await getRedis().setex(cacheKey, COMMENT_LIKERS_CACHE_TTL_SEC, JSON.stringify(payload));
        } catch {
            // Redis 장애 무시
        }

        return json(payload);
    } catch (error) {
        console.error('Comment likers GET error:', error);
        return json(
            { success: false, message: '공감한 사람 목록 조회에 실패했습니다.' },
            { status: 500 }
        );
    }
};
