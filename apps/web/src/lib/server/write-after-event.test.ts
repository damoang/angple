import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ default: { query: vi.fn() } }));

import { enqueueWriteChangedEvent } from './write-after-event';

describe('enqueueWriteChangedEvent', () => {
    it('글이면 post_updated 이벤트를 post_id 없이 남긴다', async () => {
        const query = vi.fn().mockResolvedValue(undefined);
        const ok = await enqueueWriteChangedEvent(
            {
                boardId: 'free',
                wrId: 10,
                postId: 10,
                isComment: false,
                mbId: 'author',
                author: '작성자',
                subject: '제목'
            },
            query
        );
        expect(ok).toBe(true);
        const [sql, params] = query.mock.calls[0];
        expect(sql).toContain('INSERT INTO g5_write_after_events');
        expect(params).toEqual(['post_updated', 'free', 10, null, 'author', '작성자', '제목']);
    });

    it('댓글이면 comment_updated 이벤트에 부모 글 번호를 담는다', async () => {
        const query = vi.fn().mockResolvedValue(undefined);
        await enqueueWriteChangedEvent(
            {
                boardId: 'free',
                wrId: 11,
                postId: 10,
                isComment: true,
                mbId: 'commenter',
                author: '댓글러',
                subject: '무시됨'
            },
            query
        );
        expect(query.mock.calls[0][1]).toEqual([
            'comment_updated',
            'free',
            11,
            10,
            'commenter',
            '댓글러',
            ''
        ]);
    });

    it('기록 실패는 던지지 않고 false 를 돌려준다', async () => {
        const query = vi.fn().mockRejectedValue(new Error('db down'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const ok = await enqueueWriteChangedEvent(
            { boardId: 'free', wrId: 1, postId: 1, isComment: false, mbId: 'a', author: 'a' },
            query
        );
        expect(ok).toBe(false);
        spy.mockRestore();
    });
});
