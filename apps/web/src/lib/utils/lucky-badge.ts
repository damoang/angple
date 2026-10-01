/**
 * 럭키 당첨 🍀 배지 표시·병합 헬퍼.
 *
 * 당첨 상품은 포인트(lucky_point)와 경험치(lucky_exp) 두 갈래다. 둘 중 하나만 있을 수도,
 * 둘 다 있을 수도 있다. 값이 없거나 0 이하이면 그 갈래는 표시하지 않는다.
 *
 * 이벤트 회차 당첨이면 지급 문구가 「<회차명> …」으로 시작한다. 회차명(lucky_tier)과
 * 당첨 시각(lucky_at, ISO +09:00)을 함께 실어 배지 옆에 작은 라벨로 보여준다.
 * 레거시 당첨(회차명 없음)은 라벨 없이 기존과 같다.
 */

/** 배지 라벨을 붙이는 회차명. 지급 문구가 「<회차명> 」으로 시작할 때만 인정한다. */
const LUCKY_TIER_RE = /^(앙복타임|앙팡타임|앙팡팡타임) /;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function positive(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/** 원장 한 갈래(포인트 또는 경험치)의 당첨 정보. */
export interface LuckyHit {
    amount: number;
    tier?: string;
    /** ISO 8601, +09:00 */
    at?: string;
}

/** 지급 문구에서 회차명을 뽑는다. 레거시 문구면 undefined. */
export function parseLuckyTier(content: unknown): string | undefined {
    if (typeof content !== 'string') return undefined;
    const m = LUCKY_TIER_RE.exec(content);
    return m ? m[1] : undefined;
}

/**
 * DB 의 KST DATETIME 을 `YYYY-MM-DDTHH:mm:ss+09:00` 으로.
 * - 문자열(`YYYY-MM-DD HH:mm:ss`)은 벽시계 그대로 +09:00 을 붙인다.
 * - Date(드라이버가 KST 로 해석한 시점)는 KST 벽시계로 바꿔 붙인다.
 * 0000-00-00 등 잘못된 값은 undefined.
 */
export function toKstIso(value: unknown): string | undefined {
    if (typeof value === 'string') {
        const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
        if (!m || m[1] === '0000' || m[2] === '00' || m[3] === '00') return undefined;
        return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+09:00`;
    }
    if (value instanceof Date) {
        const t = value.getTime();
        if (!Number.isFinite(t)) return undefined;
        return new Date(t + KST_OFFSET_MS).toISOString().slice(0, 19) + '+09:00';
    }
    return undefined;
}

/**
 * 원장 행들을 rel_id 별 당첨 정보로 모은다(쿼리 1회 결과를 그대로 받는다).
 * 레거시 중복행 방어: 금액이 가장 큰 행을 쓰고, 같은 금액이면 회차명이 있는 행을 쓴다.
 */
export function collectLuckyRows(
    rows: Array<Record<string, unknown>>,
    keys: { id: string; amount: string; content: string; datetime: string }
): Map<number, LuckyHit> {
    const map = new Map<number, LuckyHit>();
    for (const r of rows) {
        const id = Number(r[keys.id]);
        if (!Number.isFinite(id)) continue;
        const amount = Number(r[keys.amount]);
        if (!Number.isFinite(amount)) continue;
        const hit: LuckyHit = { amount };
        const tier = parseLuckyTier(r[keys.content]);
        if (tier) hit.tier = tier;
        const at = toKstIso(r[keys.datetime]);
        if (at) hit.at = at;
        const prev = map.get(id);
        if (!prev || amount > prev.amount || (amount === prev.amount && !prev.tier && hit.tier)) {
            map.set(id, hit);
        }
    }
    return map;
}

/**
 * 댓글 응답에 실을 럭키 필드. 0 이하인 갈래·없는 값은 키 자체를 싣지 않는다(기존 응답 형태 유지).
 * 회차명·시각은 회차명이 있는 갈래를 우선(포인트 → 경험치 순)하고, 없으면 시각만 싣는다.
 */
export function luckyFields(
    point: LuckyHit | undefined,
    exp: LuckyHit | undefined
): { lucky_point?: number; lucky_exp?: number; lucky_tier?: string; lucky_at?: string } {
    const p = positive(point?.amount);
    const x = positive(exp?.amount);
    const hits = [p > 0 ? point : undefined, x > 0 ? exp : undefined].filter(
        (h): h is LuckyHit => !!h
    );
    const source = hits.find((h) => h.tier) ?? hits.find((h) => h.at);
    return {
        ...(p > 0 ? { lucky_point: p } : {}),
        ...(x > 0 ? { lucky_exp: x } : {}),
        ...(source?.tier ? { lucky_tier: source.tier } : {}),
        ...(source?.at ? { lucky_at: source.at } : {})
    };
}

/**
 * 배지 문자열. 「🍀1,234p」「🍀500XP」「🍀1,234p·500XP」.
 * 둘 다 0 이하(또는 없음)이면 빈 문자열 — 호출부는 렌더하지 않는다.
 */
export function formatLuckyBadge(amount: unknown, exp: unknown = 0): string {
    const point = positive(amount);
    const xp = positive(exp);
    const parts: string[] = [];
    if (point > 0) parts.push(`${point.toLocaleString('ko-KR')}p`);
    if (xp > 0) parts.push(`${xp.toLocaleString('ko-KR')}XP`);
    return parts.length > 0 ? `🍀${parts.join('·')}` : '';
}

/** ISO 시각을 KST 벽시계 부품으로. 브라우저 시간대와 무관. 잘못된 값이면 null. */
function kstParts(at: unknown): { y: number; mo: number; d: number; h: string; mi: string } | null {
    if (typeof at !== 'string' || !at) return null;
    const t = Date.parse(at);
    if (!Number.isFinite(t)) return null;
    const k = new Date(t + KST_OFFSET_MS);
    return {
        y: k.getUTCFullYear(),
        mo: k.getUTCMonth() + 1,
        d: k.getUTCDate(),
        h: String(k.getUTCHours()).padStart(2, '0'),
        mi: String(k.getUTCMinutes()).padStart(2, '0')
    };
}

/** 「10/1 14:23」(KST). 잘못된 값이면 빈 문자열. */
export function formatLuckyAtShort(at: unknown): string {
    const p = kstParts(at);
    return p ? `${p.mo}/${p.d} ${p.h}:${p.mi}` : '';
}

/** 배지 옆 라벨 「앙팡팡타임 · 10/1 14:23」. 회차명이 없으면 빈 문자열(레거시 = 라벨 없음). */
export function formatLuckyMeta(tier: unknown, at: unknown): string {
    if (typeof tier !== 'string' || !tier) return '';
    const when = formatLuckyAtShort(at);
    return when ? `${tier} · ${when}` : tier;
}

/** 배지 title. 회차명이 있으면 「럭키 당첨 · 앙팡팡타임 · 2026-10-01 14:23」, 없으면 「럭키 당첨」. */
export function formatLuckyTitle(tier: unknown, at: unknown): string {
    if (typeof tier !== 'string' || !tier) return '럭키 당첨';
    const p = kstParts(at);
    if (!p) return `럭키 당첨 · ${tier}`;
    const mo = String(p.mo).padStart(2, '0');
    const d = String(p.d).padStart(2, '0');
    return `럭키 당첨 · ${tier} · ${p.y}-${mo}-${d} ${p.h}:${p.mi}`;
}
