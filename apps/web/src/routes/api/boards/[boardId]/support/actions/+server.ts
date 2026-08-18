/**
 * 소모임 돌보기 — 임시 조치 API
 * POST /api/boards/[boardId]/support/actions
 *
 * 당주가 자기 소모임의 글/댓글 주소를 붙여넣어 임시 노출 제한(잠금)을 걸거나 푼다.
 * 삭제가 아니다 — 최종 처리(삭제 확정/해제)는 운영진이 한다.
 *
 * 잠금의 실체는 신고잠김과 같은 `wr_7='lock'` — 렌더(작성자 수정·삭제 차단, 댓글
 * 블라인드, 마이페이지 제외)와 해제가 기존 인프라를 그대로 탄다.
 *
 * ⛔ wr_7 은 신고 카운트 숫자와 겸용 컬럼이다. 잠글 때 이전값을 이력에 보존하고,
 *    해제 시 그 값을 복원한다. 단순 '' 초기화는 임계 근처 신고 카운트를 지운다.
 * ⛔ 이력은 audit_logs 를 쓴다 — g5_da_content_history 는 operation 이
 *    ENUM('수정','삭제') 라 새 동작을 못 담는다(DDL 회피). audit_logs 는 manage
 *    API 가 이미 쓰는 감사 채널이고 action 인덱스가 있다.
 * ⛔ 이력 기록은 best-effort 가 아니라 **필수 경로**다 — 이력 없는 당주 조치는
 *    운영진이 확정할 수 없고, 해제 시 복원값도 이력에서 나온다. 실패하면 잠금도
 *    롤백한다. (댓글삭제 API 가 감사 없이 UPDATE 하던 전례를 반복하지 않는다.)
 * ⛔ 권한 없음은 404 — 403 은 "여기 조치 API 가 있다"를 알려준다 (manage 관례).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2/promise';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { getBoardOwnerContext } from '$lib/server/board-owner';
import { parseContentUrl } from '$lib/board-content-url';
import {
    ACT_LOCK,
    ACT_UNLOCK,
    countActiveSupportLocks,
    getLastSupportAction
} from '$lib/server/board-support';
import { resolveClientIp } from '$lib/server/rate-limit.js';

const REASON_MAX = 200;
/** 보드당 동시 잠금 상한 — 남용(무더기 잠금) 1차 방어선 */
const ACTIVE_LOCK_LIMIT = 20;

interface TargetRow extends RowDataPacket {
    wr_id: number;
    wr_parent: number;
    wr_is_comment: number;
    mb_id: string;
    wr_name: string;
    wr_subject: string;
    wr_content: string;
    wr_7: string;
}

