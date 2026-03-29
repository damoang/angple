import type { SiteLogoSchedule } from '$lib/server/logo';
import { resolveActiveLogo as resolveScheduledLogo } from './logo-schedule';

/**
 * 클라이언트 현지 시간 기준으로 활성 로고를 결정합니다.
 * SSR에서는 KST 기준으로 1차 매칭하고, 클라이언트에서 재매칭합니다.
 */
export function resolveActiveLogo(
    schedules: SiteLogoSchedule[],
    now: Date = new Date()
): SiteLogoSchedule | null {
    return resolveScheduledLogo(schedules, {
        now,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'
    });
}
