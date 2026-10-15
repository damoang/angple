import { describe, expect, it } from 'vitest';
import { findTmdbSources, tmdbSourceKey } from './angtt-source';

describe('TMDB 작품 링크', () => {
    it('영화와 TV의 동일 번호를 구분한다', () => {
        expect(tmdbSourceKey('https://www.themoviedb.org/movie/123-title?language=ko')).toBe(
            'movie:123'
        );
        expect(tmdbSourceKey('https://themoviedb.org/tv/123')).toBe('tv:123');
    });

    it.each([
        'https://evilthemoviedb.org/movie/123',
        'https://themoviedb.org.evil.test/movie/123',
        'https://user:pass@themoviedb.org/movie/123',
        'https://themoviedb.org:444/movie/123',
        'ftp://themoviedb.org/movie/123',
        'https://themoviedb.org/person/123',
        'https://themoviedb.org/movie/0',
        'https://themoviedb.org/movie/123abc',
        'https://themoviedb.org/movie/9007199254740992'
    ])('지원하지 않는 주소는 거부한다: %s', (source) => {
        expect(tmdbSourceKey(source)).toBeNull();
    });

    it('HTML 본문과 링크 필드의 중복 작품을 합친다', () => {
        expect(
            findTmdbSources(
                'https://themoviedb.org/movie/123',
                '<a href="https://www.themoviedb.org/movie/123-title">영화</a>'
            )
        ).toHaveLength(1);
    });

    it('여러 작품은 모호함 판정에 필요한 두 건까지만 수집한다', () => {
        expect(
            findTmdbSources(
                '(https://themoviedb.org/movie/1) https://themoviedb.org/tv/2 https://themoviedb.org/movie/3'
            )
        ).toEqual(['https://themoviedb.org/movie/1', 'https://themoviedb.org/tv/2']);
    });
});
