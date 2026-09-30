import { describe, it, expect } from 'vitest';
import { sanitizeLoginRedirect, sanitizeAdminRedirect } from './login-redirect';

describe('sanitizeLoginRedirect — 상대 경로', () => {
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

    it('상대 경로 아닌 값 차단', () => {
        expect(sanitizeLoginRedirect('free')).toBe('/');
        expect(sanitizeLoginRedirect('../free')).toBe('/');
        expect(sanitizeLoginRedirect(' /free')).toBe('/');
    });
});

describe('sanitizeLoginRedirect — 다모앙 서브도메인 복귀', () => {
    // ⛔ 이 블록이 서브도메인 로그인의 생명줄이다. 2026-10-01 에 「상대 경로만」으로 좁혔다가
    //    ads·ops 복귀를 끊었다(#2336). 아래는 실제 호출부가 보내는 값 그대로다.
    it('광고주 대시보드 복귀 — damoang-ads 실제 호출부', () => {
        // base-client.ts:33 · auth.svelte.ts:142 — window.location.href
        expect(sanitizeLoginRedirect('https://ads.damoang.net/dashboard')).toBe(
            'https://ads.damoang.net/dashboard'
        );
        expect(sanitizeLoginRedirect('https://ads.damoang.net/promotion?tab=period')).toBe(
            'https://ads.damoang.net/promotion?tab=period'
        );
        // login/+page.svelte:52 — window.location.origin (경로 없음)
        expect(sanitizeLoginRedirect('https://ads.damoang.net')).toBe('https://ads.damoang.net/');
    });

    it('운영 콘솔 복귀 — damoang-ops 실제 호출부', () => {
        // hooks.server.ts:28 — event.url.href
        expect(sanitizeLoginRedirect('https://ops.damoang.net/singo/123')).toBe(
            'https://ops.damoang.net/singo/123'
        );
        // login/+page.svelte:30 — 오리진 리터럴
        expect(sanitizeLoginRedirect('https://ops.damoang.net')).toBe('https://ops.damoang.net/');
    });

    it('본 사이트 절대 주소도 허용', () => {
        expect(sanitizeLoginRedirect('https://damoang.net/free')).toBe('https://damoang.net/free');
        expect(sanitizeLoginRedirect('https://www.damoang.net/free')).toBe(
            'https://www.damoang.net/free'
        );
    });

    it('http 도 허용한다 — 서버 safeRedirectUrl 과 같은 정책', () => {
        expect(sanitizeLoginRedirect('http://ads.damoang.net/x')).toBe('http://ads.damoang.net/x');
    });

    it('대소문자는 파서가 정규화한다', () => {
        expect(sanitizeLoginRedirect('HTTPS://ADS.DAMOANG.NET/x')).toBe(
            'https://ads.damoang.net/x'
        );
    });
});

describe('sanitizeLoginRedirect — 호스트 위장 차단', () => {
    // ⛔ 여기가 #2312 가 고친 구멍이다. 문자열 포함 검사로 되돌리면 이 블록이 잡는다.
    it('허용 호스트를 문자열로 품은 외부 주소 차단', () => {
        expect(sanitizeLoginRedirect('https://evil.com/?x=ads.damoang.net')).toBe('/');
        expect(sanitizeLoginRedirect('https://evil.com/ads.damoang.net/invite/a')).toBe('/');
        expect(sanitizeLoginRedirect('https://evil.com/#ops.damoang.net')).toBe('/');
    });

    it('접미사·인증정보 위장 차단', () => {
        expect(sanitizeLoginRedirect('https://ads.damoang.net.evil.com/')).toBe('/');
        expect(sanitizeLoginRedirect('https://ads.damoang.net@evil.com/')).toBe('/');
        expect(sanitizeLoginRedirect('https://damoang.net@evil.com/')).toBe('/');
    });

    it('허용목록에 없는 다모앙 하위 호스트 차단', () => {
        expect(sanitizeLoginRedirect('https://sub.ads.damoang.net/')).toBe('/');
        expect(sanitizeLoginRedirect('https://static.damoang.net/x')).toBe('/');
        expect(sanitizeLoginRedirect('https://evil.damoang.net.co/')).toBe('/');
    });

    it('외부 호스트 차단', () => {
        expect(sanitizeLoginRedirect('https://evil.com/')).toBe('/');
        expect(sanitizeLoginRedirect('https://damoang.net.attacker.io/free')).toBe('/');
    });

    it('http/https 아닌 스킴 차단', () => {
        expect(sanitizeLoginRedirect('javascript:alert(1)')).toBe('/');
        expect(sanitizeLoginRedirect('data:text/html,<script>1</script>')).toBe('/');
        expect(sanitizeLoginRedirect('mailto:a@b.c')).toBe('/');
        expect(sanitizeLoginRedirect('ftp://damoang.net/x')).toBe('/');
    });
});

