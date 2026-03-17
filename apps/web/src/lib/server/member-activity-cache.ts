import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';

const CACHE_SCAN_COUNT = 100;

async function deleteByPatterns(patterns: string[]): Promise<void> {
    if (patterns.length === 0) return;

    try {
        const redis = getRedis();
        for (const pattern of patterns) {
            let cursor = '0';
            do {
                const [nextCursor, keys] = await redis.scan(
                    cursor,
                    'MATCH',
                    pattern,
                    'COUNT',
                    CACHE_SCAN_COUNT
                );
                cursor = nextCursor;
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } while (cursor !== '0');
        }
    } catch (error) {
        console.error('[member-activity-cache] redis invalidation failed:', error);
    }
}

export async function invalidateReactionCaches(options: {
    boardId: string;
    writeId: number;
    authorMbId?: string;
    actorMbId?: string;
    isComment?: boolean;
}): Promise<void> {
    const patterns: string[] = [];

    if (options.actorMbId) {
        patterns.push(`my_liked_posts:${options.actorMbId}:*`);
        patterns.push(`member_liked:${options.actorMbId}:*`);
        patterns.push(`member_interactions:${options.actorMbId}:*`);
        patterns.push(`post_like_status:${options.actorMbId}:*`);
        patterns.push(`comment_like_statuses:${options.actorMbId}:*`);
        patterns.push(`post_like_api:${options.actorMbId}:*`);
        patterns.push(`comment_like_api:${options.actorMbId}:*`);
    }
    if (options.authorMbId) {
        patterns.push(`member_interactions:${options.authorMbId}:*`);
        if (options.isComment) {
            patterns.push(`my_comments:${options.authorMbId}:*`);
        } else {
            patterns.push(`my_posts:${options.authorMbId}:*`);
        }
    }
    if (options.isComment) {
        patterns.push(`comment_likers:${options.boardId}:${options.writeId}:*`);
        patterns.push(`comment_likers_batch:${options.boardId}:*`);
    } else {
        patterns.push(`likers:${options.boardId}:${options.writeId}:*`);
    }

    await deleteByPatterns(patterns);
}

export async function syncFeedReactionCounts(options: {
    boardId: string;
    writeId: number;
    activityType: 1 | 2;
    likes: number;
    dislikes: number;
}): Promise<void> {
    const writeTable = `g5_write_${options.boardId}`;
    try {
        await pool.query(
            `UPDATE member_activity_feed
                SET like_count = ?, dislike_count = ?, updated_at = NOW()
              WHERE write_table = ? AND write_id = ? AND activity_type = ?`,
            [options.likes, options.dislikes, writeTable, options.writeId, options.activityType]
        );
    } catch (error) {
        console.error('[member-activity-cache] feed reaction sync failed:', error);
    }
}
