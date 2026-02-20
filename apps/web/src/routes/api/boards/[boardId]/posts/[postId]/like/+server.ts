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
import { getAuthUser } from '$lib/server/auth';

interface GoodRow extends RowDataPacket {
    bg_flag: string;
}

interface WriteRow extends RowDataPacket {
    wr_good: number;
    wr_nogood: number;
    mb_id: string;
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

        const user = await getAuthUser(cookies);
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

        return json({
            success: true,
            data: {
                likes,
                dislikes,
                user_liked: userLiked,
                user_disliked: userDisliked
            }
        });
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
export const POST: RequestHandler = async ({ params, request, cookies }) => {
    const { boardId, postId } = params;

    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
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
            `SELECT wr_good, wr_nogood, mb_id FROM ?? WHERE wr_id = ? AND wr_is_comment = 0`,
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
        } else {
            // 추가 (INSERT + 카운트 증가)
            await conn.query(
                `INSERT INTO g5_board_good (bo_table, wr_id, mb_id, bg_flag, bg_datetime) VALUES (?, ?, ?, ?, NOW())`,
                [safeBoardId, safePostId, user.mb_id, action]
            );
            await conn.query(`UPDATE ?? SET ${column} = ${column} + 1 WHERE wr_id = ?`, [
                tableName,
                safePostId
            ]);
        }

        await conn.commit();

        // 최신 값 다시 조회
        const [updatedRows] = await pool.query<WriteRow[]>(
            `SELECT wr_good, wr_nogood FROM ?? WHERE wr_id = ?`,
            [tableName, safePostId]
        );

        // 현재 사용자 상태 다시 조회
        const [userRows] = await pool.query<GoodRow[]>(
            `SELECT bg_flag FROM g5_board_good WHERE bo_table = ? AND wr_id = ? AND mb_id = ?`,
            [safeBoardId, safePostId, user.mb_id]
        );

        const userLiked = userRows.some((r) => r.bg_flag === 'good');
        const userDisliked = userRows.some((r) => r.bg_flag === 'nogood');

        return json({
            success: true,
            data: {
                likes: updatedRows[0]?.wr_good ?? 0,
                dislikes: updatedRows[0]?.wr_nogood ?? 0,
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
