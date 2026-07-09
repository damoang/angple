import { describe, it, expect, beforeEach } from 'vitest';
import {
    configureSeo,
    buildTitle,
    buildRobots,
    buildOgTags,
    buildTwitterTags,
    buildJsonLd,
    truncateText,
    createArticleJsonLd,
    createBreadcrumbJsonLd,
    createWebSiteJsonLd
} from './meta-helper';
import { createDiscussionForumPostingJsonLd } from './json-ld';

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
            const result = buildJsonLd([
                createWebSiteJsonLd(),
                createArticleJsonLd({ headline: 'H' })
            ]);
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
            const ld = createBreadcrumbJsonLd([{ name: '홈', url: '/' }, { name: '게시판' }]);
            expect(ld).not.toBeNull();
            expect(ld!.itemListElement).toHaveLength(2);
            expect(ld!.itemListElement[0].position).toBe(1);
            expect(ld!.itemListElement[1].position).toBe(2);
            expect(ld!.itemListElement[1].item).toBeUndefined();
        });

        // GSC "'name' 또는 'item.name' 지정 필요" 에러 방지 (빈 제목 글 등)
        it('name 이 빈 항목은 제외하고 position 재부여', () => {
            const ld = createBreadcrumbJsonLd([
                { name: '홈', url: '/' },
                { name: '', url: '/free' },
                { name: '   ' },
                { name: undefined },
                { name: '글제목' }
            ]);
            expect(ld).not.toBeNull();
            expect(ld!.itemListElement).toHaveLength(2);
            expect(ld!.itemListElement[0].name).toBe('홈');
            expect(ld!.itemListElement[1].name).toBe('글제목');
            expect(ld!.itemListElement[1].position).toBe(2);
        });

        it('유효 항목이 없으면 null (빈 BreadcrumbList 미출력)', () => {
            expect(createBreadcrumbJsonLd([])).toBeNull();
            expect(createBreadcrumbJsonLd([{ name: '' }, { name: undefined }])).toBeNull();
        });

        it('name 앞뒤 공백 trim', () => {
            const ld = createBreadcrumbJsonLd([{ name: '  홈  ', url: '/' }]);
            expect(ld!.itemListElement[0].name).toBe('홈');
        });
    });

    describe('buildJsonLd null 필터', () => {
        it('null 항목 제외 후 직렬화', () => {
            const result = buildJsonLd([createWebSiteJsonLd(), null, undefined]);
            const parsed = JSON.parse(result);
            expect(parsed['@type']).toBe('WebSite');
        });

        it('전부 null 이면 빈 문자열 (script 태그 생략)', () => {
            expect(buildJsonLd([null, undefined])).toBe('');
        });
    });

    // GSC "잘린 유니코드 문자"(파싱 불가) 방지
    describe('truncateText', () => {
        it('이모지(서로게이트 쌍)가 경계에 걸려도 깨지지 않음', () => {
            const text = 'a'.repeat(159) + '😀불닭';
            const cut = truncateText(text, 160);
            // .slice(0,160) 이었다면 😀 의 상위 서로게이트 반쪽이 남아 lone surrogate 발생
            expect(/[\uD800-\uDBFF]$/.test(cut)).toBe(false);
            expect(cut.endsWith('😀')).toBe(true);
            expect([...cut]).toHaveLength(160);
        });

        it('길이 이내면 그대로', () => {
            expect(truncateText('짧은 글 😀', 160)).toBe('짧은 글 😀');
        });

        it('잘린 결과의 JSON 직렬화에 lone surrogate 없음', () => {
            const cut = truncateText('가'.repeat(158) + '🎉🎉🎉', 160);
            const json = JSON.stringify({ text: cut });
            expect(
                /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
                    json
                )
            ).toBe(false);
        });
    });

    // GSC "comment/headline 누락" 개선
    describe('createDiscussionForumPostingJsonLd', () => {
        const base = {
            headline: '제목',
            author: '앙님',
            datePublished: '2026-07-08T00:00:00+09:00',
            url: 'https://test.com/free/1'
        };

        it('comments 상위 3개만 Comment 노드로 출력', () => {
            const ld = createDiscussionForumPostingJsonLd({
                ...base,
                comments: [1, 2, 3, 4, 5].map((i) => ({
                    text: `댓글${i}`,
                    author: `유저${i}`,
                    datePublished: '2026-07-08T00:00:00+09:00'
                }))
            });
            expect(ld.comment).toHaveLength(3);
            expect(ld.comment![0]).toMatchObject({
                '@type': 'Comment',
                text: '댓글1',
                author: { '@type': 'Person', name: '유저1' }
            });
        });

        it('내용/작성자 빈 댓글은 제외, 전부 무효면 comment 필드 생략', () => {
            const ld = createDiscussionForumPostingJsonLd({
                ...base,
                comments: [
                    { text: '', author: '유저' },
                    { text: '내용', author: '  ' }
                ]
            });
            expect(ld.comment).toBeUndefined();
        });

        it('author 빈 값이면 익명 폴백 (name 누락 방지)', () => {
            const ld = createDiscussionForumPostingJsonLd({ ...base, author: '' });
            expect(ld.author.name).toBe('익명');
        });
    });
});
