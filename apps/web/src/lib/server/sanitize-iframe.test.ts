import { describe, expect, it } from 'vitest';
import {
    sanitizeComment,
    sanitizeIntroHtml,
    sanitizePostContent,
    sanitizePostContentStrict
} from './sanitize';

const YOUTUBE = 'https://www.youtube.com/embed/abc';
const CALENDAR = 'https://calendar.google.com/calendar/embed?src=abc';
const OTHER = 'https://other.example.com/x';

describe('sanitizePostContentStrict — iframe 허용 도메인', () => {
    it('허용 도메인(유튜브·비메오) iframe 은 남긴다', () => {
        expect(
            sanitizePostContentStrict(`<iframe src="${YOUTUBE}" allowfullscreen></iframe>`)
        ).toContain('youtube.com/embed/abc');
        expect(
            sanitizePostContentStrict('<iframe src="https://player.vimeo.com/video/1"></iframe>')
        ).toContain('player.vimeo.com/video/1');
    });

    it('허용 밖 도메인 iframe 은 제거한다', () => {
        const out = sanitizePostContentStrict(`<p>본문</p><iframe src="${OTHER}"></iframe>`);
        expect(out).toContain('<p>본문</p>');
        expect(out).not.toContain('<iframe');
        expect(out).not.toContain('other.example.com');
    });

    it('src 앞 속성 값에 > 가 있어도 허용 도메인만 남긴다', () => {
        const blocked = sanitizePostContentStrict(
            `<iframe title="a>" src="${OTHER}"></iframe><p>뒤</p>`
        );
        expect(blocked).not.toContain('<iframe');
        expect(blocked).not.toContain('other.example.com');
        expect(blocked).toContain('<p>뒤</p>');

        expect(
            sanitizePostContentStrict(`<iframe title="a>" src="${YOUTUBE}"></iframe>`)
        ).toContain('youtube.com/embed/abc');
    });

    it('작은따옴표·따옴표 없는 src 도 같은 기준으로 판정한다', () => {
        expect(sanitizePostContentStrict(`<iframe src='${OTHER}'></iframe>`)).not.toContain(
            'other.example.com'
        );
        expect(sanitizePostContentStrict(`<iframe src=${OTHER}></iframe>`)).not.toContain(
            'other.example.com'
        );
        expect(sanitizePostContentStrict(`<iframe src='${YOUTUBE}'></iframe>`)).toContain(
            'youtube.com/embed/abc'
        );
    });

    it('대문자 태그·속성 이름도 같은 기준으로 판정한다', () => {
        expect(sanitizePostContentStrict(`<IFRAME SRC="${OTHER}"></IFRAME>`)).not.toContain(
            'other.example.com'
        );
        expect(sanitizePostContentStrict(`<IFRAME SRC="${YOUTUBE}"></IFRAME>`)).toContain(
            'youtube.com/embed/abc'
        );
    });

    it('프로토콜 상대 URL·http·비슷한 호스트 이름은 허용하지 않는다', () => {
        for (const src of [
            '//other.example.com/x',
            'http://www.youtube.com/embed/abc',
            'https://www.youtube.com.other.example.com/x',
            'https://youtube.com@other.example.com/x',
            ' https://other.example.com/x',
            'https://other.example.com/\nhttps://www.youtube.com/embed/abc'
        ]) {
            const out = sanitizePostContentStrict(`<iframe src="${src}"></iframe>`);
            expect(out, src).not.toContain('other.example.com');
            expect(out, src).not.toContain('http://www.youtube.com');
        }
    });

    it('javascript:·data: src 는 남기지 않는다', () => {
        const js = sanitizePostContentStrict('<iframe src="javascript:alert(1)"></iframe>');
        expect(js).not.toContain('javascript:');
        const data = sanitizePostContentStrict(
            '<iframe src="data:text/html;base64,PHA+eDwvcD4="></iframe>'
        );
        expect(data).not.toContain('data:');
    });

    it('srcdoc 속성은 남기지 않는다', () => {
        const out = sanitizePostContentStrict(
            `<iframe srcdoc="<p>x</p>" src="${YOUTUBE}"></iframe><iframe srcdoc="<b>y</b>"></iframe>`
        );
        expect(out).not.toContain('srcdoc');
        expect(out).toContain('youtube.com/embed/abc');
    });

    it('여러 iframe 중 허용 밖인 것만 제거한다', () => {
        const out = sanitizePostContentStrict(
            `<div><iframe src="${OTHER}"></iframe><iframe src="${YOUTUBE}"></iframe></div>`
        );
        expect(out).not.toContain('other.example.com');
        expect(out).toContain('youtube.com/embed/abc');
    });
});

describe('sanitizeIntroHtml — iframe 허용 도메인', () => {
    it('src 앞 속성 값에 > 가 있어도 구글 캘린더만 남긴다', () => {
        expect(sanitizeIntroHtml(`<iframe title="a>" src="${OTHER}"></iframe>`)).not.toContain(
            'iframe'
        );
        expect(sanitizeIntroHtml(`<iframe title="a>" src="${CALENDAR}"></iframe>`)).toContain(
            'calendar.google.com'
        );
    });

    it('대문자·작은따옴표·프로토콜 상대 URL 도 같은 기준으로 판정한다', () => {
        expect(sanitizeIntroHtml(`<IFRAME SRC="${OTHER}"></IFRAME>`)).not.toContain('iframe');
        expect(sanitizeIntroHtml(`<iframe src='${OTHER}'></iframe>`)).not.toContain('iframe');
        expect(sanitizeIntroHtml('<iframe src="//other.example.com/x"></iframe>')).not.toContain(
            'iframe'
        );
    });

    it('src 가 없거나 srcdoc 만 있는 iframe 은 제거한다', () => {
        expect(sanitizeIntroHtml('<iframe width="100"></iframe><p>a</p>')).toBe('<p>a</p>');
        expect(sanitizeIntroHtml('<iframe srcdoc="<p>x</p>"></iframe>')).not.toContain('iframe');
    });
});

describe('iframe 허용 도메인 검사 적용 범위', () => {
    it('Strict·소개 정화 호출 밖에서는 검사가 적용되지 않는다 (기존 동작 유지)', () => {
        sanitizePostContentStrict(`<iframe src="${OTHER}"></iframe>`);
        expect(sanitizePostContent(`<iframe src="${OTHER}"></iframe>`)).toContain(
            'other.example.com'
        );
    });

    it('정책이 호출마다 따로 적용된다', () => {
        expect(sanitizeIntroHtml(`<iframe src="${YOUTUBE}"></iframe>`)).not.toContain('iframe');
        expect(sanitizePostContentStrict(`<iframe src="${YOUTUBE}"></iframe>`)).toContain(
            'youtube.com/embed/abc'
        );
        expect(sanitizePostContentStrict(`<iframe src="${CALENDAR}"></iframe>`)).not.toContain(
            'calendar.google.com'
        );
    });

    it('다른 정화 함수 결과에는 영향이 없다', () => {
        sanitizeIntroHtml(`<iframe src="${OTHER}"></iframe>`);
        expect(sanitizeComment('<p><b>굵게</b></p>')).toBe('<p><b>굵게</b></p>');
    });
});
