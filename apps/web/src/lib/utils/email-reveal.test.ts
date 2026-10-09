import { describe, it, expect } from 'vitest';
import {
    decodeEmailMarkers,
    emailToMarker,
    encodeEmails,
    maskEmailText,
    maskTitleFields,
    markerToEmail,
    renderEmailMarkers,
    splitEmailMarkers,
    stripEmailMarkers,
    titleEmailReviver
} from './email-reveal';

const RAW_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/;

describe('encodeEmails', () => {
    it('replaces a plain email with a marker and leaves no raw address', () => {
        const out = encodeEmails('문의는 help.desk@example.co.kr 로 주세요.');
        expect(out).toBe(`문의는 ${emailToMarker('help.desk@example.co.kr')} 로 주세요.`);
        expect(out).not.toMatch(RAW_EMAIL);
    });

    it('handles Korean text glued to the address and a colon before it', () => {
        const out = encodeEmails('메일:a.b@test.com입니다');
        expect(out).toContain(emailToMarker('a.b@test.com'));
        expect(out).not.toMatch(RAW_EMAIL);
    });

    it('keeps a trailing sentence period outside the marker', () => {
        expect(encodeEmails('me@x.io.')).toBe(`${emailToMarker('me@x.io')}.`);
    });

    it('replaces <a href="mailto:..."> links entirely', () => {
        const out = encodeEmails('<p><a href="mailto:me@x.io?subject=hi">me@x.io</a></p>');
        expect(out).toBe(`<p>${emailToMarker('me@x.io')}</p>`);
    });

    it('keeps the link text of mailto links that are not the address itself', () => {
        expect(encodeEmails('<a href="mailto:me@x.io">연락</a>')).toBe(
            `연락 ${emailToMarker('me@x.io')}`
        );
        expect(encodeEmails('[메일](mailto:me@x.io)')).toBe(`메일 ${emailToMarker('me@x.io')}`);
    });

    it('replaces markdown mailto links and bare mailto: text', () => {
        expect(encodeEmails('[me@x.io](mailto:me@x.io)')).toBe(emailToMarker('me@x.io'));
        expect(encodeEmails('mailto:me@x.io')).toBe(emailToMarker('me@x.io'));
    });

    it('encodes addresses in attribute text but not image URLs', () => {
        const html = '<img src="https://cdn.example.com/a/logo@2x.png" alt="me@x.io">';
        expect(encodeEmails(html)).toBe(
            `<img src="https://cdn.example.com/a/logo@2x.png" alt="${emailToMarker('me@x.io')}">`
        );
    });

    it('replaces <address> angle-bracket autolinks', () => {
        expect(encodeEmails('메일 <me@x.io> 로')).toBe(`메일 ${emailToMarker('me@x.io')} 로`);
    });

    it('treats tab and NBSP as URL token separators', () => {
        const s = '접속\thttps://user:pw@host.com 참고';
        expect(encodeEmails(s)).toBe(s);
        expect(encodeEmails('메일\u00a0me@x.io')).toBe(`메일\u00a0${emailToMarker('me@x.io')}`);
    });

    it('stays fast on long @-heavy input', () => {
        const long = 'a'.repeat(200000) + '@' + 'b'.repeat(200000);
        const start = Date.now();
        expect(encodeEmails(long)).toBe(long);
        expect(Date.now() - start).toBeLessThan(2000);
    });

    it('does not treat image file names as emails', () => {
        expect(encodeEmails('icon@2x.png 파일')).toBe('icon@2x.png 파일');
    });

    it('does not touch credentials inside a URL', () => {
        const s = '접속 https://user:pass@host.example.com/path 참고';
        expect(encodeEmails(s)).toBe(s);
    });

    it('does not touch URL paths containing @', () => {
        const s = 'https://medium.com/@writer/post 와 https://x.com/u@page';
        expect(encodeEmails(s)).toBe(s);
    });

    it('does not touch @mentions', () => {
        expect(encodeEmails('@홍길동 님 안녕하세요 @alice')).toBe('@홍길동 님 안녕하세요 @alice');
    });

    it('returns empty and @-less content unchanged', () => {
        expect(encodeEmails('')).toBe('');
        expect(encodeEmails('그냥 글')).toBe('그냥 글');
    });
});

