import type { LuckySettings } from '$lib/api/board-extended-settings';

/** 관리자 럭키 카드가 다루는 필드 */
export interface LuckyFormValues {
    enabled: boolean;
    points: number;
    odds: number;
    comment_odds: number;
}

/**
 * 기존 lucky 설정 위에 폼 값을 덮어쓴다.
 * 백엔드 PUT 은 settings 를 통째로 저장하므로, 카드가 모르는 키를 새 객체로
 * 만들면 저장 한 번에 지워진다. 그래서 원본을 먼저 펼친다.
 */
export function mergeLuckySettings(
    prev: LuckySettings | undefined,
    form: LuckyFormValues
): LuckySettings {
    return {
        ...(prev ?? {}),
        enabled: form.enabled,
        points: form.points,
        odds: form.odds,
        comment_odds: form.comment_odds
    };
}
