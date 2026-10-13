/**
 * 뱀 게임 기록 — 앙쌓기 혼자하기와 같은 서버(stack-ws)·같은 방식.
 *
 *   POST /stack-ws/snake/start  → { runId, seed }
 *   POST /stack-ws/snake/finish { runId, inputs: [[틱, 방향], …], score }
 *                               → { accepted, best, weekBest, rankWeek? }
 *
 * 두 요청 모두 Authorization: Bearer 토큰이 필요하다. 실패하거나 늦으면(시작 3초) null 을 돌려주고,
 * 화면은 로컬 무작위 시드로 그대로 진행한다(「기록 미등록」).
 * 서버는 seed 와 입력 기록으로 판을 처음부터 다시 돌려(engine.ts 와 같은 규칙) 점수를 맞춰 본다.
 */
import { postJSON, type RequestOptions, type TokenGetter } from '$lib/games/stack/solo-record';
import type { SnakeInput } from './engine';

/** 시작 요청을 기다리는 최대 시간 — 넘기면 로컬 모드로 시작한다 */
export const SNAKE_START_TIMEOUT_MS = 3000;
/** 서버가 판 시작을 받아 주는 최소 간격(회원당) — 화면은 여기에 여유를 더해 부른다 */
export const SNAKE_START_GAP_MS = 5000;
/** 기록 요청을 기다리는 최대 시간 */
export const SNAKE_FINISH_TIMEOUT_MS = 8000;
/** 브라우저에 남기는 내 최고 점수 키 */
export const SNAKE_BEST_KEY = 'angple_snake_best';

export interface SnakeRun {
    runId: string;
    seed: number;
}

export interface SnakeFinishResult {
    /** 검사를 통과해 점수판에 반영됐는가 */
    accepted: boolean;
    /** 역대 최고 점수 */
    best: number;
    /** 이번 주 최고 점수 */
    weekBest: number;
    /** 이번 주 순위 (기록이 없으면 없음) */
    rankWeek?: number;
}

function num(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** finish 요청 본문 — 필드 이름은 서버와 같다 */
export function buildSnakeFinishBody(runId: string, inputs: SnakeInput[], score: number) {
    return { runId, inputs: inputs.map(([t, d]) => [t, d]), score };
}

/**
 * 판 시작 — 시드를 받는다. 실패·시간 초과(3초)면 null (로컬 모드).
 * 서버의 시작 간격 제한(429)은 실패가 아니라 「아직 아님」이라 'rate_limited' 로 따로 알린다.
 */
export async function startSnakeRun(
    getToken: TokenGetter,
    opts: RequestOptions = {}
): Promise<SnakeRun | 'rate_limited' | null> {
    const r = await postJSON('/snake/start', {}, getToken, opts, SNAKE_START_TIMEOUT_MS);
    if (r?.status === 429) return 'rate_limited';
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
export async function finishSnakeRun(
    runId: string,
    inputs: SnakeInput[],
    score: number,
    getToken: TokenGetter,
    opts: RequestOptions = {}
): Promise<SnakeFinishResult | null> {
    const r = await postJSON(
        '/snake/finish',
        buildSnakeFinishBody(runId, inputs, score),
        getToken,
        opts,
        SNAKE_FINISH_TIMEOUT_MS
    );
    if (!r || r.status !== 200 || !r.data || typeof r.data !== 'object') return null;
    const d = r.data as Record<string, unknown>;
    const out: SnakeFinishResult = {
        accepted: d.accepted === true,
        best: num(d.best),
        weekBest: num(d.weekBest)
    };
    if (typeof d.rankWeek === 'number' && d.rankWeek > 0) out.rankWeek = d.rankWeek;
    return out;
}

/** 브라우저에 남긴 내 최고 점수 — 읽을 수 없으면 0 */
export function loadLocalBest(storage: Pick<Storage, 'getItem'> | null = null): number {
    try {
        const s = storage ?? localStorage;
        const v = Number(s.getItem(SNAKE_BEST_KEY));
        return Number.isInteger(v) && v > 0 ? v : 0;
    } catch {
        return 0;
    }
}

/** 내 최고 점수를 브라우저에 남긴다 — 저장할 수 없으면(사생활 보호 모드 등) 조용히 넘어간다 */
export function saveLocalBest(value: number, storage: Pick<Storage, 'setItem'> | null = null) {
    try {
        const s = storage ?? localStorage;
        s.setItem(SNAKE_BEST_KEY, String(value));
    } catch {
        // 이번 방문 동안만 기억
    }
}
