/**
 * 럭키 당첨 🍀 배지 표시·병합 헬퍼.
 *
 * 당첨 상품은 포인트(lucky_point)와 경험치(lucky_exp) 두 갈래다. 둘 중 하나만 있을 수도,
 * 둘 다 있을 수도 있다. 값이 없거나 0 이하이면 그 갈래는 표시하지 않는다.
 */

function positive(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
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

/**
 * 댓글 응답에 실을 럭키 필드. 0 이하인 갈래는 키 자체를 싣지 않는다(기존 응답 형태 유지).
 */
export function luckyFields(
    point: number | undefined,
    exp: number | undefined
): { lucky_point?: number; lucky_exp?: number } {
    const p = positive(point);
    const x = positive(exp);
    return {
        ...(p > 0 ? { lucky_point: p } : {}),
        ...(x > 0 ? { lucky_exp: x } : {})
    };
}
