/**
 * 게임 점수 순위 — 브라우저 쪽 요청 (공용 API /api/games/[game]/…).
 *
 *   POST start  { variant? }                    → { ready: true, runId, seed } | { ready: false }
 *   POST finish { runId, score, ticks, inputs } → { accepted, best, weekBest, rankWeek? }
 *   GET  leaderboard?period=week|all&variant=   → { ready, rows, weekStart? }
 *
 * start·finish 는 로그인 쿠키로 인증한다. 실패하거나 늦으면 null 을 돌려주고, 게임은 로컬 시드로 그대로
 * 진행한다(「기록 미등록」). 서버는 seed 와 입력 기록으로 판을 다시 돌려 점수를 직접 계산한다.
 */

/** 시작 요청을 기다리는 최대 시간 — 넘기면 로컬 모드 */
export const RANK_START_TIMEOUT_MS = 3000;
/** 서버의 회원당 시작 간격 — 화면은 여기에 여유를 더해 부른다 */
export const RANK_START_GAP_MS = 5000;
/** 기록 요청을 기다리는 최대 시간 */
export const RANK_FINISH_TIMEOUT_MS = 10000;
/** 순위표 줄 수 */
export const RANK_BOARD_SIZE = 10;

export interface ScoreRun {
    runId: string;
    seed: number;
}

export interface ScoreFinishResult {
    /** 검사를 통과해 순위에 반영됐는가 */
    accepted: boolean;
    /** 역대 최고 (없으면 null) */
    best: number | null;
    /** 이번 주 최고 (없으면 null) */
    weekBest: number | null;
    /** 이번 주 순위 */
    rankWeek?: number;
}

export interface ScoreBoardRow {
    rank: number;
    nickname: string;
    score: number;
    achievedAt?: string;
}

export interface ScoreBoard {
    /** false = 순위 준비 중 */
    ready: boolean;
    rows: ScoreBoardRow[];
    weekStart?: string;
}

type FetchFn = typeof fetch;

async function postJSON(
    url: string,
    body: unknown,
    timeoutMs: number,
    fetchFn: FetchFn
): Promise<{ status: number; data: unknown } | null> {
    const ctrl = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer = setTimeout(() => ctrl?.abort(), timeoutMs);
    try {
        const r = await fetchFn(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body),
            signal: ctrl?.signal
        });
        let data: unknown = null;
        try {
            data = await r.json();
        } catch {
            data = null;
        }
        return { status: r.status, data };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function nullableNum(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * 판 시작 — 시드를 받는다. 실패·시간 초과·순위 준비 중이면 null(로컬 모드).
 * 시작 간격 제한(429)은 'rate_limited', 순위 준비 중은 'not_ready' 로 따로 알린다.
 */
export async function startScoreRun(
    game: string,
    variant = '',
    fetchFn: FetchFn = fetch
): Promise<ScoreRun | 'rate_limited' | 'not_ready' | null> {
    const r = await postJSON(
        `/api/games/${encodeURIComponent(game)}/start`,
        { variant },
        RANK_START_TIMEOUT_MS,
        fetchFn
    );
    if (!r) return null;
    if (r.status === 429) return 'rate_limited';
    if (r.status !== 200 || !r.data || typeof r.data !== 'object') return null;
    const d = r.data as Record<string, unknown>;
    if (d.ready === false) return 'not_ready';
    const seed = d.seed;
    if (typeof d.runId !== 'string' || d.runId === '') return null;
    if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
        return null;
    }
    return { runId: d.runId, seed };
}

/** 기록 제출 — 실패하면 null */
export async function finishScoreRun(
    game: string,
    body: { runId: string; score: number; ticks: number; inputs: unknown },
    fetchFn: FetchFn = fetch
): Promise<ScoreFinishResult | null> {
    const r = await postJSON(
        `/api/games/${encodeURIComponent(game)}/finish`,
        body,
        RANK_FINISH_TIMEOUT_MS,
        fetchFn
    );
    if (!r || r.status !== 200 || !r.data || typeof r.data !== 'object') return null;
    const d = r.data as Record<string, unknown>;
    if (d.ready === false) return null;
    const out: ScoreFinishResult = {
        accepted: d.accepted === true,
        best: nullableNum(d.best),
        weekBest: nullableNum(d.weekBest)
    };
    if (typeof d.rankWeek === 'number' && d.rankWeek > 0) out.rankWeek = d.rankWeek;
    return out;
}

/** 순위표 — 실패하면 throw. fresh=true 면 브라우저 캐시를 건너뛴다(기록을 낸 직후) */
export async function fetchScoreBoard(
    game: string,
    period: 'week' | 'all',
    opts: { variant?: string; fresh?: boolean; fetchFn?: FetchFn } = {}
): Promise<ScoreBoard> {
    const fetchFn = opts.fetchFn ?? fetch;
    const q = new URLSearchParams({ period });
    if (opts.variant) q.set('variant', opts.variant);
    const r = await fetchFn(
        `/api/games/${encodeURIComponent(game)}/leaderboard?${q.toString()}`,
        opts.fresh ? { cache: 'no-cache' } : undefined
    );
    if (!r.ok) throw new Error(String(r.status));
    const body = (await r.json()) as Record<string, unknown> | null;
    const list = body?.rows;
    const rows = Array.isArray(list) ? (list as ScoreBoardRow[]).slice(0, RANK_BOARD_SIZE) : [];
    return {
        ready: body?.ready !== false,
        rows,
        weekStart: typeof body?.weekStart === 'string' ? body.weekStart : undefined
    };
}
