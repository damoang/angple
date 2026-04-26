import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// --- Redis 모듈 모킹 ---
// 각 테스트에서 get/setex 동작을 자유롭게 바꾸기 위해 vi.fn() 으로 래핑.
const redisGet = vi.fn();
const redisSetex = vi.fn();

vi.mock('../redis.js', () => ({
    getRedis: () => ({
        get: redisGet,
        setex: redisSetex
    })
}));

// 모킹 후에 import (vi.mock 은 hoist 되지만 명시적으로 안전 보장).
import { resolveBlueskyHandle, isValidDID } from './resolver';

const VALID_DID = 'did:plc:abc123xyzhandle';

function mockFetchOk(did: string): Mock {
    return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ did })
    });
}

function mockFetchStatus(status: number): Mock {
    return vi.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({})
    });
}

describe('isValidDID', () => {
    it('did:plc:* / did:web:* 만 통과', () => {
        expect(isValidDID('did:plc:abc123')).toBe(true);
        expect(isValidDID('did:web:example.com')).toBe(true);
        expect(isValidDID('did:bad:abc')).toBe(false);
        expect(isValidDID('handle.bsky.social')).toBe(false);
        expect(isValidDID(undefined)).toBe(false);
        expect(isValidDID(null)).toBe(false);
        expect(isValidDID(123)).toBe(false);
    });
});

describe('resolveBlueskyHandle', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        redisGet.mockReset();
        redisSetex.mockReset();
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('빈 입력은 null 반환', async () => {
        await expect(resolveBlueskyHandle('')).resolves.toBeNull();
        // @ts-expect-error 의도적 잘못된 타입 입력
        await expect(resolveBlueskyHandle(undefined)).resolves.toBeNull();
    });

    it('이미 DID 형식이면 fetch 없이 그대로 반환', async () => {
        const fetchMock = vi.fn();
        globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

        await expect(resolveBlueskyHandle(VALID_DID)).resolves.toBe(VALID_DID);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(redisGet).not.toHaveBeenCalled();
    });

    it('Redis 캐시 히트 시 fetch 없이 DID 반환', async () => {
        redisGet.mockResolvedValue(VALID_DID);
        const fetchMock = vi.fn();
        globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

        const result = await resolveBlueskyHandle('AAGaming.me');
        expect(result).toBe(VALID_DID);
        // 키는 lowercase 정규화되어야 함.
        expect(redisGet).toHaveBeenCalledWith('bsky:handle:aagaming.me');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(redisSetex).not.toHaveBeenCalled();
    });

    it('Redis NX 센티넬 히트 시 fetch 없이 null 반환', async () => {
        redisGet.mockResolvedValue('NX');
        const fetchMock = vi.fn();
        globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

        await expect(resolveBlueskyHandle('missing.bsky.social')).resolves.toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('Redis 미스 → fetch 성공 → 30일 TTL 로 캐시', async () => {
        redisGet.mockResolvedValue(null);
        redisSetex.mockResolvedValue('OK');
        globalThis.fetch = mockFetchOk(VALID_DID) as unknown as typeof globalThis.fetch;

        const result = await resolveBlueskyHandle('aagaming.me');
        expect(result).toBe(VALID_DID);
        expect(redisSetex).toHaveBeenCalledWith(
            'bsky:handle:aagaming.me',
            60 * 60 * 24 * 30,
            VALID_DID
        );
    });

    it('Redis 미스 → fetch 404 → NX 센티넬 10분 TTL 로 캐시 + null 반환', async () => {
        redisGet.mockResolvedValue(null);
        redisSetex.mockResolvedValue('OK');
        globalThis.fetch = mockFetchStatus(404) as unknown as typeof globalThis.fetch;

        const result = await resolveBlueskyHandle('missing.bsky.social');
        expect(result).toBeNull();
        expect(redisSetex).toHaveBeenCalledWith('bsky:handle:missing.bsky.social', 60 * 10, 'NX');
    });

    it('Redis get 장애 → 직접 fetch + setex 호출하지 않음', async () => {
        redisGet.mockRejectedValue(new Error('connection refused'));
        globalThis.fetch = mockFetchOk(VALID_DID) as unknown as typeof globalThis.fetch;

        const result = await resolveBlueskyHandle('aagaming.me');
        expect(result).toBe(VALID_DID);
        // get 이 던지면 redisAvailable=false 가 되어 setex 도 건드리지 않아야 함.
        expect(redisSetex).not.toHaveBeenCalled();
    });

    it('fetch 응답에 잘못된 DID 형식이 오면 null + NX 캐시', async () => {
        redisGet.mockResolvedValue(null);
        redisSetex.mockResolvedValue('OK');
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ did: 'not-a-did' })
        }) as unknown as typeof globalThis.fetch;

        const result = await resolveBlueskyHandle('weird.example');
        expect(result).toBeNull();
        expect(redisSetex).toHaveBeenCalledWith('bsky:handle:weird.example', 60 * 10, 'NX');
    });

    it('fetch 자체가 throw → null + NX 캐시', async () => {
        redisGet.mockResolvedValue(null);
        redisSetex.mockResolvedValue('OK');
        globalThis.fetch = vi
            .fn()
            .mockRejectedValue(new Error('network down')) as unknown as typeof globalThis.fetch;
        // console.warn 잡기.
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await resolveBlueskyHandle('flaky.example');
        expect(result).toBeNull();
        expect(redisSetex).toHaveBeenCalledWith('bsky:handle:flaky.example', 60 * 10, 'NX');
    });
});
