/**
 * "지금 뜨는 소모임" 순수 랭킹 로직
 *
 * DB / 서버 모듈을 import 하지 않는 순수 함수만 모아 vitest 단독 검증이 가능하도록 분리한다.
 * (trending-groups-data.ts 가 이 모듈을 재사용한다.)
 */

export interface TrendingGroupRow {
    bo_table: string;
    bo_subject: string;
    weekly_count: number;
    today_count: number;
}

/** 위젯 표시 개수 하한/상한 (요구: 3~5개) */
export const MIN_LIMIT = 3;
export const MAX_LIMIT = 5;

/**
 * limit 값을 3~5 범위로 정규화한다.
 *
 * - 값이 없거나(null·undefined·빈 문자열) 파싱 불가(NaN)면 기본값 상한(5)으로 수렴
 *   → API 에서 `?limit=` 미지정 시 기본 5개.
 * - 숫자면 3~5 범위로 클램프(0·1·2 → 3, 6+ → 5, 음수 → 3).
 */
export function clampLimit(raw: number | string | null | undefined): number {
    if (raw === null || raw === undefined || raw === '') return MAX_LIMIT;
    const v = Math.floor(Number(raw));
    if (!Number.isFinite(v)) return MAX_LIMIT;
    return Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, v));
}

/**
 * 소모임을 활동순으로 정렬하고 상위 N개를 고른다.
 *
 * - 활동 0(주간 글 0건) 소모임은 제외 → 위젯이 죽은 소모임을 노출하지 않는다.
 * - 정렬: 주간 글수 desc → 오늘 글수 desc → 이름 asc(동점 안정 정렬).
 */
export function rankTrendingGroups(rows: TrendingGroupRow[], limit: number): TrendingGroupRow[] {
    const n = clampLimit(limit);
    return rows
        .filter((r) => (r.weekly_count ?? 0) > 0)
        .slice()
        .sort(
            (a, b) =>
                (b.weekly_count ?? 0) - (a.weekly_count ?? 0) ||
                (b.today_count ?? 0) - (a.today_count ?? 0) ||
                a.bo_subject.localeCompare(b.bo_subject)
        )
        .slice(0, n);
}
