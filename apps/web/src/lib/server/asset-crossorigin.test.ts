import { describe, expect, it } from 'vitest';
import { addAssetCrossorigin } from './asset-crossorigin.js';

const BASE = 'https://static.damoang.net/releases/sha-abc1234-p105d410';
const A = (p: string) => `${BASE}/_app/immutable/${p}`;

describe('addAssetCrossorigin', () => {
    it('우리 자산 link 에 crossorigin 을 붙인다', () => {
        const out = addAssetCrossorigin(
            `<link href="${A('assets/x.css')}" rel="stylesheet">`,
            BASE
        );
        expect(out).toBe(`<link href="${A('assets/x.css')}" rel="stylesheet" crossorigin>`);
    });

    it('속성 순서가 뒤바뀌어도 붙인다 (rel 이 먼저)', () => {
        const out = addAssetCrossorigin(`<link rel="stylesheet" href="${A('y.css')}">`, BASE);
        expect(out).toContain('crossorigin>');
        expect(out).toContain(A('y.css'));
    });

    it('자기닫음 태그는 형태를 지킨다', () => {
        const out = addAssetCrossorigin(`<link href="${A('z.css')}" rel="stylesheet" />`, BASE);
        expect(out).toBe(`<link href="${A('z.css')}" rel="stylesheet" crossorigin />`);
    });

    it('링크 여러 개에 전부 붙는다', () => {
        const html = [1, 2, 3]
            .map((i) => `<link href="${A(`c${i}.css`)}" rel="stylesheet">`)
            .join('');
        const out = addAssetCrossorigin(html, BASE);
        expect(out.match(/crossorigin/g)?.length).toBe(3);
    });

    // ⛔ 서드파티는 건드리지 않는다 — 이미 맞춰져 있고 ACAO 정책이 다르다
    it('jsdelivr 링크는 그대로 둔다', () => {
        const html = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/x/y.css">';
        expect(addAssetCrossorigin(html, BASE)).toBe(html);
    });

    it('같은 회사라도 다른 호스트(r2·s3)는 그대로 둔다', () => {
        const html =
            '<link rel="preload" href="https://r2.damoang.net/data/a.png" as="image">' +
            '<link rel="preload" href="https://s3.damoang.net/b.png" as="image">';
        expect(addAssetCrossorigin(html, BASE)).toBe(html);
    });

    // ⛔ 멱등 — 두 번 통과해도 속성이 하나여야 한다
    it('이미 crossorigin 이 있으면 두 번 붙이지 않는다', () => {
        const html = `<link href="${A('d.css')}" rel="stylesheet" crossorigin>`;
        expect(addAssetCrossorigin(html, BASE)).toBe(html);
    });

    it('두 번 적용해도 결과가 같다', () => {
        const html = `<link href="${A('e.css')}" rel="stylesheet">`;
        const once = addAssetCrossorigin(html, BASE);
        expect(addAssetCrossorigin(once, BASE)).toBe(once);
    });

    it('crossorigin="anonymous" 형태도 중복 추가하지 않는다', () => {
        const html = `<link href="${A('f.css')}" rel="stylesheet" crossorigin="anonymous">`;
        expect(addAssetCrossorigin(html, BASE)).toBe(html);
    });

    // ⛔ script·import() 는 이미 CORS 모드다. 손대면 새 위험을 만든다
    it('script 태그는 건드리지 않는다', () => {
        const html = `<script type="module" src="${A('entry/app.js')}"></script>`;
        expect(addAssetCrossorigin(html, BASE)).toBe(html);
    });

    it('inline import() 는 건드리지 않는다', () => {
        const html = `<script>import("${A('entry/start.js')}")</script>`;
        expect(addAssetCrossorigin(html, BASE)).toBe(html);
    });

    // ⛔ 잘못된 입력으로 HTML 을 망치지 않는다
    it('assetBase 가 비면 그대로 반환한다', () => {
        const html = `<link href="${A('g.css')}" rel="stylesheet">`;
        expect(addAssetCrossorigin(html, '')).toBe(html);
    });

    it('assetBase 가 URL 이 아니면 그대로 반환한다', () => {
        const html = `<link href="${A('h.css')}" rel="stylesheet">`;
        expect(addAssetCrossorigin(html, 'not-a-url')).toBe(html);
    });

    it('경로에 crossorigin 이라는 문자열이 있어도 속성은 붙인다', () => {
        const out = addAssetCrossorigin(
            `<link href="${A('assets/crossorigin-helper.css')}" rel="stylesheet">`,
            BASE
        );
        expect(out.endsWith(' crossorigin>')).toBe(true);
    });

    it('우리 링크와 서드파티가 섞여 있으면 우리 것만 붙는다', () => {
        const html =
            `<link href="${A('i.css')}" rel="stylesheet">` +
            '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/z.css">';
        const out = addAssetCrossorigin(html, BASE);
        expect(out.match(/crossorigin/g)?.length).toBe(1);
        expect(out).toContain('jsdelivr.net/npm/z.css">');
    });
});
