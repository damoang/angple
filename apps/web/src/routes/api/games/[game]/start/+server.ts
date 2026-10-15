/**
 * POST /api/games/[game]/start  body: { variant?: string }
 *   → 200 { ready: true, runId, seed }
 *   → 200 { ready: false }            순위 준비 중(표 없음) — 게임은 로컬로 진행
 *   → 401 로그인 필요 · 404 모르는 게임 · 400 모르는 변형
 *   → 429 { error: 'rate_limited' }   시작 간격(5초) 또는 속도 제한
 *   → 503 { error: 'unavailable' }    판 보관소 장애 — 게임은 로컬로 진행
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUser } from '$lib/server/auth';
import { resolveGame, startRun } from '$lib/server/game-ranking/service';
import { hitLimit } from '$lib/server/game-ranking/limits';

const NO_STORE = { 'Cache-Control': 'no-store' };

async function readVariant(request: Request): Promise<string | null> {
    try {
        const text = await request.text();
        if (!text || text.length > 1024) return '';
        const body = JSON.parse(text) as { variant?: unknown };
        if (body?.variant === undefined) return '';
        return typeof body.variant === 'string' ? body.variant : null;
    } catch {
        return '';
    }
}

export const POST: RequestHandler = async ({ params, request, cookies }) => {
    const user = await getAuthUser(cookies);
    if (!user) return json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });

    const variant = await readVariant(request);
    const found = resolveGame(params.game, variant);
    if (!found) {
        const known = resolveGame(params.game, '') !== null;
        return json(
            { error: known ? 'bad_variant' : 'unknown_game' },
            {
                status: known ? 400 : 404,
                headers: NO_STORE
            }
        );
    }

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
