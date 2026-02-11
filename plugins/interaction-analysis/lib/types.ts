/**
 * 상호작용 분석 타입 정의
 */

/** 분석 기간 */
export type AnalysisPeriod = 'day' | 'week' | 'month' | 'year' | 'all';

/** 상호작용 타입 */
export type InteractionType = 'like' | 'comment' | 'all';

/** 상호작용 방향 */
export type InteractionDirection = 'given' | 'received';

/** 개별 상호작용 항목 */
export interface InteractionEntry {
    mb_id: string;
    mb_name: string;
    like_count: number;
    comment_count: number;
    total_count: number;
}

/** 상호작용 분석 응답 */
export interface InteractionAnalysis {
    target_mb_id: string;
    direction: InteractionDirection;
    period: AnalysisPeriod;
    period_label: string;
    interaction_type: InteractionType;
    entries: InteractionEntry[];
    total_interactions: number;
    analyzed_at: string;
}

/** 기간 라벨 */
export const PERIOD_LABELS: Record<AnalysisPeriod, string> = {
    day: '오늘',
    week: '이번 주',
    month: '이번 달',
    year: '올해',
    all: '전체'
};

/** 방향 라벨 */
export const DIRECTION_LABELS: Record<InteractionDirection, string> = {
    given: '이 회원이 활동한 대상',
    received: '이 회원에게 활동한 사람'
};
