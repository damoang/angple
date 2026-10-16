import { afterEach, describe, expect, it, vi } from 'vitest';

// vi.mock 팩토리는 파일 맨 위로 끌어올려지므로, 팩토리가 읽는 객체도 vi.hoisted 로 먼저 만든다.
const mockEnv = vi.hoisted(() => ({}) as Record<string, string | undefined>);
vi.mock('$env/dynamic/private', () => ({ env: mockEnv }));

import { hasValidInternalSecret, isInternalAppRequest } from './internal-api.js';

function setSecrets(current?: string, previous?: string): void {
    mockEnv.INTERNAL_SECRET = current;
    mockEnv.INTERNAL_SECRET_PREVIOUS = previous;
}

// 비밀값 외의 신호(Origin·Referer·Sec-Fetch-Site·User-Agent)가 없는 요청.
function requestWithSecret(secret?: string): Request {
    const headers = new Headers({ 'user-agent': 'test-client/1.0' });
    if (secret !== undefined) headers.set('x-internal-secret', secret);
    return new Request('https://example.test/api/internal/affiliate/sync', {
        method: 'POST',
        headers
    });
}

afterEach(() => {
    delete mockEnv.INTERNAL_SECRET;
    delete mockEnv.INTERNAL_SECRET_PREVIOUS;
});

describe('hasValidInternalSecret', () => {
    it('현재 값을 받는다', () => {
        setSecrets('cur-secret');
        expect(hasValidInternalSecret('cur-secret')).toBe(true);
    });

    it('이전 값도 받는다', () => {
        setSecrets('cur-secret', 'old-secret');
        expect(hasValidInternalSecret('old-secret')).toBe(true);
        expect(hasValidInternalSecret('cur-secret')).toBe(true);
    });

    it('이전 값이 비어 있으면 무시한다', () => {
        setSecrets('cur-secret', '');
        expect(hasValidInternalSecret('old-secret')).toBe(false);
        expect(hasValidInternalSecret('')).toBe(false);
    });

    it('둘 다 틀리면 거부한다', () => {
        setSecrets('cur-secret', 'old-secret');
        expect(hasValidInternalSecret('wrong')).toBe(false);
    });

    it('빈 헤더·없는 헤더는 거부한다', () => {
        setSecrets('cur-secret', 'old-secret');
        expect(hasValidInternalSecret('')).toBe(false);
        expect(hasValidInternalSecret(null)).toBe(false);
    });

    it('비밀이 하나도 설정되지 않으면 모두 거부한다', () => {
        setSecrets(undefined, undefined);
        expect(hasValidInternalSecret('anything')).toBe(false);
        expect(hasValidInternalSecret('')).toBe(false);
    });

    it('길이가 다른 값도 예외 없이 거부한다', () => {
        setSecrets('cur-secret');
        expect(() => hasValidInternalSecret('c')).not.toThrow();
        expect(hasValidInternalSecret('c')).toBe(false);
        expect(hasValidInternalSecret('cur-secret-and-more')).toBe(false);
    });
});

describe('isInternalAppRequest — 비밀값 경로', () => {
    it('현재 값 헤더면 내부 요청이다', () => {
        setSecrets('cur-secret', 'old-secret');
        expect(isInternalAppRequest(requestWithSecret('cur-secret'))).toBe(true);
    });

    it('이전 값 헤더도 내부 요청이다', () => {
        setSecrets('cur-secret', 'old-secret');
        expect(isInternalAppRequest(requestWithSecret('old-secret'))).toBe(true);
    });

    it('틀린 값이고 다른 신호가 없으면 거부한다', () => {
        setSecrets('cur-secret', 'old-secret');
        expect(isInternalAppRequest(requestWithSecret('wrong'))).toBe(false);
        expect(isInternalAppRequest(requestWithSecret())).toBe(false);
    });
});
