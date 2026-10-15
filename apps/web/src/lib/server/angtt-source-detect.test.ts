import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('$lib/server/db', () => ({ default: { query } }));

const movie = {
    id: 1,
    slug: 'movie-123',
    canonical_title: '영화 작품',
    aliases: [],
    poster_url: null,
    meta: { auto_link: true },
    type: 'movie',
    external_ids: { tmdb: 123 }
};
const tv = {
    ...movie,
    id: 2,
    slug: 'tv-123',
    canonical_title: 'TV 작품',
    type: 'series',
    external_ids: { tmdb: 123, tmdb_type: 'tv' }
};

describe('명시적 작품 URL 감지', () => {
    beforeEach(() => {
        vi.resetModules();
        query.mockReset();
        query.mockResolvedValue([[movie, tv]]);
    });

    it('제목 추측보다 작품 URL을 우선하며 자동 저장을 허용하지 않는다', async () => {
        const { detectEntityFromSources } = await import('./angtt-auto-link');
        expect(
            await detectEntityFromSources('영화 작품 후기', ['https://themoviedb.org/tv/123'])
        ).toMatchObject({ slug: 'tv-123', canAutoLink: false });
    });

    it('예전 영화 데이터의 tmdb_type 누락을 지원한다', async () => {
        const { detectEntityFromSources } = await import('./angtt-auto-link');
        expect(
            await detectEntityFromSources('', ['https://themoviedb.org/movie/123'])
        ).toMatchObject({ slug: 'movie-123' });
    });

    it('미등록 URL을 다른 제목의 작품으로 대체하지 않는다', async () => {
        const { detectEntityFromSources } = await import('./angtt-auto-link');
        expect(
            await detectEntityFromSources('영화 작품 후기', ['https://themoviedb.org/movie/999'])
        ).toBeNull();
    });

    it('여러 작품 URL이면 임의 선택하지 않고 DB 조회도 생략한다', async () => {
        const { detectEntityFromSources } = await import('./angtt-auto-link');
        expect(
            await detectEntityFromSources('', [
                'https://themoviedb.org/movie/123',
                'https://themoviedb.org/tv/123'
            ])
        ).toBeNull();
        expect(query).not.toHaveBeenCalled();
    });

    it('중복 등록된 외부 ID는 임의 선택하지 않는다', async () => {
        query.mockResolvedValue([[movie, { ...movie, id: 3, slug: 'duplicate' }]]);
        const { detectEntityFromSources } = await import('./angtt-auto-link');
        expect(await detectEntityFromSources('', ['https://themoviedb.org/movie/123'])).toBeNull();
    });

    it('URL이 없으면 기존 제목 감지를 유지하고 사전 캐시를 공유한다', async () => {
        const { detectEntityFromSources } = await import('./angtt-auto-link');
        expect(await detectEntityFromSources('영화 작품 후기', [])).toMatchObject({
            slug: 'movie-123'
        });
        await detectEntityFromSources('', ['https://themoviedb.org/tv/123']);
        expect(query).toHaveBeenCalledTimes(1);
    });
});
