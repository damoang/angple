import type { PostRating } from '$lib/api/types.js';

/**
 * 별점 투표 최소 등급 — 앙님💛 (mb_level 3).
 * ⚠️ mb_level(등급) 기준. as_level(활동 레벨)을 넣지 말 것.
 */
export const RATING_MIN_LEVEL = 3;

/** 별점 값을 1~5 정수로 클램프 */
export function clampRating(value: number): number {
    if (!Number.isFinite(value)) return 1;
    return Math.min(5, Math.max(1, Math.round(value)));
}

/**
 * n번째 별(1~5)의 채움 비율(0~100%) 계산.
 * 예: value 4.3 → 1~4번째 별 100%, 5번째 별 30%.
 */
export function starFillPercent(value: number, star: number): number {
    if (!Number.isFinite(value)) return 0;
    const fill = Math.min(Math.max(value - (star - 1), 0), 1);
    return Math.round(fill * 100);
}

/**
 * 낙관적 갱신: 서버 응답 전에 내 투표를 집계에 미리 반영한 새 객체를 반환.
 * 입력 객체는 변이하지 않는다 — 실패 시 이전 객체로 그대로 롤백하기 위함.
 *
 * - 첫 투표(my=0): count+1, 합계에 내 별점 추가
 * - 재투표(my>0): count 불변, 합계에서 이전 내 별점을 빼고 새 별점을 더함
 */
export function applyOptimisticRating(current: PostRating, next: number): PostRating {
    const my = clampRating(next);
    if (current.my > 0) {
        const count = Math.max(current.count, 1);
        const sum = current.avg * count - current.my + my;
        return { avg: sum / count, count, my };
    }
    const count = current.count + 1;
    const sum = current.avg * current.count + my;
    return { avg: sum / count, count, my };
}
