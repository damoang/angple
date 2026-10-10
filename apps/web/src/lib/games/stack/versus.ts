/**
 * 앙쌓기 대전 규칙·판 직렬화·메시지 형식 — DOM 없음.
 *
 * 각 클라이언트는 자기 엔진(engine.ts)을 돌리고, 서버는 시드·방해 줄·판정·시간만 맡는다.
 * 여기 있는 표와 식은 서버(stack-ws)와 같은 값이어야 한다 — 바꿀 때는 양쪽을 함께 바꾼다.
 */
import { COLS, LINES_PER_LEVEL, ROWS, TICK_MS, scoreFor } from './engine';

/** 1초당 고정 틱 수 */
export const TICKS_PER_SEC = 60;

/* ── 대전 모드 ── */

export type RuleId = 'attack' | 'sprint40';
export type MatchMode = 'random' | 'favorite';

export interface SpeedUp {
    /** 이 시각(초)부터 최소 레벨이 오른다 */
    startSec: number;
    /** 이 간격(초)마다 최소 레벨 +1 */
    everySec: number;
}

export interface RuleDef {
    id: RuleId;
    label: string;
    /** 줄을 지우면 상대에게 방해 줄을 보내는가 */
    garbage: boolean;
    /** 이 줄 수를 먼저 지우면 승리 (없으면 null) */
    goalLines: number | null;
    /** 제한 시간(초) — 넘기면 규칙별 판정 */
    timeLimitSec: number;
    /** 시간이 지나면 빨라지는 규칙 (없으면 null) */
    speedUp: SpeedUp | null;
}

export const RULES: Record<RuleId, RuleDef> = {
    attack: {
        id: 'attack',
        label: '공격 모드',
        garbage: true,
        goalLines: null,
        timeLimitSec: 600,
        speedUp: { startSec: 120, everySec: 30 }
    },
    sprint40: {
        id: 'sprint40',
        label: '40줄 스프린트',
        garbage: false,
        goalLines: 40,
        timeLimitSec: 300,
        speedUp: null
    }
};

export const RULE_IDS = Object.keys(RULES) as RuleId[];

export function isRuleId(v: unknown): v is RuleId {
    return typeof v === 'string' && Object.prototype.hasOwnProperty.call(RULES, v);
}

/* ── 공격 ── */

/** 한 번에 지운 줄 수(0~4) → 상대에게 보내는 방해 줄 수 */
export const ATTACK: readonly number[] = [0, 0, 1, 2, 4];
/** 한 번에 받는 방해 줄 상한 */
export const GARBAGE_PER_LOCK_MAX = 8;
/** 쌓여 대기할 수 있는 방해 줄 상한 */
export const GARBAGE_PENDING_MAX = 12;

export function attackFor(cleared: number): number {
    return ATTACK[cleared] ?? 0;
}

/**
 * 상쇄 — 내가 보낼 공격으로 먼저 내게 쌓인 방해 줄을 지우고, 남은 만큼만 상대에게 보낸다.
 */
export function offsetAttack(pending: number, attack: number): { pending: number; send: number } {
    const cancel = Math.min(pending, attack);
    return { pending: pending - cancel, send: attack - cancel };
}

/* ── 속도 ── */

/** 경과 틱(60/초)에서의 최소 레벨. 빨라지지 않는 규칙은 1 */
export function levelFloor(rule: RuleDef, elapsedTicks: number): number {
    const s = rule.speedUp;
    if (!s) return 1;
    const sec = Math.floor(Math.max(0, elapsedTicks) / TICKS_PER_SEC);
    if (sec < s.startSec) return 1;
    return 2 + Math.floor((sec - s.startSec) / s.everySec);
}

/* ── 판 직렬화: 162자 '0'~'8', 9열 × 18줄, 위 줄부터 왼쪽→오른쪽 ── */

export const BOARD_CELLS = COLS * ROWS;
const BOARD_RE = /^[0-8]+$/;

export function encodeBoard(board: readonly number[]): string {
    let out = '';
    for (let i = 0; i < BOARD_CELLS; i++) {
        const v = board[i];
        out += v >= 0 && v <= 8 ? String(v) : '0';
    }
    return out;
}

