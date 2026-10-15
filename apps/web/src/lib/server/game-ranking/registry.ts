/**
 * 순위가 있는 게임 등록부 — 게임마다 재생 규칙·정렬 방향·상한을 여기 한 곳에서 정한다.
 *
 * 새 게임은 항목 하나만 더한다. replay 는 브라우저와 같은 엔진 코드를 그대로 import 해서 돌린다
 * (서버가 시드+입력 기록으로 판을 처음부터 다시 돌려 점수를 직접 계산한다).
 */
import {
    MAX_TICKS as BREAKOUT_MAX_TICKS,
    replay as replayBreakout
} from '$lib/games/breakout/engine';
import { decodeLog } from '$lib/games/breakout/log-codec';

/** 재생 결과 — error 가 있으면 기록이 엔진 규칙과 맞지 않는다(점수는 의미 없음) */
export interface ReplayOutcome {
    score: number;
    ticks: number;
    /** 거부 사유 코드(짧은 영문). 통과면 없음 */
    error?: string;
}

export interface RankedGame {
    /** game_id 열 값 (16자 이하) */
    gameId: string;
    /** 허용하는 variant 값들. 변형이 없는 게임은 [''] */
    variants: readonly string[];
    /** true = 점수가 높을수록 위, false = 낮을수록 위 */
    higherIsBetter: boolean;
    /** engine_ver 열 값 — 엔진 규칙이나 기록 형식이 바뀌면 올린다 */
    engineVer: number;
    /** 순위에 받는 판 길이 상한(틱) */
    maxTicks: number;
    /** 1초 틱 수 — 서버 경과 시간과 비교할 시뮬레이션 시간 계산용 */
    tickHz: number;
    /** finish 요청 본문 상한(바이트) */
    maxBodyBytes: number;
    /** 시드·입력 기록으로 판을 다시 돌린다. inputs 는 요청 본문 그대로(모양 검사는 여기서) */
    replay(seed: number, inputs: unknown, ticks: number, variant: string): ReplayOutcome;
}

/**
 * 벽돌깨기 finish 본문 상한.
 * 기록은 판 길이 × 2글자 이하(log-codec.ts) → 1시간 판 = 432,000글자 + 발사·나머지 필드.
 * 서버 기본 요청 본문 상한(512KB)보다 작게 둔다.
 */
export const BREAKOUT_MAX_BODY_BYTES = 450 * 1024;

const breakout: RankedGame = {
    gameId: 'breakout',
    variants: [''],
    higherIsBetter: true,
    engineVer: 1,
    maxTicks: BREAKOUT_MAX_TICKS,
    tickHz: 60,
    maxBodyBytes: BREAKOUT_MAX_BODY_BYTES,
    replay(seed, inputs, ticks) {
        const log = decodeLog(inputs, ticks);
        if (!log) return { score: 0, ticks: 0, error: 'bad_log' };
        const res = replayBreakout(seed, log, ticks);
        if (!res.ok)
            return { score: res.game.score, ticks: res.game.tick, error: `replay_${res.error}` };
        return { score: res.game.score, ticks: res.game.tick };
    }
};

const GAMES: Record<string, RankedGame> = { breakout };

/** 등록된 게임 — 없으면 null */
export function getRankedGame(gameId: string): RankedGame | null {
    return Object.prototype.hasOwnProperty.call(GAMES, gameId) ? GAMES[gameId] : null;
}
