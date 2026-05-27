/**
 * Hook 실행 컨텍스트 — 서버 사이드 hook(applyFilter/doAction) 호출 표준 인자.
 *
 * 서버 hook 호출은 마지막 인자로 HookContext 를 넘긴다:
 *   applyFilter('post.list.enrich', posts, buildHookContext(locals))
 *
 * ## 왜 필요한가 (Track A ↔ B 공통 이음새)
 * - 단일 테넌트(self-host / 사이트별 별도 배포 = 현 운영): site 가 단일이므로
 *   콜백/디스패치가 ctx 를 무시해도 무방 → **현재 동작 변화 0**.
 * - 멀티테넌트(managed SaaS, 향후): 한 프로세스가 여러 host 를 서빙하므로,
 *   디스패치/콜백이 `ctx.site` 로 사이트별 게이팅(활성 플러그인/entitlement)에 사용.
 *
 * 기존 hook 콜백은 추가 인자를 무시하므로 ctx 전달은 점진 도입이며 회귀가 없다.
 * 런타임 경계·등록 규약은 ./HOOKS.md 참고.
 */
import type { SiteContext } from '$lib/server/site-resolver/index.js';

/** hook 콜백에 노출되는 사용자 정보 (App.Locals.user 와 동일 형태, 비로그인 시 null). */
export type HookUser = NonNullable<App.Locals['user']>;

/** 서버 hook 호출에 함께 전달되는 표준 컨텍스트. */
export interface HookContext {
    /** host→site 해석 결과. 멀티테넌트 게이팅용. 단일 테넌트면 단일/누락. */
    site?: SiteContext | null;
    /** 요청 사용자 (비로그인 시 null). */
    user?: HookUser | null;
    /** hook 별 추가 컨텍스트 확장 슬롯. */
    [key: string]: unknown;
}

/**
 * SvelteKit `locals` 에서 표준 HookContext 를 만든다.
 *
 * 서버 load/endpoint 의 hook 호출에서 사용:
 *   applyFilter(name, value, buildHookContext(locals))
 */
export function buildHookContext(locals: App.Locals): HookContext {
    return {
        site: locals.site ?? null,
        user: locals.user ?? null
    };
}
