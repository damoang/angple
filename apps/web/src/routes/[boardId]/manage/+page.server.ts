/**
 * 소모임 관리 화면 (당주 콘솔) — 서버 로드
 *
 * ⛔ 여기서 권한을 확정한다. 권한이 없으면 데이터를 아예 만들지 않고 404 를 낸다.
 *    403 이 아니라 404 인 이유: 403 은 "여기 관리 화면이 있다"를 알려준다.
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool, { readPool } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { getBoardOwnerContext, getBoardIntro } from '$lib/server/board-owner';

export const load: PageServerLoad = async ({ params, cookies }) => {
    const { boardId } = params;

    const user = await getAuthUser(cookies);
    const ctx = await getBoardOwnerContext(boardId, user);
    if (!ctx) throw error(404, 'Not Found');

    const [boardRows] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(bo_notice, '')        AS bo_notice,
                COALESCE(bo_category_list, '') AS bo_category_list,
                COALESCE(bo_use_category, 0)   AS bo_use_category
           FROM g5_board WHERE bo_table = ?`,
        [boardId]
    );
    const board = boardRows[0] ?? {};

    // 고정된 공지의 제목까지 함께 보여준다 — 번호만 보고는 무엇을 고정했는지 알 수 없다.
    const noticeIds = String(board.bo_notice || '')
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);

    let notices: Array<{ id: number; subject: string }> = [];
    if (noticeIds.length > 0) {
        try {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT wr_id, wr_subject FROM ??
                  WHERE wr_id IN (?) AND wr_is_comment = 0 AND wr_deleted_at IS NULL`,
                [`g5_write_${boardId}`, noticeIds]
            );
            const found = new Map(rows.map((r) => [Number(r.wr_id), String(r.wr_subject || '')]));
            // bo_notice 의 순서를 유지한다. 사라진 글은 제목 없이 번호만 남겨 정리할 수 있게 한다.
            notices = noticeIds.map((id) => ({ id, subject: found.get(id) ?? '' }));
        } catch {
            notices = noticeIds.map((id) => ({ id, subject: '' }));
        }
    }

    // 활동 현황 — 당주가 소모임 상태를 파악할 유일한 수단.
    //
    // ⚠️ g5_write_* 에는 wr_datetime 인덱스가 없다. 기간 조건을 그 테이블에 직접 걸면
    //    풀스캔이 된다(g5_write_car 실측 13.6만 행). 관리 화면을 열 때마다 그걸 도는 건
    //    7/20 스왑 스래싱·7/21 EBS IOPS 502 이력을 생각하면 위험하다.
    //    → 기간 필터는 bn_datetime 인덱스가 있는 g5_board_new 로 걸고(실측 5.2천 행),
    //      삭제글 제외만 PK 조인으로 붙인다. 실측 결과 직접 집계와 수치가 정확히 일치했다.
    // ⚠️ 읽기는 readPool 로 보낸다(설정 없으면 writer 로 자동 폴백).
    let stats = { posts30d: 0, comments30d: 0, writers30d: 0, totalPosts: 0 };
    try {
        const [rows] = await readPool.query<RowDataPacket[]>(
            `SELECT SUM(w.wr_is_comment = 0)              AS posts30d,
                    SUM(w.wr_is_comment = 1)              AS comments30d,
                    COUNT(DISTINCT NULLIF(w.mb_id, ''))   AS writers30d
               FROM g5_board_new n
               JOIN ?? w ON w.wr_id = n.wr_id
              WHERE n.bo_table = ?
                AND n.bn_datetime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                AND w.wr_deleted_at IS NULL`,
            [`g5_write_${boardId}`, boardId]
        );
        const r = rows[0] ?? {};
        stats.posts30d = Number(r.posts30d ?? 0);
        stats.comments30d = Number(r.comments30d ?? 0);
        stats.writers30d = Number(r.writers30d ?? 0);
    } catch {
        // 통계 실패가 관리 화면 전체를 막지 않는다.
    }

    try {
        // wr_is_comment + wr_deleted_at 인덱스를 탄다(실측 5.5천 행).
        const [rows] = await readPool.query<RowDataPacket[]>(
            `SELECT COUNT(*) AS total FROM ?? WHERE wr_is_comment = 0 AND wr_deleted_at IS NULL`,
            [`g5_write_${boardId}`]
        );
        stats.totalPosts = Number(rows[0]?.total ?? 0);
    } catch {
        // 무시 — 0 으로 남는다.
    }

    return {
        boardId,
        subject: ctx.subject,
        isOwner: ctx.isOwner,
        isSiteAdmin: ctx.isSiteAdmin,
        intro: await getBoardIntro(boardId),
        useCategory: Number(board.bo_use_category ?? 0) === 1,
        categoryList: String(board.bo_category_list || ''),
        notices,
        stats
    };
};
