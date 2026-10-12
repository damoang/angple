/**
 * 내 키워드 알림 API
 * GET    /api/my/keyword-alerts          — 내 키워드 목록
 * POST   /api/my/keyword-alerts          — 키워드 추가 (body: { keyword })
 * DELETE /api/my/keyword-alerts?id=123   — 키워드 삭제 (내 것만)
 *
 * 새 글 제목에 키워드가 들어가면 백엔드 글 작성 후처리가 알림을 보낸다.
 * 여기는 g5_member_keyword_alert 의 내 행만 읽고 쓴다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { internalOnlyErrorResponse, isInternalAppRequest } from '$lib/server/internal-api.js';
import {
    KEYWORD_ALERT_MAX_COUNT,
    keywordAlertErrorMessage,
    keywordAlertErrorStatus,
    validateKeywordAlert
} from '$lib/utils/keyword-alert.js';

interface KeywordRow extends RowDataPacket {
    id: number;
    keyword: string;
}

interface KeywordAlertItem {
    id: number;
    keyword: string;
}

async function listKeywords(mbId: string): Promise<KeywordAlertItem[]> {
    const [rows] = await pool.query<KeywordRow[]>(
        'SELECT id, keyword FROM g5_member_keyword_alert WHERE mb_id = ? ORDER BY id ASC',
        [mbId]
    );
    return rows.map((r) => ({ id: Number(r.id), keyword: String(r.keyword) }));
}

function listResponse(keywords: KeywordAlertItem[], status = 200): Response {
    return json({ success: true, data: { keywords, max: KEYWORD_ALERT_MAX_COUNT } }, { status });
}

function unauthorized(): Response {
    return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
}

function isDuplicateEntry(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === 'ER_DUP_ENTRY';
}

function isDeadlock(error: unknown): boolean {
    const e = error as { code?: string; errno?: number } | null;
    return e?.code === 'ER_LOCK_DEADLOCK' || e?.errno === 1213;
}

/** GET: 내 키워드 목록 */
export const GET: RequestHandler = async ({ cookies, request }) => {
    if (!isInternalAppRequest(request)) return internalOnlyErrorResponse();

    const user = await getAuthUser(cookies);
    if (!user) return unauthorized();

    try {
        return listResponse(await listKeywords(user.mb_id));
    } catch (error) {
        console.error('[Keyword Alerts API] GET error:', error);
        return json(
            { success: false, message: '키워드 목록을 불러오지 못했습니다.' },
            { status: 500 }
        );
    }
};

/** POST: 키워드 추가 */
export const POST: RequestHandler = async ({ cookies, request }) => {
    if (!isInternalAppRequest(request)) return internalOnlyErrorResponse();

    const user = await getAuthUser(cookies);
    if (!user) return unauthorized();

    let raw: unknown = '';
    try {
        const body = await request.json();
        raw = body?.keyword;
    } catch {
        // body 없음 → 아래 검증에서 empty 로 거절
    }

    try {
        const existing = await listKeywords(user.mb_id);
        const result = validateKeywordAlert(
            raw,
            existing.map((k) => k.keyword)
        );
        if (!result.ok) {
            return json(
                { success: false, error: result.error, message: result.message },
                { status: keywordAlertErrorStatus(result.error) }
            );
        }

        // 동시 요청으로 상한을 넘지 않도록 개수 조건을 INSERT 안에서 다시 확인한다.
        let inserted: ResultSetHeader;
        try {
            [inserted] = await pool.query<ResultSetHeader>(
                `INSERT INTO g5_member_keyword_alert (mb_id, keyword)
                 SELECT ?, ? FROM DUAL
                 WHERE (SELECT COUNT(*) FROM g5_member_keyword_alert WHERE mb_id = ?) < ?`,
                [user.mb_id, result.keyword, user.mb_id, KEYWORD_ALERT_MAX_COUNT]
            );
        } catch (error) {
            // UNIQUE(mb_id, keyword) — 동시 요청이나 콜레이션 기준 중복(악센트 등)
            if (isDuplicateEntry(error)) {
                return json(
                    {
                        success: false,
                        error: 'duplicate',
                        message: keywordAlertErrorMessage('duplicate')
                    },
                    { status: 409 }
                );
            }
            // 같은 회원의 동시 추가끼리 INSERT … SELECT 잠금이 엇갈리면 교착으로 한쪽이 진다.
            // 서버 오류가 아니라 「다시 시도」로 풀리는 충돌이다.
            if (isDeadlock(error)) {
                return json(
                    {
                        success: false,
                        error: 'conflict',
                        message: '동시에 여러 요청이 처리되고 있습니다. 잠시 후 다시 시도해 주세요.'
                    },
                    { status: 409 }
                );
            }
            throw error;
        }

        if (!inserted.affectedRows) {
            return json(
                { success: false, error: 'limit', message: keywordAlertErrorMessage('limit') },
                { status: 409 }
            );
        }

        return listResponse(await listKeywords(user.mb_id), 201);
    } catch (error) {
        console.error('[Keyword Alerts API] POST error:', error);
        return json({ success: false, message: '키워드를 추가하지 못했습니다.' }, { status: 500 });
    }
};

/** DELETE: 키워드 삭제 — 내 행만 지운다 */
export const DELETE: RequestHandler = async ({ cookies, request, url }) => {
    if (!isInternalAppRequest(request)) return internalOnlyErrorResponse();

    const user = await getAuthUser(cookies);
    if (!user) return unauthorized();

    const id = Number(url.searchParams.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) {
        return json({ success: false, message: '삭제할 키워드를 지정해 주세요.' }, { status: 400 });
    }

    try {
        const [result] = await pool.query<ResultSetHeader>(
            'DELETE FROM g5_member_keyword_alert WHERE id = ? AND mb_id = ?',
            [id, user.mb_id]
        );
        if (!result.affectedRows) {
            return json({ success: false, message: '키워드를 찾을 수 없습니다.' }, { status: 404 });
        }
        return listResponse(await listKeywords(user.mb_id));
    } catch (error) {
        console.error('[Keyword Alerts API] DELETE error:', error);
        return json({ success: false, message: '키워드를 삭제하지 못했습니다.' }, { status: 500 });
    }
};
