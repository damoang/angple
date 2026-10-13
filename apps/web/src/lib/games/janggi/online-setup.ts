/**
 * 온라인 대전 상차림 선택 단계 — 서버 메시지 해석과 남은 시간 계산(순수 함수).
 *
 * 프로토콜(janggi-ws):
 * - 서버 → `setup_choose` {roomId, playerTeam, seconds, remainingMs, mySetup?}
 * - 클라 → `setup_select` {roomId, setup}
 * - 서버 → `setup_status` {roomId, choSelected, hanSelected}
 * - 서버 → `game_start` (+ 선택 사항 `setups: {cho, han}`, 재접속 gameState 에도)
 */
import { LEGACY_SETUP, SETUP_LABEL, TEAM, isSetup, type Setup } from './rules';

/** 선택 단계 기본 길이(초) — 서버가 seconds 를 안 주면 쓴다. */
export const SETUP_SECONDS = 20;

export interface SetupChoose {
    roomId: string;
    playerTeam: number;
    seconds: number;
    remainingMs: number;
    /** 재접속 시 이미 고른 값(없으면 null). */
    mySetup: Setup | null;
}

export interface Setups {
    cho: Setup;
    han: Setup;
}

function num(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** `setup_choose` 메시지 해석. 남은 시간은 0 ~ seconds×1000 으로 자른다. */
export function parseSetupChoose(msg: unknown): SetupChoose | null {
    if (!msg || typeof msg !== 'object') return null;
    const m = msg as Record<string, unknown>;
    if (m.type !== 'setup_choose') return null;
    const sec = num(m.seconds);
    const seconds = sec !== null && sec > 0 ? sec : SETUP_SECONDS;
    const rem = num(m.remainingMs);
    const remainingMs = Math.min(seconds * 1000, Math.max(0, rem ?? seconds * 1000));
    const team = num(m.playerTeam);
    return {
        roomId: typeof m.roomId === 'string' ? m.roomId : '',
        playerTeam: team === TEAM.HAN ? TEAM.HAN : team === TEAM.CHO ? TEAM.CHO : 0,
        seconds,
        remainingMs,
        mySetup: isSetup(m.mySetup) ? m.mySetup : null
    };
}

/** `setups` 필드 해석 — 둘 다 올바른 값일 때만. 없거나 깨졌으면 null(구 서버). */
export function parseSetups(v: unknown): Setups | null {
    if (!v || typeof v !== 'object') return null;
    const s = v as Record<string, unknown>;
    return isSetup(s.cho) && isSetup(s.han) ? { cho: s.cho, han: s.han } : null;
}

/** 마감 시각까지 남은 초(올림, 0 미만 없음). */
export function secondsLeft(deadline: number, now: number): number {
    return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** 내 진영의 미선택 기본값 — 서버가 시간 초과 시 쓰는 현행 배치(초 상마상마·한 마상마상). */
export function teamDefaultSetup(team: number): Setup {
    return team === TEAM.HAN ? LEGACY_SETUP.han : LEGACY_SETUP.cho;
}

/** 상대 진영 상차림 (내 진영을 모르면 null). */
export function opponentSetup(setups: Setups | null, myTeam: number): Setup | null {
    if (!setups) return null;
    if (myTeam === TEAM.CHO) return setups.han;
    if (myTeam === TEAM.HAN) return setups.cho;
    return null;
}

/** 표시용: 「안상(마상상마)」 */
export function setupText(s: Setup): string {
    return `${SETUP_LABEL[s]}(${s})`;
}
