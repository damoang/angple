import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const redisGet = vi.fn();
const redisSetex = vi.fn();
const redisDel = vi.fn();

vi.mock('$lib/server/db', () => ({
    pool: {
        query: mockQuery
    }
}));

vi.mock('$lib/server/redis.js', () => ({
    getRedis: () => ({
        get: redisGet,
        setex: redisSetex,
        del: redisDel
    })
}));

async function loadModule() {
    vi.resetModules();
    return import('./db.js');
}

describe('DbSiteResolver', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        redisGet.mockReset();
        redisSetex.mockReset();
        redisDel.mockReset();
        redisGet.mockResolvedValue(null);
        redisSetex.mockResolvedValue('OK');
        redisDel.mockResolvedValue(1);
    });

    it('positive lookup 는 캐시되어 같은 host 재조회 시 DB를 다시 치지 않는다', async () => {
        mockQuery.mockResolvedValueOnce([
            [
                {
                    id: 7,
                    domain: 'damoang.net',
                    theme_id: 'default',
                    site_title: 'Damoang',
                    site_description: null,
                    site_url: null,
                    logo_url: null,
                    favicon_url: null,
                    keywords: '["community"]',
                    settings: null,
                    active: 1
                }
            ]
        ]);

        const { DbSiteResolver } = await loadModule();
        const resolver = new DbSiteResolver();

        await expect(resolver.resolve('damoang.net')).resolves.toMatchObject({
            id: 'db:7',
            numericId: 7,
            theme_id: 'default',
            title: 'Damoang',
            keywords: ['community']
        });
        await expect(resolver.resolve('damoang.net')).resolves.toMatchObject({
            id: 'db:7'
        });
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('miss 는 60초 negative cache 되어 같은 host 재조회 시 DB를 다시 치지 않는다', async () => {
        mockQuery.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

        const { DbSiteResolver } = await loadModule();
        const resolver = new DbSiteResolver();

        await expect(resolver.resolve('unknown.damoang.net')).resolves.toBeNull();
        await expect(resolver.resolve('unknown.damoang.net')).resolves.toBeNull();
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('angple_sites 테이블 누락 시 resolver 를 일정 시간 자동 bypass 한다', async () => {
        const tableMissing = Object.assign(new Error('missing table'), {
            code: 'ER_NO_SUCH_TABLE',
            errno: 1146
        });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockQuery.mockRejectedValueOnce(tableMissing);

        const { DbSiteResolver } = await loadModule();
        const resolver = new DbSiteResolver();

        await expect(resolver.resolve('damoang.net')).resolves.toBeNull();
        mockQuery.mockClear();
        await expect(resolver.resolve('another.damoang.net')).resolves.toBeNull();

        expect(mockQuery).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('angple_sites tables unavailable'),
            tableMissing
        );
    });

    it('일반 DB 오류는 숨기지 않고 상위로 전달한다', async () => {
        const fatal = new Error('db down');
        mockQuery.mockRejectedValueOnce(fatal);

        const { DbSiteResolver } = await loadModule();
        const resolver = new DbSiteResolver();

        await expect(resolver.resolve('damoang.net')).rejects.toThrow('db down');
    });
});
