import { describe, expect, it } from 'vitest';
import { isWikiangLookup, wikiangDocumentUrl, wikiSourceTitle } from './wikiang-source';

describe('외부 위키 제목', () => {
    it('나무위키와 위키백과의 제목을 해시 없이 읽는다', () => {
        expect(wikiSourceTitle('https://namu.wiki/w/서울#s-1')).toBe('서울');
        expect(wikiSourceTitle('https://ko.wikipedia.org/wiki/대한민국_정부#목록')).toBe(
            '대한민국 정부'
        );
        expect(wikiSourceTitle('https://en.m.wikipedia.org/wiki/Seoul')).toBe('Seoul');
    });
    it.each([
        'https://evilnamu.wiki/w/서울',
        'https://namu.wiki.evil.test/w/서울',
        'https://ko.wikipedia.org.evil.test/wiki/서울',
        'https://user@namu.wiki/w/서울',
        'https://namu.wiki/w/%zz',
        'https://example.com/wiki/서울'
    ])('위조/손상된 주소는 제외한다: %s', (url) => {
        expect(wikiSourceTitle(url)).toBeNull();
    });
});

describe('공개 조회 계약과 경로', () => {
    it('정규 문서 경로만 위키앙 주소로 만든다', () => {
        expect(wikiangDocumentUrl('/문서/서울')).toBe(
            'https://wikiang.org/%EB%AC%B8%EC%84%9C/%EC%84%9C%EC%9A%B8'
        );
        expect(wikiangDocumentUrl('//evil.test')).toBeNull();
        expect(wikiangDocumentUrl('/\\evil.test')).toBeNull();
        expect(wikiangDocumentUrl('javascript:alert(1)')).toBeNull();
    });
    it('명시적으로 조회 완료된 제목과 정규 주소를 수용한다', () => {
        expect(
            isWikiangLookup(
                { checked: ['서울'], pages: [{ title: '서울', path: '/대한민국/서울' }] },
                ['서울']
            )
        ).toBe(true);
        expect(isWikiangLookup({ checked: ['서울'], pages: [] }, ['서울'])).toBe(true);
    });
    it('부분 응답·중복·외부 주소를 문서 부재로 오인하지 않는다', () => {
        expect(isWikiangLookup({ exists: [] }, ['서울'])).toBe(false);
        expect(isWikiangLookup({ checked: [], pages: [] }, ['서울'])).toBe(false);
        expect(
            isWikiangLookup(
                { checked: ['서울'], pages: [{ title: '서울', path: '//evil.test' }] },
                ['서울']
            )
        ).toBe(false);
        expect(
            isWikiangLookup(
                {
                    checked: ['서울'],
                    pages: [
                        { title: '서울', path: '/1' },
                        { title: '서울', path: '/2' }
                    ]
                },
                ['서울']
            )
        ).toBe(false);
    });
});
