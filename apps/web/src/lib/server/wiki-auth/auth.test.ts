import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
const mocks = vi.hoisted(() => ({
    keys: undefined as unknown,
    redis: { get: vi.fn(), set: vi.fn(), del: vi.fn(), eval: vi.fn() },
    pool: { query: vi.fn(), getConnection: vi.fn() }
}));
vi.mock('$env/dynamic/private', () => ({
    env: {
        WIKIANG_SITE: 'true',
        WIKIANG_GOOGLE_CLIENT_ID: 'wiki-client',
        WIKIANG_GOOGLE_CLIENT_SECRET: 'test-only'
    }
}));
vi.mock('$lib/server/redis', () => ({ getRedis: () => mocks.redis }));
vi.mock('$lib/server/db', () => ({ pool: mocks.pool }));
vi.mock('jose', async (original) => {
    const actual = await original<typeof import('jose')>();
    return {
        ...actual,
        createRemoteJWKSet:
            () =>
            (...args: Parameters<ReturnType<typeof actual.createLocalJWKSet>>) =>
                (mocks.keys as ReturnType<typeof actual.createLocalJWKSet>)(...args)
    };
});
import {
    beginGoogle,
    finishGoogle,
    verifyGoogleToken,
    safeReturnPath,
    readSession,
    findOrCreateUser
} from './index';
import type { Cookies } from '@sveltejs/kit';
const cookieJar = () => {
    const values = new Map<string, string>();
    return {
        get: (name: string) => values.get(name),
        getAll: () => [...values].map(([name, value]) => ({ name, value })),
        set: (name: string, value: string) => {
            values.set(name, value);
        },
        delete: (name: string) => {
            values.delete(name);
        },
        serialize: () => ''
    } satisfies Cookies;
};
let key: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    key = pair.privateKey;
    mocks.keys = createLocalJWKSet({
        keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'test', alg: 'RS256' }]
    });
});
beforeEach(() => vi.clearAllMocks());
const sign = (claims: Record<string, unknown> = {}) =>
    new SignJWT({ nonce: 'nonce', ...claims })
        .setProtectedHeader({ alg: 'RS256', kid: 'test' })
        .setSubject('google-subject')
        .setIssuer('https://accounts.google.com')
        .setAudience('wiki-client')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(key);

