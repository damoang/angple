/**
 * OAuth state 쿠키 round-trip 테스트.
 * #12037 추가 연결(link) 모드의 linkTo 필드를 state 에 저장/검증하는 흐름을 보호한다.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

vi.mock('$app/environment', () => ({ dev: true }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { createOAuthState, validateOAuthState } from './state.js';

function createFakeCookies(): Cookies {
    const store = new Map<string, string>();
    return {
        get: (name: string) => store.get(name),
        set: (name: string, value: string) => {
            store.set(name, value);
        },
        delete: (name: string) => {
            store.delete(name);
        },
        getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
        serialize: () => ''
    } as unknown as Cookies;
}

describe('OAuth state with linkTo', () => {
    it('round-trips state with linkTo when provided', () => {
        const cookies = createFakeCookies();
        const state = createOAuthState(cookies, 'apple', '/member/settings', 'mb_user_a');
        const data = validateOAuthState(cookies, state);
        expect(data).not.toBeNull();
        expect(data?.linkTo).toBe('mb_user_a');
        expect(data?.provider).toBe('apple');
        expect(data?.redirect).toBe('/member/settings');
    });

    it('omits linkTo when not provided (regular login flow)', () => {
        const cookies = createFakeCookies();
        const state = createOAuthState(cookies, 'google', '/');
        const data = validateOAuthState(cookies, state);
        expect(data).not.toBeNull();
        expect(data?.linkTo).toBeUndefined();
    });

    it('returns null when state mismatches (CSRF)', () => {
        const cookies = createFakeCookies();
        createOAuthState(cookies, 'naver', '/', 'mb_user_a');
        expect(validateOAuthState(cookies, 'attacker_state')).toBeNull();
    });
});
