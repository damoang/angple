import { describe, it, expect } from 'vitest';
import { safeRedirectUrl } from './safe-redirect';

describe('safeRedirectUrl — 상대 경로', () => {
    it('빈 값은 fallback', () => {
        expect(safeRedirectUrl(null)).toBe('/');
        expect(safeRedirectUrl(undefined)).toBe('/');
        expect(safeRedirectUrl('')).toBe('/');
    });

    it('fallback 인자를 쓴다', () => {
        expect(safeRedirectUrl(null, '/free')).toBe('/free');
        expect(safeRedirectUrl('https://evil.com/', '/free')).toBe('/free');
    });

    it('같은 사이트 경로는 그대로', () => {
        expect(safeRedirectUrl('/')).toBe('/');
        expect(safeRedirectUrl('/free')).toBe('/free');
        expect(safeRedirectUrl('/free/123?page=2#c7')).toBe('/free/123?page=2#c7');
    });

    // ⛔ 회귀 시험의 본체. 아래 세 갈래를 하나라도 지우면 오픈 리다이렉트가 돌아온다.
    it('프로토콜 상대 주소 차단', () => {
        expect(safeRedirectUrl('//evil.com')).toBe('/');
        expect(safeRedirectUrl('//evil.com/free')).toBe('/');
    });

    it('역슬래시 우회 차단', () => {
        expect(safeRedirectUrl('/\\evil.com')).toBe('/');
        expect(safeRedirectUrl('/\\/evil.com')).toBe('/');
    });

    it('제어 문자 차단 — 브라우저가 제거한 뒤 해석한다', () => {
        expect(safeRedirectUrl('/\tevil.com')).toBe('/');
        expect(safeRedirectUrl('/\n/evil.com')).toBe('/');
        expect(safeRedirectUrl('/\r/evil.com')).toBe('/');
        expect(safeRedirectUrl('/free\u0000')).toBe('/');
        expect(safeRedirectUrl('/free\u007f')).toBe('/');
    });
});

describe('safeRedirectUrl — 절대 주소', () => {
    it('허용 호스트는 통과한다', () => {
        expect(safeRedirectUrl('https://damoang.net/free')).toBe('https://damoang.net/free');
        expect(safeRedirectUrl('https://www.damoang.net/free')).toBe(
            'https://www.damoang.net/free'
        );
        expect(safeRedirectUrl('https://ads.damoang.net/invite/a')).toBe(
            'https://ads.damoang.net/invite/a'
        );
        expect(safeRedirectUrl('https://ops.damoang.net/x')).toBe('https://ops.damoang.net/x');
    });

    it('http 도 아직 허용한다 (현행 동작 고정)', () => {
        expect(safeRedirectUrl('http://damoang.net/free')).toBe('http://damoang.net/free');
    });

    it('정규화된 형태로 돌려준다', () => {
        expect(safeRedirectUrl('https://damoang.net')).toBe('https://damoang.net/');
        expect(safeRedirectUrl('HTTPS://DAMOANG.NET/free')).toBe('https://damoang.net/free');
    });

    it('허용 목록 밖 호스트 차단', () => {
        expect(safeRedirectUrl('https://evil.com/')).toBe('/');
        expect(safeRedirectUrl('https://sub.damoang.net/')).toBe('/');
    });

    // ⛔ 문자열 포함 검사로 되돌리면 이 네 줄이 잡는다.
    it('호스트를 흉내낸 주소 차단', () => {
        expect(safeRedirectUrl('https://evil.com/?x=damoang.net')).toBe('/');
        expect(safeRedirectUrl('https://evil.com/damoang.net/free')).toBe('/');
        expect(safeRedirectUrl('https://damoang.net.evil.com/')).toBe('/');
        expect(safeRedirectUrl('https://damoang.net@evil.com/')).toBe('/');
    });

    it('http/https 아닌 스킴 차단', () => {
        expect(safeRedirectUrl('javascript:alert(1)')).toBe('/');
        expect(safeRedirectUrl('data:text/html,<script>1</script>')).toBe('/');
        expect(safeRedirectUrl('ftp://damoang.net/x')).toBe('/');
    });

    it('URL 로 파싱되지 않는 값 차단', () => {
        expect(safeRedirectUrl('free')).toBe('/');
        expect(safeRedirectUrl('../free')).toBe('/');
        expect(safeRedirectUrl('not a url')).toBe('/');
    });
});
