/**
 * 장군·멍군·외통 판정 — 한 수가 끝난 직후 화면에 띄울 알림을 고른다.
 *
 * - 장군: 이번 수로 상대 궁이 장군을 받는다.
 * - 멍군: 직전에 장군을 받던 진영이 이번 수를 두었다(= 장군을 피했다).
 * - 외통 순간에는 장군·멍군 대신 끝 배너가 뜨므로 알림이 없다.
 */
import { TEAM, getLegalMoves, isCheck, type JanggiPiece } from './rules';

export type CheckEvent = 'janggun' | 'meonggun';

export const CHECK_EVENT_TEXT: Record<CheckEvent, string> = {
    janggun: '장군!',
    meonggun: '멍군!'
};

/** 알림이 떠 있는 시간(ms). */
export const CHECK_FLASH_MS = 900;

export function otherTeam(team: number): number {
    return team === TEAM.CHO ? TEAM.HAN : TEAM.CHO;
}

/** team 이 외통인지 — 장군을 받고 있고 둘 수 있는 합법수가 없다. */
export function isCheckmate(pieces: JanggiPiece[], team: number): boolean {
    return isCheck(pieces, team) && getLegalMoves(pieces, team).length === 0;
}

/**
 * @param prevCheckTeam 이번 수 전에 장군을 받던 진영(없으면 null)
 * @param mover 이번 수를 둔 진영
 * @param nowCheckTeam 이번 수 뒤 장군을 받는 진영(없으면 null)
 * @param mate 이번 수로 외통이 되었는지
 */
export function checkEvent(
    prevCheckTeam: number | null,
    mover: number,
    nowCheckTeam: number | null,
    mate = false
): CheckEvent | null {
    if (mate) return null;
    if (nowCheckTeam !== null && nowCheckTeam !== mover) return 'janggun';
    if (prevCheckTeam !== null && prevCheckTeam === mover) return 'meonggun';
    return null;
}
