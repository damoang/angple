/**
 * GET /api/angmap/resolve?url=...
 *
 * 앙지도 작성폼 자동완성 전용 서버 프록시 — 지도 링크(naver.me/kko.to/goo.gl 등)를
 * 좌표·상호·주소로 해소해 "이 장소 맞나요?" 확인 칩에 공급한다.
 *
 * - 로그인 필수 (작성 문맥 전용 — 익명 대량 호출로 외부 fetch 를 유발하지 않게)
 * - 대상 호스트는 $lib/utils/angmap-link.ts allowlist 로 제한 (SSRF 가드)
 * - 같은 가게 재공유가 잦아 URL 키 10분 캐시 (실패도 negative cache)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCache } from '$lib/server/cache.js';
import { resolveMapUrl, type AngmapResolvedPlace } from '$lib/server/angmap-resolve.js';
import { findMapLink } from '$lib/utils/angmap-link.js';

const resolveCache = createCache<AngmapResolvedPlace | null>({ ttl: 600_000, maxSize: 300 });

export const GET: RequestHandler = async ({ url, locals }) => {
    if (!locals.user?.id) {
        return json({ place: null }, { status: 401 });
    }

    const raw = (url.searchParams.get('url') ?? '').slice(0, 500);
    const candidate = findMapLink(raw);
    if (!candidate) {
        return json({ place: null });
    }

    const place = await resolveCache.getOrSet(`angmap:resolve:${candidate}`, () =>
        resolveMapUrl(candidate)
    );

    return json({ place }, { headers: { 'cache-control': 'private, max-age=300' } });
};