describe('markers', () => {
    it('round-trips through decodeEmailMarkers', () => {
        const src = '연락처 a@b.com, c.d+e@f-g.co.kr\n끝';
        expect(decodeEmailMarkers(encodeEmails(src))).toBe(src);
    });

    it('marker payload is hex only and not the raw address', () => {
        const m = emailToMarker('a@b.com');
        expect(m).toMatch(/^\{email:[0-9a-f]+\}$/);
        expect(markerToEmail(m.slice(7, -1))).toBe('a@b.com');
    });

    it('rejects forged markers that do not decode to an email', () => {
        const forged = Buffer.from('<script>', 'utf8').toString('hex');
        expect(markerToEmail(forged)).toBeNull();
        expect(renderEmailMarkers(`{email:${forged}}`)).toBe(`{email:${forged}}`);
    });

    it('renders a reveal button without the raw address', () => {
        const html = renderEmailMarkers(`<p>${emailToMarker('a@b.com')}</p>`);
        expect(html).toContain('class="email-reveal"');
        expect(html).not.toMatch(RAW_EMAIL);
    });

    it('never inserts markup inside a tag (forged marker in an attribute)', () => {
        const m = emailToMarker('a@b.com');
        const html = renderEmailMarkers(`<img alt="${m}" title="x"><a href="${m}">t</a>`);
        expect(html).toBe('<img alt="[이메일]" title="x"><a href="[이메일]">t</a>');
    });

    it('strips markers for plain-text descriptions', () => {
        expect(stripEmailMarkers(`메일 ${emailToMarker('a@b.com')}`)).toBe('메일 [이메일]');
    });
});

describe('maskEmailText', () => {
    it('replaces raw addresses and markers with a placeholder', () => {
        expect(maskEmailText('연락 a.b@test.com 주세요')).toBe('연락 [이메일] 주세요');
        expect(maskEmailText(`연락 ${emailToMarker('a@b.com')}`)).toBe('연락 [이메일]');
    });

    it('is idempotent', () => {
        const once = maskEmailText('x a@b.com y <c@d.org>');
        expect(maskEmailText(once)).toBe(once);
        expect(once).not.toMatch(RAW_EMAIL);
    });

    it('leaves text without addresses untouched', () => {
        expect(maskEmailText('logo@2x.png 파일')).toBe('logo@2x.png 파일');
        expect(maskEmailText('')).toBe('');
    });
});

describe('splitEmailMarkers', () => {
    it('splits text and valid markers', () => {
        const hex = emailToMarker('a@b.com').slice(7, -1);
        expect(splitEmailMarkers(`제목 ${emailToMarker('a@b.com')} 끝`)).toEqual([
            { text: '제목 ' },
            { hex },
            { text: ' 끝' }
        ]);
    });

    it('keeps forged markers as text', () => {
        const forged = '{email:3c7363726970743e}';
        expect(splitEmailMarkers(`a ${forged} b`)).toEqual([{ text: `a ${forged} b` }]);
    });

    it('returns a single text segment without markers and nothing for empty input', () => {
        expect(splitEmailMarkers('평범한 제목')).toEqual([{ text: '평범한 제목' }]);
        expect(splitEmailMarkers('')).toEqual([]);
    });
});

describe('maskTitleFields', () => {
    it('masks title-like keys in nested arrays and objects only', () => {
        const data = {
            data: [
                { title: 'a@b.com 문의', content: 'c@d.com', author: 'x' },
                { wr_subject: '메일 e@f.org', subject: 'g@h.net', parent_title: 'i@j.io' }
            ],
            notices: [{ title: '공지 k@l.com' }]
        };
        const out = maskTitleFields(data);
        expect(out).toBe(data);
        expect(out.data[0].title).toBe('[이메일] 문의');
        expect(out.data[0].content).toBe('c@d.com');
        expect(out.data[1]).toEqual({
            wr_subject: '메일 [이메일]',
            subject: '[이메일]',
            parent_title: '[이메일]'
        });
        expect(out.notices[0].title).toBe('공지 [이메일]');
    });

    it('accepts a custom key list', () => {
        const out = maskTitleFields({ name: 'a@b.com', title: 'c@d.com' }, ['name']);
        expect(out).toEqual({ name: '[이메일]', title: 'c@d.com' });
    });

    it('stops at the depth limit and ignores non-objects', () => {
        let deep: Record<string, unknown> = { title: 'a@b.com' };
        for (let i = 0; i < 10; i++) deep = { child: deep };
        maskTitleFields(deep);
        let cur = deep;
        while (cur.child) cur = cur.child as Record<string, unknown>;
        expect(cur.title).toBe('a@b.com');
        expect(maskTitleFields('a@b.com')).toBe('a@b.com');
        expect(maskTitleFields(null)).toBeNull();
    });
});

describe('titleEmailReviver', () => {
    it('masks title fields while parsing JSON', () => {
        const json = JSON.stringify({
            posts: [{ title: 'a@b.com', wr_subject: 'c@d.com', content: 'e@f.com' }]
        });
        const out = JSON.parse(json, titleEmailReviver);
        expect(out.posts[0]).toEqual({
            title: '[이메일]',
            wr_subject: '[이메일]',
            content: 'e@f.com'
        });
    });
});
