import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';

let feedReactionSyncDisabled = false;
let feedReactionSyncWarningLogged = false;
const CACHE_VERSION_TTL_SEC = 7 * 24 * 60 * 60;

function getPostReactionVersionKey(boardId: string, writeId: number): string {
    return `rv:post:${boardId}:${writeId}`;
}

function getCommentReactionVersionKey(boardId: string): string {
    return `rv:comment-board:${boardId}`;
}

function getMemberLikedVersionKey(memberId: string): string {
    return `rv:member-liked:${memberId}`;
}

function getMemberInteractionsVersionKey(memberId: string): string {
    return `rv:member-interactions:${memberId}`;
}

function getCommentLikersVersionKey(boardId: string, commentId: number): string {
    return `rv:comment-likers:${boardId}:${commentId}`;
}

function getCommentLikersBatchVersionKey(boardId: string): string {
    return `rv:comment-likers-batch:${boardId}`;
}

function getPostLikersVersionKey(boardId: string, postId: number): string {
    return `rv:post-likers:${boardId}:${postId}`;
}

async function getVersion(key: string): Promise<number> {
    try {
        const raw = await getRedis().get(key);
        const parsed = raw ? Number.parseInt(raw, 10) : 0;
        return Number.isFinite(parsed) ? parsed : 0;
    } catch {
        return 0;
    }
}

async function bumpVersions(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    const uniqueKeys = [...new Set(keys)];
    const redis = getRedis();
    const pipeline = redis.pipeline();
    for (const key of uniqueKeys) {
        pipeline.incr(key);
        pipeline.expire(key, CACHE_VERSION_TTL_SEC);
    }
    await pipeline.exec();
}

export async function getPostReactionVersion(boardId: string, writeId: number): Promise<number> {
    return getVersion(getPostReactionVersionKey(boardId, writeId));
}

export async function getCommentReactionVersion(boardId: string): Promise<number> {
    return getVersion(getCommentReactionVersionKey(boardId));
}

export async function getMemberLikedVersion(memberId: string): Promise<number> {
    return getVersion(getMemberLikedVersionKey(memberId));
}

export async function getMemberInteractionsVersion(memberId: string): Promise<number> {
    return getVersion(getMemberInteractionsVersionKey(memberId));
}

export async function getCommentLikersVersion(boardId: string, commentId: number): Promise<number> {
    return getVersion(getCommentLikersVersionKey(boardId, commentId));
}

export async function getCommentLikersBatchVersion(boardId: string): Promise<number> {
    return getVersion(getCommentLikersBatchVersionKey(boardId));
}

export async function getPostLikersVersion(boardId: string, postId: number): Promise<number> {
    return getVersion(getPostLikersVersionKey(boardId, postId));
}

export async function invalidateReactionCaches(options: {
    boardId: string;
    writeId: number;
    authorMbId?: string;
    actorMbId?: string;
    isComment?: boolean;
}): Promise<void> {
    // Hot path write requests must not trigger Redis-wide SCAN. Invalidate via
    // version keys so read paths naturally roll to fresh cache keys.
    const versionKeys: string[] = [];

    if (options.isComment) {
        versionKeys.push(getCommentReactionVersionKey(options.boardId));
        versionKeys.push(getCommentLikersVersionKey(options.boardId, options.writeId));
        versionKeys.push(getCommentLikersBatchVersionKey(options.boardId));
    } else {
        versionKeys.push(getPostReactionVersionKey(options.boardId, options.writeId));
        versionKeys.push(getPostLikersVersionKey(options.boardId, options.writeId));
    }

    if (options.actorMbId && !options.isComment) {
        versionKeys.push(getMemberLikedVersionKey(options.actorMbId));
    }

    if (options.actorMbId) {
        versionKeys.push(getMemberInteractionsVersionKey(options.actorMbId));
    }

    if (options.authorMbId) {
        versionKeys.push(getMemberInteractionsVersionKey(options.authorMbId));
    }

    if (versionKeys.length === 0) return;

    try {
        await bumpVersions(versionKeys);
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
