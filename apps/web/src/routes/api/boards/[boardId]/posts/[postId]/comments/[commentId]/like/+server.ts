/**
 * 댓글 추천/비추천 API (레거시 g5_board_good 기반)
 *
 * GET  /api/boards/[boardId]/posts/[postId]/comments/[commentId]/like — 추천 상태 조회
 * POST /api/boards/[boardId]/posts/[postId]/comments/[commentId]/like — 추천/비추천 토글
 *   body: { action: 'good' | 'nogood' }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { canRestrictedUserReactToBoard, getAuthUser, isRestrictedUser } from '$lib/server/auth';
import { checkCertification } from '$lib/server/certification';
import { getRedis } from '$lib/server/redis';
import {
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
}

const COMMENT_LIKE_API_CACHE_TTL_SEC = 15;

/**
 * GET: 댓글 추천 상태 조회
 */
export const GET: RequestHandler = async ({ params, cookies }) => {
    const { boardId, commentId } = params;

    if (!boardId || !commentId) {
        return json(
            { success: false, message: 'boardId와 commentId가 필요합니다.' },
            { status: 400 }
        );
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeCommentId = parseInt(commentId, 10);

    if (isNaN(safeCommentId)) {
        return json({ success: false, message: '유효하지 않은 commentId입니다.' }, { status: 400 });
    }

    try {
        const user = await getAuthUser(cookies);
        const cacheKey = `comment_like_api:${user?.mb_id || 'anon'}:${safeBoardId}:${safeCommentId}`;
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

        const tableName = `g5_write_${safeBoardId}`;
        const [writeRows] = await pool.query<WriteRow[]>(
            `SELECT wr_good, wr_nogood FROM ?? WHERE wr_id = ? AND wr_is_comment >= 1`,
            [tableName, safeCommentId]
        );

        if (!writeRows[0]) {
            return json({ success: false, message: '댓글을 찾을 수 없습니다.' }, { status: 404 });
        }

        const likes = writeRows[0].wr_good;
        const dislikes = writeRows[0].wr_nogood;

        let userLiked = false;
        let userDisliked = false;

        if (user) {
            const [goodRows] = await pool.query<GoodRow[]>(
                `SELECT bg_flag FROM g5_board_good WHERE bo_table = ? AND wr_id = ? AND mb_id = ?`,
                [safeBoardId, safeCommentId, user.mb_id]
            );

            for (const row of goodRows) {
                if (row.bg_flag === 'good') userLiked = true;
                if (row.bg_flag === 'nogood') userDisliked = true;
            }
        }

        const payload = {
            success: true,
            data: { likes, dislikes, user_liked: userLiked, user_disliked: userDisliked }
        };

        try {
            await getRedis().setex(
                cacheKey,
                COMMENT_LIKE_API_CACHE_TTL_SEC,
                JSON.stringify(payload)
            );
        } catch {
            // Redis 장애 무시
        }

        return json(payload);
    } catch (error) {
        console.error('Comment like status GET error:', error);
        return json(
            { success: false, message: '댓글 추천 상태 조회에 실패했습니다.' },
            { status: 500 }
        );
    }
};

/**
 * POST: 댓글 추천/비추천 토글
 * body: { action: 'good' | 'nogood' }
 */
export const POST: RequestHandler = async ({ params, request, cookies, getClientAddress }) => {
    const { boardId, commentId } = params;

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

    if ((user.mb_level ?? 0) < 3) {
        return json(
            { success: false, message: '레벨 3 이상부터 추천/비추천이 가능합니다.' },
            { status: 403 }
        );
    }

    if (!boardId || !commentId) {
        return json(
            { success: false, message: 'boardId와 commentId가 필요합니다.' },
            { status: 400 }
        );
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeCommentId = parseInt(commentId, 10);

    if (isNaN(safeCommentId)) {
        return json({ success: false, message: '유효하지 않은 commentId입니다.' }, { status: 400 });
    }

    // 실명인증 체크
    const certError = await checkCertification(safeBoardId, user.mb_id);
    if (certError) {
        return json({ success: false, message: certError }, { status: 403 });
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

        // 댓글 존재 확인 + 본인 댓글 추천 방지
        const [writeRows] = await conn.query<WriteRow[]>(
            `SELECT wr_good, wr_nogood, mb_id FROM ?? WHERE wr_id = ? AND wr_is_comment >= 1`,
            [tableName, safeCommentId]
        );

        if (!writeRows[0]) {
            await conn.rollback();
            return json({ success: false, message: '댓글을 찾을 수 없습니다.' }, { status: 404 });
        }

        if (writeRows[0].mb_id === user.mb_id) {
            await conn.rollback();
            return json(
                { success: false, message: '자신의 댓글은 추천/비추천할 수 없습니다.' },
                { status: 400 }
            );
        }

        // 기존 추천/비추천 기록 확인
        const [existingRows] = await conn.query<GoodRow[]>(
            `SELECT bg_flag FROM g5_board_good WHERE bo_table = ? AND wr_id = ? AND mb_id = ?`,
            [safeBoardId, safeCommentId, user.mb_id]
        );

        const existingGood = existingRows.find((r) => r.bg_flag === 'good');
        const existingNogood = existingRows.find((r) => r.bg_flag === 'nogood');

        // 반대 action이 이미 있으면 에러
        if (action === 'good' && existingNogood) {
            await conn.rollback();
            return json(
                {
                    success: false,
                    message: '이미 비추천한 댓글입니다. 비추천을 취소한 후 추천해주세요.'
                },
                { status: 400 }
            );
        }
        if (action === 'nogood' && existingGood) {
            await conn.rollback();
            return json(
                {
                    success: false,
                    message: '이미 추천한 댓글입니다. 추천을 취소한 후 비추천해주세요.'
                },
                { status: 400 }
            );
        }

        const alreadyExists = action === 'good' ? existingGood : existingNogood;

        if (alreadyExists) {
            // 토글: 이미 있으면 취소
            await conn.query(
                `DELETE FROM g5_board_good WHERE bo_table = ? AND wr_id = ? AND mb_id = ? AND bg_flag = ?`,
                [safeBoardId, safeCommentId, user.mb_id, action]
            );
            await conn.query(
                `UPDATE ?? SET ${column} = GREATEST(${column} - 1, 0) WHERE wr_id = ?`,
                [tableName, safeCommentId]
            );

            // 추천 취소 시 해당 알림도 삭제 (중복 알림 방지)
            if (action === 'good') {
                pool.query(
                    `DELETE FROM g5_na_noti WHERE bo_table = ? AND wr_id = ? AND rel_mb_id = ? AND ph_from_case = 'good'`,
                    [safeBoardId, safeCommentId, user.mb_id]
                ).catch(() => {});
            }
        } else {
            // 추가
            const clientIp = getClientAddress();
            await conn.query(
                `INSERT INTO g5_board_good (bo_table, wr_id, mb_id, bg_flag, bg_datetime, bg_ip) VALUES (?, ?, ?, ?, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00'), ?)`,
                [safeBoardId, safeCommentId, user.mb_id, action, clientIp]
            );
            await conn.query(`UPDATE ?? SET ${column} = ${column} + 1 WHERE wr_id = ?`, [
                tableName,
                safeCommentId
            ]);
        }

        await conn.commit();

        // 댓글 좋아요 알림 (추가 시에만, 알림 설정 확인)
        if (!alreadyExists && action === 'good') {
            const commentAuthorId = writeRows[0].mb_id;
            if (commentAuthorId && commentAuthorId !== user.mb_id) {
                // 댓글 작성자의 공감 알림 설정 확인
                const [prefRows] = await pool.query<RowDataPacket[]>(
                    `SELECT noti_like FROM g5_noti_preference WHERE mb_id = ?`,
                    [commentAuthorId]
                );
                const notiLikeEnabled = prefRows[0]?.noti_like ?? 1;

                if (!notiLikeEnabled) {
                    // 공감 알림이 꺼져있으면 알림 발송하지 않음
                } else {
                    const userNick = user.mb_nick || user.mb_name || user.mb_id;
                    const safeParentPostId = parseInt(params.postId!, 10);
                    // 기존 알림 삭제 후 새 알림 (추천→취소→재추천 중복 방지)
                    pool.query(
                        `DELETE FROM g5_na_noti WHERE bo_table = ? AND wr_id = ? AND rel_mb_id = ? AND ph_from_case = 'good'`,
                        [safeBoardId, safeCommentId, user.mb_id]
                    )
                        .then(() =>
                            pool.query<WriteRow[]>(`SELECT wr_subject FROM ?? WHERE wr_id = ?`, [
                                tableName,
                                safeParentPostId
                            ])
                        )
                        .then(([parentRows]) => {
                            const parentSubject = (parentRows as WriteRow[])[0]?.wr_subject || '';
                            pool.query(
                                `INSERT INTO g5_na_noti (ph_to_case, ph_from_case, bo_table, wr_id, mb_id, rel_mb_id, rel_mb_nick, rel_msg, rel_url, ph_readed, ph_datetime, parent_subject, wr_parent)
                         VALUES ('good', 'good', ?, ?, ?, ?, ?, ?, ?, 'N', CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+09:00'), ?, ?)`,
                                [
                                    safeBoardId,
                                    safeCommentId,
                                    commentAuthorId,
                                    user.mb_id,
                                    userNick,
                                    `${userNick}님이 회원님의 댓글을 추천했습니다.`,
                                    `/${safeBoardId}/${params.postId}#c_${safeCommentId}`,
                                    parentSubject,
                                    safeParentPostId
                                ]
                            );
                        })
                        .catch(() => {});
                }
            }
        }

        // 최신 값 조회
        const [updatedRows] = await pool.query<WriteRow[]>(
            `SELECT wr_good, wr_nogood FROM ?? WHERE wr_id = ?`,
            [tableName, safeCommentId]
        );

        const [userRows] = await pool.query<GoodRow[]>(
            `SELECT bg_flag FROM g5_board_good WHERE bo_table = ? AND wr_id = ? AND mb_id = ?`,
            [safeBoardId, safeCommentId, user.mb_id]
        );

        const userLiked = userRows.some((r) => r.bg_flag === 'good');
        const userDisliked = userRows.some((r) => r.bg_flag === 'nogood');

        const nextLikes = updatedRows[0]?.wr_good ?? 0;
        const nextDislikes = updatedRows[0]?.wr_nogood ?? 0;

        await Promise.all([
            syncFeedReactionCounts({
                boardId: safeBoardId,
                writeId: safeCommentId,
                activityType: 2,
                likes: nextLikes,
                dislikes: nextDislikes
            }),
            invalidateReactionCaches({
                boardId: safeBoardId,
                writeId: safeCommentId,
                authorMbId: writeRows[0].mb_id,
                actorMbId: user.mb_id,
                isComment: true
            })
        ]);

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
        console.error('Comment like toggle POST error:', error);
        return json(
            { success: false, message: '댓글 추천/비추천에 실패했습니다.' },
            { status: 500 }
        );
    } finally {
        conn.release();
    }
};
