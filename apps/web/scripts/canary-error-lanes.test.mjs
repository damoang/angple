#!/usr/bin/env node
/**
 * canary-error-lanes 자체 단언 — vitest 는 `src/**` 만 보므로 순수 node 로 돈다.
 * ⛔ 이 파일이 실패하면 카나리 검사가 **6월 지문을 놓치는 상태**라는 뜻이다. 승격 전에 돈다.
 *   node apps/web/scripts/canary-error-lanes.test.mjs
 */
import { classify } from './canary-error-lanes.mjs';

const OURS = 'at n (https://static.damoang.net/releases/sha-x/_app/immutable/bundle.abc.js:1:2)';
const THIRD = 'at x (https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js:1:2)';

const cases = [
    // ── 1차(6월) 지문 — 이것을 놓쳐서 6/28→6/29 하루 만에 롤백했다
    ["Cannot read properties of undefined (reading '$set')", OURS, '', 'hydrate'],
    ["Cannot read properties of undefined (reading '$set')", '', '', 'hydrate'],
    ['TypeError: r.$set is not a function', OURS, '', 'hydrate'],
    ['Failed to hydrate: HierarchyRequestError: appendChild', OURS, '', 'hydrate'],
    ['Failed to hydrate', '', '', 'hydrate'],
    ['HierarchyRequestError: Node cannot be inserted', OURS, '', 'hydrate'],
    // ── 2차(9월) 지문
    [
        'Failed to fetch dynamically imported module: https://static.damoang.net/releases/sha-x/_app/immutable/bundle.js',
        '',
        '',
        'chunk'
    ],
    [
        'Access to script blocked by CORS policy',
        '',
        'https://static.damoang.net/releases/sha-x/_app/immutable/x.js',
        'chunk'
    ],
    ['net::ERR_FAILED', OURS, '', 'chunk'],
    // ── 판정 대상이 아닌 것 (오탐 방지)
    ['HierarchyRequestError: Node cannot be inserted', THIRD, '', null],
    ['blocked by CORS policy', THIRD, 'https://pagead2.googlesyndication.com/x.js', null],
    ["Cannot read properties of undefined (reading 'foo')", OURS, '', null],
    ['ResizeObserver loop completed with undelivered notifications', OURS, '', null],
    ['', '', '', null],
    [null, '', '', null]
];

let fail = 0;
for (const [msg, stack, src, want] of cases) {
    const got = classify(msg, stack, src);
    const ok = got === want;
    if (!ok) fail++;
    console.log(
        `${ok ? 'PASS' : 'FAIL'} want=${String(want)} got=${String(got)} :: ${String(msg).slice(0, 62)}`
    );
}
console.log(fail ? `FAIL ${fail}/${cases.length}건` : `PASS ${cases.length}건 모두`);
process.exit(fail ? 1 : 0);
