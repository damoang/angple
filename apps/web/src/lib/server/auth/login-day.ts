/**
 * 일일 접속 기록(mb_today_login) 날짜 판정 — 순수 함수.
 *
 * mb_today_login 은 DB 세션 시간대(+09:00)로 NOW() 를 쓴 DATETIME 이라 벽시계 값이 KST 다.
 * 그런데 같은 값이 경로에 따라 서로 다른 모양으로 들어온다.
 * - DB 직조회(mysql2, timezone '+09:00'): `Date` 객체(정확한 순간)
 * - 회원 캐시 L2(Redis JSON): `"2026-10-11T15:30:00.000Z"` 같은 UTC ISO 문자열
 * - dateStrings 류 경로: `"2026-10-12 00:30:00"` 같은 KST 벽시계 문자열
 * - 그누보드 빈 값: `"0000-00-00 00:00:00"`
 *
 * 예전 비교는 `typeof raw === 'string'` 만 처리해 Date 일 때는 항상 「오늘 아님」이 되어
 * 캐시 미스마다 같은 날 UPDATE 를 반복했다. 여기서는 모든 모양을 KST 날짜(YYYY-MM-DD)로
 * 맞춘 뒤 비교한다.
 */

/** KST 는 일광절약시간이 없어 고정 +9시간 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const WALL_CLOCK_DATE = /^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function kstDateOfInstant(ms: number): string | null {
    if (!Number.isFinite(ms)) return null;
    return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Date | string | null 을 KST 날짜 문자열(YYYY-MM-DD)로 정규화한다.
 * 해석할 수 없거나 빈 값(그누보드 0000-00-00 포함)이면 null.
 *
 * - Date / 시간대가 붙은 문자열(Z, +09:00 등): 그 순간을 KST 로 환산한 날짜
 * - 시간대 없는 문자열("YYYY-MM-DD HH:MM:SS"): DB 세션 시간대(KST) 벽시계로 보고 날짜 부분 그대로
 */
export function toKstDateString(value: unknown): string | null {
    if (value instanceof Date) {
        return kstDateOfInstant(value.getTime());
    }
    if (typeof value !== 'string') return null;

    const s = value.trim();
    if (!s || s.startsWith('0000-00-00')) return null;

    if (HAS_ZONE.test(s)) {
        return kstDateOfInstant(Date.parse(s));
    }

    const m = WALL_CLOCK_DATE.exec(s);
    return m ? m[1] : null;
}

/**
 * mb_today_login 을 다시 써야 하는지 — 마지막 기록이 오늘(KST)이 아니면 true.
 * 값이 없거나 해석할 수 없으면 true(기록이 없는 것으로 본다).
 */
export function needsLoginTimestampUpdate(lastLogin: unknown, now: Date = new Date()): boolean {
    const last = toKstDateString(lastLogin);
    if (!last) return true;
    return last !== toKstDateString(now);
}
