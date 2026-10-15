/**
 * 게임 순위 — 판 발급(start)·기록 접수(finish)·순위표(leaderboard).
 *
 * 흐름 (뱀 게임 기록과 같은 방식)
 * 1) start: 서버가 {runId, seed} 를 발급한다(회원당 5초 간격·동시 1판·2시간 만료·1회용).
 * 2) 브라우저는 그 seed 로 판을 돌리고 입력 기록을 모은다.
 * 3) finish {runId, score, ticks, inputs}: 서버가 같은 엔진 코드로 seed+입력을 처음부터 다시 돌려 점수·판 길이를
 *    직접 계산한다. 신고 점수와 다르면 score_mismatch, 시뮬레이션 시간이 서버가 잰 경과보다 길면 too_fast.
 *    의심 판은 거부하지 않고 flagged 로 기록만 남긴다(순위표에는 넣지 않는다).
 */
import { randomBytes, randomInt } from 'node:crypto';
import { getRankedGame, type RankedGame } from './registry';
import { redisRunStore, type IssuedRun, type RunStore } from './run-store';
import {
    TablesMissingError,
    saveRun,
    tablesReady,
    topRows,
    type BoardRow,
    type RunRecord,
    type Standing
} from './store';
import { kstWall, weekStartKST } from './kst';

/** 실경과에 더해 주는 비율 여유(브라우저 타이머 오차) */
export const TIME_SLACK_PERCENT = 5;
/** 고정 여유(요청 왕복 등) */
export const TIME_SLACK_MS = 2000;
/** 순위표 프로세스 캐시 */
export const BOARD_CACHE_MS = 60 * 1000;
/** flag_reason 열 길이 */
const FLAG_REASON_MAX = 64;
const SCORE_MAX = Number.MAX_SAFE_INTEGER;
const ELAPSED_MAX = 2147483647;

export interface ScoreStore {
    tablesReady(): Promise<boolean>;
    saveRun(rec: RunRecord, higherIsBetter: boolean): Promise<Standing>;
    topRows(
        gameId: string,
        variant: string,
        week: string | null,
        higherIsBetter: boolean
    ): Promise<BoardRow[]>;
}

export interface RankingDeps {
    runs: RunStore;
    store: ScoreStore;
    now(): number;
    newRunId(): string;
    newSeed(): number;
}

export const defaultDeps: RankingDeps = {
    runs: redisRunStore,
    store: { tablesReady: () => tablesReady(), saveRun, topRows },
    now: () => Date.now(),
    newRunId: () => 'g_' + randomBytes(15).toString('base64url'),
    newSeed: () => randomInt(0, 0x100000000)
};

/* ── 검사 (순수) ── */

export interface ClaimCheck {
    reasons: string[];
    /** 재생으로 얻은 점수·판 길이 */
    score: number;
    ticks: number;
}

/**
 * seed+입력을 다시 돌려 신고 점수·판 길이·서버 경과와 맞춰 본다. 통과면 reasons 가 빈 배열.
 * 사유: ticks_shape · bad_log · replay_* · score_shape · score_mismatch · too_fast
 */
export function checkClaim(
    game: RankedGame,
    variant: string,
    seed: number,
    claim: { score: unknown; ticks: unknown; inputs: unknown },
    elapsedMs: number
): ClaimCheck {
    const reasons: string[] = [];
    const ticks = claim.ticks;
    if (
        typeof ticks !== 'number' ||
        !Number.isSafeInteger(ticks) ||
        ticks < 0 ||
        ticks > game.maxTicks
    ) {
        reasons.push('ticks_shape');
        return { reasons, score: 0, ticks: 0 };
    }
    const rep = game.replay(seed, claim.inputs, ticks, variant);
    if (rep.error) reasons.push(rep.error);
    const score = claim.score;
    if (typeof score !== 'number' || !Number.isSafeInteger(score) || score < 0) {
        reasons.push('score_shape');
    } else if (!rep.error && score !== rep.score) {
        reasons.push('score_mismatch');
    }
    const elapsed = Math.max(0, elapsedMs);
    const simMs = Math.floor((ticks * 1000) / game.tickHz);
    if (simMs > elapsed + Math.floor((elapsed * TIME_SLACK_PERCENT) / 100) + TIME_SLACK_MS) {
        reasons.push('too_fast');
    }
    return { reasons, score: rep.score, ticks: rep.ticks };
}

/** 저장할 신고 점수 — 정수가 아니거나 범위를 넘으면 자른다 */
function storedScore(v: unknown): number {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return 0;
    return Math.min(Math.floor(v), SCORE_MAX);
}

/* ── start ── */

export type StartResult =
    | { kind: 'ok'; runId: string; seed: number }
    | { kind: 'not_ready' }
    | { kind: 'rate_limited' }
    | { kind: 'unavailable' };

