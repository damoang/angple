import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';

let feedReactionSyncDisabled = false;
let feedReactionSyncWarningLogged = false;

export async function invalidateReactionCaches(options: {
    boardId: string;
    writeId: number;
    authorMbId?: string;
    actorMbId?: string;
    isComment?: boolean;
}): Promise<void> {
    // Hot path write requests must not trigger Redis-wide SCAN. Only invalidate
    // exact keys we can derive here and let short TTL caches expire naturally.
    const keys: string[] = [];

    if (options.actorMbId) {
        if (options.isComment) {
            keys.push(`comment_like_api:${options.actorMbId}:${options.boardId}:${options.writeId}`);
        } else {
            keys.push(`post_like_api:${options.actorMbId}:${options.boardId}:${options.writeId}`);
            keys.push(`post_like_status:${options.actorMbId}:${options.boardId}:${options.writeId}`);
        }
    }

    if (keys.length === 0) return;

    try {
        await getRedis().del(...keys);
    } catch (error) {
        console.error('[member-activity-cache] redis invalidation failed:', error);
    }
}

export async function syncFeedReactionCounts(options: {
    boardId: string;
    writeId: number;
    activityType: 1 | 2;
    likes: number;
    dislikes: number;
}): Promise<void> {
    if (feedReactionSyncDisabled) return;

    const writeTable = `g5_write_${options.boardId}`;
    try {
        await pool.query(
            `UPDATE member_activity_feed
                SET like_count = ?, dislike_count = ?, updated_at = NOW()
              WHERE write_table = ? AND write_id = ? AND activity_type = ?`,
            [options.likes, options.dislikes, writeTable, options.writeId, options.activityType]
        );
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : typeof error === 'object' && error && 'sqlMessage' in error
                  ? String(error.sqlMessage)
                  : '';
        const missingReactionColumns =
            message.includes("Unknown column 'like_count'") ||
            message.includes("Unknown column 'dislike_count'");

        if (missingReactionColumns) {
            feedReactionSyncDisabled = true;
            if (!feedReactionSyncWarningLogged) {
                feedReactionSyncWarningLogged = true;
                console.warn(
                    '[member-activity-cache] feed reaction sync disabled: member_activity_feed reaction columns are missing in the current DB schema'
                );
            }
            return;
        }
        console.error('[member-activity-cache] feed reaction sync failed:', error);
    }
}
