/**
 * 순위가 있는 게임 등록부 — 게임마다 재생 규칙·정렬 방향·상한을 여기 한 곳에서 정한다.
 *
 * 새 게임은 항목 하나만 더한다. replay 는 브라우저와 같은 엔진 코드를 그대로 import 해서 돌린다
 * (서버가 시드+입력 기록으로 판을 처음부터 다시 돌려 점수를 직접 계산한다).
 */
import { replay as replayBreakout } from '$lib/games/breakout/engine';
import { decodeLog } from '$lib/games/breakout/log-codec';
import { BREAKOUT_RANKED_MAX_TICKS } from '$lib/games/breakout/ranked';

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
    /**
     * runs.inputs_json 에 남길 값 — 모양이 맞고 판 길이에 걸맞은 크기일 때만 JSON 문자열, 아니면 null.
     * (위조·쓰레기 본문이 DB 에 그대로 쌓이지 않게)
     */
    storableInputs(inputs: unknown, ticks: number): string | null;
}

/**
 * 벽돌깨기 finish 본문 상한.
 * 기록은 판 길이 × 2글자 이하(log-codec.ts) → 1시간 판 = 432,000글자 + 발사·나머지 필드.
 * 서버 전체 본문 상한과 별개로 이 값에서 읽기를 끊는다(body.ts).
 */
export const BREAKOUT_MAX_BODY_BYTES = 450 * 1024;
/** 저장할 기록 크기 여유(글자) — 발사 기록 몫 */
const BREAKOUT_STORE_SLACK = 256;

const breakout: RankedGame = {
    gameId: 'breakout',
    variants: [''],
    higherIsBetter: true,
    engineVer: 1,
    // 순위 판 길이 상한(20분) — 최악의 재생 비용을 묶는다(ranked.ts)
    maxTicks: BREAKOUT_RANKED_MAX_TICKS,
    tickHz: 60,
    maxBodyBytes: BREAKOUT_MAX_BODY_BYTES,
    replay(seed, inputs, ticks) {
        const log = decodeLog(inputs, ticks);
        if (!log) return { score: 0, ticks: 0, error: 'bad_log' };
        const res = replayBreakout(seed, log, ticks);
        if (!res.ok)
            return { score: res.game.score, ticks: res.game.tick, error: `replay_${res.error}` };
        return { score: res.game.score, ticks: res.game.tick };
    },
    storableInputs(inputs, ticks) {
        if (!Number.isSafeInteger(ticks) || ticks < 0) return null;
        if (!decodeLog(inputs, ticks)) return null;
        const { m, l } = inputs as { m: string; l: string };
        // 엔진이 만든 기록은 판 길이 × 2글자를 넘지 않는다(발사는 판마다 몇 번뿐)
        if (m.length + l.length > 2 * ticks + BREAKOUT_STORE_SLACK) return null;
        return JSON.stringify({ m, l });
    }
};

const GAMES: Record<string, RankedGame> = { breakout };

/** 등록된 게임 — 없으면 null */
export function getRankedGame(gameId: string): RankedGame | null {
    return Object.prototype.hasOwnProperty.call(GAMES, gameId) ? GAMES[gameId] : null;
}
