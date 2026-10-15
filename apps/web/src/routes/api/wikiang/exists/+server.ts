import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createCache } from '$lib/server/cache';
import { isWikiangLookup, type WikiangLookup } from '$lib/utils/wikiang-source';

const cache = createCache<WikiangLookup>({ ttl: 300_000, maxSize: 300 });
let retryAfter = 0;
let lastErrorLog = 0;

/** 독립 위키앙의 공개 메타데이터 API만 사용한다. DB·회원·인증 정보는 공유하지 않는다. */
export const GET: RequestHandler = async ({ url }) => {
    const raw = url.searchParams.has('title')
        ? url.searchParams.getAll('title')
        : (url.searchParams.get('titles') ?? '').split('|');
    const titles = [...new Set(raw.map((title) => title.trim()).filter(Boolean))];
    if (titles.length > 20 || titles.some((title) => title.length > 255)) {
        return json({ error: 'invalid_titles' }, { status: 400 });
    }
    if (!titles.length) return json({ checked: [], pages: [], exists: [] });
    try {
        const result = await cache.getOrSet(JSON.stringify([...titles].sort()), async () => {
            if (Date.now() < retryAfter) throw new Error('Wikiang lookup cooling down');
            const target = new URL('https://wikiang.org/api/wiki/lookup');
            for (const title of titles) target.searchParams.append('title', title);
            const response = await fetch(target, {
                redirect: 'error',
                credentials: 'omit',
                signal: AbortSignal.timeout(3000),
                headers: { accept: 'application/json' }
            });
            if (!response.ok) throw new Error(`Wikiang lookup HTTP ${response.status}`);
            const data: unknown = await response.json();
            if (!isWikiangLookup(data, titles)) throw new Error('Invalid Wikiang lookup response');
            return data;
        });
        return json(
            { ...result, exists: result.pages.map((page) => page.title) },
            { headers: { 'cache-control': 'public, max-age=300' } }
        );
    } catch (error) {
        const now = Date.now();
        if (now >= retryAfter) retryAfter = now + 10_000;
        if (now - lastErrorLog > 60_000) {
            lastErrorLog = now;
            console.error('[wikiang/exists] public lookup failed:', error);
        }
        return json(
            { error: 'lookup_unavailable' },
            { status: 503, headers: { 'cache-control': 'no-store' } }
        );
    }
};
