import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import pool from '$lib/server/db';

/**
 * 알뜰구매 "판매 종료 제보" (#사장님 지시 2026-07-10)
 *
 * 서로 다른 회원 THRESHOLD 명이 제보하면 글 카테고리를 '종료'로 전환하고
 * ai 계정 안내 댓글을 남긴다. 제보는 g5_deal_end_report 에 회원당 1회(UNIQUE).
 * 댓글 INSERT 는 그누보드 정합성(wr_comment 카운트·board_new·bo_count_comment·
 * 나리야 알림)을 comment-watcher reply 시맨틱과 동일하게 유지한다.
 */
const ALLOWED_BOARDS = new Set(['economy']);
const THRESHOLD = 3;
const CLOSED_CATEGORY = '종료';
const AI_MB_ID = 'ai';
const AI_NAME = '다모앙';

function noticeContent(count: number): string {
    return (
        '[AI 안내]\n\n' +
        `회원 ${count}분의 품절·판매 종료 제보에 따라 이 글의 말머리를 '${CLOSED_CATEGORY}'로 변경했습니다.\n\n` +
        '판매가 재개되었거나 잘못 전환된 경우, 글쓴이께서는 글 수정에서 말머리를 다시 변경해 주세요.'
    );
}

async function fetchReportState(
    boardId: string,
    postId: number,
    viewerId: string | null
): Promise<{ count: number; reported: boolean }> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt,
                COALESCE(SUM(mb_id = ?), 0) AS mine
         FROM g5_deal_end_report WHERE bo_table = ? AND wr_id = ?`,
        [viewerId || '', boardId, postId]
    );
    return { count: Number(rows[0]?.cnt ?? 0), reported: Number(rows[0]?.mine ?? 0) > 0 };
}

export const GET: RequestHandler = async ({ params, locals }) => {
    const boardId = params.boardId || '';
    const postId = Number(params.postId);
    if (!ALLOWED_BOARDS.has(boardId) || !Number.isFinite(postId)) {
        return json({ success: false, error: 'unsupported' }, { status: 404 });
    }
    try {
        const state = await fetchReportState(boardId, postId, locals.user?.id ?? null);
        return json({ success: true, data: { ...state, threshold: THRESHOLD } });
    } catch (e) {
        console.error('[end-report] GET failed:', e);
        return json({ success: false, error: 'internal' }, { status: 500 });
    }
};

export const POST: RequestHandler = async ({ params, locals, getClientAddress }) => {
    const boardId = params.boardId || '';
    const postId = Number(params.postId);
    if (!ALLOWED_BOARDS.has(boardId) || !Number.isFinite(postId)) {
        return json({ success: false, error: 'unsupported' }, { status: 404 });
    }
    const viewerId = locals.user?.id;
    if (!viewerId) {
        return json({ success: false, error: 'auth_required' }, { status: 401 });
    }

    const table = `g5_write_${boardId}`;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 원글 존재·상태 확인 (잠금: 동시 3번째 제보 경합 시 댓글 중복 방지)
        const [postRows] = await conn.query<RowDataPacket[]>(
            `SELECT wr_num, ca_name, mb_id, wr_subject FROM ${table}
             WHERE wr_id = ? AND wr_is_comment = 0 AND wr_deleted_at IS NULL FOR UPDATE`,
            [postId]
        );
        const post = postRows[0];
        if (!post) {
            await conn.rollback();
            return json({ success: false, error: 'not_found' }, { status: 404 });
        }

        const alreadyClosed = post.ca_name === CLOSED_CATEGORY;

        await conn.query<ResultSetHeader>(
            `INSERT IGNORE INTO g5_deal_end_report (bo_table, wr_id, mb_id, created_at)
             VALUES (?, ?, ?, NOW())`,
            [boardId, postId, viewerId]
        );

        const [cntRows] = await conn.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS cnt FROM g5_deal_end_report WHERE bo_table = ? AND wr_id = ?`,
            [boardId, postId]
        );
        const count = Number(cntRows[0]?.cnt ?? 0);

        let closed = alreadyClosed;
        if (!alreadyClosed && count >= THRESHOLD) {
            await conn.query(`UPDATE ${table} SET ca_name = ? WHERE wr_id = ?`, [
                CLOSED_CATEGORY,
                postId
            ]);
            await insertAiComment(conn, boardId, table, postId, post, noticeContent(count));
            closed = true;
        }

        await conn.commit();
        return json({
            success: true,
            data: { count, threshold: THRESHOLD, reported: true, closed }
        });
    } catch (e) {
        try {
            await conn.rollback();
        } catch {
            // ignore rollback failure
        }
        console.error('[end-report] POST failed:', e);
        return json({ success: false, error: 'internal' }, { status: 500 });
    } finally {
        conn.release();
        void getClientAddress; // IP 는 저장하지 않음 (회원 단위 제보)
    }
};

