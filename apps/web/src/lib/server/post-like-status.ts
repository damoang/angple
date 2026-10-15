/**
 * 게시글 추천/비추천 상태 조회 (SSR용)
 *
 * g5_board_good 테이블에서 현재 사용자의 게시글 추천/비추천 상태를 조회하고,
 * 같은 때 게시글의 추천/비추천 수(wr_good/wr_nogood)도 함께 읽는다.
 * 캐시 키는 추천할 때마다 올라가는 버전을 포함하므로 개수도 새 값으로 유지된다.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import { getPostReactionVersion } from '$lib/server/member-activity-cache';

interface GoodRow extends RowDataPacket {
    bg_flag: string;
}

interface CountRow extends RowDataPacket {
    wr_good: number;
    wr_nogood: number;
}

export interface PostLikeStatus {
    userLiked: boolean;
    userDisliked: boolean;
    /** 게시글 추천 수(wr_good). 글을 찾지 못했거나 개수 없이 저장된 캐시면 없다. */
    likes?: number;
    /** 게시글 비추천 수(wr_nogood). likes 와 같은 조건으로 없다. */
    dislikes?: number;
}

const POST_LIKE_STATUS_CACHE_TTL_SEC = 30;

/**
 * 게시글 추천/비추천 상태 조회
 * @param boardId 게시판 ID
 * @param postId 게시글 ID
 * @param userId 현재 사용자 mb_id
 */
export async function fetchPostLikeStatus(
    boardId: string,
    postId: number,
    userId: string
): Promise<PostLikeStatus> {
    if (!userId) {
        return { userLiked: false, userDisliked: false };
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const version = await getPostReactionVersion(safeBoardId, postId);
    const cacheKey = `post_like_status:${userId}:${safeBoardId}:${postId}:v${version}`;

    try {
        const cached = await getRedis().get(cacheKey);
        if (cached) {
            return JSON.parse(cached) as PostLikeStatus;
        }
    } catch {
        // Redis 장애 시 DB fallback
    }

    // 개수는 추천 상태 API(GET …/like)와 같은 방식으로 기본키 한 행만 읽는다.
    const [[rows], [countRows]] = await Promise.all([
        pool.query<GoodRow[]>(
            `SELECT bg_flag FROM g5_board_good
             WHERE bo_table = ? AND wr_id = ? AND mb_id = ?`,
            [safeBoardId, postId, userId]
        ),
        pool.query<CountRow[]>(
            `SELECT wr_good, wr_nogood FROM ?? WHERE wr_id = ? AND wr_is_comment = 0`,
            [`g5_write_${safeBoardId}`, postId]
        )
    ]);

    let userLiked = false;
    let userDisliked = false;

    for (const row of rows) {
        if (row.bg_flag === 'good') userLiked = true;
        if (row.bg_flag === 'nogood') userDisliked = true;
    }

    const result: PostLikeStatus = { userLiked, userDisliked };
    const countRow = countRows[0];
    if (countRow) {
        result.likes = Number(countRow.wr_good) || 0;
        result.dislikes = Number(countRow.wr_nogood) || 0;
    }
    try {
        await getRedis().setex(cacheKey, POST_LIKE_STATUS_CACHE_TTL_SEC, JSON.stringify(result));
    } catch {
        // Redis 장애 무시
    }

    return result;
}
