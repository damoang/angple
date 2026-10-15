import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const boardHasRatingFeature = vi.fn();

vi.mock('$lib/server/db', () => ({
    default: { query: (...a: unknown[]) => query(...a) }
}));
vi.mock('$lib/server/rating-aspects.js', () => ({
    boardHasRatingFeature: (id: string) => boardHasRatingFeature(id)
}));

const gates = await import('./comment-enrich-gates');
const { shouldLookupReviewRatings, luckyLookupCommentIds } = gates;

beforeEach(() => {
    query.mockReset();
    boardHasRatingFeature.mockReset();
    gates._resetCommentEnrichGateCaches();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('shouldLookupReviewRatings', () => {
    it('설정을 그대로 따르고 게시판별로 캐시한다', async () => {
        boardHasRatingFeature.mockImplementation(async (id: string) => id === 'review');

        expect(await shouldLookupReviewRatings('review')).toBe(true);
        expect(await shouldLookupReviewRatings('free')).toBe(false);
        expect(await shouldLookupReviewRatings('free')).toBe(false);
        expect(boardHasRatingFeature).toHaveBeenCalledTimes(2);
    });

    it('설정 조회가 실패하면 조회하도록 연다(캐시하지 않음)', async () => {
        boardHasRatingFeature.mockRejectedValueOnce(new Error('db down'));
        expect(await shouldLookupReviewRatings('free')).toBe(true);

        boardHasRatingFeature.mockResolvedValueOnce(false);
        expect(await shouldLookupReviewRatings('free')).toBe(false);
    });
});

describe('luckyLookupCommentIds', () => {
    it('원장에 있는 댓글 id 만 돌려주고 게시판별로 캐시한다', async () => {
        query.mockResolvedValue([[{ source_id: '2' }, { source_id: '7' }, { source_id: 'x' }]]);

        expect(await luckyLookupCommentIds('free', [1, 2, 3])).toEqual([2]);
        expect(await luckyLookupCommentIds('free', [7, 8])).toEqual([7]);
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][0]).toContain('g5_da_lucky_grant');
        expect(query.mock.calls[0][1]).toEqual(['free']);
    });

    it('원장이 비면 빈 목록', async () => {
        query.mockResolvedValue([[]]);
        expect(await luckyLookupCommentIds('free', [1, 2])).toEqual([]);
    });

    it('댓글이 없으면 원장을 읽지 않는다', async () => {
        expect(await luckyLookupCommentIds('free', [])).toEqual([]);
        expect(query).not.toHaveBeenCalled();
    });

    it('원장 조회가 실패하면 댓글 id 전체를 돌려준다', async () => {
        query.mockRejectedValueOnce(new Error('db down'));
        expect(await luckyLookupCommentIds('free', [1, 2])).toEqual([1, 2]);
    });
});
