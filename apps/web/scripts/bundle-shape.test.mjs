import {
    parseImports,
    resolveSpec,
    closure,
    summarize,
    shapeFails,
    formatReport
} from './bundle-shape.mjs';

let pass = 0;
let fail = 0;
const fails = [];

function eq(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        pass++;
    } else {
        fail++;
        fails.push(`${name}\n      기대 ${e}\n      실제 ${a}`);
    }
}

// ── parseImports ────────────────────────────────────────────────
// ⛔ 순서는 계약이 아니다 — 폐쇄 계산은 집합으로 쓴다. 정렬해 비교한다.
const imports = (src) => parseImports(src).sort();
eq('정적 import 를 뽑는다 (압축형: from 앞 공백 없음)', imports('import{a}from"../chunks/x.js";\nimport"./y.js";'), [
    '../chunks/x.js',
    './y.js'
]);
eq('re-export 도 의존이다', imports('export{z}from"../chunks/z.js";'), ['../chunks/z.js']);
eq('압축형 여러 개를 다 집는다', imports('import{a}from"./a.js";import*as b from"./b.js";export{c}from"./c.js";'), ['./a.js', './b.js', './c.js']);
eq('여러 줄·공백 허용', imports('import {\n a\n} from  "../a.js" ;'), ['../a.js']);
// ⛔ 동적 import 는 「그 라우트를 열려면 필요한 파일」이 아니다. 세면 과대평가가 된다.
eq('동적 import() 는 세지 않는다', imports('const p=import("../chunks/lazy.js");'), []);
eq('import.meta 에 속지 않는다', imports('const u=import.meta.url;'), []);
eq('문자열 안의 import 단어에 속지 않는다', imports('const s="import x from \\"a\\"";'), []);
eq('빈 소스', imports(''), []);

// ── resolveSpec ─────────────────────────────────────────────────
eq('상위로 올라간다', resolveSpec('entry/app.js', '../chunks/a.js'), 'chunks/a.js');
eq('같은 폴더', resolveSpec('nodes/2.js', './3.js'), 'nodes/3.js');
eq('두 단계', resolveSpec('a/b/c.js', '../../d.js'), 'd.js');
eq('외부 모듈은 무시', resolveSpec('entry/app.js', 'svelte'), null);
eq('절대 URL 도 무시', resolveSpec('entry/app.js', 'https://x/y.js'), null);

// ── closure ─────────────────────────────────────────────────────
const g = {
    'nodes/2.js': ['chunks/a.js', 'chunks/b.js'],
    'chunks/a.js': ['chunks/c.js'],
    'chunks/b.js': [],
    'chunks/c.js': [],
    'nodes/3.js': ['chunks/a.js']
};
eq('전이 폐쇄(자기 포함)', closure(g, 'nodes/2.js').size, 4);
eq('가지가 적은 라우트', closure(g, 'nodes/3.js').size, 3);
eq('의존 없는 파일은 1', closure(g, 'chunks/b.js').size, 1);
// ⛔ 순환이 있어도 멈춰야 한다 — 안 막으면 CI 가 영원히 돈다.
const cyc = { 'a.js': ['b.js'], 'b.js': ['a.js'] };
eq('순환에서 멈춘다', closure(cyc, 'a.js').size, 2);
eq('그래프에 없는 입구', closure(g, 'nodes/99.js').size, 1);

// ── summarize ───────────────────────────────────────────────────
const per = [
    { route: 'r1', files: 3 },
    { route: 'r2', files: 33 },
    { route: 'r3', files: 214 },
    { route: 'r4', files: 33 }
];
const s = summarize(per);
eq('라우트 수', s.routes, 4);
eq('최소', s.min, 3);
eq('중위(짝수 개는 평균)', s.median, 33);
eq('최대', s.max, 214);
eq('평균', s.mean, 70.8);
eq('가장 무거운 라우트가 먼저', s.top[0].route, 'r3');
eq('빈 입력', summarize([]), { routes: 0, min: 0, median: 0, mean: 0, max: 0, top: [] });
eq('홀수 개 중위', summarize([{ route: 'a', files: 1 }, { route: 'b', files: 5 }, { route: 'c', files: 9 }]).median, 5);

// ── shapeFails ──────────────────────────────────────────────────
// ⛔ 측정기가 아무것도 못 읽었는데 「통과」로 읽히면 가드가 죽은 것이다.
eq('라우트 0개는 실패로 본다', shapeFails(summarize([]), { maxFiles: 8 }), [
    '라우트를 하나도 찾지 못했다 — 측정기가 산출물을 못 읽었다'
]);
eq('3차 실패 형상은 걸러진다 (최대·중위 둘 다)', shapeFails(s, { maxFiles: 8, medianFiles: 5 }), [
    '최대 214개 > 임계 8 (r3)',
    '중위 33개 > 임계 5'
]);
eq('목표 형상은 통과', shapeFails(summarize([{ route: 'r', files: 5 }]), { maxFiles: 8, medianFiles: 5 }), []);
// ⭐ 중위만 보면 괴물 라우트가 숨는다 — 그걸 시험으로 고정한다.
const hidden = summarize([
    { route: 'ok1', files: 2 },
    { route: 'ok2', files: 2 },
    { route: 'ok3', files: 2 },
    { route: 'monster', files: 214 }
]);
eq('중위는 통과해도 최대로 잡는다', shapeFails(hidden, { maxFiles: 8, medianFiles: 5 }), [
    '최대 214개 > 임계 8 (monster)'
]);
eq('임계를 안 주면 판정하지 않는다', shapeFails(s, {}), []);

// ── formatReport ────────────────────────────────────────────────
const rep = formatReport(summarize([{ route: 'x', files: 7 }]), 'single');
eq('보고에 모드가 들어간다', rep.includes('모드: single'), true);
eq('보고에 중위가 들어간다', rep.includes('중위 7'), true);

console.log(`\n  통과 ${pass} · 실패 ${fail}`);
for (const f of fails) console.log('  🔴 ' + f);
process.exitCode = fail ? 1 : 0;
