#!/usr/bin/env node
/**
 * canary-shell-verdict 자체 단언 — vitest 는 `src/**` 만 보므로 순수 node 로 돈다.
 * ⛔ 이 파일이 실패하면 카나리 검사가 **bug/14049 형태(스타일 덜 먹은 화면)를 놓치는 상태**다.
 *   node apps/web/scripts/canary-shell-verdict.test.mjs
 */
import { pickCheckablePostId, shellFails } from './canary-shell-verdict.mjs';

const OK = { header: true, appRoot: true, postLinks: 28, proseLen: 500, cssLinks: 1, cssLoaded: 1 };
const cases = [
    ['정상 /free', '/free', OK, 0, null],
    ['정상 글상세', '/free/123', OK, 0, null],
    ['header 없음', '/', { ...OK, header: false }, 1, 'header'],
    ['#app-root 없음', '/', { ...OK, appRoot: false }, 1, 'app-root'],
    ['/free 목록 부족', '/free', { ...OK, postLinks: 3 }, 1, '목록 링크'],
    ['/ 는 목록 수를 보지 않는다', '/', { ...OK, postLinks: 0 }, 0, null],
    // ⛔ 짧은 글 오탐 방지 — 최근 글이 19자짜리 한 줄 글이라 verify-canary 가 실패한 적이 있다.
    ['짧은 글: 5자 + 미디어 0 은 정상', '/free/9', { ...OK, proseLen: 5, proseMedia: 0 }, 0, null],
    ['짧은 글: 1자 + 미디어 0 은 정상', '/free/9', { ...OK, proseLen: 1, proseMedia: 0 }, 0, null],
    // ⛔ 사진 글 오탐 방지 — 2026-10-01 verify-canary 가 4자짜리 이미지 글에서 두 번 실패했다.
    ['사진 글: 4자 + 이미지 1장은 정상', '/free/9', { ...OK, proseLen: 4, proseMedia: 1 }, 0, null],
    ['사진 글: 0자 + 이미지 3장은 정상', '/free/9', { ...OK, proseLen: 0, proseMedia: 3 }, 0, null],
    ['빈 본문: 0자 + 미디어 0', '/free/9', { ...OK, proseLen: 0, proseMedia: 0 }, 1, '본문'],
    ['proseMedia 필드 없음(구 프로브): 0자면 실패', '/free/9', { ...OK, proseLen: 0 }, 1, '본문'],
    [
        'proseMedia 필드 없음(구 프로브): 글자가 있으면 정상',
        '/free/9',
        { ...OK, proseLen: 3 },
        0,
        null
    ],
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
// 본문 검사에 쓸 글 고르기 — 삭제·비밀글 등은 본문이 의도적으로 비어 보이므로 건너뛴다.
const pickCases = [
    ['맨 위가 일반 글이면 그 글', [{ id: 10 }, { id: 9 }], 10],
    ['삭제된 글은 건너뛴다', [{ id: 10, deleted_at: '2026-10-02' }, { id: 9 }], 9],
    ['비밀글은 건너뛴다', [{ id: 10, is_secret: true }, { id: 9 }], 9],
    [
        '블러·성인 글은 건너뛴다',
        [{ id: 10, is_blur: true }, { id: 9, is_adult: true }, { id: 8 }],
        8
    ],
    ['표식 필드가 없는 응답은 맨 위 글', [{ id: 7, title: 't' }], 7],
    ['전부 건너뛸 글이면 null', [{ id: 10, is_secret: true }], null],
    ['id 없는 항목은 건너뛴다', [{ title: 'x' }, { id: 5 }], 5],
    ['배열이 아니면 null', undefined, null],
    ['빈 배열이면 null', [], null]
];
for (const [name, posts, want] of pickCases) {
    let got;
    try {
        got = pickCheckablePostId(posts);
    } catch (e) {
        got = `THREW: ${e.message}`;
    }
    const ok = got === want;
    if (!ok) fail++;
    console.log(`${ok ? 'PASS' : 'FAIL'} 글 고르기: ${name.padEnd(26)} → ${got} (기대 ${want})`);
}
const total = cases.length + pickCases.length;
console.log(fail ? `FAIL ${fail}/${total}건` : `PASS ${total}건 모두`);
process.exit(fail ? 1 : 0);
