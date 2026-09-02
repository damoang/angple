import { describe, it, expect } from 'vitest';
import { pathGroup } from './web-vitals-rum';

/**
 * `pathGroup` 은 **기존 `web_vitals.page=` 와 공용**이다. 값이 한 글자라도 바뀌면
 * 그 값으로 짜인 집계 쿼리가 전부 깨진다. 그래서 "안 바뀐다" 를 말로 두지 않고
 * **바뀌기 전 구현을 그대로 박아** 대조한다(2026-09-02, bug/13836 3차).
 */
const legacyPathGroup = (pathname: string): string =>
    pathname
        .replace(/^\/([a-zA-Z0-9_-]+)\/\d+.*$/, '/$1/:id')
        .replace(/\/\d+/g, '/:n')
        .slice(0, 60);

/** 식별자 누출과 무관한 경로들 — 여기 값은 **한 글자도** 달라지면 안 된다. */
const UNCHANGED_PATHS = [
    '/',
    '',
    '/free',
    '/free/',
    '/free/123',
    '/free/123/edit',
    '/notice/18300',
    '/car',
    '/wiki/damoang',
    '/search',
    '/admin/members',
    '/my/posts',
    '/messages/456',
    '/point',
    '/level',
    '/shop/1/2',
    // 대상 접두사이지만 **정적 라우트**인 것들 — 남아야 한다
    '/member/settings',
    '/member/settings/social',
    '/member/settings/ui',
    '/member/settings/verify-email',
    '/member/orders',
    '/member/leave',
    '/member/leave/cancel',
    '/member/leave/complete',
    '/member/escrow',
    '/checkout/complete',
    // 대상 접두사 + **숫자** 식별자 — 기존 규칙이 이미 처리한다(값 보존)
    '/member/12345',
    '/member/orders/9876',
    '/go/12',
    '/checkout/4242',
    // 프로토타입 키가 경로로 들어와도 예외 없이 그대로
    '/toString/x',
    '/constructor'
];

/** 회원 식별자가 그대로 실려 나가던 경로들 — `:id` 로 가려져야 한다. */
const MASKED_PATHS: Array<[string, string]> = [
    ['/member/naver_8e22080b', '/member/:id'],
    ['/member/google_956d0909', '/member/:id'],
    ['/member/kakao_1a2b3c4d', '/member/:id'],
    ['/member/hong_gildong', '/member/:id'],
    ['/member/naver_8e22080b/', '/member/:id/'],
    ['/invite/AbC-token_1', '/invite/:id'],
    ['/go/aBcD1234', '/go/:id'],
    ['/checkout/ORD-2026-0902', '/checkout/:id'],
    ['/member/orders/ORD-2026-0902', '/member/orders/:id']
];

describe('pathGroup — 기존 값 불변', () => {
    it('식별자 누출과 무관한 경로는 변경 전 구현과 완전히 동일하다', () => {
        for (const p of UNCHANGED_PATHS) {
            expect(`${p} -> ${pathGroup(p)}`).toBe(`${p} -> ${legacyPathGroup(p)}`);
        }
    });

    it('대표 값이 그대로다', () => {
        expect(pathGroup('/')).toBe('/');
        expect(pathGroup('/free')).toBe('/free');
        expect(pathGroup('/free/123')).toBe('/free/:id');
        expect(pathGroup('/member/settings')).toBe('/member/settings');
        expect(pathGroup('/member/12345')).toBe('/member/:id');
    });
});

describe('pathGroup — 회원 식별자 마스킹', () => {
    it('member/invite/go/checkout 의 비숫자 식별자 세그먼트를 :id 로 가린다', () => {
        for (const [input, expected] of MASKED_PATHS) {
            expect(`${input} -> ${pathGroup(input)}`).toBe(`${input} -> ${expected}`);
        }
    });

    it('가린 뒤에는 어떤 식별자 원문도 남지 않는다', () => {
        for (const [input] of MASKED_PATHS) {
            expect(pathGroup(input)).not.toMatch(/naver_|google_|kakao_|ORD-|token/);
        }
    });
});