describe('independent Wikiang Google authentication', () => {
    it('verifies signed Google identity, audience, nonce, expiry and signature', async () => {
        expect(await verifyGoogleToken(await sign(), 'nonce')).toBe('google-subject');
        await expect(verifyGoogleToken(await sign(), 'different')).rejects.toThrow();
        await expect(
            verifyGoogleToken(await sign({ azp: 'community-client' }), 'nonce')
        ).rejects.toThrow();
        for (const overrides of [
            { aud: 'community-client' },
            { iss: 'https://attacker.invalid' },
            { exp: 1 }
        ]) {
            const jwt = await new SignJWT({
                sub: 'x',
                nonce: 'nonce',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 60,
                aud: 'wiki-client',
                iss: 'https://accounts.google.com',
                ...overrides
            })
                .setProtectedHeader({ alg: 'RS256', kid: 'test' })
                .sign(key);
            await expect(verifyGoogleToken(jwt, 'nonce')).rejects.toThrow();
        }
        const other = await generateKeyPair('RS256');
        const forged = await new SignJWT({ nonce: 'nonce' })
            .setProtectedHeader({ alg: 'RS256', kid: 'test' })
            .sign(other.privateKey);
        await expect(verifyGoogleToken(forged, 'nonce')).rejects.toThrow();
    });
    it('rejects external return paths and never reads community cookies', async () => {
        for (const path of [
            '//evil.test',
            '/\\evil.test',
            'https://evil.test',
            '/wiki-auth/logout',
            '/api/auth/login'
        ])
            expect(safeReturnPath(path)).toBe('/');
        expect(safeReturnPath('/문서/edit')).toContain('/edit');
        const jar = cookieJar();
        jar.set('damoang_jwt', 'old');
        jar.set('angple_sid', 'old');
        expect(await readSession(jar, new URL('https://wikiang.org'))).toBeNull();
        expect(mocks.redis.get).not.toHaveBeenCalled();
    });
    it('uses distinct credentials, minimal scope, PKCE, nonce and expiring state', async () => {
        const jar = cookieJar();
        const target = new URL(
            await beginGoogle(
                jar,
                new URL('https://wikiang.org/wiki-auth/google?returnTo=//evil.test')
            )
        );
        expect(target.origin).toBe('https://accounts.google.com');
        expect(target.searchParams.get('client_id')).toBe('wiki-client');
        expect(target.searchParams.get('redirect_uri')).toBe(
            'https://wikiang.org/wiki-auth/callback'
        );
        expect(target.searchParams.get('scope')).toBe('openid');
        expect(target.searchParams.get('code_challenge_method')).toBe('S256');
        expect(target.searchParams.get('nonce')).toHaveLength(43);
        expect(jar.get('__Host-wikiang_oauth')).toBe(target.searchParams.get('state'));
        expect(mocks.redis.set.mock.calls[0].slice(2)).toEqual(['EX', 600]);
    });
    it('rejects mismatched and consumed callbacks before token exchange', async () => {
        const jar = cookieJar();
        const state = 'x'.repeat(43);
        jar.set('__Host-wikiang_oauth', state);
        await expect(
            finishGoogle(
                jar,
                new URL('https://wikiang.org/wiki-auth/callback?state=wrong&code=secret')
            )
        ).rejects.toThrow();
        expect(mocks.redis.eval).not.toHaveBeenCalled();
        jar.set('__Host-wikiang_oauth', state);
        mocks.redis.eval.mockResolvedValue(null);
        await expect(
            finishGoogle(
                jar,
                new URL('https://wikiang.org/wiki-auth/callback?state=' + state + '&code=secret')
            )
        ).rejects.toThrow('Expired');
    });
    it('completes a verified callback with a fresh opaque session and consumes its state', async () => {
        const jar = cookieJar();
        const target = new URL(
            await beginGoogle(jar, new URL('https://wikiang.org/wiki-auth/google?returnTo=/문서'))
        );
        const flow = JSON.parse(mocks.redis.set.mock.calls[0][1]);
        mocks.redis.eval.mockResolvedValueOnce(JSON.stringify(flow)).mockResolvedValueOnce(null);
        const c = {
            query: vi
                .fn()
                .mockResolvedValueOnce([{}])
                .mockResolvedValueOnce([[{ user_id: 99 }]])
                .mockResolvedValueOnce([[{ id: 99, is_active: 1 }]])
                .mockResolvedValueOnce([{}]),
            beginTransaction: vi.fn(),
            commit: vi.fn(),
            rollback: vi.fn(),
            release: vi.fn()
        };
        mocks.pool.getConnection.mockResolvedValue(c);
        const token = await sign({ nonce: flow.nonce });
        const exchange = vi
            .fn()
            .mockResolvedValue(new Response(JSON.stringify({ id_token: token }), { status: 200 }));
        vi.stubGlobal('fetch', exchange);
        try {
            const callback = new URL(
                'https://wikiang.org/wiki-auth/callback?code=one-time&state=' +
                    target.searchParams.get('state')
            );
            expect(await finishGoogle(jar, callback)).toBe('/%EB%AC%B8%EC%84%9C');
            expect(jar.get('__Host-wikiang_session')).toHaveLength(43);
            expect(jar.get('angple_sid')).toBeUndefined();
            expect(exchange.mock.calls[0][1].body.get('code_verifier')).toBe(flow.verifier);
            expect(JSON.parse(mocks.redis.set.mock.calls[1][1]).userId).toBe(99);
            jar.set('__Host-wikiang_oauth', target.searchParams.get('state')!);
            await expect(finishGoogle(jar, callback)).rejects.toThrow('Expired');
            expect(exchange).toHaveBeenCalledTimes(1);
        } finally {
            vi.unstubAllGlobals();
        }
    });
    it('maps only verified subject to an active wiki user inside a transaction', async () => {
        const query = vi
            .fn()
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([[{ user_id: 99 }]])
            .mockResolvedValueOnce([[{ id: 99, is_active: 1 }]])
            .mockResolvedValueOnce([{}]);
        const c = {
            query,
            beginTransaction: vi.fn(),
            commit: vi.fn(),
            rollback: vi.fn(),
            release: vi.fn()
        };
        mocks.pool.getConnection.mockResolvedValue(c);
        expect(await findOrCreateUser('verified-sub')).toBe(99);
        expect(query.mock.calls[1][1]).toEqual(['verified-sub']);
        expect(c.commit).toHaveBeenCalled();
        expect(JSON.stringify(query.mock.calls)).not.toMatch(/g5_member|email/);
    });
});
