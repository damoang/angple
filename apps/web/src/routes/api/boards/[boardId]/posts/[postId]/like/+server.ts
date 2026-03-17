/**
 * 게시글 추천/비추천 API (레거시 g5_board_good 기반)
 *
 * GET  /api/boards/[boardId]/posts/[postId]/like  — 현재 추천 상태 조회
 * POST /api/boards/[boardId]/posts/[postId]/like  — 추천/비추천 토글
 *   body: { action: 'good' | 'nogood' }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '$lib/server/db';
import { canRestrictedUserReactToBoard, getAuthUser, isRestrictedUser } from '$lib/server/auth';
import { checkCertification } from '$lib/server/certification';
import { getRedis } from '$lib/server/redis';
import {
    getPostReactionVersion,
    invalidateReactionCaches,
    syncFeedReactionCounts
} from '$lib/server/member-activity-cache.js';

interface GoodRow extends RowDataPacket {
    bg_flag: string;
}

interface WriteRow extends RowDataPacket {
    wr_good: number;
    wr_nogood: number;
    mb_id: string;
    wr_subject?: string;
}

const POST_LIKE_API_CACHE_TTL_SEC = 15;

function fireAndForgetPostLikeSideEffects(options: {
    alreadyExists: GoodRow | undefined;
    action: 'good' | 'nogood';
    boardId: string;
    postId: number;
    tableName: string;
    authorMbId: string;
    actorMbId: string;
    actorNick: string;
    postSubject: string;
    nextLikes: number;
    nextDislikes: number;
}): void {
    const tasks: Promise<unknown>[] = [
        syncFeedReactionCounts({
            boardId: options.boardId,
            writeId: options.postId,
            activityType: 1,
            likes: options.nextLikes,
            dislikes: options.nextDislikes
        }),
        invalidateReactionCaches({
            boardId: options.boardId,
            writeId: options.postId,
            authorMbId: options.authorMbId,
            actorMbId: options.actorMbId,
            isComment: false
        })
    ];

    if (options.alreadyExists && options.action === 'good') {
        tasks.push(
            pool
                .query(
                    `DELETE FROM g5_na_noti WHERE bo_table = ? AND wr_id = ? AND rel_mb_id = ? AND ph_from_case = 'good'`,
                    [options.boardId, options.postId, options.actorMbId]
                )
                .catch(() => undefined)
        );
    }

    if (!options.alreadyExists && options.action === 'good') {
        tasks.push(
            (async () => {
                if (!options.authorMbId || options.authorMbId === options.actorMbId) return;

                const [prefRows] = await pool.query<RowDataPacket[]>(
                    `SELECT noti_like, like_threshold FROM g5_noti_preference WHERE mb_id = ?`,
                    [options.authorMbId]
                );
                const notiLikeEnabled = prefRows[0]?.noti_like ?? 1;
                const likeThreshold = prefRows[0]?.like_threshold ?? 1;

                if (
                    !notiLikeEnabled ||
                    (likeThreshold > 1 && options.nextLikes % likeThreshold !== 0)
                ) {
                    return;
                }

                await pool.query(
                    `DELETE FROM g5_na_noti WHERE bo_table = ? AND wr_id = ? AND rel_mb_id = ? AND ph_from_case = 'good'`,
                    [options.boardId, options.postId, options.actorMbId]
                );
                await pool.query(
                    `INSERT INTO g5_na_noti (ph_to_case, ph_from_case, bo_table, wr_id, mb_id, rel_mb_id, rel_mb_nick, rel_msg, rel_url, ph_readed, ph_datetime, parent_subject, wr_parent)
                     VALUES ('good', 'good', ?, ?, ?, ?, ?, ?, ?, 'N', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00'), ?, ?)`,
                    [
                        options.boardId,
                        options.postId,
                        options.authorMbId,
                        options.actorMbId,
                        options.actorNick,
                        `${options.actorNick}님이 회원님의 글을 추천했습니다.`,
                        `/${options.boardId}/${options.postId}`,
                        options.postSubject,
                        options.postId
                    ]
                );
            })().catch(() => undefined)
        );
    }

    void Promise.allSettled(tasks);
}

/**
 * GET: 추천 상태 조회
 * 비로그인 시에도 추천/비추천 수는 반환, user_liked/user_disliked는 false
 */
