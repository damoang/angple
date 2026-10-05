import { describe, expect, it, vi } from 'vitest';
import { calculateMemberCounts, type QueryFn } from './_recompute-counts';

/** 보드 목록 → 카운트 순으로 응답하는 mock query */
function mockQuery(
    boards: string[],
    counts: Array<{ total: number; deleted: number; c_total: number; c_deleted: number }>
): QueryFn {
    let call = 0;
    return vi.fn(async () => {
        call += 1;
        if (call === 1) return [boards.map((b) => ({ bo_table: b })), undefined] as never;
        return [counts, undefined] as never;
    }) as unknown as QueryFn;
}

describe('calculateMemberCounts', () => {
    it('여러 보드의 글·댓글 총계와 삭제 수를 합산한다', async () => {
        const query = mockQuery(
            ['free', 'bug'],
            [
                { total: 291, deleted: 291, c_total: 2428, c_deleted: 1508 },
                { total: 22, deleted: 20, c_total: 9, c_deleted: 4 }
            ]
        );
        expect(await calculateMemberCounts(query, 'testuser')).toEqual({
            totalPosts: 313,
            deletedPosts: 311,
            totalComments: 2437,
            deletedComments: 1512
        });
    });

    it('총계와 삭제를 같은 호출에서 세어 생존 수가 음수가 되지 않는다', async () => {
        const query = mockQuery(['free'], [{ total: 10, deleted: 10, c_total: 0, c_deleted: 0 }]);
        const c = await calculateMemberCounts(query, 'testuser');
        expect(c!.totalPosts - c!.deletedPosts).toBe(0);
    });

    it('보드가 없으면 null (stale 값을 덮어쓰지 않는다)', async () => {
        const query = mockQuery([], []);
        expect(await calculateMemberCounts(query, 'testuser')).toBeNull();
    });

    it('카운트 쿼리 실패 시 null', async () => {
        let call = 0;
        const query = vi.fn(async () => {
            call += 1;
            if (call === 1) return [[{ bo_table: 'free' }], undefined];
            throw new Error('table missing');
        }) as unknown as QueryFn;
        expect(await calculateMemberCounts(query, 'testuser')).toBeNull();
    });

    it('보드 이름에 이상한 문자가 있으면 제외한다', async () => {
        const query = mockQuery(
            ['free', 'evil; DROP TABLE'],
            [{ total: 1, deleted: 0, c_total: 0, c_deleted: 0 }]
        );
        const c = await calculateMemberCounts(query, 'testuser');
        expect(c!.totalPosts).toBe(1);
    });
});

interface RawRow {
    board: string;
    isComment: 0 | 1;
    deleted: boolean;
}

/**
 * UNION ALL 각 항의 보드와 WHERE 절을 읽어 원시 행에서 카운트를 계산하는 mock.
 * 고정 응답 mock 과 달리, SQL 에 들어간 필터가 결과에 실제로 반영되는지 확인할 수 있다.
 */
function sqlAwareQuery(boards: string[], raw: RawRow[]) {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    let call = 0;
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
        call += 1;
        if (call === 1) return [boards.map((b) => ({ bo_table: b })), undefined];
        calls.push({ sql, params });
        const rows = sql.split(' UNION ALL ').map((part) => {
            const board = /FROM g5_write_(\w+)/.exec(part)![1];
            const where = part.slice(part.indexOf('WHERE'));
            const commentsOnly = where.includes('wr_is_comment = 1');
            const scoped = raw.filter(
                (r) => r.board === board && (!commentsOnly || r.isComment === 1)
            );
            const posts = scoped.filter((r) => r.isComment === 0);
            const comments = scoped.filter((r) => r.isComment === 1);
            return {
                total: posts.length,
                deleted: posts.filter((r) => r.deleted).length,
                c_total: comments.length,
                c_deleted: comments.filter((r) => r.deleted).length
            };
        });
        return [rows, undefined];
    }) as unknown as QueryFn;
    return { query, calls };
}

/** UNION ALL 항에서 보드별 WHERE 절만 뽑는다 */
function whereByBoard(sql: string): Record<string, string> {
    return Object.fromEntries(
        sql
            .split(' UNION ALL ')
            .map((part) => [
                /FROM g5_write_(\w+)/.exec(part)![1],
                part.slice(part.indexOf('WHERE')).trim()
            ])
    );
}

describe('calculateMemberCounts — truthroom 글 제외 (bug/14061)', () => {
    const boards = ['free', 'truthroom', 'qa'];

    it('truthroom 항에만 wr_is_comment = 1 조건이 붙는다', async () => {
        const { query, calls } = sqlAwareQuery(boards, []);
        await calculateMemberCounts(query, 'testuser');
        const where = whereByBoard(calls[0].sql);
        expect(where.truthroom).toBe('WHERE mb_id = ? AND wr_is_comment = 1');
    });

    it('다른 보드 항의 조건은 바뀌지 않는다', async () => {
        const { query, calls } = sqlAwareQuery(boards, []);
        await calculateMemberCounts(query, 'testuser');
        const where = whereByBoard(calls[0].sql);
        expect(where.free).toBe('WHERE mb_id = ?');
        expect(where.qa).toBe('WHERE mb_id = ?');
    });

    it('파라미터 수는 보드 수와 같다', async () => {
        const { query, calls } = sqlAwareQuery(boards, []);
        await calculateMemberCounts(query, 'testuser');
        expect(calls[0].params).toEqual(['testuser', 'testuser', 'testuser']);
    });

    it('truthroom 글은 총계·삭제에서 빠지고 댓글은 합산된다', async () => {
        const { query } = sqlAwareQuery(boards, [
            { board: 'free', isComment: 0, deleted: false },
            { board: 'free', isComment: 0, deleted: false },
            { board: 'free', isComment: 1, deleted: false },
            { board: 'truthroom', isComment: 0, deleted: false },
            { board: 'truthroom', isComment: 0, deleted: true },
            { board: 'truthroom', isComment: 1, deleted: false },
            { board: 'truthroom', isComment: 1, deleted: true },
            { board: 'qa', isComment: 1, deleted: false }
        ]);
        expect(await calculateMemberCounts(query, 'testuser')).toEqual({
            totalPosts: 2,
            deletedPosts: 0,
            totalComments: 4,
            deletedComments: 1
        });
    });
});
