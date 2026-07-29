#!/usr/bin/env node
/**
 * 맞붙은 분기 블록 검사 — 하이드레이션 연쇄 붕괴를 막는다.
 *
 * 무엇을 잡는가:
 *   {#if a}…{/if}{#if b}…{/if}   ← 사이에 아무 노드도 없이 맞붙은 분기 블록
 *
 * 왜 위험한가 (2026-07-29 실측):
 *   {#if} 는 SSR HTML 에 <!--[--> … <!--]--> 마커를 남긴다. 분기를 나란히 이어 쓰면
 *   마커가 <!--]--><!--[--> 로 맞닿는다. 하이드레이션은 이 마커를 읽어 "SSR 이 어느
 *   분기를 골랐는지"를 판정하는데, 앞쪽 노드가 하나라도 바뀌면 앵커가 이웃 마커를
 *   읽어 판정이 어긋난다. 그러면 skip_nodes() 가 종료 마커를 찾아 형제 노드를 지우며
 *   전진하는데, 이미 어긋난 뒤라 목록 끝을 넘어가 null 을 참조하고 죽는다.
 *   맞붙은 분기가 N개면 하나가 밀리는 순간 N개가 연쇄로 밀린다.
 *
 *   노드를 바꾸는 주체는 대개 번역이다 — 확장(DeepL 등)이든 브라우저 내장 번역이든
 *   텍스트 노드를 감싸는 순간 같은 일이 벌어진다. 회사 정보·주소처럼 번역기가 가장
 *   먼저 건드리는 텍스트일수록 취약하다.
 *
 *   실제 피해: 푸터(모든 페이지에 있다)에 맞붙은 분기가 5쌍 있었고, 하이드레이션
 *   실패 스택이 그 한 지점으로 수렴했다. 12시간당 약 2,000명이 영향을 받았다.
 *
 * 어떻게 고치나:
 *   - 여러 조건을 이어 붙이는 텍스트라면 스크립트에서 문자열로 조립한다
 *     (filter(Boolean).join(' | ')). 분기가 아예 사라진다. ← 대개 이게 정답이다
 *   - 분기가 꼭 필요하면 각 분기의 내용을 <span> 등 요소로 감싼다. 마커가 요소에
 *     붙어 있으면 안쪽 텍스트가 감싸여도 앵커가 흔들리지 않는다.
 *   - 중첩 {#if} 는 {:else if} 사슬로 편다. 중첩은 마커를 겹쳐 쌓아 더 나쁘다.
 *
 * ⛔ 정규식으로 세지 않는다. 분기 구조는 선형 스캔으로 못 센다(선행 가드에서 오탐 61건).
 *    svelte/compiler 의 parse() AST 를 쓴다.
 *
 * 한계 (정직하게):
 *   맞붙지 않았더라도 공백 텍스트 하나만 사이에 둔 분기는 여전히 취약할 수 있다.
 *   여기서는 "사이에 노드가 전혀 없는" 확실한 경우만 잡는다. 오탐 0을 우선한다.
 *
 * 종료코드: 위반 1건 이상이면 1, 검사 자체가 성립하지 않으면 2
 */
import { readFileSync, globSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// pnpm 워크스페이스라 svelte 는 저장소 루트가 아니라 apps/web/node_modules 에 있다.
const req = createRequire(new URL('../apps/web/package.json', import.meta.url));
const mod = await import(pathToFileURL(req.resolve('svelte/compiler')).href);
const parse = mod.parse ?? mod.default?.parse;

// ⛔ 조용히 넘어가면 안 된다. parse 없이 통과시키면 "검사했는데 0건"으로 위장된다.
if (typeof parse !== 'function') {
    console.error('❌ svelte/compiler 의 parse 를 얻지 못했습니다 — 검사를 수행할 수 없습니다.');
    process.exit(2);
}

const patterns =
    process.argv.length > 2
        ? process.argv.slice(2)
        : ['apps/web/src/**/*.svelte', 'themes/**/*.svelte', 'widgets/**/*.svelte'];
const files = patterns.flatMap((p) =>
    p.includes('*') ? globSync(p, { exclude: (x) => x.includes('node_modules') }) : [p]
);

/** SSR 에 하이드레이션 마커를 남기는 블록들 */
const BLOCK = new Set(['IfBlock', 'EachBlock', 'AwaitBlock', 'KeyBlock']);

let violations = 0;
let scanned = 0;
let parseFailed = 0;

function walk(node, file, src) {
    if (!node || typeof node !== 'object') return;

    const kids = node.nodes ?? node.children;
    if (Array.isArray(kids)) {
        for (let i = 0; i + 1 < kids.length; i++) {
            const a = kids[i];
            const b = kids[i + 1];
            if (!BLOCK.has(a?.type) || !BLOCK.has(b?.type)) continue;

            const line = src.slice(0, a.start).split('\n').length;
            const ctx = src
                .slice(a.start, b.end)
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 90);
            console.error(
                `${file}:${line}  분기 블록이 사이에 아무것도 없이 맞붙어 있습니다.\n` +
                    `    ${ctx}...\n` +
                    `    → SSR 마커가 <!--]--><!--[--> 로 맞닿아, 앞이 한 번 흔들리면 뒤가 연쇄로 밀립니다.\n` +
                    `    → 문자열로 조립하거나(filter(Boolean).join), 각 분기를 요소로 감싸세요.`
            );
            violations++;
        }
    }

    for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const v = node[key];
        if (Array.isArray(v)) {
            for (const c of v) walk(c, file, src);
        } else if (v && typeof v === 'object' && 'type' in v) {
            walk(v, file, src);
        }
    }
}

for (const file of files) {
    const src = readFileSync(file, 'utf8');
    let ast;
    try {
        ast = parse(src, { modern: true });
    } catch (e) {
        console.error(`⚠️  ${file}: 파싱 실패 — ${String(e).slice(0, 120)}`);
        parseFailed++;
        continue;
    }
    scanned++;
    walk(ast.fragment, file, src);
}

// 검사 대상이 0개면 글롭이 어긋난 것이다. 통과로 위장하지 않는다.
if (scanned === 0) {
    console.error(`❌ 검사한 파일이 0개입니다 (대상 ${files.length}개). 경로·글롭을 확인하세요.`);
    process.exit(2);
}
if (parseFailed > 0) {
    console.error(`❌ 파싱 실패 ${parseFailed}건 — 그 파일들은 검사되지 않았습니다.`);
    process.exit(2);
}
if (violations > 0) {
    console.error(`\n❌ 맞붙은 분기 블록 ${violations}건. 배포되면 하이드레이션이 연쇄로 깨집니다.`);
    process.exit(1);
}
console.log(`✅ 맞붙은 분기 블록 검사 통과 (${scanned}개 파일)`);
