#!/usr/bin/env node
/**
 * canary-shell-verdict 자체 단언 — vitest 는 `src/**` 만 보므로 순수 node 로 돈다.
 * ⛔ 이 파일이 실패하면 카나리 검사가 **bug/14049 형태(스타일 덜 먹은 화면)를 놓치는 상태**다.
 *   node apps/web/scripts/canary-shell-verdict.test.mjs
 */
import { shellFails } from './canary-shell-verdict.mjs';

const OK = { header: true, appRoot: true, postLinks: 28, proseLen: 500, cssLinks: 1, cssLoaded: 1 };
const cases = [
    ['정상 /free', '/free', OK, 0, null],
    ['정상 글상세', '/free/123', OK, 0, null],
    ['header 없음', '/', { ...OK, header: false }, 1, 'header'],
    ['#app-root 없음', '/', { ...OK, appRoot: false }, 1, 'app-root'],
    ['/free 목록 부족', '/free', { ...OK, postLinks: 3 }, 1, '목록 링크'],
    ['/ 는 목록 수를 보지 않는다', '/', { ...OK, postLinks: 0 }, 0, null],
    ['글상세 본문 짧음', '/free/9', { ...OK, proseLen: 5 }, 1, '본문'],
    ['/free 는 본문을 보지 않는다', '/free', { ...OK, proseLen: 0 }, 0, null],

    // ⭐ CSS 축 — bug/14049 를 잡는 자리
    [
        'CSS 일부 미적용(split 34개 중 4개 실패)',
        '/free',
        { ...OK, cssLinks: 34, cssLoaded: 30 },
        1,
        'CSS 미적용 4/34'
    ],
    ['CSS 단 1개가 실패', '/free', { ...OK, cssLinks: 1, cssLoaded: 0 }, 1, 'CSS 미적용 1/1'],
    ['CSS 전부 적용', '/free', { ...OK, cssLinks: 34, cssLoaded: 34 }, 0, null],
    // ⛔ 오탐 방지 — 판정하지 않는 경우
    ['styleSheets 접근 불가(-1)', '/free', { ...OK, cssLinks: 34, cssLoaded: -1 }, 0, null],
    ['우리 CSS 링크 0개', '/free', { ...OK, cssLinks: 0, cssLoaded: 0 }, 0, null],
    ['loaded 가 links 보다 많음(중복 등)', '/free', { ...OK, cssLinks: 2, cssLoaded: 3 }, 0, null],

    // ⛔ 잘못된 입력으로 죽지 않는다
    ['evalError', '/free', { evalError: 'boom' }, 1, '셸 프로브 실패'],
    ['sh 없음', '/free', null, 1, '결과 없음'],
    ['필드 누락', '/free', { header: true, appRoot: true }, 1, '목록 링크']
];

let fail = 0;
for (const [name, path, sh, wantN, wantSub] of cases) {
    let got;
    try {
        got = shellFails(path, sh);
    } catch (e) {
        got = [`THREW: ${e.message}`];
    }
    const nOk = got.length === wantN;
    const sOk = !wantSub || got.some((x) => x.includes(wantSub));
    const ok = nOk && sOk;
    if (!ok) fail++;
    console.log(
        `${ok ? 'PASS' : 'FAIL'} ${name.padEnd(34)} 실패 ${got.length}건(기대 ${wantN})` +
            (got.length ? ` :: ${got.join(' / ').slice(0, 60)}` : '')
    );
}
console.log(fail ? `FAIL ${fail}/${cases.length}건` : `PASS ${cases.length}건 모두`);
process.exit(fail ? 1 : 0);
