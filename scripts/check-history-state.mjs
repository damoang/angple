#!/usr/bin/env node
/**
 * 히스토리 state 파괴 검사 — 뒤로가기를 조용히 망가뜨리는 두 패턴을 막는다.
 *
 * 왜 필요한가 (2026-08-02 실측, bug/13209·12860·9391·12286·9074):
 *   `hooks.client.ts` 의 모듈 최상위는 SvelteKit 라우터(`start()`)보다 **먼저** 실행된다.
 *   거기서 `$app/navigation` 의 `replaceState()` 를 부르면, 그 함수가 히스토리 state 에
 *   함께 적는 `sveltekit:pageurl` 값이 아직 자리표시자인 `page.url` —
 *   즉 SvelteKit 이 박아 둔 `new URL('https://example.com')` — 로 저장된다.
 *   나중에 그 항목으로 뒤로가기하면 popstate 핸들러가 그 값을 목적지로 삼아
 *   **example.com 으로 실제 이동**한다.
 *
 *   피해: 5개월간 4명 이상이 같은 증상을 제보했다. 게다가 같은 호출이 아직 없는 루트
 *   컴포넌트를 건드려 예외를 던지면서 `kit.start()` 자체가 안 돌아, 복구 리로드를 탄
 *   세션(일 215건)은 하이드레이션이 통째로 죽은 페이지를 받고 있었다.
 *
 *   ⛔ 2026-04-05 에 한 번 "고쳤다"고 닫았다. 그때는 넘기는 **URL 인자**를 상대→절대로
 *   바꿨는데, SvelteKit 은 그 인자를 `document.baseURI` 기준으로 해석하므로 무효였다.
 *   오염원은 인자가 아니라 **함께 저장되는 state** 다. 사람 눈으로는 또 놓친다. 그래서 가드다.
 *
 * 검사 2종
 *   A. 라우터 초기화 전 파일(`hooks.client.ts`)에서 `$app/navigation` 의
 *      `pushState`/`replaceState` import 금지
 *   B. `history.replaceState(` 의 1번 인자가 `{}` 또는 `null` 인 것 금지 —
 *      기존 항목의 SvelteKit 히스토리 인덱스를 지워 뒤로가기가 정상 경로를 못 탄다.
 *      `history.state` 를 그대로 넘기거나 전개해야 한다.
 *
 * 한계 (정직하게):
 *   - B 는 1번 인자가 **리터럴** `{}`/`null` 인 경우만 잡는다. `const s = {}` 처럼
 *     변수를 거치면 못 잡는다. 실측된 결함 2건이 모두 리터럴이었고, 리터럴만 보면
 *     오탐이 0 이라 이 선을 택했다.
 *   - `history.pushState` 는 검사하지 않는다. 새 항목을 만드는 쪽이라 SvelteKit 키가
 *     없어도 popstate 가 무인덱스 분기로 정상 처리한다(모달 패턴이 의도적으로 쓴다).
 */
import { readFileSync, globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** 라우터 초기화 전에 평가되는 파일 — $app/navigation 의 얕은 라우팅 API 금지 */
const PRE_ROUTER_FILES = ['apps/web/src/hooks.client.ts'];

const SCAN_GLOBS = [
    'apps/web/src/**/*.{ts,svelte}',
    'plugins/**/*.{ts,svelte}',
    'widgets/**/*.{ts,svelte}',
    'themes/**/*.{ts,svelte}',
    'packages/*/src/**/*.{ts,svelte}'
];

let violations = 0;
const report = (file, line, msg, hint) => {
    violations++;
    console.error(`❌ ${file}:${line}\n   ${msg}\n   → ${hint}`);
};

// ── A. 라우터 초기화 전 파일에서 $app/navigation 의 pushState/replaceState import ──
let checkedPreRouter = 0;
for (const rel of PRE_ROUTER_FILES) {
    let src;
    try {
        src = readFileSync(ROOT + rel, 'utf-8');
    } catch {
        console.error(`❌ ${rel}: 읽지 못했습니다. 경로가 바뀌었다면 이 스크립트도 고쳐야 합니다.`);
        process.exit(2);
    }
    checkedPreRouter++;
    src.split('\n').forEach((text, i) => {
        if (!text.includes('$app/navigation')) return;
        const m = text.match(/import\s*\{([^}]*)\}\s*from\s*['"]\$app\/navigation['"]/);
        if (!m) return;
        const named = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim());
        const bad = named.filter((n) => n === 'pushState' || n === 'replaceState');
        if (bad.length) {
            report(
                rel,
                i + 1,
                `이 파일은 SvelteKit 라우터보다 먼저 실행되는데 ${bad.join('/')} 를 import 합니다.`,
                '네이티브 history.replaceState(history.state, "", url) 를 쓰세요. ' +
                    '$app/navigation 판은 히스토리에 자리표시자 page.url(https://example.com)을 저장합니다.'
            );
        }
    });
}

// ── B. history.replaceState 의 1번 인자가 {} 또는 null ──
let files = [];
for (const g of SCAN_GLOBS) {
    try {
        files.push(...globSync(g, { cwd: ROOT }));
    } catch {
        /* 없는 디렉터리는 건너뛴다 */
    }
}
files = [...new Set(files)];

let scanned = 0;
// `history.` 와 `window.history.`(globalThis/self 포함) 를 모두 잡되, `myHistory.` 같은
// 다른 식별자는 제외한다. ⛔ 초안이 `[^.\w]` 만 써서 `window.history.` 를 통째로 놓쳤고,
// 수정 전 코드를 대조군으로 돌려보고서야 드러났다. 가드는 반드시 대조군으로 검증할 것.
const DESTRUCTIVE =
    /(?:^|[^.\w])(?:(?:window|globalThis|self)\s*\.\s*)?history\s*\.\s*replaceState\s*\(\s*(\{\s*\}|null)\s*,/;

for (const rel of files) {
    let src;
    try {
        src = readFileSync(ROOT + rel, 'utf-8');
    } catch {
        continue;
    }
    scanned++;
    src.split('\n').forEach((text, i) => {
        if (text.trimStart().startsWith('*') || text.trimStart().startsWith('//')) return;
        const m = text.match(DESTRUCTIVE);
        if (!m) return;
        report(
            rel,
            i + 1,
            `history.replaceState 의 1번 인자가 ${m[1]} 입니다 — 그 항목의 SvelteKit 히스토리 인덱스가 지워집니다.`,
            'history.state 를 그대로 넘기거나 { ...history.state, ... } 로 전개하세요.'
        );
    });
}

// 검사 대상이 하나도 없으면 글롭이 어긋났다는 뜻이다. 통과로 위장하면 안 된다.
if (checkedPreRouter === 0 || scanned === 0) {
    console.error(
        `❌ 검사한 파일이 없습니다 (pre-router ${checkedPreRouter}, scan ${scanned}). 경로·글롭을 확인하세요.`
    );
    process.exit(2);
}
if (violations > 0) {
    console.error(`\n❌ 히스토리 state 파괴 ${violations}건. 배포되면 뒤로가기가 깨집니다.`);
    process.exit(1);
}
console.log(`✅ 히스토리 state 검사 통과 (pre-router ${checkedPreRouter}개, 스캔 ${scanned}개 파일)`);
