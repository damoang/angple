import { describe, it, expect, beforeEach } from 'vitest';
import {
	configureSeo,
	buildTitle,
	buildRobots,
	buildOgTags,
	buildTwitterTags,
	buildJsonLd,
	createArticleJsonLd,
	createBreadcrumbJsonLd,
	createWebSiteJsonLd
} from './meta-helper';

describe('SEO meta-helper', () => {
	beforeEach(() => {
		configureSeo({ siteName: 'TestSite', siteUrl: 'https://test.com', locale: 'ko_KR' });
	});

	describe('buildTitle', () => {
		it('사이트명 포함', () => {
			expect(buildTitle('페이지')).toBe('페이지 | TestSite');
		});

		it('사이트명 제외', () => {
			expect(buildTitle('페이지', false)).toBe('페이지');
		});
	});

	describe('buildRobots', () => {
		it('기본값 null', () => {
			expect(buildRobots({ title: 'test' })).toBeNull();
		});

		it('noindex, nofollow', () => {
			expect(buildRobots({ title: 'test', noIndex: true, noFollow: true })).toBe(
				'noindex, nofollow'
			);
		});

		it('noindex만', () => {
			expect(buildRobots({ title: 'test', noIndex: true })).toBe('noindex');
		});
	});

	describe('buildOgTags', () => {
		it('기본 OG 태그 생성', () => {
			const tags = buildOgTags({ title: '제목' });
			expect(tags['og:title']).toBe('제목');
			expect(tags['og:type']).toBe('website');
			expect(tags['og:site_name']).toBe('TestSite');
		});

		it('커스텀 OG 값 우선', () => {
			const tags = buildOgTags({ title: '기본' }, { title: '커스텀', type: 'article' });
			expect(tags['og:title']).toBe('커스텀');
			expect(tags['og:type']).toBe('article');
		});

		it('이미지 크기 포함', () => {
			const tags = buildOgTags(
				{ title: 't' },
				{ image: '/img.jpg', imageWidth: 1200, imageHeight: 630 }
			);
			expect(tags['og:image']).toBe('/img.jpg');
			expect(tags['og:image:width']).toBe('1200');
			expect(tags['og:image:height']).toBe('630');
		});
	});

	describe('buildTwitterTags', () => {
		it('기본 Twitter 태그', () => {
			const tags = buildTwitterTags({ title: '제목' });
			expect(tags['twitter:card']).toBe('summary');
			expect(tags['twitter:title']).toBe('제목');
		});
	});

	describe('buildJsonLd', () => {
		it('단일 항목은 배열 아닌 객체', () => {
			const result = buildJsonLd([createWebSiteJsonLd()]);
			const parsed = JSON.parse(result);
			expect(parsed['@context']).toBe('https://schema.org');
			expect(parsed['@type']).toBe('WebSite');
		});

		it('복수 항목은 배열', () => {
			const result = buildJsonLd([createWebSiteJsonLd(), createArticleJsonLd({ headline: 'H' })]);
			const parsed = JSON.parse(result);
			expect(Array.isArray(parsed)).toBe(true);
			expect(parsed).toHaveLength(2);
		});
	});

	describe('createArticleJsonLd', () => {
		it('기본 필드', () => {
			const ld = createArticleJsonLd({ headline: '제목', author: '작성자' });
			expect(ld['@type']).toBe('Article');
			expect(ld.headline).toBe('제목');
			expect(ld.author?.name).toBe('작성자');
		});
	});

	describe('createBreadcrumbJsonLd', () => {
		it('올바른 position', () => {
			const ld = createBreadcrumbJsonLd([
				{ name: '홈', url: '/' },
				{ name: '게시판' }
			]);
			expect(ld.itemListElement).toHaveLength(2);
			expect(ld.itemListElement[0].position).toBe(1);
			expect(ld.itemListElement[1].position).toBe(2);
			expect(ld.itemListElement[1].item).toBeUndefined();
		});
	});
});
