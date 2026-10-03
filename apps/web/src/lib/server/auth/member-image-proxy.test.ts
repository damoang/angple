import { describe, it, expect, vi } from 'vitest';
import {
    backendErrorMessage,
    loadFreshMember,
    parseBackendBody,
    resolveProxyToken
} from './member-image-proxy';

describe('resolveProxyToken', () => {
    it('요청 토큰이 있으면 그것을 쓴다', () => {
        expect(resolveProxyToken('req-token', 'locals-token')).toBe('req-token');
    });

    it('요청 토큰이 비면 locals.accessToken 으로 폴백', () => {
        expect(resolveProxyToken('', 'locals-token')).toBe('locals-token');
    });

    it('둘 다 없으면 빈 문자열', () => {
        expect(resolveProxyToken('', null)).toBe('');
        expect(resolveProxyToken(undefined, undefined)).toBe('');
    });
});

describe('parseBackendBody', () => {
    it('JSON 객체를 해석한다', () => {
        expect(parseBackendBody('{"success":true,"data":{"url":"x"}}')).toEqual({
            success: true,
            data: { url: 'x' }
        });
    });

    it('JSON 이 아니면 null', () => {
        expect(parseBackendBody('<html>413 Request Entity Too Large</html>')).toBeNull();
    });

    it('빈 본문·원시값은 null', () => {
        expect(parseBackendBody('')).toBeNull();
        expect(parseBackendBody('"text"')).toBeNull();
        expect(parseBackendBody('null')).toBeNull();
    });
});

describe('backendErrorMessage', () => {
    it('error 필드를 우선', () => {
        expect(backendErrorMessage({ error: 'E', message: 'M' }, 'F')).toBe('E');
    });

    it('error 가 없으면 message', () => {
        expect(backendErrorMessage({ message: 'M' }, 'F')).toBe('M');
    });

    it('본문이 없거나 문자열이 아니면 기본 문구', () => {
        expect(backendErrorMessage(null, 'F')).toBe('F');
        expect(backendErrorMessage({ error: { code: 1 } }, 'F')).toBe('F');
        expect(backendErrorMessage({ error: '' }, 'F')).toBe('F');
    });
});

describe('loadFreshMember', () => {
    it('캐시를 먼저 비운 뒤 조회한다', async () => {
        const calls: string[] = [];
        const invalidate = vi.fn(async (id: string) => {
            calls.push(`invalidate:${id}`);
        });
        const load = vi.fn(async (id: string) => {
            calls.push(`load:${id}`);
            return { mb_id: id };
        });

        const member = await loadFreshMember('user1', { invalidate, load });

        expect(member).toEqual({ mb_id: 'user1' });
        expect(calls).toEqual(['invalidate:user1', 'load:user1']);
    });

    it('캐시 무효화가 실패해도 조회는 진행한다', async () => {
        const invalidate = vi.fn(async () => {
            throw new Error('redis down');
        });
        const load = vi.fn(async () => ({ mb_id: 'user1' }));

        await expect(loadFreshMember('user1', { invalidate, load })).resolves.toEqual({
            mb_id: 'user1'
        });
        expect(load).toHaveBeenCalledWith('user1');
    });
});
