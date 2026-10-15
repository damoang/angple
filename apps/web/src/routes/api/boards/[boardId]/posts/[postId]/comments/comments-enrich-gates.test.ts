/**
 * 댓글 목록 API — 리뷰 별점은 rating 이 켜진 게시판에서만, 럭키 포인트·경험치는
 * 지급 원장에 있는 댓글 id 로만 조회하는지 확인한다. 게이트 판단은 흉내 내고,
 * 게이트 자체의 fail-open(실패 시 조회 유지)은 게이트 모듈 테스트에서 본다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const COMMENT_IDS = [1, 2, 3];

let ratingOn = false;
let luckyIdsFor: (ids: number[]) => number[] = () => [];

const query = vi.fn(async (...args: [string, unknown[]?]) => {
    const [sql] = args;
    if (sql.includes('wr_is_comment = 0')) {
        return [[{ wr_deleted_at: null, wr_deleted_by: null, mb_id: 'writer', wr_name: '글쓴이' }]];
    }
    if (sql.includes('wr_is_comment = 1') && sql.includes('ORDER BY')) {
        return [
            COMMENT_IDS.map((id, i) => ({
                wr_id: id,
                wr_parent: 10,
                wr_comment: i + 1,
                wr_comment_reply: '',
                wr_content: `본문${id}`,
                wr_link1: '',
                wr_link2: '',
                wr_option: '',
                wr_good: 0,
                wr_nogood: 0,
                mb_id: '',
                wr_name: '손님',
                wr_ip: '1.2.3.4',
                wr_datetime: '2026-01-01 00:00:00',
                wr_edit_count: 0,
                wr_last_edited_at: null,
                wr_deleted_at: null,
                wr_deleted_by: null,
                wr_7: null,
                wr_1: null
            }))
        ];
    }
    if (sql.includes('angple_post_ratings')) {
        return [[{ wr_id: 2, avg_rating: 4.5 }]];
    }
    if (sql.includes('FROM g5_point')) {
        return [[{ po_rel_id: '2', po_point: 100, po_content: '', po_datetime: null }]];
    }
    if (sql.includes('FROM g5_na_xp')) {
        return [[{ xp_rel_id: '2', xp_point: 50, xp_content: '', xp_datetime: null }]];
    }
    return [[]];
});

vi.mock('$lib/server/db', () => ({
    default: { query: (...a: unknown[]) => query(...(a as [string, unknown[]?])) }
}));
vi.mock('$lib/server/comment-enrich-gates', () => ({
    shouldLookupReviewRatings: async () => ratingOn,
    luckyLookupCommentIds: async (...args: [string, number[]]) => luckyIdsFor(args[1])
}));
vi.mock('$lib/server/member-card.js', () => ({ fetchMemberCards: async () => new Map() }));
vi.mock('$lib/server/discipline-ids', () => ({ getDisciplineIds: async () => new Set<number>() }));
vi.mock('$lib/server/lucky-tier-names', () => ({ getLuckyTierInfo: async () => null }));
vi.mock('$lib/server/affiliate-links', () => ({
    applyAffiliateField: (href: string) => ({ href, displayUrl: href, affiliate: false }),
    fetchCommentAffiliateLinks: async () => [],
    findAffiliateFieldRow: () => undefined,
    groupAffiliateLinksByCommentId: () => new Map(),
    renderAffiliateContent: (html: string) => html
}));
vi.mock('$lib/server/link-processing/runtime', () => ({
    isLinkProcessingPluginEnabled: async () => false
}));
vi.mock('$lib/server/internal-api.js', () => ({ isInternalAppRequest: () => true }));
vi.mock('$lib/server/rate-limit.js', () => ({
    checkRateLimit: () => ({ allowed: true }),
    recordAttempt: () => {},
    resolveClientIp: () => null
}));
vi.mock('$lib/server/bluesky/transform.js', () => ({
    prefetchBlueskyDIDs: async (html: string) => html
}));

const { GET } = await import('./+server');

async function callGet() {
    const url = new URL('http://localhost/api/boards/free/posts/10/comments?page=1&limit=50');
    const res = await GET({
        params: { boardId: 'free', postId: '10' },
        url,
        locals: {},
        request: new Request(url),
        getClientAddress: () => '127.0.0.1'
    } as unknown as Parameters<typeof GET>[0]);
    return { status: res.status, body: await res.json() };
}

function callsTo(table: string) {
    return query.mock.calls.filter(([sql]) => sql.includes(table));
}

function commentById(body: { data: { comments: Array<Record<string, unknown>> } }, id: number) {
    return body.data.comments.find((c) => c.id === id);
}

describe('GET comments — 별점·럭키 조회 게이트', () => {
    beforeEach(() => {
        query.mockClear();
        ratingOn = false;
        luckyIdsFor = () => [];
    });

    it('rating 꺼진 게시판은 평점 조회를 하지 않고 review_rating 키도 없다', async () => {
        const { status, body } = await callGet();

        expect(status).toBe(200);
        expect(callsTo('angple_post_ratings')).toHaveLength(0);
        expect(commentById(body, 2)).not.toHaveProperty('review_rating');
    });

    it('rating 켜진 게시판은 댓글 id 전체로 평점을 조회한다', async () => {
        ratingOn = true;

        const { body } = await callGet();

        const calls = callsTo('angple_post_ratings');
        expect(calls).toHaveLength(1);
        expect(calls[0][1]).toEqual(['free', COMMENT_IDS]);
        expect(commentById(body, 2)).toMatchObject({ review_rating: 4.5 });
        expect(commentById(body, 1)).not.toHaveProperty('review_rating');
    });

    it('원장과 교집합이 없으면 포인트·경험치를 조회하지 않고 럭키 키도 없다', async () => {
        const { body } = await callGet();

        expect(callsTo('FROM g5_point')).toHaveLength(0);
        expect(callsTo('FROM g5_na_xp')).toHaveLength(0);
        expect(commentById(body, 2)).not.toHaveProperty('lucky_point');
        expect(commentById(body, 2)).not.toHaveProperty('lucky_exp');
    });

    it('교집합이 있으면 그 id 로만 포인트·경험치를 조회한다', async () => {
        luckyIdsFor = (ids) => ids.filter((id) => id === 2);

        const { body } = await callGet();

        const pt = callsTo('FROM g5_point');
        const xp = callsTo('FROM g5_na_xp');
        expect(pt).toHaveLength(1);
        expect(xp).toHaveLength(1);
        expect(pt[0][1]).toEqual(['free', ['2']]);
        expect(xp[0][1]).toEqual(['free', ['2']]);
        expect(commentById(body, 2)).toMatchObject({ lucky_point: 100, lucky_exp: 50 });
        expect(commentById(body, 1)).not.toHaveProperty('lucky_point');
    });

    it('게이트가 전체 id 를 돌려주면(원장 조회 실패) 예전처럼 전체로 조회한다', async () => {
        luckyIdsFor = (ids) => ids;

        await callGet();

        expect(callsTo('FROM g5_point')[0][1]).toEqual(['free', ['1', '2', '3']]);
        expect(callsTo('FROM g5_na_xp')[0][1]).toEqual(['free', ['1', '2', '3']]);
    });
});