export const POST: RequestHandler = async ({ params, request, cookies, getClientAddress }) => {
    const { boardId } = params;

    const user = await getAuthUser(cookies);
    const ctx = await getBoardOwnerContext(boardId, user);
    if (!ctx) return json({ success: false, error: 'Not Found' }, { status: 404 });

    let body: { url?: string; action?: string; reason?: string };
    try {
        body = await request.json();
    } catch {
        return json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const action = body.action;
    if (action !== 'preview' && action !== 'lock' && action !== 'unlock') {
        return json({ success: false, error: '알 수 없는 동작입니다.' }, { status: 400 });
    }
    const reason = (body.reason ?? '').trim().slice(0, REASON_MAX);

    const parsed = parseContentUrl(body.url ?? '');
    if (!parsed || parsed.boardId !== boardId) {
        return json(
            { success: false, error: '이 소모임의 글/댓글 주소가 아닙니다.' },
            { status: 400 }
        );
    }

    // 대상 실조회 — 댓글이면 앵커의 id 로 조회하고 부모 글 일치까지 검증한다.
    const table = `g5_write_${boardId}`;
    const targetId = parsed.commentId ?? parsed.postId;
    const [rows] = await pool.query<TargetRow[]>(
        `SELECT wr_id, wr_parent, wr_is_comment, COALESCE(mb_id,'') AS mb_id,
                COALESCE(wr_name,'') AS wr_name, COALESCE(wr_subject,'') AS wr_subject,
                LEFT(COALESCE(wr_content,''), 80) AS wr_content,
                COALESCE(wr_7,'') AS wr_7
           FROM ?? WHERE wr_id = ? AND wr_deleted_at IS NULL`,
        [table, targetId]
    );
    const target = rows[0];
    const isComment = parsed.commentId !== null;
    if (
        !target ||
        (isComment && (target.wr_is_comment !== 1 || target.wr_parent !== parsed.postId)) ||
        (!isComment && target.wr_is_comment !== 0)
    ) {
        return json(
            { success: false, error: '대상 글/댓글을 찾을 수 없습니다. (삭제되었을 수 있습니다)' },
            { status: 404 }
        );
    }

    const summary = {
        target_id: target.wr_id,
        post_id: parsed.postId,
        is_comment: isComment,
        author: target.wr_name,
        subject: isComment ? target.wr_content : target.wr_subject,
        locked: target.wr_7 === 'lock'
    };

    if (action === 'preview') {
        return json({ success: true, data: summary });
    }

    const auditInsert = `INSERT INTO audit_logs
        (created_at, user_id, action, resource, resource_id, details, client_ip)
        VALUES (NOW(3), ?, ?, ?, ?, ?, ?)`;

    if (action === 'lock') {
        if (target.wr_7 === 'lock') {
            return json({ success: false, error: '이미 조치된 대상입니다.' }, { status: 409 });
        }
        if ((await countActiveSupportLocks(boardId)) >= ACTIVE_LOCK_LIMIT) {
            return json(
                {
                    success: false,
                    error: `동시에 가려둘 수 있는 글은 ${ACTIVE_LOCK_LIMIT}건까지입니다. 운영진 확인을 기다려 주세요.`
                },
                { status: 400 }
            );
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query(`UPDATE ?? SET wr_7 = 'lock' WHERE wr_id = ?`, [table, target.wr_id]);
            // 이력 — 실패 시 전체 롤백 (필수 경로)
            await conn.query(auditInsert, [
                user!.mb_id,
                ACT_LOCK,
                boardId,
                String(target.wr_id),
                JSON.stringify({
                    is_comment: target.wr_is_comment,
                    author_id: target.mb_id,
                    author_name: target.wr_name,
                    wr_7_prev: target.wr_7,
                    url: body.url,
                    reason,
                    subject: summary.subject
                }),
                resolveClientIp(getClientAddress, request) ?? ''
            ]);
            await conn.commit();
        } catch (e) {
            await conn.rollback();
            console.error('[support/actions] lock 실패:', boardId, target.wr_id, e);
            return json({ success: false, error: '조치에 실패했습니다.' }, { status: 500 });
        } finally {
            conn.release();
        }

        // 글 잠금은 새글 목록의 신고 표시도 동기화 (report_autolock 관례, best-effort)
        if (!isComment) {
            try {
                await pool.query(
                    `UPDATE g5_board_new SET wr_singo = 'lock' WHERE bo_table = ? AND wr_id = ?`,
                    [boardId, target.wr_id]
                );
            } catch {
                /* 목록 표식 실패가 조치를 되돌리지 않는다 */
            }
        }
        return json({ success: true, data: { ...summary, locked: true } });
    }

    // action === 'unlock'
    // 해제는 "최신 이력이 당주잠금"인 대상만 — 신고누적 자동잠금·운영진 잠금을
    // 당주가 임의로 풀 수 없다. 사이트 관리자는 예외.
    if (target.wr_7 !== 'lock') {
        return json({ success: false, error: '잠금 상태가 아닙니다.' }, { status: 409 });
    }
    const last = await getLastSupportAction(boardId, target.wr_id);
    if (last?.action !== ACT_LOCK && !ctx.isSiteAdmin) {
        return json(
            {
                success: false,
                error: '이 잠금은 소모임 조치가 아니라 여기서 풀 수 없습니다. 운영진에게 문의해 주세요.'
            },
            { status: 403 }
        );
    }

    let restored = '';
    const prev = last?.details?.wr_7_prev;
    if (last?.action === ACT_LOCK && typeof prev === 'string' && prev !== 'lock') {
        restored = prev;
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(`UPDATE ?? SET wr_7 = ? WHERE wr_id = ?`, [table, restored, target.wr_id]);
        await conn.query(auditInsert, [
            user!.mb_id,
            ACT_UNLOCK,
            boardId,
            String(target.wr_id),
            JSON.stringify({
                is_comment: target.wr_is_comment,
                author_id: target.mb_id,
                author_name: target.wr_name,
                wr_7_restored: restored,
                reason,
                subject: summary.subject
            }),
            resolveClientIp(getClientAddress, request) ?? ''
        ]);
        await conn.commit();
    } catch (e) {
        await conn.rollback();
        console.error('[support/actions] unlock 실패:', boardId, target.wr_id, e);
        return json({ success: false, error: '해제에 실패했습니다.' }, { status: 500 });
    } finally {
        conn.release();
    }

    if (!isComment) {
        try {
            await pool.query(
                `UPDATE g5_board_new SET wr_singo = '' WHERE bo_table = ? AND wr_id = ?`,
                [boardId, target.wr_id]
            );
        } catch {
            /* best-effort */
        }
    }
    return json({ success: true, data: { ...summary, locked: false } });
};
