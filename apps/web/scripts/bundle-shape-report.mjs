#!/usr/bin/env node
/**
 * 빌드 산출물을 걸어 「라우트당 JS 파일 수」를 보고한다. CI 전용 — 운영 동작과 무관하다.
 *
 * 사용:
 *   node bundle-shape-report.mjs [산출물경로] [--max N] [--median N]
 *   기본 경로: .svelte-kit/output/client/_app/immutable
 *
 * ## ⛔ 재는 것은 **JS 정적 import 폐쇄**다
 *
 * 9/30 에 보고한 「라우트당 중위 33개·최대 214개」는 `__vite__mapDeps` 기준이고 **CSS 가 섞여**
 * 있었다. 이 도구는 JS 만 센다. 두 숫자를 직접 비교하지 마라 — 그래서 Sprint 1 에서
 * **같은 도구로 기준선을 다시 뜬다.** 비교는 이 도구끼리만 한다.
 *
 * ⛔ `single` 모드에는 `nodes/` 가 없다. 그때는 번들 자체가 모든 라우트의 입구이므로
 *    라우트 1개로 보고한다 — 「측정 실패」와 구분되게 모드를 함께 찍는다.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
    closure,
    formatReport,
    parseImports,
    resolveSpec,
    shapeFails,
    summarize
} from './bundle-shape.mjs';

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith('--')) || '.svelte-kit/output/client/_app/immutable';
const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] != null ? Number(args[i + 1]) : null;
};
const limits = { maxFiles: flag('max'), medianFiles: flag('median') };

if (!existsSync(root)) {
    console.error(`🔴 산출물 경로가 없다: ${root}`);
    process.exit(2);
}

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

const files = walk(root);
const js = files
    .filter((f) => f.endsWith('.js'))
    .map((f) => relative(root, f).split('\\').join('/'));
const css = files.filter((f) => f.endsWith('.css'));

const graph = {};
for (const f of js) {
    const src = readFileSync(join(root, f), 'utf8');
    graph[f] = parseImports(src)
        .map((spec) => resolveSpec(f, spec))
        .filter((p) => !!p);
}
// ⛔ 산출물에 없는 경로(동적으로만 쓰이거나 외부)는 그래프에서 뺀다 — 폐쇄가 부풀지 않게.
const known = new Set(js);
for (const f of js) graph[f] = graph[f].filter((p) => known.has(p));

const nodes = js.filter((f) => /^nodes\/[^/]+\.js$/.test(f));
let mode;
let perRoute;
if (nodes.length) {
    mode = `split (nodes ${nodes.length}개)`;
    perRoute = nodes.map((n) => ({ route: n, files: closure(graph, n).size }));
} else {
    // single — 번들 하나가 모든 라우트의 입구다
    const entries = js.filter((f) => /^bundle\.[^/]+\.js$/.test(f));
    mode = `single (bundle ${entries.length}개)`;
    perRoute = entries.map((e) => ({ route: e, files: closure(graph, e).size }));
}

const summary = summarize(perRoute);
console.log(`\n${formatReport(summary, mode)}`);
console.log(`\nJS 파일 총 ${js.length}개 · CSS 파일 총 ${css.length}개`);
console.log('⛔ 이 수치는 JS 정적 import 폐쇄다. 9/30 의 mapDeps 기준(CSS 포함)과 직접 비교하지 마라.');

const problems = shapeFails(summary, limits);
if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [
        '### 번들 형상',
        '',
        '```',
        formatReport(summary, mode),
        `JS ${js.length}개 · CSS ${css.length}개`,
        '```'
    ];
    if (problems.length) md.push('', '🔴 ' + problems.join(' · '));
    try {
        const { appendFileSync } = await import('node:fs');
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n');
    } catch {
        /* 요약 못 쓰는 건 판정과 무관하다 */
    }
}

if (problems.length) {
    console.error('\n🔴 형상 임계 초과');
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
}
console.log(
    limits.maxFiles == null && limits.medianFiles == null
        ? '\n(임계 미지정 — 측정만 하고 판정하지 않는다)'
        : '\n✅ 형상 임계 통과'
);
