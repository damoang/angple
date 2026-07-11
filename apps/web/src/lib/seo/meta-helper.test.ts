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
        it('기본값 = Discover 대형 미리보기 허용 (max-image-preview:large)', () => {
            expect(buildRobots({ title: 'test' })).toBe('max-image-preview:large');
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

describe('VideoObject (GSC 동영상 색인 — 썸네일 필수)', () => {
    it('유튜브 임베드 iframe 에서 videoId 추출 (embed·nocookie·중복 제거)', async () => {
        const { extractVideosFromContent } = await import('./json-ld');
        const html = `
            <div data-youtube-video><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"></iframe></div>
            <iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>
            <iframe src="https://www.youtube.com/embed/abc123XYZ_-"></iframe>`;
        expect(extractVideosFromContent(html)).toEqual([
            { type: 'youtube', id: 'dQw4w9WgXcQ' },
            { type: 'youtube', id: 'abc123XYZ_-' }
        ]);
    });

    it('업로드 동영상: <video src> 와 <video><source src> 모두 추출, 단순 링크는 제외', async () => {
        const { extractVideosFromContent } = await import('./json-ld');
        const html = `
            <video src="https://r2.damoang.net/data/editor/a.mp4" controls></video>
            <video controls><source src="https://r2.damoang.net/data/file/b.mp4" /></video>
            <a href="https://youtu.be/dQw4w9WgXcQ">링크만</a>`;
        expect(extractVideosFromContent(html)).toEqual([
            { type: 'file', url: 'https://r2.damoang.net/data/editor/a.mp4' },
            { type: 'file', url: 'https://r2.damoang.net/data/file/b.mp4' }
        ]);
    });

    it('createVideoObjectJsonLd: 필수값(name·thumbnailUrl·uploadDate·재생URL) 미충족 시 null', async () => {
        const { createVideoObjectJsonLd } = await import('./json-ld');
        const base = {
            name: '제목',
            thumbnailUrl: 'https://i.ytimg.com/vi/x/hqdefault.jpg',
            uploadDate: '2026-07-10T00:00:00+09:00',
            embedUrl: 'https://www.youtube.com/embed/x'
        };
        expect(createVideoObjectJsonLd(base)).toMatchObject({
            '@type': 'VideoObject',
            name: '제목'
        });
        expect(createVideoObjectJsonLd({ ...base, thumbnailUrl: undefined })).toBeNull();
        expect(createVideoObjectJsonLd({ ...base, name: '  ' })).toBeNull();
        expect(createVideoObjectJsonLd({ ...base, embedUrl: undefined })).toBeNull();
    });
});

describe('동영상 포스터 (관례 키 + poster 속성)', () => {
    it('extractVideosFromContent: video poster 속성 추출', async () => {
        const { extractVideosFromContent } = await import('./json-ld');
        const html = `
            <video src="https://r2.damoang.net/data/editor/2607/a.mp4" poster="https://r2.damoang.net/data/editor/2607/a_poster.jpg" controls></video>
            <video controls><source src="https://r2.damoang.net/data/file/b.mp4" /></video>`;
        expect(extractVideosFromContent(html)).toEqual([
            {
                type: 'file',
                url: 'https://r2.damoang.net/data/editor/2607/a.mp4',
                poster: 'https://r2.damoang.net/data/editor/2607/a_poster.jpg'
            },
            { type: 'file', url: 'https://r2.damoang.net/data/file/b.mp4' }
        ]);
    });

    it('deriveVideoPoster: 확장자 → _poster.jpg (쿼리스트링 보존)', async () => {
        const { deriveVideoPoster } = await import('../utils/video-poster');
        expect(deriveVideoPoster('https://r2.damoang.net/data/editor/2607/a.mp4')).toBe(
            'https://r2.damoang.net/data/editor/2607/a_poster.jpg'
        );
        expect(deriveVideoPoster('https://r2.damoang.net/data/editor/2607/a.webm?v=1')).toBe(
            'https://r2.damoang.net/data/editor/2607/a_poster.jpg?v=1'
        );
    });
});

describe('SEO P3 — Discover + QAPage', () => {
    it('buildRobots: 색인 페이지에 max-image-preview:large, noindex 페이지엔 없음', () => {
        expect(buildRobots({ title: 't' })).toBe('max-image-preview:large');
        expect(buildRobots({ title: 't', noIndex: true })).toBe('noindex');
        expect(buildRobots({ title: 't', noFollow: true })).toBe(
            'nofollow, max-image-preview:large'
        );
    });

    it('createQAPageJsonLd: 유효 답변 있으면 Question+suggestedAnswer, 없으면 null', async () => {
        const { createQAPageJsonLd } = await import('./json-ld');
        const base = {
            name: '질문 제목',
            answerCount: 5,
            dateCreated: '2026-07-10T00:00:00+09:00',
            answers: [
                { text: '답변입니다', author: '앙님', upvoteCount: 3 },
                { text: '  ', author: '빈답변' }
            ]
        };
        const ld = createQAPageJsonLd(base);
        expect(ld?.mainEntity.name).toBe('질문 제목');
        expect(ld?.mainEntity.answerCount).toBe(5);
        expect(ld?.mainEntity.suggestedAnswer).toHaveLength(1);
        expect(ld?.mainEntity.suggestedAnswer?.[0].author?.name).toBe('앙님');
        expect(createQAPageJsonLd({ ...base, answers: [] })).toBeNull();
        expect(createQAPageJsonLd({ ...base, name: ' ' })).toBeNull();
    });
});

describe('comment.author url (GSC 개선 제안)', () => {
    it('DiscussionForumPosting comment author 에 프로필 url 포함, 없으면 생략', () => {
        const ld = createDiscussionForumPostingJsonLd({
            headline: 't',
            author: '글쓴이',
            datePublished: '2026-07-10',
            url: 'https://test.com/free/1',
            comments: [
                { text: '댓글', author: '앙님', authorUrl: 'https://test.com/member/ang' },
                { text: '익명댓글', author: '누군가' }
            ]
        });
        expect(ld.comment?.[0].author.url).toBe('https://test.com/member/ang');
        expect(ld.comment?.[1].author.url).toBeUndefined();
    });

    it('QAPage answer author 에 프로필 url 포함', async () => {
        const { createQAPageJsonLd } = await import('./json-ld');
        const ld = createQAPageJsonLd({
            name: '질문',
            answerCount: 1,
            answers: [{ text: '답변', author: '앙님', authorUrl: 'https://test.com/member/ang' }]
        });
        expect(ld?.mainEntity.suggestedAnswer?.[0].author?.url).toBe('https://test.com/member/ang');
    });
});

describe('QAPage url 보강 (GSC Q&A 4건)', () => {
    it('question author url + answer url 출력, 미제공 시 생략', async () => {
        const { createQAPageJsonLd } = await import('./json-ld');
        const ld = createQAPageJsonLd({
            name: '질문',
            text: '본문',
            author: '질문자',
            authorUrl: 'https://test.com/member/asker',
            answerCount: 2,
            answers: [
                {
                    text: '답변1',
                    url: 'https://test.com/qa/1#c_10',
                    author: '앙님',
                    authorUrl: 'https://test.com/member/ang'
                },
                { text: '답변2' }
            ]
        });
        expect(ld?.mainEntity.author?.url).toBe('https://test.com/member/asker');
        expect(ld?.mainEntity.text).toBe('본문');
        expect(ld?.mainEntity.suggestedAnswer?.[0].url).toBe('https://test.com/qa/1#c_10');
        expect(ld?.mainEntity.suggestedAnswer?.[1].url).toBeUndefined();
    });
});
