import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockGetConnection = vi.fn();

vi.mock('$lib/server/db', () => ({
    default: { query: mockQuery, getConnection: mockGetConnection },
    pool: { query: mockQuery, getConnection: mockGetConnection }
}));

vi.mock('$lib/server/redis', () => ({
    getRedis: () => ({ set: vi.fn() })
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

const SET_SQL =
    "SELECT DISTINCT board_slug, post_id FROM g5_affiliate_links WHERE comment_id <> 0 AND status = 'converted'";

function setQueryCalls() {
    return mockQuery.mock.calls.filter((args) => String(args[0]) === SET_SQL);
}

describe('postMayHaveCommentAffiliateLinks', () => {
    beforeEach(async () => {
        mockQuery.mockReset();
        mockGetConnection.mockReset();
        const { invalidateCommentAffiliatePostSet } = await load();
        invalidateCommentAffiliatePostSet();
    });

    it('변환된 댓글 링크가 있는 글이면 true (조회 진행)', async () => {
        const { postMayHaveCommentAffiliateLinks } = await load();
        mockQuery.mockResolvedValue([[{ board_slug: 'free', post_id: 10 }]]);
        await expect(postMayHaveCommentAffiliateLinks('free', 10)).resolves.toBe(true);
        expect(setQueryCalls()).toHaveLength(1);
    });

    it('집합에 없는 글이면 false (조회 생략)', async () => {
        const { postMayHaveCommentAffiliateLinks } = await load();
        mockQuery.mockResolvedValue([[{ board_slug: 'free', post_id: 10 }]]);
        await expect(postMayHaveCommentAffiliateLinks('free', 11)).resolves.toBe(false);
        await expect(postMayHaveCommentAffiliateLinks('qa', 10)).resolves.toBe(false);
    });

    it('게시판 ID 는 저장과 같은 규칙으로 정리해 비교한다', async () => {
        const { postMayHaveCommentAffiliateLinks } = await load();
        mockQuery.mockResolvedValue([[{ board_slug: 'free', post_id: 10 }]]);
        await expect(postMayHaveCommentAffiliateLinks('fr/ee', 10)).resolves.toBe(true);
    });

    it('집합은 TTL 동안 한 번만 읽는다', async () => {
        const { postMayHaveCommentAffiliateLinks } = await load();
        mockQuery.mockResolvedValue([[{ board_slug: 'free', post_id: 10 }]]);
        await postMayHaveCommentAffiliateLinks('free', 10);
        await postMayHaveCommentAffiliateLinks('free', 11);
        await postMayHaveCommentAffiliateLinks('qa', 1);
        expect(setQueryCalls()).toHaveLength(1);
    });

    it('동시 조회는 쿼리 하나를 나눠 쓴다', async () => {
        const { postMayHaveCommentAffiliateLinks } = await load();
        mockQuery.mockResolvedValue([[{ board_slug: 'free', post_id: 10 }]]);
        const results = await Promise.all([
            postMayHaveCommentAffiliateLinks('free', 10),
            postMayHaveCommentAffiliateLinks('free', 11)
        ]);
        expect(results).toEqual([true, false]);
        expect(setQueryCalls()).toHaveLength(1);
    });

    it('집합 로드 실패는 true (지금처럼 조회) 이고 캐시하지 않는다', async () => {
        const { postMayHaveCommentAffiliateLinks } = await load();
        mockQuery.mockRejectedValueOnce(new Error('connection lost'));
        await expect(postMayHaveCommentAffiliateLinks('free', 11)).resolves.toBe(true);
        mockQuery.mockResolvedValue([[]]);
        await expect(postMayHaveCommentAffiliateLinks('free', 11)).resolves.toBe(false);
        expect(setQueryCalls()).toHaveLength(2);
    });

    it('무효화하면 다음 조회가 새로 읽는다', async () => {
        const { postMayHaveCommentAffiliateLinks } = await load();
        const { invalidateCommentAffiliatePostSet } = await load();
        mockQuery.mockResolvedValue([[]]);
        await expect(postMayHaveCommentAffiliateLinks('free', 10)).resolves.toBe(false);
        mockQuery.mockResolvedValue([[{ board_slug: 'free', post_id: 10 }]]);
        invalidateCommentAffiliatePostSet();
        await expect(postMayHaveCommentAffiliateLinks('free', 10)).resolves.toBe(true);
        expect(setQueryCalls()).toHaveLength(2);
    });

    it('무효화 전에 시작된 로드 결과는 무효화 뒤에 쓰이지 않는다', async () => {
        const { postMayHaveCommentAffiliateLinks } = await load();
        const { invalidateCommentAffiliatePostSet } = await load();
        let resolveOld: (value: unknown) => void = () => {};
        mockQuery.mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)));
        const oldCall = postMayHaveCommentAffiliateLinks('free', 10);
        invalidateCommentAffiliatePostSet();
        mockQuery.mockResolvedValue([[{ board_slug: 'free', post_id: 10 }]]);
        await expect(postMayHaveCommentAffiliateLinks('free', 10)).resolves.toBe(true);
        resolveOld([[]]);
        await expect(oldCall).resolves.toBe(false);
        await expect(postMayHaveCommentAffiliateLinks('free', 10)).resolves.toBe(true);
        expect(setQueryCalls()).toHaveLength(2);
    });
});

