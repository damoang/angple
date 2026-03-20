import type { SiteLogoSchedule } from '$lib/server/logo';

/**
 * 클라이언트 현지 시간 기준으로 활성 로고를 결정합니다.
 * SSR에서는 KST 기준으로 1차 매칭하고, 클라이언트에서 재매칭합니다.
 */
export function resolveActiveLogo(
    schedules: SiteLogoSchedule[],
    now: Date = new Date()
): SiteLogoSchedule | null {
    if (!schedules || schedules.length === 0) return null;

    const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const today = now.toISOString().slice(0, 10);

    // 1순위: recurring (이미 priority DESC 정렬됨)
    const recurring = schedules.find(
        (s) => s.schedule_type === 'recurring' && s.recurring_date === mmdd
    );
    if (recurring) return recurring;

    // 2순위: date_range
    const range = schedules.find(
        (s) => s.schedule_type === 'date_range' && s.start_date! <= today && s.end_date! >= today
    );
    if (range) return range;

    // 3순위: default
    return schedules.find((s) => s.schedule_type === 'default') || null;
}