export const GET: RequestHandler = async ({ params, cookies }) => {
    const { boardId, postId } = params;

    if (!boardId || !postId) {
        return json({ success: false, message: 'boardId와 postId가 필요합니다.' }, { status: 400 });
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safePostId = parseInt(postId, 10);

    if (isNaN(safePostId)) {
        return json({ success: false, message: '유효하지 않은 postId입니다.' }, { status: 400 });
    }

    try {
        const user = await getAuthUser(cookies);
        const version = await getPostReactionVersion(safeBoardId, safePostId);
        const cacheKey = `post_like_api:${user?.mb_id || 'anon'}:${safeBoardId}:${safePostId}:v${version}`;
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

        // 게시글의 wr_good, wr_nogood 조회
        const tableName = `g5_write_${safeBoardId}`;
        const [writeRows] = await pool.query<WriteRow[]>(
            `SELECT wr_good, wr_nogood FROM ?? WHERE wr_id = ? AND wr_is_comment = 0`,
            [tableName, safePostId]
        );

        if (!writeRows[0]) {
            return json({ success: false, message: '게시글을 찾을 수 없습니다.' }, { status: 404 });
        }

        const likes = writeRows[0].wr_good;
        const dislikes = writeRows[0].wr_nogood;

        // 로그인 사용자의 추천/비추천 여부 확인
        let userLiked = false;
        let userDisliked = false;

        if (user) {
            const [goodRows] = await pool.query<GoodRow[]>(
                `SELECT bg_flag FROM g5_board_good WHERE bo_table = ? AND wr_id = ? AND mb_id = ?`,
                [safeBoardId, safePostId, user.mb_id]
            );

            for (const row of goodRows) {
                if (row.bg_flag === 'good') userLiked = true;
                if (row.bg_flag === 'nogood') userDisliked = true;
            }
        }

        const payload = {
            success: true,
            data: {
                likes,
                dislikes,
                user_liked: userLiked,
                user_disliked: userDisliked
            }
        };

        try {
            await getRedis().setex(cacheKey, POST_LIKE_API_CACHE_TTL_SEC, JSON.stringify(payload));
        } catch {
            // Redis 장애 무시
        }

        return json(payload);
    } catch (error) {
        console.error('Like status GET error:', error);
        return json({ success: false, message: '추천 상태 조회에 실패했습니다.' }, { status: 500 });
    }
};

/**
 * POST: 추천/비추천 토글
 * body: { action: 'good' | 'nogood' }
 *
 * 이미 같은 action이 있으면 취소(DELETE), 없으면 추가(INSERT)
 * 반대 action이 있으면 에러 반환 (그누보드 동작과 동일)
 */
export const POST: RequestHandler = async ({ params, request, cookies, getClientAddress }) => {
    const { boardId, postId } = params;

    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (isRestrictedUser(user) && !canRestrictedUserReactToBoard(boardId)) {
        return json(
            { success: false, message: '이용제한 중에는 추천/비추천을 할 수 없습니다.' },
            { status: 403 }
        );
    }

    // 레벨 체크 (레벨 3 미만은 추천/비추천 불가)
    if ((user.mb_level ?? 0) < 3) {
        return json(
            { success: false, message: '레벨 3 이상부터 추천/비추천이 가능합니다.' },
            { status: 403 }
        );
    }

    if (!boardId || !postId) {
        return json({ success: false, message: 'boardId와 postId가 필요합니다.' }, { status: 400 });
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safePostId = parseInt(postId, 10);

    // 실명인증 체크
    const certError = await checkCertification(safeBoardId, user.mb_id);
    if (certError) {
        return json({ success: false, message: certError }, { status: 403 });
    }

    if (isNaN(safePostId)) {
        return json({ success: false, message: '유효하지 않은 postId입니다.' }, { status: 400 });
    }

    let body: { action?: string };
    try {
        body = await request.json();
    } catch {
        return json({ success: false, message: '요청 본문이 올바르지 않습니다.' }, { status: 400 });
    }

    const action = body.action;
    if (action !== 'good' && action !== 'nogood') {
        return json(
            { success: false, message: "action은 'good' 또는 'nogood'이어야 합니다." },
            { status: 400 }
        );
    }

    const tableName = `g5_write_${safeBoardId}`;
    const column = action === 'good' ? 'wr_good' : 'wr_nogood';

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 게시글 존재 확인 + 본인 글 추천 방지
        const [writeRows] = await conn.query<WriteRow[]>(
            `SELECT wr_good, wr_nogood, mb_id, wr_subject FROM ?? WHERE wr_id = ? AND wr_is_comment = 0`,
            [tableName, safePostId]
        );

        if (!writeRows[0]) {
            await conn.rollback();
            return json({ success: false, message: '게시글을 찾을 수 없습니다.' }, { status: 404 });
        }

        if (writeRows[0].mb_id === user.mb_id) {
            await conn.rollback();
            return json(
                { success: false, message: '자신의 글은 추천/비추천할 수 없습니다.' },
                { status: 400 }
            );
        }

        // 현재 사용자의 기존 추천/비추천 기록 확인
        const [existingRows] = await conn.query<GoodRow[]>(
            `SELECT bg_flag FROM g5_board_good WHERE bo_table = ? AND wr_id = ? AND mb_id = ?`,
            [safeBoardId, safePostId, user.mb_id]
        );

        const existingGood = existingRows.find((r) => r.bg_flag === 'good');
        const existingNogood = existingRows.find((r) => r.bg_flag === 'nogood');

        // 반대 action이 이미 있으면 에러
        if (action === 'good' && existingNogood) {
            await conn.rollback();
            return json(
                {
                    success: false,
                    message: '이미 비추천한 글입니다. 비추천을 취소한 후 추천해주세요.'
                },
                { status: 400 }
            );
        }
        if (action === 'nogood' && existingGood) {
            await conn.rollback();
            return json(
                {
                    success: false,
                    message: '이미 추천한 글입니다. 추천을 취소한 후 비추천해주세요.'
                },
                { status: 400 }
            );
        }

        const alreadyExists = action === 'good' ? existingGood : existingNogood;

        let nextLikes = writeRows[0].wr_good;
        let nextDislikes = writeRows[0].wr_nogood;
        let userLiked = existingGood !== undefined;
        let userDisliked = existingNogood !== undefined;

        if (alreadyExists) {
            // 토글: 이미 있으면 취소 (DELETE + 카운트 감소)
            await conn.query(
                `DELETE FROM g5_board_good WHERE bo_table = ? AND wr_id = ? AND mb_id = ? AND bg_flag = ?`,
                [safeBoardId, safePostId, user.mb_id, action]
            );
            await conn.query(
                `UPDATE ?? SET ${column} = GREATEST(${column} - 1, 0) WHERE wr_id = ?`,
                [tableName, safePostId]
            );
            if (action === 'good') {
                nextLikes = Math.max(writeRows[0].wr_good - 1, 0);
                userLiked = false;
            } else {
                nextDislikes = Math.max(writeRows[0].wr_nogood - 1, 0);
                userDisliked = false;
            }
        } else {
            // 추가 (INSERT + 카운트 증가)
            const clientIp = getClientAddress();
            await conn.query(
                `INSERT INTO g5_board_good (bo_table, wr_id, mb_id, bg_flag, bg_datetime, bg_ip) VALUES (?, ?, ?, ?, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00'), ?)`,
                [safeBoardId, safePostId, user.mb_id, action, clientIp]
            );
            await conn.query(`UPDATE ?? SET ${column} = ${column} + 1 WHERE wr_id = ?`, [
                tableName,
                safePostId
            ]);
            if (action === 'good') {
                nextLikes = writeRows[0].wr_good + 1;
                userLiked = true;
                userDisliked = false;
            } else {
                nextDislikes = writeRows[0].wr_nogood + 1;
                userDisliked = true;
                userLiked = false;
            }
        }

        await conn.commit();

        fireAndForgetPostLikeSideEffects({
            alreadyExists,
            action,
            boardId: safeBoardId,
            postId: safePostId,
            tableName,
            authorMbId: writeRows[0].mb_id,
            actorMbId: user.mb_id,
            actorNick: user.mb_nick || user.mb_name || user.mb_id,
            postSubject: writeRows[0].wr_subject || '',
            nextLikes,
            nextDislikes
        });

        return json({
            success: true,
            data: {
                likes: nextLikes,
                dislikes: nextDislikes,
                user_liked: userLiked,
                user_disliked: userDisliked
            }
        });
    } catch (error) {
        await conn.rollback();
        console.error('Like toggle POST error:', error);
        return json({ success: false, message: '추천/비추천에 실패했습니다.' }, { status: 500 });
    } finally {
        conn.release();
    }
};