/** 형식이 틀리면 null */
export function decodeBoard(s: string): number[] | null {
    if (typeof s !== 'string' || s.length !== BOARD_CELLS || !BOARD_RE.test(s)) return null;
    const out = new Array<number>(BOARD_CELLS);
    for (let i = 0; i < BOARD_CELLS; i++) out[i] = s.charCodeAt(i) - 48;
    return out;
}

/**
 * 대전 칸 보존식 — 굳힌 조각 4칸 + 받은 방해 줄 8칸 − 지운 줄 9칸 은 판 안의 칸 수(0~162)다.
 */
export function cellBalanceOk(locks: number, garbageLines: number, cleared: number): boolean {
    const cells = 4 * locks + 8 * garbageLines - 9 * cleared;
    return cells >= 0 && cells <= BOARD_CELLS;
}

/* ── 혼자하기 기록 검사 (서버와 같은 식) ── */

/**
 * 조각 하나가 내려올 수 있는 최대 줄 수 — 판 높이 + 위로 올리는 회전 보정 최대 횟수(엔진의 12회).
 * 낙하 점수(소프트 1/줄, 하드 2/줄) 상한 계산에 쓴다.
 */
export const DROP_ROWS_PER_PIECE_MAX = ROWS + 12;
/** 클라이언트 틱이 서버 실경과보다 앞설 수 있는 여유(틱) */
export const SOLO_TICK_SLACK = 3 * TICKS_PER_SEC;

export interface SoloClaim {
    score: number;
    lines: number;
    level: number;
    /** 진행한 고정 틱 수 */
    ticks: number;
    /** 굳힌 조각 수 */
    pieces: number;
    /** 줄을 지운 순간마다 그때 지운 줄 수(1~4), 순서대로 */
    clears: number[];
}

export type SoloReject =
    | 'shape'
    | 'clears_range'
    | 'lines_sum'
    | 'level'
    | 'cells'
    | 'pieces_ticks'
    | 'ticks_elapsed'
    | 'score_low'
    | 'drop_cap';

export interface SoloCheckResult {
    ok: boolean;
    reasons: SoloReject[];
    /** 줄 지우기로 얻은 점수 (재계산) */
    clearScore: number;
    /** 나머지 = 낙하 점수 */
    dropScore: number;
}

