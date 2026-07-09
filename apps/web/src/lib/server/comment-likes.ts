/**
 * 댓글 좋아요/비추천 상태 배치 조회 (SSR용)
 *
 * g5_board_good 테이블에서 현재 사용자의 댓글 추천/비추천 상태를 일괄 조회
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import { getCommentReactionVersion } from '$lib/server/member-activity-cache';

interface GoodRow extends RowDataPacket {
    wr_id: number;
    bg_flag: string;
}

export interface CommentLikeStatuses {
    likedIds: number[];
    dislikedIds: number[];
}

const COMMENT_LIKE_STATUSES_CACHE_TTL_SEC = 30;

/**
 * 댓글 좋아요/비추천 상태 배치 조회 — 글 단위
 *
 * 과거에는 SSR 1페이지 댓글 ID 목록만 조회해서, 11번째 이후(backfill) 댓글은
 * 새로고침/재방문 시 하트 토글 상태가 영원히 비어 있었다(economy/77128 제보).
 * 글 전체 댓글을 조인으로 한 번에 조회해 페이지네이션·정렬 순서와 절연한다.
 * @param boardId 게시판 ID
 * @param postId 글 ID (wr_parent)
 * @param userId 현재 사용자 mb_id
 */
export async function fetchCommentLikeStatuses(
    boardId: string,
    postId: number,
    userId: string
): Promise<CommentLikeStatuses> {
    if (!postId || !userId) {
        return { likedIds: [], dislikedIds: [] };
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const version = await getCommentReactionVersion(safeBoardId);
    const cacheKey = `comment_like_statuses:${userId}:${safeBoardId}:${postId}:v${version}`;

    try {
        const cached = await getRedis().get(cacheKey);
        if (cached) {
            return JSON.parse(cached) as CommentLikeStatuses;
        }
    } catch {
        // Redis 장애 시 DB fallback
    }

    // fkey1(bo_table, wr_id, mb_id) 인덱스 + 보드 테이블 PK 조인 — 글당 수십 행 수준
    const [rows] = await pool.query<GoodRow[]>(
        `SELECT g.wr_id, g.bg_flag
         FROM g5_board_good g
         JOIN ?? w ON w.wr_id = g.wr_id
         WHERE g.bo_table = ? AND g.mb_id = ?
           AND w.wr_parent = ? AND w.wr_is_comment = 1`,
        [`g5_write_${safeBoardId}`, safeBoardId, userId, postId]
    );

    const likedIds: number[] = [];
    const dislikedIds: number[] = [];

    for (const row of rows) {
        if (row.bg_flag === 'good') likedIds.push(row.wr_id);
        if (row.bg_flag === 'nogood') dislikedIds.push(row.wr_id);
    }

    const result = { likedIds, dislikedIds };
    try {
        await getRedis().setex(
            cacheKey,
            COMMENT_LIKE_STATUSES_CACHE_TTL_SEC,
            JSON.stringify(result)
        );
    } catch {
        // Redis 장애 무시
    }

    return result;
}
