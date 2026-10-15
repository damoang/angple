import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockGetConnection = vi.fn();
const redisSet = vi.fn();

vi.mock('$lib/server/db', () => ({
    default: { query: mockQuery, getConnection: mockGetConnection },
    pool: { query: mockQuery, getConnection: mockGetConnection }
}));

vi.mock('$lib/server/redis', () => ({
    getRedis: () => ({ set: redisSet })
}));

vi.mock('$lib/server/link-processing/runtime', () => ({
    isLinkProcessingPluginEnabled: vi.fn().mockResolvedValue(true)
}));

vi.mock('$plugins/affiliate-link-private/lib/resolver.server', () => ({
    resolveAffiliateCandidate: vi.fn()
}));

vi.mock('$lib/server/affiliate-events', () => ({
    sendAffiliateDecisionEvents: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/server/affiliate-redirect', () => ({
    resolveAffiliateRedirect: vi.fn()
}));

async function load() {
    return import('./affiliate-links');
}

function sampleRow() {
    return {
        entityType: 'post_body' as const,
        linkIndex: 1,
        sourceUrl: 'https://example.com',
        normalizedUrl: 'https://example.com',
        merchantDomain: 'example.com',
        platform: '',
        affiliateUrl: null,
        redirectId: '',
        status: 'unsupported' as const,
        reasonCode: '',
        attemptCount: 1,
        lastError: null
    };
}

function makeConn(existing: unknown[]) {
    const query = vi.fn(async (sql: string) => {
        if (sql.startsWith('SELECT 1')) return [existing];
        return [{ affectedRows: 0 }];
    });
    return { query };
}

function sqlOf(query: { mock: { calls: unknown[][] } }) {
    return query.mock.calls.map((args) => String(args[0]).trim().split(/\s+/)[0]);
}

describe('hasAffiliateCandidateLinks', () => {
    it('이미지 속성 안에만 URL 이 있으면 false', async () => {
        const { hasAffiliateCandidateLinks } = await load();
        expect(hasAffiliateCandidateLinks('<p><img src="https://example.com/a.jpg"></p>')).toBe(
            false
        );
    });

    it('앵커가 있으면 true', async () => {
        const { hasAffiliateCandidateLinks } = await load();
        expect(hasAffiliateCandidateLinks('<a href="https://example.com/item">상품</a>')).toBe(
            true
        );
    });

    it('평문 URL 은 자동 링크되므로 true', async () => {
        const { hasAffiliateCandidateLinks } = await load();
        expect(hasAffiliateCandidateLinks('여기 https://example.com/item 보세요')).toBe(true);
    });

    it('빈 문자열은 false', async () => {
        const { hasAffiliateCandidateLinks } = await load();
        expect(hasAffiliateCandidateLinks('')).toBe(false);
    });

    it('연속 호출해도 결과가 같다(정규식 상태 공유 없음)', async () => {
        const { hasAffiliateCandidateLinks } = await load();
        const html = '<a href="https://example.com/item">상품</a>';
        expect(hasAffiliateCandidateLinks(html)).toBe(true);
        expect(hasAffiliateCandidateLinks(html)).toBe(true);
    });
});

describe('replaceEntityRows', () => {
    it('새 행 0개·기존 행 0개면 DELETE 하지 않는다', async () => {
        const { replaceEntityRows } = await load();
        const conn = makeConn([]);
        await replaceEntityRows(conn as never, 'free', 1, 0, ['post_body'], []);
        expect(sqlOf(conn.query)).toEqual(['SELECT']);
    });

    it('새 행 0개·기존 행 있으면 DELETE 한다', async () => {
        const { replaceEntityRows } = await load();
        const conn = makeConn([{ 1: 1 }]);
        await replaceEntityRows(conn as never, 'free', 1, 0, ['post_body'], []);
        expect(sqlOf(conn.query)).toEqual(['SELECT', 'DELETE']);
    });

    it('새 행이 있으면 지금처럼 DELETE 후 INSERT 한다', async () => {
        const { replaceEntityRows } = await load();
        const conn = makeConn([]);
        await replaceEntityRows(conn as never, 'free', 1, 0, ['post_body'], [sampleRow()]);
        expect(sqlOf(conn.query)).toEqual(['DELETE', 'INSERT']);
    });
});

describe('syncPostAffiliateLinks', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        mockGetConnection.mockReset();
    });

    it('링크도 기존 행도 없으면 트랜잭션을 열지 않는다', async () => {
        const { syncPostAffiliateLinks } = await load();
        mockQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('g5_write_') || sql.includes('FROM ??')) {
                return [
                    [
                        {
                            wr_id: 1,
                            wr_content: '<img src="https://example.com/a.jpg">',
                            wr_link1: '',
                            wr_link2: ''
                        }
                    ]
                ];
            }
            if (sql.startsWith('SELECT 1')) return [[]];
            throw new Error('unexpected sql: ' + sql);
        });

        await syncPostAffiliateLinks('free', 1);
        expect(mockGetConnection).not.toHaveBeenCalled();
    });
});

describe('triggerPostAffiliateSyncOnView', () => {
    beforeEach(() => {
        redisSet.mockReset();
    });

    it('락을 잡으면 sync 를 호출한다', async () => {
        const { triggerPostAffiliateSyncOnView } = await load();
        redisSet.mockResolvedValue('OK');
        const sync = vi.fn().mockResolvedValue(undefined);
        await triggerPostAffiliateSyncOnView('free', 1, sync);
        expect(redisSet).toHaveBeenCalledWith('affiliate:sync:free:1', '1', 'EX', 30, 'NX');
        expect(sync).toHaveBeenCalledWith('free', 1);
    });

    it('이미 잡힌 락이면 sync 를 호출하지 않는다', async () => {
        const { triggerPostAffiliateSyncOnView } = await load();
        redisSet.mockResolvedValue(null);
        const sync = vi.fn().mockResolvedValue(undefined);
        await triggerPostAffiliateSyncOnView('free', 1, sync);
        expect(sync).not.toHaveBeenCalled();
    });

    it('Redis 오류면 그대로 sync 를 호출한다', async () => {
        const { triggerPostAffiliateSyncOnView } = await load();
        redisSet.mockRejectedValue(new Error('down'));
        const sync = vi.fn().mockResolvedValue(undefined);
        await triggerPostAffiliateSyncOnView('free', 1, sync);
        expect(sync).toHaveBeenCalledWith('free', 1);
    });
});
