/**
 * 소모임 관리 저장 API (당주 콘솔)
 * PATCH /api/boards/[boardId]/manage
 *
 * ⛔ 페이지 로드에서 이미 권한을 봤더라도 여기서 **다시** 확인한다.
 *    API 는 화면을 거치지 않고 직접 호출할 수 있다. slug 를 바꿔 넣어도 막혀야 한다.
 * ⛔ 권한 없음은 404 로 응답한다(존재를 알리지 않는다).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { getBoardOwnerContext, setBoardIntro } from '$lib/server/board-owner';

/** 소개글 상한 — 무제한이면 저장소·화면 모두 감당이 안 된다. */
const INTRO_MAX = 2000;
/** 카테고리 개수·길이 상한 (그누보드 bo_category_list 는 '|' 구분) */
const CATEGORY_MAX_COUNT = 20;
const CATEGORY_NAME_MAX = 20;

export const PATCH: RequestHandler = async ({ params, request, cookies, getClientAddress }) => {
    const { boardId } = params;

    const user = await getAuthUser(cookies);
    const ctx = await getBoardOwnerContext(boardId, user);
    if (!ctx) return json({ success: false, error: 'Not Found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
    }

    const changed: string[] = [];

    // --- 소개글 ---
    if (typeof body.intro === 'string') {
        const intro = body.intro.trim();
        if (intro.length > INTRO_MAX) {
            return json(
                { success: false, error: `소개글은 ${INTRO_MAX}자까지 쓸 수 있습니다.` },
                { status: 400 }
            );
        }
        await setBoardIntro(boardId, intro);
        changed.push('intro');
    }

    // --- 카테고리 ---
    if (body.categories !== undefined) {
        if (!Array.isArray(body.categories)) {
            return json(
                { success: false, error: '카테고리 형식이 올바르지 않습니다.' },
                { status: 400 }
            );
        }

        const names = body.categories
            .map((c) => (typeof c === 'string' ? c.trim() : ''))
            .filter((c) => c !== '');

        if (names.length > CATEGORY_MAX_COUNT) {
            return json(
                {
                    success: false,
                    error: `카테고리는 ${CATEGORY_MAX_COUNT}개까지 만들 수 있습니다.`
                },
                { status: 400 }
            );
        }
        if (names.some((n) => n.length > CATEGORY_NAME_MAX)) {
            return json(
                { success: false, error: `카테고리 이름은 ${CATEGORY_NAME_MAX}자까지 가능합니다.` },
                { status: 400 }
            );
        }
        // '|' 는 구분자라 이름에 들어가면 목록이 깨진다. ',' 는 다른 설정에서 구분자로 쓰인다.
        if (names.some((n) => n.includes('|') || n.includes(','))) {
            return json(
                { success: false, error: '카테고리 이름에 | 나 , 는 쓸 수 없습니다.' },
                { status: 400 }
            );
        }
        if (new Set(names).size !== names.length) {
            return json({ success: false, error: '중복된 카테고리가 있습니다.' }, { status: 400 });
        }

        await pool.query(
            `UPDATE g5_board SET bo_category_list = ?, bo_use_category = ? WHERE bo_table = ?`,
            [names.join('|'), names.length > 0 ? 1 : 0, boardId]
        );
        changed.push('categories');
    }

    if (changed.length === 0) {
        return json({ success: false, error: '변경할 내용이 없습니다.' }, { status: 400 });
    }

    // 감사 로그 — best-effort. 기록 실패가 기능을 막지 않는다.
    try {
        await pool.query(
            `INSERT INTO audit_logs (created_at, user_id, action, resource, resource_id, details, client_ip)
             VALUES (NOW(3), ?, 'board_owner.update', 'board', ?, ?, ?)`,
            [
                user!.mb_id,
                boardId,
                JSON.stringify({ changed, is_owner: ctx.isOwner, is_site_admin: ctx.isSiteAdmin }),
                getClientAddress()
            ]
        );
    } catch {
        // 감사 로그 스키마가 다르거나 없더라도 저장 자체는 성공으로 둔다.
    }

    return json({ success: true, changed });
};
