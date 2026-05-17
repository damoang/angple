/**
 * should_render_ad filter — pure callback + 타입 정의 (DRY).
 *
 * `.server.ts` / `.client.ts` 두 register 파일이 이 모듈을 import 한 뒤 각자
 * server / client hook instance 에 addFilter 한다. SvelteKit 규약상 `.server.ts`
 * 는 client 번들에 들어가지 않으므로 callback 자체는 plain 모듈로 둔다.
 */

export interface AdFreeFilterCtx {
    slotName: string;
    user: {
        ad_free_until?: string | Date | null;
        [k: string]: unknown;
    } | null;
    /** PC 뷰포트 여부 (≥970px). undefined/false 면 SSR/mobile 로 간주 → 광고 유지. */
    isDesktop?: boolean;
}

/**
 * - 다른 플러그인이 이미 false → 그대로 false (체이닝 보존)
 * - isDesktop=false/undefined (SSR/mobile) → 입력값 그대로 (광고 유지, 다모앙 광고앙 배너 정책)
 * - user.ad_free_until > now (PC + 활성 멤버십) → false (AdSense PC 광고 OFF)
 * - 그 외 → 입력값 그대로 (default true)
 *
 * 정책 메모: ad-free 멤버십은 **PC AdSense 광고만 제거**. 모바일 AdSense + 다모앙 자체 광고앙
 * (premium/plugins/ad-widget 의 배너 — AdSlot 안 거치는 별도 컴포넌트) 는 항상 유지.
 */
export function suppressAdsForAdFreeMember(value: boolean, ctx: AdFreeFilterCtx): boolean {
    if (value === false) return false;
    // 모바일/SSR 은 광고 유지
    if (!ctx?.isDesktop) return value;
    const until = ctx?.user?.ad_free_until;
    if (!until) return value;
    const expires = until instanceof Date ? until : new Date(until);
    if (Number.isNaN(expires.getTime())) return value;
    return expires.getTime() > Date.now() ? false : value;
}
