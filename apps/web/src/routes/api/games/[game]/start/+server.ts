/**
 * POST /api/games/[game]/start  body: { variant?: string }
 *   → 200 { ready: true, runId, seed }
 *   → 200 { ready: false }            순위 준비 중(표 없음) — 게임은 로컬로 진행
 *   → 401 로그인 필요 · 404 모르는 게임 · 400 모르는 변형 · 413 본문이 큼(1KB) · 415 JSON 아님
 *   → 429 { error: 'rate_limited' }   시작 간격(5초) 또는 속도 제한
 *   → 503 { error: 'unavailable' }    판 보관소 장애 — 게임은 로컬로 진행
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUser } from '$lib/server/auth';
import { resolveGame, startRun } from '$lib/server/game-ranking/service';
import { hitLimit } from '$lib/server/game-ranking/limits';
import { readJsonBody } from '$lib/server/game-ranking/body';

const NO_STORE = { 'Cache-Control': 'no-store' };
/** start 본문 상한 — { variant } 하나뿐이다 */
const START_BODY_MAX = 1024;

/** 본문의 variant — 없으면 '', 문자열이 아니면 null(모르는 변형) */
function parseVariant(text: string): string | null {
    if (!text) return '';
    try {
        const body = JSON.parse(text) as { variant?: unknown } | null;
        if (!body || body.variant === undefined) return '';
        return typeof body.variant === 'string' ? body.variant : null;
    } catch {
        return null;
    }
}

export const POST: RequestHandler = async ({ params, request, cookies }) => {
    const user = await getAuthUser(cookies);
    if (!user) return json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });

    if (!resolveGame(params.game, '')) {
        return json({ error: 'unknown_game' }, { status: 404, headers: NO_STORE });
    }

    // 속도 제한은 본문을 읽기 전에
    const retryAfter = hitLimit('start', user.mb_id);
    if (retryAfter !== null) {
        return json(
            { error: 'rate_limited' },
            {
                status: 429,
                headers: { ...NO_STORE, 'Retry-After': String(retryAfter) }
            }
        );
    }

    const read = await readJsonBody(request, START_BODY_MAX);
    if (!read.ok) return json({ error: read.error }, { status: read.status, headers: NO_STORE });
    const found = resolveGame(params.game, parseVariant(read.text));
    if (!found) return json({ error: 'bad_variant' }, { status: 400, headers: NO_STORE });

    const r = await startRun(found.game, found.variant, user.mb_id);
    switch (r.kind) {
        case 'ok':
            return json({ ready: true, runId: r.runId, seed: r.seed }, { headers: NO_STORE });
        case 'not_ready':
            return json({ ready: false }, { headers: NO_STORE });
        case 'rate_limited':
            return json({ error: 'rate_limited' }, { status: 429, headers: NO_STORE });
        default:
            return json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
    }
};