function isCount(v: unknown): v is number {
    return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/**
 * 혼자하기 기록이 엔진 규칙상 가능한지 본다. elapsedMs = 서버가 잰 시작~끝 실경과.
 *  1. clears 각 1~4, 합 = lines
 *  2. level = 1 + floor(lines / 8)
 *  3. 칸 보존: 0 ≤ 4×pieces − 9×lines ≤ 162
 *  4. clears 개수 ≤ pieces ≤ ticks
 *  5. ticks ≤ floor(elapsedMs / TICK_MS) + 180
 *  6. 줄 점수 재계산(지울 때의 레벨 × 표) ≤ score, 나머지(낙하 점수) ≤ 2 × 30 × (pieces + 1)
 */
export function soloClaimCheck(c: SoloClaim, elapsedMs: number): SoloCheckResult {
    const reasons: SoloReject[] = [];
    if (
        !isCount(c.score) ||
        !isCount(c.lines) ||
        !isCount(c.level) ||
        !isCount(c.ticks) ||
        !isCount(c.pieces) ||
        !Array.isArray(c.clears)
    ) {
        return { ok: false, reasons: ['shape'], clearScore: 0, dropScore: 0 };
    }

    let sum = 0;
    let clearScore = 0;
    let rangeBad = false;
    for (const n of c.clears) {
        if (!Number.isInteger(n) || n < 1 || n > 4) {
            rangeBad = true;
            continue;
        }
        const levelAt = 1 + Math.floor(sum / LINES_PER_LEVEL);
        clearScore += scoreFor(n, levelAt);
        sum += n;
    }
    if (rangeBad) reasons.push('clears_range');
    if (sum !== c.lines) reasons.push('lines_sum');
    if (c.level !== 1 + Math.floor(c.lines / LINES_PER_LEVEL)) reasons.push('level');

    const cells = 4 * c.pieces - 9 * c.lines;
    if (cells < 0 || cells > BOARD_CELLS) reasons.push('cells');

    if (c.clears.length > c.pieces || c.pieces > c.ticks) reasons.push('pieces_ticks');
    if (c.ticks > Math.floor(Math.max(0, elapsedMs) / TICK_MS) + SOLO_TICK_SLACK) {
        reasons.push('ticks_elapsed');
    }

    const dropScore = c.score - clearScore;
    if (dropScore < 0) reasons.push('score_low');
    else if (dropScore > 2 * DROP_ROWS_PER_PIECE_MAX * (c.pieces + 1)) reasons.push('drop_cap');

    return { ok: reasons.length === 0, reasons, clearScore, dropScore };
}

/* ── 웹소켓 메시지 — 봉투는 { type, data } (오목·장기와 같은 형식). 이름·필드는 서버와 같다 ── */

export interface Envelope<T extends string, D> {
    type: T;
    data: D;
}

type Empty = Record<string, never>;

/** 클라이언트 → 서버 */
export type ClientMessage =
    | Envelope<'join_matching_queue', { mode: MatchMode; rule: RuleId; invite?: string }>
    | Envelope<'cancel_matching', Empty>
    | Envelope<'ready', { roomId: string }>
    | Envelope<
          'lock',
          {
              /** 1부터 하나씩 오르는 번호 */
              seq: number;
              /** 굳은 순간의 엔진 틱 */
              tick: number;
              /** 이번에 지운 줄 수 0~4 */
              cleared: number;
              /** encodeBoard 결과 (162자) */
              board: string;
              score: number;
              lines: number;
          }
      >
    | Envelope<'topped_out', { seq: number; tick: number }>
    | Envelope<'surrender', Empty>
    /** 재대결 신청·수락 겸용 */
    | Envelope<'rematch', Empty>
    | Envelope<'rematch_decline', Empty>
    | Envelope<'reconnect', { sessionId: string }>
    | Envelope<'ping', Empty>;

export interface PlayerStats {
    rating: number;
    wins: number;
    losses: number;
    draws: number;
}

export interface OpponentInfo {
    nickname: string;
    rating?: number;
}

export type GameOverReason =
    | 'topout'
    | 'goal'
    | 'time'
    | 'resign'
    | 'inactivity'
    | 'disconnect'
    | 'cheat'
    | 'draw';

/** 서버 → 클라이언트 */
export type ServerMessage =
    | Envelope<
          'connected',
          {
              mbId: string;
              nickname: string;
              sessionId: string;
              /** random 매칭 참가비 */
              entryFee: number;
              stats: Partial<Record<RuleId, PlayerStats>>;
          }
      >
    | Envelope<
          'matching_status',
          {
              status: 'waiting' | 'matched' | 'error';
              roomId?: string;
              opponent?: OpponentInfo;
              rule: RuleId;
          }
      >
    | Envelope<
          'game_start',
          {
              roomId: string;
              rule: RuleId;
              ruleSpec: RuleDef;
              seed: number;
              /** go 까지의 카운트다운 (3000) */
              countdownMs: number;
              /** 이번 판에 차감된 참가비 (없으면 0) */
              entryFeeCharged: number;
          }
      >
    | Envelope<'go', Empty>
    /** attack 전용 — 내게 쌓인 방해 줄 수 */
    | Envelope<'garbage_queued', { pending: number }>
    /** attack 전용 — 이번에 넣을 줄(≤ 8)·구멍 열 0~8·넣고 남은 대기 줄 */
    | Envelope<'garbage_apply', { lines: number; hole: number; pending: number }>
    /** 상대 판 (초당 4회 상한) */
    | Envelope<'opponent_state', { board: string; lines: number; score: number; pending: number }>
    /** sprint40 전용 */
    | Envelope<'progress', { you: { lines: number }; opp: { lines: number }; elapsedMs: number }>
    | Envelope<'opponent_disconnected', { timeout: number }>
    | Envelope<'opponent_reconnected', Empty>
    | Envelope<'game_restored', { pending: number; opponentBoard: string; elapsedMs: number }>
    | Envelope<
          'game_over',
          {
              /** 이긴 쪽 닉네임, 무승부면 null */
              winner: string | null;
              reason: GameOverReason;
              result: { timeMs?: number; lines: number; score: number };
              stats: PlayerStats;
          }
      >
    | Envelope<'rematch_offer', { feeNotice: string }>
    | Envelope<'rematch_canceled', { reason: string }>
    | Envelope<'error', { code: string; message: string }>;

export type ClientMessageType = ClientMessage['type'];
export type ServerMessageType = ServerMessage['type'];
