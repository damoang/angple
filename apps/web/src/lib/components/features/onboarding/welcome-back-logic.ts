/**
 * 휴면 회원 웰컴백(R1) 판정 로직 — 컴포넌트에서 분리해 단위 테스트 가능하게 한다.
 * 설계: docs/dormant-reactivation-design-20260720.html
 */

export const MIN_DORMANT_DAYS = 56; // 8주
export const MAX_DORMANT_DAYS = 175; // 25주
export const HOLDOUT_PERCENT = 10;

export interface ActivityItem {
    wr_datetime?: string;
}

export interface MemberActivityResponse {
    recentPosts?: ActivityItem[];
    recentComments?: ActivityItem[];
}

/**
 * `wr_datetime`("2026-07-20 00:50:55", KST, 타임존 표기 없음)을 ms 로 변환.
 * Safari 는 공백 구분 형식을 파싱하지 못하므로 ISO 로 정규화한다.
 * 서버가 KST 로 주므로 +09:00 을 명시한다 — 로컬 타임존에 따라 결과가 달라지면
 * 56일 임계 판정이 기기별로 흔들린다.
 */
export function parseKstDateTime(raw: string | undefined): number | null {
    if (!raw) return null;
    const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+09:00`);
    return Number.isNaN(t) ? null : t;
}

/** 최근 글·댓글 중 가장 최신 기여 시각(ms). 없으면 null. */
export function lastContributionAt(
    activity: MemberActivityResponse | null | undefined
): number | null {
    if (!activity) return null;
    const stamps = [...(activity.recentPosts ?? []), ...(activity.recentComments ?? [])]
        .map((item) => parseKstDateTime(item?.wr_datetime))
        .filter((t): t is number => t !== null);
    return stamps.length ? Math.max(...stamps) : null;
}

/**
 * mb_id 해시 기반 결정적 홀드아웃 — 같은 회원은 언제나 같은 군.
 * 대조군은 카드를 보지 않지만 노출 자격 이벤트는 남겨 증분을 계산한다.
 */
export function isHoldout(mbId: string): boolean {
    let h = 0;
    for (let i = 0; i < mbId.length; i++) h = (h * 31 + mbId.charCodeAt(i)) >>> 0;
    return h % 100 < HOLDOUT_PERCENT;
}

/** 휴면 일수가 노출 구간(8~25주)인가. 그 밖은 자연 복귀율이 너무 낮거나(26주+) 아직 이탈이 아니다. */
export function isDormantWindow(days: number): boolean {
    return days >= MIN_DORMANT_DAYS && days <= MAX_DORMANT_DAYS;
}

/** localStorage 키는 회원별로 스코프한다 — 공유 기기에서 남의 판정이 재사용되면 오노출된다. */
export function dismissKey(mbId: string): string {
    return `angple_welcome_back_dismissed:${mbId}`;
}

export function cacheKey(mbId: string): string {
    return `angple_welcome_back_check:${mbId}`;
}
