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
}

/**
 * - 다른 플러그인이 이미 false → 그대로 false (체이닝 보존)
 * - user.ad_free_until > now → false (광고 OFF)
 * - 그 외 → 입력값 그대로 (default true)
 */
export function suppressAdsForAdFreeMember(value: boolean, ctx: AdFreeFilterCtx): boolean {
    if (value === false) return false;
    const until = ctx?.user?.ad_free_until;
    if (!until) return value;
    const expires = until instanceof Date ? until : new Date(until);
    if (Number.isNaN(expires.getTime())) return value;
    return expires.getTime() > Date.now() ? false : value;
}
