/**
 * GET /api/games/[game]/leaderboard?period=week|all&variant=
 *   → 200 { ready: true, period, weekStart?, rows: [{ rank, nickname, score, achievedAt }] }  상위 10
 *   → 200 { ready: false, period, rows: [] }   순위 준비 중(표 없음)
 *   → 404 모르는 게임 · 400 모르는 기간·변형 · 429 속도 제한 · 503 장애
 * 공개(로그인 불요)·닉네임만. 서버 60초 캐시 + 브라우저 60초 캐시.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { leaderboard, resolveGame, BOARD_CACHE_MS } from '$lib/server/game-ranking/service';
import { hitLimit } from '$lib/server/game-ranking/limits';
import { resolveClientIp } from '$lib/server/rate-limit';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const GET: RequestHandler = async ({ params, url, request, getClientAddress }) => {
    const periodParam = url.searchParams.get('period') ?? 'week';
    if (periodParam !== 'week' && periodParam !== 'all') {
        return json({ error: 'bad_period' }, { status: 400, headers: NO_STORE });
    }
    const period = periodParam;
    const found = resolveGame(params.game, url.searchParams.get('variant') ?? '');
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

    // 공개 읽기 — IP 를 못 구하면 제한을 건너뛴다
    const ip = resolveClientIp(getClientAddress, request);
    if (ip) {
        const retryAfter = hitLimit('board', ip);
        if (retryAfter !== null) {
            return json(
                { error: 'rate_limited' },
                {
                    status: 429,
                    headers: { ...NO_STORE, 'Retry-After': String(retryAfter) }
                }
            );
        }
    }

    const r = await leaderboard(found.game, found.variant, period);
    if (r.kind === 'ok') {
        return json(
            {
                ready: true,
                period,
                ...(r.weekStart ? { weekStart: r.weekStart } : {}),
                rows: r.rows
            },
            { headers: { 'Cache-Control': `public, max-age=${BOARD_CACHE_MS / 1000}` } }
        );
    }
    if (r.kind === 'not_ready') {
        return json(
            { ready: false, period, rows: [] },
            { headers: { 'Cache-Control': `public, max-age=${BOARD_CACHE_MS / 1000}` } }
        );
    }
    return json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
};
