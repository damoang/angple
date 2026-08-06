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
