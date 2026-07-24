/**
 * 별점 표시·랭킹 공유 규약 — n(참여 수)이 작을 때의 착시 방지 (순수 로직).
 *
 * 문제: 참여 1명짜리 ★5.0 가게가 100명이 매긴 ★4.2 가게보다 위에 보인다.
 * 초기에는 거의 모든 대상이 n=1~2 이므로 이게 기본값이 된다.
 *
 * 규약:
 *   - n < RATING_DISPLAY_MIN_COUNT(3): 평균을 숫자로 내세우지 않는다("앙님 N명 평가"만).
 *   - n >= 3: 평균 + n 병기.
 *   - 정렬·랭킹: 단순 평균 금지 → 베이지안 보정(전체 평균으로 끌어당김, m=5).
 *
 * 앙지도·앙티티(작품 카드/위젯) 등 별점 요약 표면이 모두 이 모듈을 공유한다.
 * DB·Svelte 의존 없음 — vitest 로 규약을 단위 검증한다.
 */

/** 항목별 평점 집계 행(+요청자 본인 값) — 앙지도/앙티티 공통 표시 모델. */
export interface AspectRating {
    aspect: string;
    avg: number;
    count: number;
    /** 로그인 사용자 본인이 이 항목에 남긴 별점(없으면 null) */
    my: number | null;
}

/** 평균 숫자를 노출하기 위한 최소 참여 수(미만이면 숫자 미노출). */
export const RATING_DISPLAY_MIN_COUNT = 3;

/** 베이지안 보정 사전값 개수(전체 평균 쪽으로 끌어당기는 세기). */
export const RATING_BAYESIAN_M = 5;

/** 평균 숫자를 내세워도 되는 참여 수인지(n >= 3). */
export function shouldShowAverage(count: number): boolean {
    return Number.isFinite(count) && count >= RATING_DISPLAY_MIN_COUNT;
}

/**
 * 별점 요약 문구.
 *   - count <= 0: '아직 평가 없음'
 *   - 0 < count < 3: '앙님 N명 평가' (평균 숨김 — 착시 방지)
 *   - count >= 3: '★4.3 · 앙님 21명'
 */
export function formatRatingSummary(avg: number, count: number): string {
    const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    if (n <= 0) return '아직 평가 없음';
    if (!shouldShowAverage(n)) return `앙님 ${n.toLocaleString()}명 평가`;
    const a = Number.isFinite(avg) ? avg : 0;
    return `★${a.toFixed(1)} · 앙님 ${n.toLocaleString()}명`;
}

/**
 * 랭킹용 베이지안 보정 점수.
 *   보정점수 = (v/(v+m)) * 개별평균 + (m/(v+m)) * 전체평균
 * v=참여 수, m=사전값 개수(기본 5). v가 작을수록 전체 평균 쪽으로 끌린다.
 * 정렬/추천에만 쓰고 표시 숫자로는 쓰지 않는다(표시는 formatRatingSummary).
 */
export function bayesianScore(
    avg: number,
    count: number,
    globalAvg: number,
    m: number = RATING_BAYESIAN_M
): number {
    const v = Number.isFinite(count) ? Math.max(0, count) : 0;
    const a = Number.isFinite(avg) ? avg : 0;
    const g = Number.isFinite(globalAvg) ? globalAvg : 0;
    const denom = v + m;
    if (denom <= 0) return g;
    return (v / denom) * a + (m / denom) * g;
}
