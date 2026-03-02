import type { RecommendedPeriod } from '$lib/api/types.js';

/**
 * 시간대별 탭 표시 설정 (PHP 원본 로직)
 * KST(한국 표준시) 기준으로 계산
 * 00시~06시: 1H, 3H 탭 숨기기, 기본 6H
 * 06시~09시: 1H 탭만 숨기기, 기본 3H
 * 그 외: 모든 탭 표시, 기본 1H
 */
export function getCurrentTabVisibility() {
    // KST 시간대 명시적 사용 (일관성 보장)
    const kstHour = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Seoul',
        hour: 'numeric',
        hour12: false
    });
    const currentHour = parseInt(kstHour, 10);

    if (currentHour >= 0 && currentHour < 6) {
        return {
            show1H: false,
            show3H: false,
            defaultTab: '6h' as RecommendedPeriod
        };
    } else if (currentHour >= 6 && currentHour < 9) {
        return {
            show1H: false,
            show3H: true,
            defaultTab: '3h' as RecommendedPeriod
        };
    } else {
        return {
            show1H: true,
            show3H: true,
            defaultTab: '1h' as RecommendedPeriod
        };
    }
}
