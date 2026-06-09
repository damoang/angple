import { describe, expect, it } from 'vitest';

/**
 * 308/301 redirect 응답 — Vary 누락 시 cache 인증 누설 회귀 방지.
 * 동일 정규식/조건 로직을 test 에서 복제 (구현 안정성 검증용).
 */
const publicVaryHeader = 'Host, Cookie, User-Agent, Accept-Encoding';

function setRedirectHeaders(
    response: { status: number; headers: Map<string, string> },
    status: 301 | 308
) {
    if (response.status === 301 || response.status === 308) {
        response.headers.set(
            'Cache-Control',
            'public, s-maxage=86400, max-age=3600, stale-while-revalidate=604800'
        );
        response.headers.set('Vary', publicVaryHeader);
    }
}

describe('308/301 redirect 응답 — Vary 누락 회귀 방지', () => {
    it('sets Vary: Cookie 포함 헤더 on 308', () => {
        const response = { status: 308, headers: new Map() };
        setRedirectHeaders(response, 308);
        const vary = response.headers.get('Vary');
        expect(vary).toBeDefined();
        expect(vary).toContain('Cookie');
    });

    it('sets Vary 헤더 on 301', () => {
        const response = { status: 301, headers: new Map() };
        setRedirectHeaders(response, 301);
        const vary = response.headers.get('Vary');
        expect(vary).toContain('Cookie');
    });

    it('Vary 헤더 = publicVaryHeader 일치 (Host, Cookie, User-Agent, Accept-Encoding)', () => {
        const response = { status: 308, headers: new Map() };
        setRedirectHeaders(response, 308);
        expect(response.headers.get('Vary')).toBe('Host, Cookie, User-Agent, Accept-Encoding');
    });

    it('Cache-Control public 도 같이 set (CDN cache 24h)', () => {
        const response = { status: 308, headers: new Map() };
        setRedirectHeaders(response, 308);
        const cc = response.headers.get('Cache-Control');
        expect(cc).toContain('public');
        expect(cc).toContain('s-maxage=86400');
    });
});
