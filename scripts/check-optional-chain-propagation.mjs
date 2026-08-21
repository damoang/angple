#!/usr/bin/env node
/**
 * 끊긴 옵셔널 체이닝 검사.
 *
 * 무엇을 잡는가:
 *   nav.from?.url.pathname      ← `?.` 다음에 다시 `.` 이 이어지는데 방어가 없다
 *   data?.user.name
 *   x?.a.b.c
 *
 * 왜 위험한가 (2026-08-21 실측):
 *   `nav.from?.url.pathname` 는 **from 이 null 인 경우만** 막는다.
 *   from 이 있고 from.url 이 null 이면 그대로 터진다.
 *   `?.` 를 쓴 순간 그 사람은 "여긴 null 일 수 있다" 고 판단한 것인데,
 *   **그 뒤를 안 막으면 방어가 한 칸에서 끊긴다.**
 *
 *   실제 피해: 3일간 111명 (/free/write 96명 · /hello/write 15명).
 *   `afterNavigate` 콜백이라 스택이 미니파이 번들의 Set.forEach 안으로만 찍혔고,
 *   브라우저별 문구가 달라 두 개의 별개 오류로 집계됐다:
 *     Chrome  "Cannot read properties of null (reading 'pathname')"
 *     Safari  "null is not an object (evaluating 'm.from?.url.pathname')"
 *   ⭐ 사람 수로 세지 않았으면 상위 목록에 안 올라왔을 것이다.
 *
 * ⚠️ 이 검사는 **타입을 믿지 말라**는 규칙이기도 하다.
 *   SvelteKit 의 NavigationTarget.url 은 타입상 non-nullable 인데 런타임에 null 이었다.
 *   이미 `?.` 를 쓴 자리라면 그 표현식은 이미 "타입을 못 믿는 자리" 다.
 *
 * 무엇을 인정하는가:
 *   - `a?.b?.c`           체인을 계속 이었다
 *   - `a?.b()`            호출은 대상 아님
 *   - `a?.[0]`            인덱스 접근은 대상 아님
 *   - 주석 줄
 *   - `// eslint-disable` 또는 `// oc-ok:` 주석이 같은 줄에 있으면 예외
 *   - baseline 에 등재된 기존 위반
 *
 * ⭐ 왜 baseline(래칫) 인가
 *   규칙을 새로 만들면 기존 위반이 한꺼번에 쏟아진다(도입 시점 52건).
 *   전부 고치면 **회귀 위험이 이득보다 크다** — 실제로 터진 것은 1건뿐이고
 *   나머지는 잠재 위험이다. 그렇다고 규칙을 안 넣으면 새 위반이 계속 들어온다.
 *   그래서 기존분은 동결하고 **신규 유입만 막는다.**
 *
 *   ⛔ baseline 은 늘리지 마라. 줄이는 방향으로만 갱신한다.
 *      파일을 고쳐 위반이 사라지면 `--update-baseline` 로 항목을 걷어낸다.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const BASELINE = 'scripts/optional-chain-baseline.json';
const UPDATE = process.argv.includes('--update-baseline');

const ROOTS = ['apps/web/src', 'packages', 'themes', 'widgets', 'plugins'];
const EXT = /\.(svelte|ts|js)$/;
// ⛔ 테스트는 제외한다 — 단언문에서 `expect(x?.a.b)` 형태가 정상적으로 쓰인다.
const SKIP = /node_modules|\.svelte-kit|dist|build|\.d\.ts$|\.(test|spec)\.(ts|js)$/;

// `?.` 뒤에 식별자, 그 다음 다시 `.식별자` 가 오는데 그 사이에 `?` 가 없는 경우.
// 예: from?.url.pathname   /  data?.a.b
const BROKEN = /\?\.\s*[A-Za-z_$][\w$]*\s*\.\s*[A-Za-z_$][\w$]*/;

function walk(dir, out = []) {
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const e of entries) {
        const p = join(dir, e);
        if (SKIP.test(p)) continue;
        let st;
        try {
            st = statSync(p);
        } catch {
            continue;
        }
        if (st.isDirectory()) walk(p, out);
        else if (EXT.test(p)) out.push(p);
    }
    return out;
}

const files = ROOTS.flatMap((r) => walk(r));

// baseline 은 `파일:표현식` 으로 기록한다. **줄 번호는 넣지 않는다** —
// 위아래에 한 줄만 추가돼도 전부 어긋나 baseline 이 무의미해진다.
const baseline = new Set(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : []);

const found = [];
let violations = 0;

for (const file of files) {
    const rel = relative(process.cwd(), file);
    const lines = readFileSync(file, 'utf8').split('\n');

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        // 주석은 검사 대상이 아니다 — 이 규칙 자체를 설명하는 주석에 예시가 들어간다.
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        // 명시적 예외 표기
        if (line.includes('oc-ok:') || line.includes('eslint-disable')) return;

        const m = line.match(BROKEN);
        if (!m) return;

        const key = `${rel}::${m[0].replace(/\s+/g, '')}`;
        found.push(key);
        if (baseline.has(key)) return; // 기존 부채 — 동결됨

        violations++;
        console.error(
            `${rel}:${i + 1}  옵셔널 체이닝이 한 칸에서 끊겼다 — "${m[0]}"\n` +
                `    ${trimmed.slice(0, 110)}`
        );
    });
}

if (UPDATE) {
    const uniq = [...new Set(found)].sort();
    writeFileSync(BASELINE, JSON.stringify(uniq, null, 1) + '\n');
    console.log(`baseline 갱신: ${uniq.length}건`);
    process.exit(0);
}

// ⭐ 고쳐서 사라진 항목은 baseline 에서 걷어내라고 알린다. 안 그러면 부채가 안 줄어든다.
const stale = [...baseline].filter((k) => !found.includes(k));
if (stale.length) {
    console.log(
        `ℹ️ baseline 에 있는데 코드에는 없는 항목 ${stale.length}건 — ` +
            `\`node ${BASELINE.replace('optional-chain-baseline.json', 'check-optional-chain-propagation.mjs')} --update-baseline\` 로 정리할 것`
    );
}

if (violations > 0) {
    console.error(
        `\n⛔ 끊긴 옵셔널 체이닝 ${violations}건. (baseline 등재분 ${baseline.size}건 제외)\n` +
            `   \`a?.b.c\` 는 a 가 null 인 경우만 막는다. a.b 가 null 이면 그대로 터진다.\n` +
            `   \`?.\` 를 쓴 자리는 이미 "타입을 못 믿는 자리" 다 — 뒤까지 이어라: \`a?.b?.c\`\n` +
            `   의도적으로 끊는 경우에만 같은 줄에 \`// oc-ok: 이유\` 를 남길 것.\n`
    );
    process.exit(1);
}

console.log(
    `✅ 새로 들어온 끊긴 옵셔널 체이닝 없음 ` +
        `(${files.length}개 파일 · baseline 동결 ${baseline.size}건)`
);
