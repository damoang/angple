import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('$lib/server/db.js', () => ({ readPool: { query } }));

describe('등록된 앙지도 장소 연결', () => {
    beforeEach(() => {
        vi.resetModules();
        query.mockReset();
    });

    it('제공자와 장소 ID를 함께 대조하고 같은 장소는 캐시한다', async () => {
        query.mockResolvedValue([[{ wr_id: 121 }]]);
        const { findRelatedAngmapPost } = await import('./angmap-related-post');
        expect(await findRelatedAngmapPost('naver', '123')).toBe(121);
        expect(await findRelatedAngmapPost('naver', '123')).toBe(121);
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][1]).toEqual(['naver', '123']);
        await findRelatedAngmapPost('kakao', '123');
        expect(query).toHaveBeenCalledTimes(2);
    });

    it('좌표나 상호만 있는 장소는 추측으로 연결하지 않는다', async () => {
        const { findRelatedAngmapPost } = await import('./angmap-related-post');
        expect(await findRelatedAngmapPost('naver', null)).toBeNull();
        expect(await findRelatedAngmapPost('unknown', '123')).toBeNull();
        expect(query).not.toHaveBeenCalled();
    });

    it('공개된 원글 조회 결과가 없으면 링크를 만들지 않는다', async () => {
        query.mockResolvedValue([[]]);
        const { findRelatedAngmapPost } = await import('./angmap-related-post');
        expect(await findRelatedAngmapPost('naver', '123')).toBeNull();
    });

    it('잘못된 글 번호는 링크로 반환하지 않는다', async () => {
        query.mockResolvedValue([[{ wr_id: -1 }]]);
        const { findRelatedAngmapPost } = await import('./angmap-related-post');
        expect(await findRelatedAngmapPost('naver', '123')).toBeNull();
    });
});
