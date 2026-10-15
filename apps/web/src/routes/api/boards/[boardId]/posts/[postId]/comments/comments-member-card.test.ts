/**
 * 댓글 목록 API — 작성자 닉네임·사진·탈퇴 여부를 회원 조회 한 번으로 채우는지,
 * 응답 필드와 삭제 마스킹이 그대로인지 확인한다. DB 는 SQL 로 갈라 흉내 낸다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeComment {
    wr_id: number;
    mb_id: string;
    wr_name: string;
    wr_deleted_at: string | null;
}

let commentRows: FakeComment[] = [];
let memberQueryFails = false;

const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('wr_is_comment = 0')) {
        return [[{ wr_deleted_at: null, wr_deleted_by: null, mb_id: 'writer', wr_name: '글쓴이' }]];
    }
    if (sql.includes('wr_is_comment = 1') && sql.includes('ORDER BY')) {
        return [
            commentRows.map((c, i) => ({
                wr_id: c.wr_id,
                wr_parent: 10,
                wr_comment: i + 1,
                wr_comment_reply: '',
                wr_content: `본문${c.wr_id}`,
                wr_link1: '',
                wr_link2: '',
                wr_option: '',
                wr_good: 0,
                wr_nogood: 0,
                mb_id: c.mb_id,
                wr_name: c.wr_name,
                wr_ip: '1.2.3.4',
                wr_datetime: '2026-01-01 00:00:00',
                wr_edit_count: 0,
                wr_last_edited_at: null,
                wr_deleted_at: c.wr_deleted_at,
                wr_deleted_by: null,
                wr_7: null,
                wr_1: null
            }))
        ];
    }
    if (/\bg5_member\b/.test(sql)) {
        if (memberQueryFails) throw new Error('db down');
        const [ids] = params as [string[]];
        const table: Record<string, Record<string, unknown>> = {
            alice: {
                mb_id: 'alice',
                mb_nick: '앨리스',
                mb_image_url: 'https://img.example/a.webp',
                mb_image_updated_at: '2026-01-02T03:04:05Z',
                is_left: 0
            },
            bob: {
                mb_id: 'bob',
                mb_nick: '밥',
                mb_image_url: '',
                mb_image_updated_at: null,
                is_left: 1
            }
        };
        return [ids.filter((id) => table[id]).map((id) => table[id])];
    }
    // 별점·럭키·소모임 이름 등 부가 조회는 빈 결과
    return [[]];
});

vi.mock('$lib/server/db', () => ({
    default: { query: (...a: unknown[]) => query(...(a as [string, unknown[]])) }
}));
// 회원 카드 공유 캐시를 끈다 — 테스트 사이에 캐시가 남아 DB 조회를 건너뛰지 않게.
vi.mock('$lib/server/redis', () => ({ getRedis: () => null }));
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

function memberQueries() {
    return query.mock.calls.filter(([sql]) => /\bg5_member\b/.test(sql));
}

describe('GET comments — 작성자 회원 카드', () => {
    beforeEach(() => {
        query.mockClear();
        memberQueryFails = false;
        commentRows = [
            { wr_id: 1, mb_id: 'alice', wr_name: 'alice-old', wr_deleted_at: null },
            { wr_id: 2, mb_id: 'bob', wr_name: 'bob-old', wr_deleted_at: null },
            { wr_id: 3, mb_id: 'alice', wr_name: 'alice-old', wr_deleted_at: '2026-01-03' },
            { wr_id: 4, mb_id: 'ghost', wr_name: '손님', wr_deleted_at: null }
        ];
    });

    it('회원 조회는 한 번이고, 같은 작성자를 한 번씩만 묻는다', async () => {
        const { status } = await callGet();

        expect(status).toBe(200);
        const calls = memberQueries();
        expect(calls).toHaveLength(1);
        expect(calls[0][1]).toEqual([['alice', 'bob', 'ghost']]);
    });

    it('닉네임·사진·탈퇴 표시와 삭제 마스킹이 그대로다', async () => {
        const { body } = await callGet();
        const byId = new Map(
            (body.data.comments as Array<Record<string, unknown>>).map((c) => [c.id, c])
        );

        expect(byId.get(1)).toMatchObject({
            author: '앨리스',
            author_id: 'alice',
            author_image: 'https://img.example/a.webp',
            author_image_updated_at: Math.floor(Date.parse('2026-01-02T03:04:05Z') / 1000)
        });
        expect(byId.get(1)).not.toHaveProperty('is_left');

        expect(byId.get(2)).toMatchObject({
            author: '밥',
            author_id: 'bob',
            author_image: '',
            is_left: true
        });
        expect(byId.get(2)?.author_image_updated_at).toBeUndefined();

        // 삭제 댓글(비관리자): 작성자 정보 비움
        expect(byId.get(3)).toMatchObject({ author: '', author_id: '', author_image: '' });
        expect(byId.get(3)?.author_image_updated_at).toBeUndefined();

        // 회원 표에 없는 작성자: wr_name 으로 표시
        expect(byId.get(4)).toMatchObject({ author: '손님', author_image: '' });
        expect(byId.get(4)).not.toHaveProperty('is_left');
    });

    it('회원 조회가 실패하면 예전 닉네임 조회 실패와 같이 500 이다', async () => {
        memberQueryFails = true;

        const { status, body } = await callGet();

        expect(status).toBe(500);
        expect(body.success).toBe(false);
    });
});
