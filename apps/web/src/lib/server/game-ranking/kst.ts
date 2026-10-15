/**
 * 순위용 KST 시각 — DB 세션 시간대에 기대지 않고 문자열로 만들어 넣는다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** ms → KST 벽시계 "YYYY-MM-DD HH:MM:SS" (DATETIME 열에 그대로 넣는다) */
export function kstWall(ms: number): string {
    return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

/** ms 가 속한 주의 시작(KST 월요일) "YYYY-MM-DD" — 주간 순위는 월요일 0시(KST)에 새로 시작한다 */
export function weekStartKST(ms: number): string {
    const k = new Date(ms + KST_OFFSET_MS);
    const back = (k.getUTCDay() + 6) % 7;
    const d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() - back));
    return d.toISOString().slice(0, 10);
}

/** DB 에서 문자열로 읽은 KST 벽시계 → RFC3339(+09:00). 형식이 틀리면 빈 문자열 */
export function wallToRfc3339(raw: unknown): string {
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)) return '';
    return `${raw.replace(' ', 'T')}+09:00`;
}
