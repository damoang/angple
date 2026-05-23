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
 * ad-free 가입자도 광고가 노출되는 슬롯 화이트리스트.
 * 운영 정책: **본문 하단 + 목록 사이 (in-feed)** 광고는 다모앙 운영 수익 보호를 위해 유지.
 * 그 외 PC 사이드바/wing/index/explore 등 부수 슬롯만 ad-free 시 OFF.
 */
const AD_FREE_EXEMPT_SLOTS = new Set([
    'board-after-comments', // 본문 댓글 후 (본문 하단)
    'board-list-infeed', // 게시판 목록 사이
    'comment-infeed' // 댓글 목록 사이
]);

/**
 * - 다른 플러그인이 이미 false → 그대로 false (체이닝 보존)
 * - isDesktop=false/undefined (SSR/mobile) → 입력값 그대로 (광고 유지)
 * - slotName ∈ AD_FREE_EXEMPT_SLOTS → 입력값 그대로 (운영 수익 슬롯 유지)
 * - user.ad_free_until > now (PC + 활성 + 비-exempt 슬롯) → false (광고 OFF)
 * - 그 외 → 입력값 그대로 (default true)
 *
 * 정책: ad-free 는 **PC AdSense 광고 일부 제거**. 본문 하단·목록 사이·모바일·다모앙 자체 배너는 유지.
 */
export function suppressAdsForAdFreeMember(value: boolean, ctx: AdFreeFilterCtx): boolean {
    if (value === false) return false;
    // 모바일/SSR 은 광고 유지
    if (!ctx?.isDesktop) return value;
    // 본문 하단 + 목록 사이 슬롯은 운영 정책상 유지
    if (AD_FREE_EXEMPT_SLOTS.has(ctx?.slotName)) return value;
    const until = ctx?.user?.ad_free_until;
    if (!until) return value;
    const expires = until instanceof Date ? until : new Date(until);
    if (Number.isNaN(expires.getTime())) return value;
    return expires.getTime() > Date.now() ? false : value;
}
