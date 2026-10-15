import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const redisGet = vi.fn();
const redisSetex = vi.fn();

vi.mock('$lib/server/db', () => ({
    default: { query: mockQuery },
    pool: { query: mockQuery }
}));

vi.mock('$lib/server/redis', () => ({
    getRedis: () => ({
        get: redisGet,
        setex: redisSetex
    })
}));

vi.mock('$lib/server/member-activity-cache', () => ({
    getPostReactionVersion: vi.fn().mockResolvedValue(3)
}));

async function loadModule() {
    vi.resetModules();
    return import('./post-like-status.js');
}

/** 쿼리 문자열로 어느 조회인지 가려 응답한다 */
function answerQueries(goodRows: unknown[], countRows: unknown[]) {
    mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('g5_board_good')) return [goodRows];
        return [countRows];
    });
}

describe('fetchPostLikeStatus', () => {
    beforeEach(() => {
        mockQuery.mockReset();
        redisGet.mockReset();
        redisSetex.mockReset();
        redisGet.mockResolvedValue(null);
        redisSetex.mockResolvedValue('OK');
    });

    it('캐시 미스면 내 추천 여부와 글의 추천/비추천 수를 함께 읽어 같은 키에 저장한다', async () => {
        answerQueries([{ bg_flag: 'good' }], [{ wr_good: 7, wr_nogood: 2 }]);
        const { fetchPostLikeStatus } = await loadModule();

        const result = await fetchPostLikeStatus('free', 10, 'user1');

        expect(result).toEqual({ userLiked: true, userDisliked: false, likes: 7, dislikes: 2 });
        expect(mockQuery).toHaveBeenCalledTimes(2);
        const countCall = mockQuery.mock.calls.find(([sql]) => !sql.includes('g5_board_good'));
        expect(countCall?.[1]).toEqual(['g5_write_free', 10]);
        expect(redisSetex).toHaveBeenCalledWith(
            'post_like_status:user1:free:10:v3',
            expect.any(Number),
            JSON.stringify(result)
        );
    });

    it('캐시 적중이면 DB 를 부르지 않는다', async () => {
        const cached = { userLiked: false, userDisliked: true, likes: 4, dislikes: 1 };
        redisGet.mockResolvedValue(JSON.stringify(cached));
        const { fetchPostLikeStatus } = await loadModule();

        const result = await fetchPostLikeStatus('free', 10, 'user1');

        expect(result).toEqual(cached);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('글 행이 없으면 개수 없이 돌려준다(호출하는 쪽이 글 데이터의 값을 쓴다)', async () => {
        answerQueries([], []);
        const { fetchPostLikeStatus } = await loadModule();

        const result = await fetchPostLikeStatus('free', 10, 'user1');

        expect(result).toEqual({ userLiked: false, userDisliked: false });
    });

    it('게시판 ID 의 허용되지 않은 문자는 테이블명에서 지운다', async () => {
        answerQueries([], [{ wr_good: 0, wr_nogood: 0 }]);
        const { fetchPostLikeStatus } = await loadModule();

        await fetchPostLikeStatus('fr`ee; drop', 10, 'user1');

        const countCall = mockQuery.mock.calls.find(([sql]) => !sql.includes('g5_board_good'));
        expect(countCall?.[1]).toEqual(['g5_write_freedrop', 10]);
    });

    it('개수 조회가 실패하면 예외를 낸다(호출하는 쪽이 재조회하도록)', async () => {
        mockQuery.mockImplementation(async (sql: string) => {
            if (sql.includes('g5_board_good')) return [[]];
            throw new Error('db down');
        });
        const { fetchPostLikeStatus } = await loadModule();

        await expect(fetchPostLikeStatus('free', 10, 'user1')).rejects.toThrow('db down');
        expect(redisSetex).not.toHaveBeenCalled();
    });
});
