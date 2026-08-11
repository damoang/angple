/**
 * 이용제한 처분이 확정된 글의 잠금.
 *
 * 제재 근거로 확정된 글에 추천이 더 쌓이거나 댓글로 논쟁이 이어지면 처분의 취지가 무너진다.
 * 작성자가 본문을 고치면 근거 자체가 바뀐다.
 *
 * 실측(2026-08-11) — 제재가 확정된 뒤에 붙은 것들:
 *   추천 517건(95글) · 댓글 288건(78글) · 본문 수정 23건(19글)
 *
 * ⛔ 화면에서 버튼만 숨기지 않는다. 버튼은 우회할 수 있으므로 서버에서 거절한다.
 * ⛔ 이미 달린 추천·댓글은 지우지 않는다. 소급 삭제는 "몰래 지웠다"가 되고, 남아 있는
 *    것 자체가 당시 상황의 기록이다.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

/** 잠금 사유 — 화면에 그대로 보여준다. 조용히 실패하면 고장으로 읽힌다. */
export const SANCTIONED_LOCK_MESSAGE = '이용제한 처분이 확정된 글이라 더 이상 참여할 수 없습니다.';

/**
 * 이 글이 제재 근거로 확정됐는지.
 *
 * 판정 기준은 `g5_na_singo` 의 처분 완료 행이다. 별도 플래그를 쓰지 않는 이유는,
 * 플래그 방식이면 집행 경로(화면·크론·SQL)마다 갱신을 빠뜨릴 수 있고 과거분 백필도
 * 필요하기 때문이다. `idx_table_id_time` 이 걸려 조회는 2행 수준이다.
 */
export async function isSanctionedPost(boardId: string, wrId: number): Promise<boolean> {
    if (!boardId || !wrId) return false;
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT 1 AS hit FROM g5_na_singo
              WHERE sg_table = ? AND sg_id = ?
                AND processed = 1 AND admin_approved = 1 AND discipline_log_id > 0
              LIMIT 1`,
            [boardId, wrId]
        );
        return rows.length > 0;
    } catch {
        // ⛔ 조회가 실패하면 잠그지 않는다. 판정 불가를 이유로 정상 이용을 막으면
        //    장애가 곧바로 서비스 중단으로 번진다.
        return false;
    }
}

/**
 * 댓글이 달릴 대상(글)이 잠겼는지. 댓글 신고로 제재된 경우 그 댓글 자체도 잠근다.
 * 글 번호와 댓글 번호를 함께 받아 둘 중 하나라도 확정 처분이면 true.
 */
export async function isSanctionedTarget(
    boardId: string,
    postId: number,
    commentId?: number
): Promise<boolean> {
    if (await isSanctionedPost(boardId, postId)) return true;
    if (commentId && (await isSanctionedPost(boardId, commentId))) return true;
    return false;
}
