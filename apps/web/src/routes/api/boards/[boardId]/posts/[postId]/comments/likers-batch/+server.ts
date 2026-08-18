/**
 * 댓글 추천자 배치 조회 API
 * GET /api/boards/[boardId]/posts/[postId]/comments/likers-batch?commentIds=1,2,3&limit=5
 *
 * 여러 댓글의 추천자를 한 번에 조회 (N+1 방지)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { checkRateLimit, recordAttempt, resolveClientIp } from '$lib/server/rate-limit.js';
import { getAuthUser } from '$lib/server/auth';
import { getRedis } from '$lib/server/redis';
import { isInternalAppRequest } from '$lib/server/internal-api.js';
import { getCommentLikersBatchVersion } from '$lib/server/member-activity-cache';

const COMMENT_LIKERS_BATCH_CACHE_TTL_SEC = 15;
// 공감자 미리보기 수·배치 ID 수. **요청자와 무관하게 동일하다.**
//
// ⛔ 예전에는 외부 요청을 5명으로 잘랐다(EXTERNAL_COMMENT_LIKERS_BATCH_LIMIT=5).
//    IDs 쪽은 이미 같은 이유로 10→50 으로 올린 적이 있다(아래 이력) — 같은 교훈을 두 번 겪었다.
//    2026-08-18 댓글 절단 제거와 함께 남은 절단도 걷어낸다.
//
//  ① **이미 무력했다.** nginx 가 이 경로를 `proxy_cache_key "$request_uri"` 로만 캐시해
//     응답 종류를 구분하지 못했다(같은 588행 location, 댓글과 동일). 먼저 채운 쪽 응답이
//     모두에게 배포된다 — 실측 브라우저 22,542B vs 봇 11,437B 가 서로 뒤바뀐다.
//  ② **정상 사용자를 오분류했다.** 판정이 Referer·Sec-Fetch-Site 헤더에 의존하는데,
//     그 헤더가 제거되는 환경에서는 영구히 5명만 보였다.
//
// ⛔ 다시 절단으로 되돌리지 마라. 공감자는 공개 데이터이고, 남용은 rate-limit 으로 막는다.
//    (글 목록이 #826 → #12571 에서 같은 결론에 먼저 도달했다)
const COMMENT_LIKERS_BATCH_LIMIT = 50;
// 배치 ID 한도. 과거 10이면 11번째 이후 댓글은 preview/팝업 데이터가 아예 비어,
// 사용자가 해당 댓글의 공감자 리스트를 열 수 없었음.
const COMMENT_LIKERS_BATCH_IDS = 50;

// 외부 요청 rate-limit — 댓글·글 목록과 같은 기준.
// ⚠️ checkRateLimit 은 파드 in-memory 라 실효 한도는 (이 값 × 파드 수) 다.
const EXTERNAL_LIKERS_BATCH_RATE_LIMIT = 60; // 분당 60회
const EXTERNAL_LIKERS_BATCH_RATE_WINDOW_MS = 60_000;

// bg_datetime 이 null / '' / '0000-00-00 00:00:00' 일 때 new Date() 가
// Invalid Date 를 반환하며, 이후 toLocaleString() 결과가 minify 돼서
// "va.id.Da" 같은 값으로 노출됨.
function toSafeIso(raw: unknown): string {
    const s = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
    if (!s || s.startsWith('0000')) return '';
    return s.replace(' ', 'T') + 'Z';
}

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
    wr_id: number;
    mb_id: string;
    mb_nick: string;
    mb_image_url: string;
    mb_image_updated_at: string | null;
    bg_ip: string;
    bg_datetime: string;
}

interface CountRow extends RowDataPacket {
    wr_id: number;
    total: number;
}

export const GET: RequestHandler = async ({ params, url, cookies, request, getClientAddress }) => {
    const { boardId } = params;
    const isInternalRequest = isInternalAppRequest(request);
    const commentIdsParam = url.searchParams.get('commentIds');
    const requestedLimit = Math.max(1, parseInt(url.searchParams.get('limit') || '5', 10));
    const limit = Math.min(requestedLimit, COMMENT_LIKERS_BATCH_LIMIT);

    // 외부 요청은 자르지 않고 rate-limit 으로 억제한다(위 주석 참조).
    if (!isInternalRequest) {
        // ⛔ getClientAddress() 를 직접 부르면 안 된다 — x-real-ip 가 없으면 throw 하고
        //    그대로 500 이 된다. SSR 이 event.fetch 로 이 API 를 부를 때가 정확히 그 경우다.
        //    IP 를 못 구하면 제한을 **건너뛴다**(키 없이는 못 거는 게 정상이다).
        const ip = resolveClientIp(getClientAddress, request);
        if (ip) {
            const rl = checkRateLimit(
                ip,
                'comment-likers-batch',
                EXTERNAL_LIKERS_BATCH_RATE_LIMIT,
                EXTERNAL_LIKERS_BATCH_RATE_WINDOW_MS
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
            recordAttempt(ip, 'comment-likers-batch');
        }
    }

    if (!boardId || !commentIdsParam) {
        return json(
            { success: false, message: 'boardId와 commentIds가 필요합니다.' },
            { status: 400 }
        );
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');

    // commentIds 파싱 및 검증
    const commentIds = commentIdsParam
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id))
        .slice(0, COMMENT_LIKERS_BATCH_IDS);

    if (commentIds.length === 0) {
        return json({ success: false, message: '유효한 commentIds가 없습니다.' }, { status: 400 });
    }

    try {
        const user = await getAuthUser(cookies);
        const isAuthenticated = !!user;
        const version = await getCommentLikersBatchVersion(safeBoardId);
        const cacheKey = `comment_likers_batch:${safeBoardId}:${commentIds.join(',')}:${limit}:${isAuthenticated ? 1 : 0}:v${version}`;

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

        const placeholders = commentIds.map(() => '?').join(',');

        // 댓글별 추천자 수
        const [countRows] = await pool.query<CountRow[]>(
            `SELECT wr_id, COUNT(*) AS total FROM g5_board_good
			 WHERE bo_table = ? AND wr_id IN (${placeholders}) AND bg_flag = 'good'
			 GROUP BY wr_id`,
            [safeBoardId, ...commentIds]
        );

        const totalMap = new Map<number, number>();
        for (const row of countRows) {
            totalMap.set(row.wr_id, row.total);
        }

        // 댓글별 추천자 목록 (limit개씩, 최신순)
        // ROW_NUMBER() 윈도우 함수로 댓글별 limit 적용
        const [likerRows] = await pool.query<LikerRow[]>(
            `SELECT sub.wr_id, sub.mb_id, sub.mb_nick, sub.mb_image_url, sub.mb_image_updated_at, sub.bg_ip, sub.bg_datetime
			 FROM (
			   SELECT g.wr_id, g.mb_id, m.mb_nick, COALESCE(m.mb_image_url, '') as mb_image_url, m.mb_image_updated_at, g.bg_ip, g.bg_datetime,
			          ROW_NUMBER() OVER (PARTITION BY g.wr_id ORDER BY g.bg_datetime DESC) AS rn
			   FROM g5_board_good g
			   JOIN g5_member m ON g.mb_id = m.mb_id
			   WHERE g.bo_table = ? AND g.wr_id IN (${placeholders}) AND g.bg_flag = 'good'
			 ) sub
			 WHERE sub.rn <= ?`,
            [safeBoardId, ...commentIds, limit]
        );

        // 결과를 commentId별로 그룹핑
        const data: Record<
            string,
            {
                likers: Array<{
                    mb_id: string;
                    mb_nick: string;
                    mb_image: string;
                    mb_image_updated_at?: string;
                    bg_ip: string;
                    liked_at: string;
                }>;
                total: number;
            }
        > = {};

        for (const id of commentIds) {
            data[String(id)] = {
                likers: [],
                total: totalMap.get(id) ?? 0
            };
        }

        for (const row of likerRows) {
            const key = String(row.wr_id);
            if (data[key]) {
                data[key].likers.push({
                    mb_id: row.mb_id,
                    mb_nick: row.mb_nick,
                    mb_image: row.mb_image_url || '',
                    mb_image_updated_at: row.mb_image_updated_at || undefined,
                    bg_ip: isAuthenticated ? maskIp(row.bg_ip) : '',
                    liked_at: toSafeIso(row.bg_datetime)
                });
            }
        }

        const payload = { success: true, data };

        try {
            await getRedis().setex(
                cacheKey,
                COMMENT_LIKERS_BATCH_CACHE_TTL_SEC,
                JSON.stringify(payload)
            );
        } catch {
            // Redis 장애 무시
        }

        return json(payload);
    } catch (error) {
        console.error('Comment likers batch GET error:', error);
        return json(
            { success: false, message: '추천자 목록 배치 조회에 실패했습니다.' },
            { status: 500 }
        );
    }
};
