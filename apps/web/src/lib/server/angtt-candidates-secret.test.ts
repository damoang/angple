import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, execute } = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn() }));
vi.mock('$lib/server/db', () => ({ default: { query, execute } }));
vi.mock('$plugins/angtt-review/lib/entities.server', () => ({
    refreshEntityAggregates: vi.fn()
}));

describe('registerAngttCandidate — 비밀글 제외', () => {
    beforeEach(() => {
        query.mockReset();
        execute.mockReset();
    });

    it('비밀글이면 후보를 만들지 않고 더 조회하지 않는다', async () => {
        query.mockResolvedValueOnce([
            [
                {
                    wr_subject: '작품 후기',
                    ca_name: '',
                    wr_option: 'html1,secret',
                    wr_is_comment: 0,
                    wr_deleted_at: null
                }
            ]
        ]);
        const { registerAngttCandidate } = await import('./angtt-candidates');
        expect(await registerAngttCandidate('angtt', 7, 'create')).toBe('skipped');
        expect(query).toHaveBeenCalledTimes(1);
        expect(String(query.mock.calls[0][0])).toContain('wr_option');
        expect(execute).not.toHaveBeenCalled();
    });
});
