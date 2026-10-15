import { describe, expect, it, vi } from 'vitest';
import { resolveCommentTotal } from './_comment-total';

describe('resolveCommentTotal', () => {
    it('첫 페이지 행 수가 한도보다 적으면 COUNT 없이 행 수를 전체 개수로 쓴다', async () => {
        const countAll = vi.fn(async () => 999);
        expect(await resolveCommentTotal(1, 50, 12, countAll)).toBe(12);
        expect(countAll).not.toHaveBeenCalled();
    });

    it('첫 페이지가 한도만큼 차면 COUNT 를 실행한다', async () => {
        const countAll = vi.fn(async () => 120);
        expect(await resolveCommentTotal(1, 50, 50, countAll)).toBe(120);
        expect(countAll).toHaveBeenCalledTimes(1);
    });

    it('2페이지 이상이면 COUNT 를 실행한다', async () => {
        const countAll = vi.fn(async () => 70);
        expect(await resolveCommentTotal(2, 50, 20, countAll)).toBe(70);
        expect(countAll).toHaveBeenCalledTimes(1);
    });

    it('2페이지 이상에서 행이 0개여도 COUNT 를 실행한다', async () => {
        const countAll = vi.fn(async () => 30);
        expect(await resolveCommentTotal(3, 50, 0, countAll)).toBe(30);
        expect(countAll).toHaveBeenCalledTimes(1);
    });

    it('첫 페이지에 댓글이 없으면 COUNT 없이 0 을 돌려준다', async () => {
        const countAll = vi.fn(async () => 0);
        expect(await resolveCommentTotal(1, 50, 0, countAll)).toBe(0);
        expect(countAll).not.toHaveBeenCalled();
    });
});
