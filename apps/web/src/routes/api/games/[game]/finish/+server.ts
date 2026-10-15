/**
 * POST /api/games/[game]/finish  body: { runId, score, ticks, inputs }
 *   inputs 는 게임별 입력 기록(벽돌깨기: { m, l } — lib/games/breakout/log-codec.ts).
 *   → 200 { accepted, best, weekBest, rankWeek? }   accepted=false 면 기록만 남고 순위에는 들어가지 않았다
 *   → 200 { ready: false }                         순위 준비 중(표 없음)
 *   → 401 로그인 필요 · 404 모르는 게임 · 400 본문 모양 오류 · 413 본문이 너무 큼
 *   → 409 { error: 'unknown_run' }                 없음·만료·이미 낸 판·남의 판·새 판으로 바뀐 판
 *   → 429 속도 제한 · 503 저장소 장애
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUser } from '$lib/server/auth';
import { finishRun, resolveGame, type FinishBody } from '$lib/server/game-ranking/service';
import { hitLimit } from '$lib/server/game-ranking/limits';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const POST: RequestHandler = async ({ params, request, cookies }) => {
    const user = await getAuthUser(cookies);
    if (!user) return json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE });

    const found = resolveGame(params.game, '');
    if (!found) return json({ error: 'unknown_game' }, { status: 404, headers: NO_STORE });
    const { game } = found;

    const retryAfter = hitLimit('finish', user.mb_id);
    if (retryAfter !== null) {
        return json(
            { error: 'rate_limited' },
            {
                status: 429,
                headers: { ...NO_STORE, 'Retry-After': String(retryAfter) }
            }
        );
    }

    // 본문 크기 상한 — 선언된 길이로 먼저, 읽은 뒤 실제 길이로 한 번 더
    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > game.maxBodyBytes) {
        return json({ error: 'too_large' }, { status: 413, headers: NO_STORE });
    }
    let body: FinishBody;
    try {
        const text = await request.text();
        if (Buffer.byteLength(text, 'utf8') > game.maxBodyBytes) {
            return json({ error: 'too_large' }, { status: 413, headers: NO_STORE });
        }
        const parsed = JSON.parse(text) as Record<string, unknown> | null;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        body = {
            runId: parsed.runId,
            score: parsed.score,
            ticks: parsed.ticks,
            inputs: parsed.inputs
        };
    } catch {
        return json({ error: 'bad_request' }, { status: 400, headers: NO_STORE });
    }

    const r = await finishRun(game, user.mb_id, body);
    switch (r.kind) {
        case 'ok': {
            const out: Record<string, unknown> = {
                accepted: r.accepted,
                best: r.standing.best,
                weekBest: r.standing.weekBest
            };
            if (r.standing.rankWeek) out.rankWeek = r.standing.rankWeek;
            return json(out, { headers: NO_STORE });
        }
        case 'unknown_run':
            return json(
                { accepted: false, error: 'unknown_run' },
                { status: 409, headers: NO_STORE }
            );
        case 'not_ready':
            return json({ ready: false, accepted: false }, { headers: NO_STORE });
        default:
            return json(
                { accepted: false, error: 'unavailable' },
                { status: 503, headers: NO_STORE }
            );
    }
};
