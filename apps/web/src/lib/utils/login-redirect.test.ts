import { describe, it, expect } from 'vitest';
import { sanitizeLoginRedirect } from './login-redirect';

describe('sanitizeLoginRedirect', () => {
    it('빈 값은 루트', () => {
        expect(sanitizeLoginRedirect(null)).toBe('/');
        expect(sanitizeLoginRedirect(undefined)).toBe('/');
        expect(sanitizeLoginRedirect('')).toBe('/');
    });

    it('같은 사이트 상대 경로는 그대로 통과', () => {
        expect(sanitizeLoginRedirect('/')).toBe('/');
        expect(sanitizeLoginRedirect('/free')).toBe('/free');
        expect(sanitizeLoginRedirect('/free/123?page=2#c7')).toBe('/free/123?page=2#c7');
        expect(sanitizeLoginRedirect('/member/settings')).toBe('/member/settings');
    });

    // ⛔ 여기부터가 회귀 시험의 본체다. 조건을 단순화하면 이 중 하나가 깨진다.
    it('프로토콜 상대 주소 차단 — 브라우저가 외부 호스트로 읽는다', () => {
        expect(sanitizeLoginRedirect('//evil.com')).toBe('/');
        expect(sanitizeLoginRedirect('//evil.com/free')).toBe('/');
    });

    it('역슬래시 우회 차단 — `/\\host` 도 외부 호스트로 읽힌다', () => {
        expect(sanitizeLoginRedirect('/\\evil.com')).toBe('/');
        expect(sanitizeLoginRedirect('/\\/evil.com')).toBe('/');
    });

    it('제어 문자 차단 — 브라우저가 제거한 뒤 해석한다', () => {
        expect(sanitizeLoginRedirect('/\tevil.com')).toBe('/');
        expect(sanitizeLoginRedirect('/\nfree')).toBe('/');
        expect(sanitizeLoginRedirect('/\r/evil.com')).toBe('/');
        expect(sanitizeLoginRedirect('/free\u0000')).toBe('/');
        expect(sanitizeLoginRedirect('/free\u007f')).toBe('/');
    });

    it('절대 주소는 예외 없이 차단 — 초대 흐름 예외를 없앴다', () => {
        expect(sanitizeLoginRedirect('https://ads.damoang.net/invite/abc')).toBe('/');
        expect(sanitizeLoginRedirect('https://damoang.net/free')).toBe('/');
        expect(sanitizeLoginRedirect('http://damoang.net/free')).toBe('/');
        expect(sanitizeLoginRedirect('https://evil.com/')).toBe('/');
    });

    // ⛔ 예외가 있던 동안 실제로 통했던 우회. 문자열 포함 검사로 되돌리면 이 줄이 잡는다.
    it('초대 주소를 문자열로 품은 외부 주소 차단', () => {
        expect(sanitizeLoginRedirect('https://evil.com/?x=ads.damoang.net/invite/a')).toBe('/');
        expect(sanitizeLoginRedirect('https://evil.com/ads.damoang.net/invite/a')).toBe('/');
        expect(sanitizeLoginRedirect('https://ads.damoang.net.evil.com/invite/a')).toBe('/');
        expect(sanitizeLoginRedirect('https://ads.damoang.net@evil.com/invite/a')).toBe('/');
    });

    it('스킴 주소 차단', () => {
        expect(sanitizeLoginRedirect('javascript:alert(1)')).toBe('/');
        expect(sanitizeLoginRedirect('data:text/html,<script>1</script>')).toBe('/');
        expect(sanitizeLoginRedirect('mailto:a@b.c')).toBe('/');
    });

    it('상대 경로 아닌 값 차단', () => {
        expect(sanitizeLoginRedirect('free')).toBe('/');
        expect(sanitizeLoginRedirect('../free')).toBe('/');
        expect(sanitizeLoginRedirect(' /free')).toBe('/');
    });

    it('로그인 화면으로 되돌리는 무한 루프 차단', () => {
        expect(sanitizeLoginRedirect('/login')).toBe('/');
        expect(sanitizeLoginRedirect('/login?redirect=/free')).toBe('/');
        // ⚠️ 접두사 검사라 `/login` 으로 시작하는 다른 경로도 함께 막힌다 — 기존 동작 그대로 둔다.
        expect(sanitizeLoginRedirect('/login-help')).toBe('/');
    });
});