export async function startRun(
    game: RankedGame,
    variant: string,
    mbId: string,
    deps: RankingDeps = defaultDeps
): Promise<StartResult> {
    if (!(await deps.store.tablesReady())) return { kind: 'not_ready' };
    const run: IssuedRun = {
        runId: deps.newRunId(),
        seed: deps.newSeed() >>> 0,
        mbId,
        gameId: game.gameId,
        variant,
        startedAt: deps.now()
    };
    try {
        const r = await deps.runs.issue(run);
        if (r === 'rate_limited') return { kind: 'rate_limited' };
    } catch (err) {
        console.error('[game-ranking] start failed:', (err as Error)?.message);
        return { kind: 'unavailable' };
    }
    return { kind: 'ok', runId: run.runId, seed: run.seed };
}

/* ── finish ── */

export interface FinishBody {
    runId: unknown;
    score: unknown;
    ticks: unknown;
    inputs: unknown;
}

export type FinishResult =
    | { kind: 'ok'; accepted: boolean; standing: Standing }
    | { kind: 'unknown_run' }
    | { kind: 'not_ready' }
    | { kind: 'unavailable' };

const RUN_ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

export async function finishRun(
    game: RankedGame,
    mbId: string,
    body: FinishBody,
    deps: RankingDeps = defaultDeps
): Promise<FinishResult> {
    const runId = body.runId;
    if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) return { kind: 'unknown_run' };
    let run: IssuedRun | null;
    try {
        run = await deps.runs.take(game.gameId, mbId, runId);
    } catch (err) {
        console.error('[game-ranking] take failed:', (err as Error)?.message);
        return { kind: 'unavailable' };
    }
    if (!run || run.mbId !== mbId || run.gameId !== game.gameId) return { kind: 'unknown_run' };

    const now = deps.now();
    const elapsedMs = Math.min(ELAPSED_MAX, Math.max(0, now - run.startedAt));
    const check = checkClaim(game, run.variant, run.seed, body, elapsedMs);
    const flagged = check.reasons.length > 0;
    let inputsJson = '';
    try {
        inputsJson = JSON.stringify(body.inputs ?? null) ?? '';
    } catch {
        inputsJson = '';
    }
    const rec: RunRecord = {
        gameId: game.gameId,
        variant: run.variant,
        runId: run.runId,
        mbId,
        seed: run.seed,
        // 통과한 판은 재생 점수 그대로, 의심 판은 신고 점수(감사용)
        score: flagged ? storedScore(body.score) : check.score,
        ticks: check.ticks,
        inputsJson,
        engineVer: game.engineVer,
        elapsedMs,
        flagged,
        flagReason: check.reasons.join(',').slice(0, FLAG_REASON_MAX),
        startedAt: kstWall(run.startedAt),
        finishedAt: kstWall(now),
        weekStart: weekStartKST(now)
    };
    try {
        const standing = await deps.store.saveRun(rec, game.higherIsBetter);
        if (!flagged) invalidateBoards(game.gameId, run.variant);
        return { kind: 'ok', accepted: !flagged, standing };
    } catch (err) {
        if (err instanceof TablesMissingError) return { kind: 'not_ready' };
        console.error('[game-ranking] save failed:', (err as Error)?.message);
        return { kind: 'unavailable' };
    }
}

/* ── leaderboard ── */

export type Period = 'week' | 'all';

export type BoardResult =
    | { kind: 'ok'; rows: BoardRow[]; weekStart?: string }
    | { kind: 'not_ready' }
    | { kind: 'unavailable' };

const boardCache = new Map<string, { at: number; rows: BoardRow[] }>();

function invalidateBoards(gameId: string, variant: string): void {
    const prefix = `${gameId}\n${variant}\n`;
    for (const k of boardCache.keys()) if (k.startsWith(prefix)) boardCache.delete(k);
}

/** 테스트용 */
export function clearBoardCache(): void {
    boardCache.clear();
}

export async function leaderboard(
    game: RankedGame,
    variant: string,
    period: Period,
    deps: RankingDeps = defaultDeps
): Promise<BoardResult> {
    const now = deps.now();
    const week = period === 'week' ? weekStartKST(now) : null;
    const key = `${game.gameId}\n${variant}\n${period}\n${week ?? ''}`;
    const hit = boardCache.get(key);
    if (hit && now - hit.at < BOARD_CACHE_MS) {
        return { kind: 'ok', rows: hit.rows, ...(week ? { weekStart: week } : {}) };
    }
    try {
        const rows = await deps.store.topRows(game.gameId, variant, week, game.higherIsBetter);
        boardCache.set(key, { at: now, rows });
        // 지난 주 표 등 오래된 항목 정리
        for (const [k, v] of boardCache) if (now - v.at >= BOARD_CACHE_MS) boardCache.delete(k);
        return { kind: 'ok', rows, ...(week ? { weekStart: week } : {}) };
    } catch (err) {
        if (err instanceof TablesMissingError) return { kind: 'not_ready' };
        console.error('[game-ranking] leaderboard failed:', (err as Error)?.message);
        return { kind: 'unavailable' };
    }
}

/** 요청의 게임·변형을 등록부에서 찾는다 — 모르는 값이면 null */
export function resolveGame(
    gameId: string,
    variant: string | null
): { game: RankedGame; variant: string } | null {
    const game = getRankedGame(gameId);
    if (!game) return null;
    const v = variant ?? '';
    if (!game.variants.includes(v)) return null;
    return { game, variant: v };
}
