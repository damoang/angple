import { describe, it, expect } from 'vitest';
import { createRatedItemJsonLd, ratingSchemaTypeForCategory } from './json-ld';

describe('ratingSchemaTypeForCategory — 앙티티 카테고리 → schema.org 타입', () => {
    it('영화·드라마 계열 → Movie (드라마도 Google 리치결과 위해 Movie)', () => {
        for (const c of ['영화', '드라마', 'NETFLIX', 'APPLE_TV', '다큐']) {
            expect(ratingSchemaTypeForCategory(c)).toBe('Movie');
        }
    });
    it('책/만화 계열 → Book', () => {
        for (const c of ['웹툰', '만화', '소설', '책']) {
            expect(ratingSchemaTypeForCategory(c)).toBe('Book');
        }
    });
    it('게임 → VideoGame, 공연/전시 → Event', () => {
        expect(ratingSchemaTypeForCategory('게임')).toBe('VideoGame');
        expect(ratingSchemaTypeForCategory('공연')).toBe('Event');
        expect(ratingSchemaTypeForCategory('전시')).toBe('Event');
    });
    it('미지원/미지정 → CreativeWork (스키마 유효, 리치결과 미보장)', () => {
        expect(ratingSchemaTypeForCategory('음악')).toBe('CreativeWork');
        expect(ratingSchemaTypeForCategory(undefined)).toBe('CreativeWork');
        expect(ratingSchemaTypeForCategory('')).toBe('CreativeWork');
    });
});

describe('createRatedItemJsonLd — 작품 + AggregateRating', () => {
    it('평점 있으면 Movie + aggregateRating 생성', () => {
        const r = createRatedItemJsonLd({
            name: '듄: 파트 2',
            category: '영화',
            ratingValue: 4.27,
            ratingCount: 21,
            url: 'https://damoang.net/angtt/123',
            image: 'https://damoang.net/poster.jpg'
        });
        expect(r).not.toBeNull();
        expect(r?.['@type']).toBe('Movie');
        expect(r?.name).toBe('듄: 파트 2');
        expect(r?.aggregateRating).toEqual({
            '@type': 'AggregateRating',
            ratingValue: 4.3, // 소수점 1자리 반올림
            ratingCount: 21,
            bestRating: 5,
            worstRating: 1
        });
        expect(r?.url).toBe('https://damoang.net/angtt/123');
    });

    it('참여 0(count<1) → null (블록 생략)', () => {
        expect(
            createRatedItemJsonLd({
                name: '어떤작품',
                category: '영화',
                ratingValue: 0,
                ratingCount: 0
            })
        ).toBeNull();
    });

    it('이름 없음 → null', () => {
        expect(
            createRatedItemJsonLd({ name: '   ', category: '영화', ratingValue: 5, ratingCount: 3 })
        ).toBeNull();
    });

    it('평점 0인데 count>0 → null (avg 0 방어)', () => {
        expect(
            createRatedItemJsonLd({ name: '작품', category: '책', ratingValue: 0, ratingCount: 5 })
        ).toBeNull();
    });

    it('image/url 없으면 해당 필드 생략', () => {
        const r = createRatedItemJsonLd({
            name: '작품',
            category: '책',
            ratingValue: 3.5,
            ratingCount: 2
        });
        expect(r?.['@type']).toBe('Book');
        expect(r).not.toHaveProperty('url');
        expect(r).not.toHaveProperty('image');
    });
});
