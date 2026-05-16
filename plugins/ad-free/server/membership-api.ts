/**
 * 사용자의 광고 제거 멤버십 상태 조회 API.
 *
 * 현재는 stub: 실제 ad_free_membership 테이블 조회는 코어/백엔드 인프라가
 * 안정화된 후 (Sprint 7+) 연결한다. 그때까지는 inactive 응답을 반환하여
 * 회귀 없이 라우트만 노출.
 *
 * 향후 통합 옵션:
 *   - mysql2 풀을 코어에서 노출 → 여기서 직접 SELECT
 *   - Go 백엔드에 GET /api/v1/ad-free/me 추가 → 여기서 fetch
 *   - locals.user 가 ad_free_until 을 이미 포함하면 그대로 반환
 */

export interface MembershipState {
    mb_id: string;
    site_id: string;
    plan: 'monthly' | 'yearly' | null;
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'inactive';
    current_period_end: string | null;
    trial_end: string | null;
    payment_provider: 'naverpay' | 'paypal' | 'toss' | 'manual' | null;
    ad_free_until: string | null;
}

export async function getMembership(mbId: string, siteId = 'default'): Promise<MembershipState> {
    return {
        mb_id: mbId,
        site_id: siteId,
        plan: null,
        status: 'inactive',
        current_period_end: null,
        trial_end: null,
        payment_provider: null,
        ad_free_until: null
    };
}
