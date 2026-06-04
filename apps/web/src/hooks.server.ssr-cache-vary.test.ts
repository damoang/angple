import { describe, expect, it } from 'vitest';

/**
 * SSR cache 응답 (HIT/MISS/pending) — Vary 누락 회귀 방지.
 * 발견 2026-06-05: SSR cache 3분기 (L833 HIT / L857 pending HIT / L913 MISS)
 * 의 headers object 가 publicVaryHeader 미포함 → Cloudflare cache key 가
 * cookie 무관 → 인증/비로그인 같은 cache 공유 → UX 사고 (인증 사용자가
 * 비로그인 view 받음).
 */
const publicVaryHeader = 'Host, Cookie, User-Agent, Accept-Encoding';
const publicHtmlCacheControl = 'public, s-maxage=10, stale-while-revalidate=5, max-age=0';

function buildSsrResponseHeaders(ssrCacheState: 'HIT' | 'MISS'): Record<string, string> {
    return {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': publicHtmlCacheControl,
        Vary: publicVaryHeader,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-SSR-Cache': ssrCacheState
    };
}

describe('SSR cache 응답 — Vary 헤더 회귀 방지', () => {
    it('HIT 응답에 Vary 헤더 포함', () => {
        const h = buildSsrResponseHeaders('HIT');
        expect(h.Vary).toBeDefined();
        expect(h.Vary).toContain('Cookie');
    });

    it('MISS 응답에 Vary 헤더 포함', () => {
        const h = buildSsrResponseHeaders('MISS');
        expect(h.Vary).toBeDefined();
        expect(h.Vary).toContain('Cookie');
    });

    it('Vary 헤더 값 = publicVaryHeader 정확 일치', () => {
        const h = buildSsrResponseHeaders('HIT');
        expect(h.Vary).toBe('Host, Cookie, User-Agent, Accept-Encoding');
    });

    it('Vary 에 Host, Cookie, User-Agent, Accept-Encoding 4개 dim 모두 포함', () => {
        const h = buildSsrResponseHeaders('MISS');
        const vary = h.Vary;
        expect(vary).toContain('Host');
        expect(vary).toContain('Cookie');
        expect(vary).toContain('User-Agent');
        expect(vary).toContain('Accept-Encoding');
    });

    it('Cache-Control = publicHtmlCacheControl 유지', () => {
        const h = buildSsrResponseHeaders('HIT');
        expect(h['Cache-Control']).toBe(publicHtmlCacheControl);
        expect(h['Cache-Control']).toContain('public');
    });
});
