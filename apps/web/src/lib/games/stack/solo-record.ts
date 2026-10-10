/**
 * 앙쌓기 혼자하기 기록 — 서버(stack-ws)에서 시드를 받아 시작하고, 끝나면 기록을 낸다.
 *
 *   POST /stack-ws/solo/start  → { runId, seed }
 *   POST /stack-ws/solo/finish { runId, score, lines, level, ticks, pieces, clears[] }
 *                              → { accepted, best, weekBest, rankWeek? }
 *
 * 두 요청 모두 Authorization: Bearer 토큰이 필요하다. 실패하거나 늦으면(시작 3초) null 을 돌려주고,
 * 화면은 지금처럼 로컬 무작위 시드로 진행한다(「기록 미등록」).
 * 서버는 versus.ts 의 soloClaimCheck 와 같은 식으로 기록을 검사한다 — 여기서 만드는 값이
 * 엔진에서 그대로 모은 값이어야 통과한다.
 */
import type { Game, StepResult } from './engine';
import type { SoloClaim } from './versus';

export const STACK_API_BASE = '/stack-ws';
/** 시작 요청을 기다리는 최대 시간 — 넘기면 로컬 모드로 시작한다 */
export const SOLO_START_TIMEOUT_MS = 3000;
/** 서버가 판 시작을 받아 주는 최소 간격(회원당) — 이보다 빨리 다시 시작하면 거절된다 */
export const SOLO_START_GAP_MS = 5000;
/** 기록 요청을 기다리는 최대 시간 */
export const SOLO_FINISH_TIMEOUT_MS = 8000;

/* ── 엔진에서 기록 모으기 ── */

export interface SoloTracker {
    /** 굳힌 조각 수 */
    pieces: number;
    /** 줄을 지운 순간마다 그때 지운 줄 수(1~4), 순서대로 */
    clears: number[];
}

export function createSoloTracker(): SoloTracker {
    return { pieces: 0, clears: [] };
}

/** step() 결과 하나를 기록에 더한다 — 틱마다 부른다 */
export function trackStep(t: SoloTracker, r: StepResult): void {
    if (r.locked) t.pieces++;
    if (r.cleared > 0) t.clears.push(r.cleared);
}

/** 끝난(또는 진행 중인) 판의 기록 신고 값 */
export function buildSoloClaim(g: Game, t: SoloTracker): SoloClaim {
    return {
        score: g.score,
        lines: g.lines,
        level: g.level,
        ticks: g.tick,
        pieces: t.pieces,
        clears: t.clears.slice()
    };
}

/** finish 요청 본문 — 필드 이름은 서버와 같다 */
export function buildFinishBody(runId: string, claim: SoloClaim) {
    return {
        runId,
        score: claim.score,
        lines: claim.lines,
        level: claim.level,
        ticks: claim.ticks,
        pieces: claim.pieces,
        clears: claim.clears
    };
}

/* ── 서버 요청 ── */

export interface SoloRun {
    runId: string;
    seed: number;
}

export interface SoloFinishResult {
    /** 검사를 통과해 점수판에 반영됐는가 */
    accepted: boolean;
    /** 역대 최고 점수 */
    best: number;
    /** 이번 주 최고 점수 */
    weekBest: number;
    /** 이번 주 순위 (기록이 없으면 없음) */
    rankWeek?: number;
}

/** fresh=true 면 캐시된 토큰 대신 새로 받아 온 토큰을 돌려준다. 없으면 null */
export type TokenGetter = (fresh: boolean) => Promise<string | null>;

export interface RequestOptions {
    fetch?: typeof fetch;
    timeoutMs?: number;
}

function num(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/**
 * 토큰을 붙여 POST 한다. 401 이면 토큰을 새로 받아 한 번 더 시도한다(접근 토큰은 수명이 짧다).
 * 시간 초과·네트워크 실패면 null.
 */
async function postJSON(
    path: string,
    body: unknown,
    getToken: TokenGetter,
    opts: RequestOptions,
    defaultTimeout: number
): Promise<{ status: number; data: unknown } | null> {
    const f = opts.fetch ?? fetch;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => {
            ctrl?.abort();
            resolve(null);
        }, opts.timeoutMs ?? defaultTimeout);
    });
    const work = (async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
            const token = await getToken(attempt > 0);
            if (!token) return null;
            const res = await f(`${STACK_API_BASE}${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(body),
                signal: ctrl?.signal
            });
            if (res.status === 401 && attempt === 0) continue;
            let data: unknown = null;
            try {
                data = await res.json();
            } catch {
                data = null;
            }
            return { status: res.status, data };
        }
        return null;
    })().catch(() => null);
    try {
        return await Promise.race([work, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

/** 판 시작 — 시드를 받는다. 실패·시간 초과(3초)면 null (로컬 모드) */
export async function startSoloRun(
    getToken: TokenGetter,
    opts: RequestOptions = {}
): Promise<SoloRun | null> {
    const r = await postJSON('/solo/start', {}, getToken, opts, SOLO_START_TIMEOUT_MS);
    if (!r || r.status !== 200 || !r.data || typeof r.data !== 'object') return null;
    const d = r.data as Record<string, unknown>;
    const seed = d.seed;
    if (typeof d.runId !== 'string' || d.runId === '') return null;
    if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
        return null;
    }
    return { runId: d.runId, seed };
}

/** 기록 제출 — 실패하면 null */
export async function finishSoloRun(
    runId: string,
    claim: SoloClaim,
    getToken: TokenGetter,
    opts: RequestOptions = {}
): Promise<SoloFinishResult | null> {
    const r = await postJSON(
        '/solo/finish',
        buildFinishBody(runId, claim),
        getToken,
        opts,
        SOLO_FINISH_TIMEOUT_MS
    );
    if (!r || r.status !== 200 || !r.data || typeof r.data !== 'object') return null;
    const d = r.data as Record<string, unknown>;
    const out: SoloFinishResult = {
        accepted: d.accepted === true,
        best: num(d.best),
        weekBest: num(d.weekBest)
    };
    if (typeof d.rankWeek === 'number' && d.rankWeek > 0) out.rankWeek = d.rankWeek;
    return out;
}
