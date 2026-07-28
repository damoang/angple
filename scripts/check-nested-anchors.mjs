#!/usr/bin/env node
/**
 * 중첩 <a> 검사 — 하이드레이션을 통째로 깨뜨리는 결함을 막는다.
 *
 * 왜 필요한가 (2026-07-28 실측):
 *   게시판 목록 행이 <a class="post-row"> 로 감싸여 있는데, 그 안에 댓글수 링크가
 *   또 <a> 로 들어 있었다(#1040 도입). HTML5 파서는 <a> 안의 <a> 를 만나면 adoption
 *   agency algorithm 을 실행해 바깥 <a> 를 복제하고 가장 가까운 블록의 자식들을 그
 *   복제본으로 옮긴다. SSR 이 찍은 하이드레이션 마커가 클라이언트가 기대하는 부모와
 *   달라지고, 하이드레이션이 실패한다.
 *
 *   피해: 시간당 로그인 회원 약 1,700명. 화면 깜빡임, 글쓰기 버튼 안 보임, 로그인 상태
 *   잘못 표시. 엔진별로 에러 문구만 다를 뿐 같은 결함이었다.
 *   무엇보다 **관측되지 않았다** — 후킹 채널이 틀려 14일간 0건으로 보였고 제보로만 알았다.
 *
 * ⛔ 정규식으로 세지 않는다. Svelte 의 {#if}/{#each} 분기를 넘나드는 태그를 선형
 *    스캔으로 세면 depth 가 어긋나 오탐이 쏟아진다(초안이 실제로 61건 오탐).
 *    svelte/compiler 의 parse() AST 를 쓴다 — 분기 구조를 정확히 이해한다.
 *
 * 한계 (정직하게):
 *   컴포넌트 경계를 넘는 중첩(부모가 <a> 로 감싸고 자식 컴포넌트가 <a> 를 렌더)은
 *   못 잡는다. 그건 SSR 산출물 검사로만 가능하고 별도 과제다.
 *
 * 종료코드: 위반 1건 이상이면 1
 */
import { readFileSync, globSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// pnpm 워크스페이스라 svelte 는 저장소 루트가 아니라 apps/web/node_modules 에 있다.
// 루트에서 `import 'svelte/compiler'` 하면 ERR_MODULE_NOT_FOUND 로 죽는다(실제로 CI 에서 겪음).
// apps/web 기준으로 해석한 뒤 그 경로를 직접 import 한다.
const req = createRequire(new URL('../apps/web/package.json', import.meta.url));
const mod = await import(pathToFileURL(req.resolve('svelte/compiler')).href);
// svelte/compiler 는 CJS 로 해석되어 default 아래에 실린다. 둘 다 대비한다.
const parse = mod.parse ?? mod.default?.parse;

// ⛔ 여기서 조용히 넘어가면 안 된다. parse 를 못 얻은 채 통과시키면 "검사했는데 0건"
//    처럼 보여서, 실제 결함이 있어도 CI 가 초록으로 지나간다. 실제로 초안이 그랬다.
if (typeof parse !== 'function') {
    console.error('❌ svelte/compiler 의 parse 를 얻지 못했습니다 — 검사를 수행할 수 없습니다.');
    process.exit(2);
}

// 인자로 파일/글롭을 주면 그것만 검사한다(테스트·부분검사용). 없으면 기본 범위.
const patterns =
    process.argv.length > 2
        ? process.argv.slice(2)
        : ['apps/web/src/**/*.svelte', 'themes/**/*.svelte', 'widgets/**/*.svelte'];
const files = patterns.flatMap((p) =>
    p.includes('*') ? globSync(p, { exclude: (x) => x.includes('node_modules') }) : [p]
);

let violations = 0;
let scanned = 0;
let parseFailed = 0;

/** AST 를 훑으며 <a> 조상 아래의 <a> 를 찾는다. */
function walk(node, file, src, insideAnchor) {
    if (!node || typeof node !== 'object') return;

    const isAnchor = node.type === 'RegularElement' && node.name === 'a';

    if (isAnchor && insideAnchor) {
        const line = src.slice(0, node.start).split('\n').length;
        const ctx = src.slice(node.start, node.start + 70).replace(/\s+/g, ' ').trim();
        console.error(
            `${file}:${line}  <a> 안에 <a> 가 중첩되어 있습니다.\n` +
                `    ${ctx}...\n` +
                `    → 파서가 트리를 재구성해 하이드레이션이 깨집니다.\n` +
                `    → 안쪽을 <button type="button"> + goto() 로 바꾸세요.`
        );
        violations++;
    }

    const nowInside = insideAnchor || isAnchor;
    for (const key of Object.keys(node)) {
        if (key === 'parent') continue;
        const v = node[key];
        if (Array.isArray(v)) {
            for (const c of v) walk(c, file, src, nowInside);
        } else if (v && typeof v === 'object' && 'type' in v) {
            walk(v, file, src, nowInside);
        }
    }
}

for (const file of files) {
    const src = readFileSync(file, 'utf8');
    let ast;
    try {
        ast = parse(src, { modern: true });
    } catch (e) {
        // 파싱 실패를 조용히 넘기지 않는다. 못 본 파일은 "검사한 것"이 아니다.
        console.error(`⚠️  ${file}: 파싱 실패 — ${String(e).slice(0, 120)}`);
        parseFailed++;
        continue;
    }
    scanned++;
    walk(ast.fragment, file, src, false);
}

// 검사 대상이 하나도 없으면 글롭이 어긋났다는 뜻이다. 통과로 위장하면 안 된다.
if (scanned === 0) {
    console.error(`❌ 검사한 파일이 0개입니다 (대상 ${files.length}개). 경로·글롭을 확인하세요.`);
    process.exit(2);
}
if (parseFailed > 0) {
    console.error(`❌ 파싱 실패 ${parseFailed}건 — 그 파일들은 검사되지 않았습니다.`);
    process.exit(2);
}
if (violations > 0) {
    console.error(`\n❌ 중첩 <a> ${violations}건. 배포되면 하이드레이션이 실패합니다.`);
    process.exit(1);
}
console.log(`✅ 중첩 <a> 검사 통과 (${scanned}개 파일)`);
