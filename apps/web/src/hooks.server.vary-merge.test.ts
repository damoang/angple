import { describe, expect, it } from 'vitest';

/**
 * mergeVarySet — 기존 Vary 헤더 (CORS Origin, framework Accept 등) 와 publicVaryHeader 합쳐서
 * 단일 헤더로 set. 발견 2026-06-04: 2줄 Vary → Cloudflare cache key 첫 줄만 사용 → 인증 누설.
 */
function mergeVarySet(response: { headers: Headers }, additional: string): void {
    const existing = response.headers.get('Vary') || '';
    const items = new Set(
        [...existing.split(','), ...additional.split(',')].map((s) => s.trim()).filter(Boolean)
    );
    response.headers.set('Vary', Array.from(items).join(', '));
}

const publicVaryHeader = 'Host, Cookie, User-Agent, Accept-Encoding';

describe('mergeVarySet — Vary 헤더 단일 보장 (인증 누설 차단)', () => {
    it('기존 Vary 없을 때 = publicVaryHeader 만 set', () => {
        const r = { headers: new Headers() };
        mergeVarySet(r, publicVaryHeader);
        expect(r.headers.get('Vary')).toBe('Host, Cookie, User-Agent, Accept-Encoding');
    });

    it('기존 Vary: Origin (CORS) + publicVaryHeader = 단일 헤더 합쳐짐', () => {
        const r = { headers: new Headers({ Vary: 'Origin' }) };
        mergeVarySet(r, publicVaryHeader);
        const v = r.headers.get('Vary');
        expect(v).toContain('Origin');
        expect(v).toContain('Cookie');
        expect(v).toContain('Host');
        expect(v).toContain('Accept-Encoding');
    });

    it('중복 dim 제거 (Set 사용) — Accept-Encoding 이 둘 다 있어도 한 번만', () => {
        const r = { headers: new Headers({ Vary: 'Accept-Encoding, Origin' }) };
        mergeVarySet(r, publicVaryHeader);
        const v = r.headers.get('Vary') || '';
        const items = v.split(',').map((s) => s.trim());
        const accCount = items.filter((s) => s === 'Accept-Encoding').length;
        expect(accCount).toBe(1);
    });

    it('Vary 헤더 = 결과 단일 줄 (Headers.get 으로 확인)', () => {
        const r = { headers: new Headers({ Vary: 'Origin' }) };
        mergeVarySet(r, publicVaryHeader);
        // Headers.get → 단일 string (multi-line 없음)
        expect(r.headers.get('Vary')?.split('\n').length).toBe(1);
    });

    it('SvelteKit framework "Accept" append 시뮬레이션 — 이미 포함되면 단일', () => {
        const r = { headers: new Headers({ Vary: 'Accept' }) };
        mergeVarySet(r, publicVaryHeader);
        const v = r.headers.get('Vary');
        expect(v).toContain('Accept');
        expect(v).toContain('Cookie');
        // framework 가 다시 .append('Vary', 'Accept') 호출해도 = ?
        // 이건 framework 동작 별도 검증 (mergeVarySet 은 정적 입력만)
    });
});
