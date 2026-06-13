/**
 * 게시판 구독 API
 * GET    /api/boards/[boardId]/subscribe — 구독 상태 조회
 * POST   /api/boards/[boardId]/subscribe — 구독
 * DELETE /api/boards/[boardId]/subscribe — 구독 해제
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { isInternalAppRequest } from '$lib/server/internal-api.js';

interface SubRow extends RowDataPacket {
    id: number;
    level: number;
}

/** 구독 단계: 1=전체(모든 글), 2=인기글만 */
function normalizeLevel(v: unknown): 1 | 2 {
    return Number(v) === 2 ? 2 : 1;
}

interface CountRow extends RowDataPacket {
    count: number;
}

// "글 많은 게시판(busy)" 기준 — 최근 7일 글 수. 신규 구독 기본 단계 + UI 추천에 사용.
// 실측(2026-06): free 5,275/7d 가 유일하게 폭주(구독 알림 99%+), 차순위는 79 → 700 이면 명확히 분리.
// 임계 기반이라 향후 다른 게시판이 폭증해도 자동으로 '인기글만' 권장 (#12607).
const BUSY_BOARD_POSTS_7D = 700;
const BUSY_CACHE_TTL_MS = 600_000; // 트래픽 변화는 느리므로 10분 캐시 (hover 마다 COUNT 방지)
const busyCache = new Map<string, { busy: boolean; expiry: number }>();

/** 게시판이 글이 많아 '전체 알림' 시 폭주하는지 (10분 캐시). 오류/미존재 보드는 false. */
async function isBusyBoard(board: string): Promise<boolean> {
    // 동적 테이블명 인젝션 방지 — 하이픈 제외 영숫자/언더스코어만 허용.
    if (!/^[A-Za-z0-9_]+$/.test(board)) return false;
    const now = Date.now();
    const cached = busyCache.get(board);
    if (cached && now < cached.expiry) return cached.busy;
    let busy = false;
    try {
        const [rows] = await pool.query<CountRow[]>(
            `SELECT COUNT(*) AS count FROM g5_write_${board}
             WHERE wr_is_comment = 0 AND wr_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
        );
        busy = (rows[0]?.count ?? 0) >= BUSY_BOARD_POSTS_7D;
    } catch {
        busy = false; // 테이블 없음 등 → 안전하게 전체(1) 기본
    }
    busyCache.set(board, { busy, expiry: now + BUSY_CACHE_TTL_MS });
    return busy;
}

/** GET: 구독 상태 + 구독자 수 */
export const GET: RequestHandler = async ({ params, cookies, request }) => {
    const boardId = params.boardId?.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!boardId) {
        return json({ success: false, message: 'boardId가 필요합니다.' }, { status: 400 });
    }

    try {
        const isInternalRequest = isInternalAppRequest(request);
        const user = isInternalRequest ? await getAuthUser(cookies) : null;
        let isSubscribed = false;
        let level: 1 | 2 | null = null;

        if (user) {
            const [rows] = await pool.query<SubRow[]>(
                'SELECT id, level FROM g5_board_subscribe WHERE mb_id = ? AND bo_table = ?',
                [user.mb_id, boardId]
            );
            isSubscribed = rows.length > 0;
            if (isSubscribed) level = normalizeLevel(rows[0].level);
        }

        const [countRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_board_subscribe WHERE bo_table = ?',
            [boardId]
        );

        return json({
            success: true,
            data: {
                is_subscribed: isSubscribed,
                level,
                subscriber_count: countRows[0]?.count ?? 0,
                // 글 많은 게시판이면 UI 가 '인기글만'을 추천하고 '전체'에 경고 표시 (#12607)
                busy: await isBusyBoard(boardId)
            }
        });
    } catch (error) {
        console.error('Subscribe GET error:', error);
        return json({ success: false, message: '구독 상태 조회에 실패했습니다.' }, { status: 500 });
    }
};

/** POST: 구독 / 구독 단계 변경 (body: { level?: 1 | 2 }) */
export const POST: RequestHandler = async ({ params, cookies, request }) => {
    const boardId = params.boardId?.replace(/[^a-zA-Z0-9_-]/g, '');
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!boardId) {
        return json({ success: false, message: 'boardId가 필요합니다.' }, { status: 400 });
    }

    let level: 1 | 2 | null = null;
    try {
        const body = await request.json();
        if (body?.level !== undefined) level = normalizeLevel(body.level);
    } catch {
        // body 없음 → 아래에서 게시판 트래픽 기반 기본값 결정
    }
    // 명시적 level 미지정 시: 글 많은 게시판은 '인기글만'(2), 그 외는 '전체'(1)로 기본 설정.
    // free 등 폭주 게시판을 무심코 전체 구독해 알림이 넘치는 #12607 방지.
    if (level === null) {
        level = (await isBusyBoard(boardId)) ? 2 : 1;
    }

    try {
        // 신규 구독(insert) + 단계 변경(update) 모두 처리. INSERT IGNORE 후 UPDATE 로
        // (mb_id, bo_table) unique 유무와 무관하게 안전하게 동작.
        await pool.query<ResultSetHeader>(
            'INSERT IGNORE INTO g5_board_subscribe (mb_id, bo_table, level) VALUES (?, ?, ?)',
            [user.mb_id, boardId, level]
        );
        await pool.query<ResultSetHeader>(
            'UPDATE g5_board_subscribe SET level = ? WHERE mb_id = ? AND bo_table = ?',
            [level, user.mb_id, boardId]
        );

        const [countRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_board_subscribe WHERE bo_table = ?',
            [boardId]
        );

        return json({
            success: true,
            data: {
                is_subscribed: true,
                level,
                subscriber_count: countRows[0]?.count ?? 0
            }
        });
    } catch (error) {
        console.error('Subscribe POST error:', error);
        return json({ success: false, message: '구독에 실패했습니다.' }, { status: 500 });
    }
};

/** DELETE: 구독 해제 */
export const DELETE: RequestHandler = async ({ params, cookies }) => {
    const boardId = params.boardId?.replace(/[^a-zA-Z0-9_-]/g, '');
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!boardId) {
        return json({ success: false, message: 'boardId가 필요합니다.' }, { status: 400 });
    }

    try {
        await pool.query('DELETE FROM g5_board_subscribe WHERE mb_id = ? AND bo_table = ?', [
            user.mb_id,
            boardId
        ]);

        const [countRows] = await pool.query<CountRow[]>(
            'SELECT COUNT(*) AS count FROM g5_board_subscribe WHERE bo_table = ?',
            [boardId]
        );

        return json({
            success: true,
            data: {
                is_subscribed: false,
                level: null,
                subscriber_count: countRows[0]?.count ?? 0
            }
        });
    } catch (error) {
        console.error('Subscribe DELETE error:', error);
        return json({ success: false, message: '구독 해제에 실패했습니다.' }, { status: 500 });
    }
};
