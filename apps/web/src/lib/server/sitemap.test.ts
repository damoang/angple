import { describe, expect, it, vi, beforeEach } from 'vitest';

let queryImpl: (sql: string, params?: unknown[]) => Promise<unknown>;
const queries: Array<{ sql: string; params?: unknown[] }> = [];

vi.mock('$lib/server/db.js', () => ({
    default: {
        query: (sql: string, params?: unknown[]) => {
            queries.push({ sql, params });
            return queryImpl(sql, params);
        }
    }
}));

vi.mock('$lib/server/cache.js', () => ({
    TieredCache: class {
        getOrFetch<T>(_key: string, factory: () => Promise<T>): Promise<T> {
            return factory();
        }
    }
}));

import {
    attachCursors,
    buildSitemapManifest,
    collectCursorOffsets,
    fetchBoardCursors,
    getSitemapPageSegments,
    segmentPaging,
    type SitemapSegment
} from './sitemap';

beforeEach(() => {
    queries.length = 0;
    queryImpl = () => Promise.resolve([[]]);
});

describe('collectCursorOffsets', () => {
    it('offset 0 은 빼고 게시판별 offset 을 모은다', () => {
        const pages = buildSitemapManifest(
            [
                { board: 'free', count: 25 },
                { board: 'qa', count: 8 }
            ],
            10
        );
        // free: 0/10, 10/10, 20/5 · qa: 0/5 (page 3), 5/3 (page 4)
        const needed = collectCursorOffsets(pages);
        expect(needed.get('free')).toEqual([10, 20]);
        expect(needed.get('qa')).toEqual([5]);
    });

    it('한 페이지에 다 들어가면 커서가 필요 없다', () => {
        const pages = buildSitemapManifest([{ board: 'free', count: 5 }], 10);
        expect(collectCursorOffsets(pages).size).toBe(0);
    });
});

describe('attachCursors', () => {
    const segs: SitemapSegment[] = [
        { board: 'free', offset: 0, limit: 10 },
        { board: 'free', offset: 10, limit: 10 },
        { board: 'qa', offset: 5, limit: 3 }
    ];

    it('offset>0 세그먼트에 해당 커서를 붙인다', () => {
        const out = attachCursors(segs, { free: { '10': 900 }, qa: { '5': 0 } });
        expect(out[0].cursor).toBeUndefined();
        expect(out[1].cursor).toBe(900);
        expect(out[2].cursor).toBe(0);
    });

    it('커서가 없는 게시판은 그대로 둔다(OFFSET 폴백)', () => {
        const out = attachCursors(segs, { free: { '10': 900 } });
        expect(out[2].cursor).toBeUndefined();
    });
});

describe('segmentPaging', () => {
    it('커서가 있으면 키셋', () => {
        expect(segmentPaging({ board: 'free', offset: 10, limit: 10, cursor: 900 })).toEqual({
            where: ' AND wr_id < ?',
            limit: 'LIMIT ?',
            params: [900, 10]
        });
    });

    it('커서 0 = 빈 세그먼트(wr_id < 0)', () => {
        expect(segmentPaging({ board: 'free', offset: 10, limit: 10, cursor: 0 }).params).toEqual([
            0, 10
        ]);
    });

    it('커서가 없으면 OFFSET 폴백', () => {
        expect(segmentPaging({ board: 'free', offset: 10, limit: 10 })).toEqual({
            where: '',
            limit: 'LIMIT ? OFFSET ?',
            params: [10, 10]
        });
    });

    it('offset 0 은 커서와 무관하게 처음부터', () => {
        expect(segmentPaging({ board: 'free', offset: 0, limit: 10, cursor: 5 }).params).toEqual([
            10, 0
        ]);
    });
});

describe('fetchBoardCursors', () => {
    it('순번별 wr_id 를 돌려주고 없는 순번은 0', async () => {
        queryImpl = () =>
            Promise.resolve([
                [
                    { wr_id: 900, rn: 10 },
                    { wr_id: 700, rn: 20 }
                ]
            ]);
        const out = await fetchBoardCursors('free', [10, 20, 30]);
        expect(out).toEqual({ '10': 900, '20': 700, '30': 0 });
        expect(queries[0].sql).toContain('ROW_NUMBER() OVER (ORDER BY wr_id DESC)');
        expect(queries[0].sql).toContain('wr_deleted_at');
        expect(queries[0].params).toEqual([[10, 20, 30]]);
    });

    it('안전하지 않은 게시판 이름은 거부한다', async () => {
        await expect(fetchBoardCursors('free; DROP', [10])).rejects.toThrow();
        expect(queries.length).toBe(0);
    });
});

describe('getSitemapPageSegments', () => {
    function setup(cursorFails: boolean) {
        queryImpl = (sql) => {
            if (sql.includes('FROM g5_board')) {
                return Promise.resolve([[{ bo_table: 'free' }]]);
            }
            if (sql.includes('COUNT(*)')) {
                return Promise.resolve([[{ cnt: 90000 }]]);
            }
            if (sql.includes('ROW_NUMBER')) {
                return cursorFails
                    ? Promise.reject(new Error('timeout'))
                    : Promise.resolve([
                          [
                              { wr_id: 5000, rn: 40000 },
                              { wr_id: 1000, rn: 80000 }
                          ]
                      ]);
            }
            return Promise.resolve([[]]);
        };
    }

    it('깊은 페이지 세그먼트에 커서가 실린다', async () => {
        setup(false);
        expect(await getSitemapPageSegments(1)).toEqual([
            { board: 'free', offset: 0, limit: 40000 }
        ]);
        expect(await getSitemapPageSegments(3)).toEqual([
            { board: 'free', offset: 80000, limit: 10000, cursor: 1000 }
        ]);
    });

    it('커서 계산이 실패하면 커서 없이(OFFSET) 같은 경계를 돌려준다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        setup(true);
        expect(await getSitemapPageSegments(2)).toEqual([
            { board: 'free', offset: 40000, limit: 40000 }
        ]);
        spy.mockRestore();
    });
});
