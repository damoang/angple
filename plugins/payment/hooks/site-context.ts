/**
 * 멀티사이트 site_id 해석.
 *
 * #1224 의 DbSiteResolver 가 hooks.server.ts 에서 이미 host → SiteContext 를 `locals.site` 에 주입.
 * DB(`angple_sites`)에서 해석된 사이트는 `numericId` 를 가지며, config/manifest/env 로 해석된 사이트는
 * 가지지 않으므로 fallback 0 ("기본 사이트") 로 처리한다.
 */

import type { RequestEvent } from '@sveltejs/kit';

const FALLBACK_SITE_ID = 0;

export function resolveSiteId(event: RequestEvent): number {
    return event.locals.site?.numericId ?? FALLBACK_SITE_ID;
}