describe('sanitizeLoginRedirect — 로그인 루프 차단', () => {
    it('상대 경로 /login 차단', () => {
        expect(sanitizeLoginRedirect('/login')).toBe('/');
        expect(sanitizeLoginRedirect('/login?redirect=/free')).toBe('/');
        // ⚠️ 접두사 검사라 `/login` 으로 시작하는 다른 경로도 함께 막힌다 — 기존 동작 그대로 둔다.
        expect(sanitizeLoginRedirect('/login-help')).toBe('/');
    });

    it('관리자 로그인 경로도 루프다', () => {
        expect(sanitizeLoginRedirect('/admin/login')).toBe('/');
        expect(sanitizeLoginRedirect('/admin/login?redirect=/admin')).toBe('/');
        expect(sanitizeLoginRedirect('https://damoang.net/admin/login')).toBe('/');
    });

    // ⛔ 절대 주소로 쓴 로그인 화면은 상대 경로 검사가 못 잡는다. 따로 막아야 한다.
    it('절대 주소 /login 도 차단', () => {
        expect(sanitizeLoginRedirect('https://damoang.net/login')).toBe('/');
        expect(sanitizeLoginRedirect('https://www.damoang.net/login?redirect=/free')).toBe('/');
    });

    it('서브도메인의 /login 은 우리 루프가 아니라 허용', () => {
        expect(sanitizeLoginRedirect('https://ops.damoang.net/login')).toBe(
            'https://ops.damoang.net/login'
        );
    });
});

describe('sanitizeLoginRedirect — fallback 인자', () => {
    it('거부된 값은 fallback 으로 간다', () => {
        expect(sanitizeLoginRedirect(null, '/admin')).toBe('/admin');
        expect(sanitizeLoginRedirect('', '/admin')).toBe('/admin');
        expect(sanitizeLoginRedirect('https://evil.com/', '/admin')).toBe('/admin');
        expect(sanitizeLoginRedirect('//evil.com', '/admin')).toBe('/admin');
        expect(sanitizeLoginRedirect('javascript:alert(1)', '/admin')).toBe('/admin');
    });

    it('통과한 값은 fallback 과 무관하다', () => {
        expect(sanitizeLoginRedirect('/free', '/admin')).toBe('/free');
    });
});

describe('sanitizeAdminRedirect', () => {
    // ⛔ 2026-10-01 까지 관리자 로그인 화면은 이 값을 검증 없이 `window.location.href` 에 넣었다.
    it('외부로 관리자를 내보내지 않는다', () => {
        expect(sanitizeAdminRedirect('https://evil.com/')).toBe('/admin');
        expect(sanitizeAdminRedirect('//evil.com')).toBe('/admin');
        expect(sanitizeAdminRedirect('/\\evil.com')).toBe('/admin');
        expect(sanitizeAdminRedirect('https://damoang.net.evil.com/admin')).toBe('/admin');
        expect(sanitizeAdminRedirect('https://evil.com/?x=damoang.net')).toBe('/admin');
    });

    it('`javascript:` 가 location.href 에 도달하지 않는다', () => {
        expect(sanitizeAdminRedirect('javascript:alert(1)')).toBe('/admin');
        expect(sanitizeAdminRedirect('data:text/html,<script>1</script>')).toBe('/admin');
    });

    it('관리자 경로는 그대로 통과', () => {
        expect(sanitizeAdminRedirect('/admin')).toBe('/admin');
        expect(sanitizeAdminRedirect('/admin/members?page=2')).toBe('/admin/members?page=2');
        expect(sanitizeAdminRedirect('/admin/ads/promotion')).toBe('/admin/ads/promotion');
    });

    it('빈 값은 /admin — 루트로 보내면 관리자가 다시 들어와야 한다', () => {
        expect(sanitizeAdminRedirect(null)).toBe('/admin');
        expect(sanitizeAdminRedirect(undefined)).toBe('/admin');
        expect(sanitizeAdminRedirect('')).toBe('/admin');
    });

    it('관리자 로그인 화면으로 되돌리는 루프 차단', () => {
        expect(sanitizeAdminRedirect('/admin/login')).toBe('/admin');
        expect(sanitizeAdminRedirect('/admin/login?login=success')).toBe('/admin');
    });

    it('제어 문자 차단', () => {
        expect(sanitizeAdminRedirect('/admin\u0000')).toBe('/admin');
        expect(sanitizeAdminRedirect('/\tadmin')).toBe('/admin');
    });
});