/** 그누보드 정합성 유지 댓글 INSERT (comment-watcher reply 시맨틱과 동일) */
async function insertAiComment(
    conn: Awaited<ReturnType<typeof pool.getConnection>>,
    boardId: string,
    table: string,
    postId: number,
    post: RowDataPacket,
    content: string
): Promise<void> {
    const [maxRows] = await conn.query<RowDataPacket[]>(
        `SELECT COALESCE(MAX(wr_comment), 0) AS max_comment FROM ${table} WHERE wr_parent = ?`,
        [postId]
    );
    const nextComment = Number(maxRows[0]?.max_comment ?? 0) + 1;

    const [ins] = await conn.query<ResultSetHeader>(
        `INSERT INTO ${table} SET
            ca_name = ?, wr_option = '', wr_num = ?, wr_reply = '', wr_parent = ?,
            wr_is_comment = 1, wr_comment = ?, wr_comment_reply = '', wr_subject = '',
            wr_content = ?, mb_id = ?, wr_password = '', wr_name = ?, wr_email = '',
            wr_homepage = '', wr_datetime = NOW(), wr_last = '', wr_ip = '127.0.0.1',
            wr_1 = '', wr_2 = '', wr_3 = '', wr_4 = '', wr_5 = '',
            wr_6 = '', wr_7 = '', wr_8 = '', wr_9 = '', wr_10 = ''`,
        [CLOSED_CATEGORY, post.wr_num, postId, nextComment, content, AI_MB_ID, AI_NAME]
    );
    const commentId = ins.insertId;

    await conn.query(
        `UPDATE ${table} SET wr_comment = wr_comment + 1, wr_last = NOW() WHERE wr_id = ?`,
        [postId]
    );
    await conn.query(
        `INSERT INTO g5_board_new (bo_table, wr_id, wr_parent, bn_datetime, mb_id)
         VALUES (?, ?, ?, NOW(), ?)`,
        [boardId, commentId, postId, AI_MB_ID]
    );
    await conn.query(
        `UPDATE g5_board SET bo_count_comment = bo_count_comment + 1 WHERE bo_table = ?`,
        [boardId]
    );

    // 글쓴이에게 나리야 알림 (ai 본인 글 제외)
    if (post.mb_id && post.mb_id !== AI_MB_ID) {
        const relMsg = content.length > 30 ? `${content.slice(0, 30)}…` : content;
        await conn.query(
            `INSERT INTO g5_na_noti
                (ph_to_case, ph_from_case, bo_table, rel_bo_table, wr_id, rel_wr_id,
                 mb_id, rel_mb_id, rel_mb_nick, rel_msg, rel_url, ph_readed, ph_datetime,
                 parent_subject, wr_parent)
             VALUES ('board', 'comment', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N', NOW(), ?, ?)`,
            [
                boardId,
                boardId,
                postId,
                commentId,
                post.mb_id,
                AI_MB_ID,
                AI_NAME,
                relMsg,
                `/bbs/board.php?bo_table=${boardId}&wr_id=${postId}#c_${commentId}`,
                post.wr_subject || '',
                postId
            ]
        );
    }
}