describe('syncCommentAffiliateLinks — 커밋 뒤 집합 무효화', () => {
    beforeEach(async () => {
        mockQuery.mockReset();
        mockGetConnection.mockReset();
        const { invalidateCommentAffiliatePostSet } = await load();
        invalidateCommentAffiliatePostSet();
    });

    function mockCommentSource(existingRows: unknown[]) {
        mockQuery.mockImplementation(async (sql: string) => {
            if (sql === SET_SQL) return [[]];
            if (sql.includes('FROM ??')) {
                return [
                    [
                        {
                            wr_id: 5,
                            wr_parent: 10,
                            wr_content: '<img src="https://example.com/a.jpg">',
                            wr_link1: '',
                            wr_link2: ''
                        }
                    ]
                ];
            }
            if (sql.startsWith('SELECT 1')) return [existingRows];
            throw new Error('unexpected sql: ' + sql);
        });
    }

    it('트랜잭션을 커밋하면 이 프로세스 집합을 다시 읽는다', async () => {
        const { postMayHaveCommentAffiliateLinks, syncCommentAffiliateLinks } = await load();
        mockCommentSource([{ 1: 1 }]);
        const conn = {
            beginTransaction: vi.fn().mockResolvedValue(undefined),
            commit: vi.fn().mockResolvedValue(undefined),
            rollback: vi.fn().mockResolvedValue(undefined),
            release: vi.fn(),
            query: vi.fn(async (sql: string) => {
                if (sql.startsWith('SELECT 1')) return [[{ 1: 1 }]];
                return [{ affectedRows: 1 }];
            })
        };
        mockGetConnection.mockResolvedValue(conn);

        await postMayHaveCommentAffiliateLinks('free', 10);
        await syncCommentAffiliateLinks('free', 10, 5);
        expect(conn.commit).toHaveBeenCalled();
        await postMayHaveCommentAffiliateLinks('free', 10);
        expect(setQueryCalls()).toHaveLength(2);
    });

    it('트랜잭션을 열지 않으면 집합을 그대로 둔다', async () => {
        const { postMayHaveCommentAffiliateLinks, syncCommentAffiliateLinks } = await load();
        mockCommentSource([]);

        await postMayHaveCommentAffiliateLinks('free', 10);
        await syncCommentAffiliateLinks('free', 10, 5);
        expect(mockGetConnection).not.toHaveBeenCalled();
        await postMayHaveCommentAffiliateLinks('free', 10);
        expect(setQueryCalls()).toHaveLength(1);
    });

    it('커밋 실패(롤백)면 무효화하지 않는다', async () => {
        const { postMayHaveCommentAffiliateLinks, syncCommentAffiliateLinks } = await load();
        mockCommentSource([{ 1: 1 }]);
        const conn = {
            beginTransaction: vi.fn().mockResolvedValue(undefined),
            commit: vi.fn().mockRejectedValue(new Error('commit failed')),
            rollback: vi.fn().mockResolvedValue(undefined),
            release: vi.fn(),
            query: vi.fn(async (sql: string) => {
                if (sql.startsWith('SELECT 1')) return [[{ 1: 1 }]];
                return [{ affectedRows: 1 }];
            })
        };
        mockGetConnection.mockResolvedValue(conn);

        await postMayHaveCommentAffiliateLinks('free', 10);
        await expect(syncCommentAffiliateLinks('free', 10, 5)).rejects.toThrow('commit failed');
        expect(conn.rollback).toHaveBeenCalled();
        await postMayHaveCommentAffiliateLinks('free', 10);
        expect(setQueryCalls()).toHaveLength(1);
    });
});
