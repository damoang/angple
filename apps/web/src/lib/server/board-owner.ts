/**
 * 소모임 당주 권한 판정 (서버 전용)
 *
 * 소모임(gr_id='group')마다 관리 책임자를 두고, 그 사람만 자기 소모임의 관리 화면을
 * 열 수 있게 한다. 판정 근거는 `g5_board.bo_admin` 하나뿐이다 — 새 테이블을 만들지 않는다.
 *
 * ⛔ 권한 판정은 반드시 서버에서 한다. 클라이언트 `{#if}` 분기는 토큰이 위조되면
 *    무력하고, 가려둔 데이터가 번들에 그대로 남는다. 권한이 없으면 데이터를 애초에
 *    내려보내지 않는다.
 *
 * ⛔ 권한 없음은 403이 아니라 404로 다룬다. 403은 "여기 관리 화면이 있다"를 알려준다.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

/** 사이트 관리자 레벨. 이 이상이면 모든 소모임을 열 수 있다. */
const SITE_ADMIN_LEVEL = 10;

export interface BoardOwnerContext {
    boardId: string;
    /** 소모임 표시 이름 (bo_subject) */
    subject: string;
    /** 지정된 당주의 mb_id. 미지정이면 빈 문자열 */
    ownerId: string;
    /** 요청자가 당주 본인인지 */
    isOwner: boolean;
    /** 요청자가 사이트 관리자인지 */
    isSiteAdmin: boolean;
}

interface UserLike {
    mb_id: string;
    mb_level: number;
}

/**
 * 요청자가 해당 소모임을 관리할 수 있는지 판정한다.
 *
 * 관리 가능하면 컨텍스트를, 아니면 null 을 돌려준다. 호출부는 null 이면 404 를 낸다.
 *
 * 소모임이 아닌 게시판(자유게시판 등)은 항상 null 이다 — 당주 개념 자체가 없다.
 */
export async function getBoardOwnerContext(
    boardId: string,
    user: UserLike | null | undefined
): Promise<BoardOwnerContext | null> {
    if (!user?.mb_id) return null;

    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT bo_subject, COALESCE(bo_admin, '') AS bo_admin
           FROM g5_board
          WHERE bo_table = ? AND gr_id = 'group'`,
        [boardId]
    );

    const board = rows[0];
    if (!board) return null; // 없는 게시판이거나 소모임이 아님

    const ownerId = String(board.bo_admin || '').trim();
    const isSiteAdmin = user.mb_level >= SITE_ADMIN_LEVEL;
    const isOwner = ownerId !== '' && ownerId === user.mb_id;

    if (!isOwner && !isSiteAdmin) return null;

    return {
        boardId,
        subject: String(board.bo_subject || boardId),
        ownerId,
        isOwner,
        isSiteAdmin
    };
}

/**
 * 소모임 확장 설정(JSON)에서 소개글을 읽는다.
 *
 * `v2_board_extended_settings.settings` 는 여러 기능이 공유하는 JSON 이라
 * 통째로 덮어쓰면 다른 설정(rating, skin 등)이 날아간다. 읽기도 방어적으로 한다.
 */
export async function getBoardIntro(boardId: string): Promise<string> {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT settings FROM v2_board_extended_settings WHERE board_id = ?`,
            [boardId]
        );
        const raw = rows[0]?.settings;
        if (!raw) return '';
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const intro = parsed?.intro;
        return typeof intro === 'string' ? intro : '';
    } catch {
        return '';
    }
}

/**
 * 소개글만 바꾸고 나머지 설정은 보존한다.
 *
 * ⛔ settings 를 통째로 교체하면 rating·skin 같은 기존 키가 사라진다.
 *    MySQL JSON_SET 으로 해당 키만 손대고, 행이 없으면 새로 만든다.
 */
export async function setBoardIntro(boardId: string, intro: string): Promise<void> {
    await pool.query(
        `INSERT INTO v2_board_extended_settings (board_id, settings, created_at, updated_at)
         VALUES (?, JSON_OBJECT('intro', ?), NOW(3), NOW(3))
         ON DUPLICATE KEY UPDATE
           settings = JSON_SET(COALESCE(settings, JSON_OBJECT()), '$.intro', ?),
           updated_at = NOW(3)`,
        [boardId, intro, intro]
    );
}
