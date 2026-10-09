import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/server/backend-fetch', () => ({ backendFetch: vi.fn() }));
vi.mock('$lib/server/redis', () => ({ getRedis: vi.fn() }));

import { maskActivityEmails } from './member-activity';

describe('maskActivityEmails', () => {
    it('masks full addresses in comment previews', () => {
        const data = { recentComments: [{ preview: '메일 주세요 me@x.io 감사' }] };
        expect(maskActivityEmails(data).recentComments[0].preview).toBe(
            '메일 주세요 [이메일] 감사'
        );
    });

    it('masks an address cut off at the end of the preview', () => {
        const data = { recentComments: [{ preview: '연락은 abc.def@gmail.c' }] };
        expect(maskActivityEmails(data).recentComments[0].preview).toBe('연락은 [이메일]');
    });

    it('leaves mentions and URLs alone', () => {
        const p = '@홍길동 님 https://medium.com/@writer';
        const data = { recentComments: [{ preview: p }] };
        expect(maskActivityEmails(data).recentComments[0].preview).toBe(p);
    });

    it('tolerates null items, non-string previews and missing lists', () => {
        const data = { recentComments: [null, { preview: 3 }, { other: 'a@b.com' }] };
        expect(maskActivityEmails(data).recentComments).toEqual([
            null,
            { preview: 3 },
            { other: 'a@b.com' }
        ]);
        expect(maskActivityEmails({ recentComments: undefined })).toEqual({
            recentComments: undefined
        });
    });
});
