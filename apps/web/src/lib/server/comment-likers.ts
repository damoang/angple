/**
 * 댓글 추천자 배치 조회
 *
 * 여러 댓글의 추천자를 한 번에 조회한다(N+1 방지). API 라우트(likers-batch)와
 * 글 상세의 서버 로드가 같은 함수를 쓴다 — 캐시 키와 형식도 공유한다.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import { getCommentLikersBatchVersion } from '$lib/server/member-activity-cache';
import {
    groupCommentLikers,
    type CommentLikersBatch,
    type CountRow,
    type LikerRow
} from '$lib/server/comment-likers-shape.js';

export type { CommentLiker, CommentLikersBatch } from '$lib/server/comment-likers-shape.js';

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
export const COMMENT_LIKERS_BATCH_LIMIT = 50;
// 배치 ID 한도. 과거 10이면 11번째 이후 댓글은 preview/팝업 데이터가 아예 비어,
// 사용자가 해당 댓글의 공감자 리스트를 열 수 없었음.
export const COMMENT_LIKERS_BATCH_IDS = 50;

/**
 * 댓글별 추천자(최신순 limit 명)와 추천자 수를 조회한다.
 *
 * @param boardId 게시판 ID (영숫자·밑줄·하이픈만 남긴 값)
 * @param commentIds 댓글 ID 목록 — 호출자가 COMMENT_LIKERS_BATCH_IDS 이하로 잘라서 넘긴다
 * @param limit 댓글당 추천자 수
 * @param isAuthenticated 요청자가 로그인 상태인가(마스킹한 IP 포함 여부)
 */
export async function fetchCommentLikersBatch(
    boardId: string,
    commentIds: number[],
    limit: number,
    isAuthenticated: boolean
): Promise<CommentLikersBatch> {
    const version = await getCommentLikersBatchVersion(boardId);
    const cacheKey = `comment_likers_batch:${boardId}:${commentIds.join(',')}:${limit}:${isAuthenticated ? 1 : 0}:v${version}`;

    try {
        const cached = await getRedis().get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached) as { data?: CommentLikersBatch };
            if (parsed?.data) return parsed.data;
        }
    } catch {
        // Redis 장애·깨진 캐시 값이면 DB fallback
    }

    const placeholders = commentIds.map(() => '?').join(',');

    // 댓글별 추천자 수
    const [countRows] = await pool.query<(CountRow & RowDataPacket)[]>(
        `SELECT wr_id, COUNT(*) AS total FROM g5_board_good
			 WHERE bo_table = ? AND wr_id IN (${placeholders}) AND bg_flag = 'good'
			 GROUP BY wr_id`,
        [boardId, ...commentIds]
    );

    // 댓글별 추천자 목록 (limit개씩, 최신순)
    // ROW_NUMBER() 윈도우 함수로 댓글별 limit 적용
    const [likerRows] = await pool.query<(LikerRow & RowDataPacket)[]>(
        `SELECT sub.wr_id, sub.mb_id, sub.mb_nick, sub.mb_image_url, sub.mb_image_updated_at, sub.bg_ip, sub.bg_datetime
			 FROM (
			   SELECT g.wr_id, g.mb_id, m.mb_nick, COALESCE(m.mb_image_url, '') as mb_image_url, m.mb_image_updated_at, g.bg_ip, g.bg_datetime,
			          ROW_NUMBER() OVER (PARTITION BY g.wr_id ORDER BY g.bg_datetime DESC) AS rn
			   FROM g5_board_good g
			   JOIN g5_member m ON g.mb_id = m.mb_id
			   WHERE g.bo_table = ? AND g.wr_id IN (${placeholders}) AND g.bg_flag = 'good'
			 ) sub
			 WHERE sub.rn <= ?`,
        [boardId, ...commentIds, limit]
    );

    const data = groupCommentLikers(commentIds, countRows, likerRows, isAuthenticated);

    try {
        // 캐시 값은 API 응답 형식 그대로 둔다 — 배포 전후 파드가 같은 키를 읽는다.
        await getRedis().setex(
            cacheKey,
            COMMENT_LIKERS_BATCH_CACHE_TTL_SEC,
            JSON.stringify({ success: true, data })
        );
    } catch {
        // Redis 장애 무시
    }

    return data;
}
