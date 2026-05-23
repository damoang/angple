import { describe, it, expect } from 'vitest';
import { suppressAdsForAdFreeMember, type AdFreeFilterCtx } from '../suppress';

function ctx(
    user: AdFreeFilterCtx['user'],
    overrides: Partial<AdFreeFilterCtx> = {}
): AdFreeFilterCtx {
    return { slotName: 'board-list-bottom', user, isDesktop: true, ...overrides };
}

describe('suppressAdsForAdFreeMember', () => {
    it('user 없으면 입력값 그대로 (default true 통과)', () => {
        expect(suppressAdsForAdFreeMember(true, ctx(null))).toBe(true);
    });

    it('user 있지만 ad_free_until 없으면 입력값 그대로', () => {
        expect(suppressAdsForAdFreeMember(true, ctx({}))).toBe(true);
    });

    it('ad_free_until 가 미래이면 false (광고 OFF)', () => {
        const future = new Date(Date.now() + 86_400_000).toISOString();
        expect(suppressAdsForAdFreeMember(true, ctx({ ad_free_until: future }))).toBe(false);
    });

    it('ad_free_until 가 과거이면 입력값 그대로 (만료된 멤버십)', () => {
        const past = new Date(Date.now() - 86_400_000).toISOString();
        expect(suppressAdsForAdFreeMember(true, ctx({ ad_free_until: past }))).toBe(true);
    });

    it('Date 객체 직접도 처리', () => {
        const future = new Date(Date.now() + 86_400_000);
        expect(suppressAdsForAdFreeMember(true, ctx({ ad_free_until: future }))).toBe(false);
    });

    it('invalid date string 은 입력값 그대로 (안전 fallback)', () => {
        expect(suppressAdsForAdFreeMember(true, ctx({ ad_free_until: 'not-a-date' }))).toBe(true);
    });

    it('다른 플러그인이 이미 false 면 항상 false (체이닝 보존)', () => {
        const future = new Date(Date.now() + 86_400_000).toISOString();
        expect(suppressAdsForAdFreeMember(false, ctx({ ad_free_until: future }))).toBe(false);
        expect(suppressAdsForAdFreeMember(false, ctx(null))).toBe(false);
    });

    it('ad_free_until null 은 입력값 그대로', () => {
        expect(suppressAdsForAdFreeMember(true, ctx({ ad_free_until: null }))).toBe(true);
    });

    // PC/모바일 분기 — ad-free 멤버십은 PC AdSense 만 OFF.
    it('mobile (isDesktop=false) 는 멤버십 활성이어도 광고 유지', () => {
        const future = new Date(Date.now() + 86_400_000).toISOString();
        expect(
            suppressAdsForAdFreeMember(true, ctx({ ad_free_until: future }, { isDesktop: false }))
        ).toBe(true);
    });

    it('SSR (isDesktop=undefined) 도 광고 유지 (hydration 후 client 가 결정)', () => {
        const future = new Date(Date.now() + 86_400_000).toISOString();
        expect(
            suppressAdsForAdFreeMember(
                true,
                ctx({ ad_free_until: future }, { isDesktop: undefined })
            )
        ).toBe(true);
    });

    // 운영 정책: 본문 하단 + 목록 사이 in-feed 슬롯은 ad-free 가입자도 광고 노출 유지
    it.each(['board-after-comments', 'board-list-infeed', 'comment-infeed'])(
        '%s 슬롯은 PC ad-free 가입자도 광고 유지 (운영 수익 보호)',
        (slotName) => {
            const future = new Date(Date.now() + 86_400_000).toISOString();
            expect(
                suppressAdsForAdFreeMember(
                    true,
                    ctx({ ad_free_until: future }, { slotName, isDesktop: true })
                )
            ).toBe(true);
        }
    );

    it('exempt 가 아닌 슬롯 (sidebar) 은 PC ad-free 가입자에게 OFF 유지', () => {
        const future = new Date(Date.now() + 86_400_000).toISOString();
        expect(
            suppressAdsForAdFreeMember(
                true,
                ctx({ ad_free_until: future }, { slotName: 'sidebar', isDesktop: true })
            )
        ).toBe(false);
    });
});
