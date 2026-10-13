import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readQuery } = vi.hoisted(() => ({ readQuery: vi.fn() }));
vi.mock('$lib/server/db.js', () => ({
    default: { query: vi.fn() },
    readPool: { query: (...a: unknown[]) => readQuery(...a) }
}));

import {
    excludeWithdrawnAuthorHits,
    findWithdrawnMemberIds,
    isAuthorSearchField,
    isWithdrawnAuthor,
    isWithdrawnSearchTerm
} from './withdrawn-authors.js';

beforeEach(() => {
    readQuery.mockReset();
});

describe('isAuthorSearchField', () => {
    it('작성자 계열 필드만 참', () => {
        for (const f of [
            'author',
            'author_nick',
            'author_id',
            'comment_author',
            'comment_nick',
            'comment_id'
        ]) {
            expect(isAuthorSearchField(f)).toBe(true);
        }
    });

    it('제목·본문·댓글 내용 검색은 거짓', () => {
        for (const f of ['title', 'content', 'title_content', 'comment', 'google', '', null]) {
            expect(isAuthorSearchField(f)).toBe(false);
        }
    });
});

describe('isWithdrawnSearchTerm', () => {
    it('탈퇴 회원 아이디·닉네임과 같으면 참', async () => {
        readQuery.mockResolvedValueOnce([[{ mb_id: 'gone' }]]);
        await expect(isWithdrawnSearchTerm(' gone ')).resolves.toBe(true);
        const [sql, params] = readQuery.mock.calls[0];
        expect(sql).toContain("mb_leave_date <> ''");
        expect(params).toEqual(['gone', 'gone']);
    });

    it('일치하는 탈퇴 회원이 없으면 거짓', async () => {
        readQuery.mockResolvedValueOnce([[]]);
        await expect(isWithdrawnSearchTerm('active')).resolves.toBe(false);
    });

    it('빈 검색어는 조회하지 않는다', async () => {
        await expect(isWithdrawnSearchTerm('   ')).resolves.toBe(false);
        expect(readQuery).not.toHaveBeenCalled();
    });

    it('조회 실패는 예외로 올린다(호출부가 빈 결과 처리)', async () => {
        readQuery.mockRejectedValueOnce(new Error('db down'));
        await expect(isWithdrawnSearchTerm('x')).rejects.toThrow('db down');
    });
});

describe('findWithdrawnMemberIds', () => {
    it('빈 아이디·중복을 빼고 IN 쿼리 1회', async () => {
        readQuery.mockResolvedValueOnce([[{ mb_id: 'Gone' }]]);
        const set = await findWithdrawnMemberIds(['a', '', 'Gone', 'a']);
        expect(readQuery).toHaveBeenCalledTimes(1);
        expect(readQuery.mock.calls[0][1]).toEqual(['a', 'Gone']);
        expect(isWithdrawnAuthor(set, 'gone')).toBe(true);
        expect(isWithdrawnAuthor(set, 'a')).toBe(false);
        expect(isWithdrawnAuthor(set, '')).toBe(false);
    });

    it('비회원 글만 있으면 조회하지 않는다', async () => {
        const set = await findWithdrawnMemberIds(['', '']);
        expect(set.size).toBe(0);
        expect(readQuery).not.toHaveBeenCalled();
    });
});

describe('excludeWithdrawnAuthorHits', () => {
    it('탈퇴 회원 글만 빼고 순서를 유지한다', async () => {
        readQuery
            .mockResolvedValueOnce([
                [
                    { wr_id: 3, mb_id: 'gone' },
                    { wr_id: 2, mb_id: 'active' },
                    { wr_id: 1, mb_id: '' }
                ]
            ])
            .mockResolvedValueOnce([[{ mb_id: 'gone' }]]);
        const res = await excludeWithdrawnAuthorHits('free', { ids: [3, 2, 1] });
        expect(res.ids).toEqual([2, 1]);
        expect(res.parentIds).toBeUndefined();
        expect(res.removed).toBe(1);
    });

    it('댓글 검색이면 원글 목록도 같은 자리를 뺀다', async () => {
        readQuery
            .mockResolvedValueOnce([
                [
                    { wr_id: 11, mb_id: 'active' },
                    { wr_id: 12, mb_id: 'gone' }
                ]
            ])
            .mockResolvedValueOnce([[{ mb_id: 'gone' }]]);
        const res = await excludeWithdrawnAuthorHits('free', {
            ids: [11, 12],
            parentIds: [1, 2]
        });
        expect(res.ids).toEqual([11]);
        expect(res.parentIds).toEqual([1]);
        expect(res.removed).toBe(1);
    });

    it('탈퇴 회원이 없으면 그대로', async () => {
        readQuery
            .mockResolvedValueOnce([[{ wr_id: 5, mb_id: 'active' }]])
            .mockResolvedValueOnce([[]]);
        const res = await excludeWithdrawnAuthorHits('free', { ids: [5] });
        expect(res.ids).toEqual([5]);
        expect(res.removed).toBe(0);
    });

    it('판정 조회 실패는 예외로 올린다', async () => {
        readQuery
            .mockResolvedValueOnce([[{ wr_id: 5, mb_id: 'x' }]])
            .mockRejectedValueOnce(new Error('db down'));
        await expect(excludeWithdrawnAuthorHits('free', { ids: [5] })).rejects.toThrow();
    });

    it('게시판 아이디 형식이 틀리면 조회하지 않고 예외', async () => {
        await expect(excludeWithdrawnAuthorHits('free; DROP', { ids: [1] })).rejects.toThrow();
        expect(readQuery).not.toHaveBeenCalled();
    });
});
