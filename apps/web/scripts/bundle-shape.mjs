/**
 * 빌드 산출물의 「라우트당 필요한 파일 수」를 센다.
 *
 * ## ⛔ 왜 이 장치가 먼저인가
 *
 * 코드 분할을 세 번 시도해 세 번 운영 사고를 냈다(2026-06 · #2303 · 9/30). 3차의 원인은
 * **라우트당 의존 파일이 중위 33개·최대 214개**여서 파일당 실패확률이 그만큼 곱해진 것이었다.
 * 그런데 그 수치를 **카나리에 올린 뒤에야** 알았다. 이 서버에서는 빌드를 못 하므로
 * 「배포해서 본다」가 유일한 측정 수단이었고, 그게 사고의 구조적 원인이다.
 *
 * ⭐ 그래서 4차는 **CI 에서 빌드 산출물을 재는 것부터** 한다. 배포 없이 숫자가 먼저 나온다.
 *
 * ## ⛔ `__vite__mapDeps` 를 파싱하지 않는 이유
 *
 * `__vite__mapDeps` 는 preload 헬퍼용이고 **분할 모드에서만** 나온다. `single` 에서는 없다.
 * 기준선(single)과 시험(분할)을 **같은 방법으로** 재지 않으면 비교가 성립하지 않는다
 * — 「배포 전후 비교는 대조군 창을 같이 떠라」와 같은 종류의 함정이다.
 *
 * 그래서 **정적 import 그래프의 전이 폐쇄(transitive closure)** 를 센다. 두 모드 모두에서
 * 같은 정의가 성립한다: *그 라우트를 열려면 브라우저가 가져와야 하는 파일 수.*
 */

/**
 * 정적 import·re-export 의 명세자만 뽑는다.
 *
 * ⛔ 압축된 산출물에는 공백이 없다 — `import{a}from"x"` 처럼 `from` 앞이 `}` 다.
 *    처음 만든 판은 `\sfrom` 을 요구해서 **실제 번들에서 의존을 하나도 못 읽었다.**
 *    시험이 그걸 잡았다. 공백을 전제하지 마라.
 * ⛔ 동적 `import()` 는 그 라우트를 열기 위한 「필요」가 아니다 — 세면 과대평가가 된다.
 *    `import(` 앞은 보통 `=`·`(` 라 아래 두 패턴에 걸리지 않는다.
 * ⛔ `[^"';]` 로 절 안에 따옴표·문장 끝이 못 들어오게 막는다. `[\s\S]*?` 로 열어 두면
 *    뒤쪽 문자열까지 건너뛰어 엉뚱한 값을 집는다.
 */
export function parseImports(src) {
    const out = [];
    const BOUND = '(?:^|[;\n}])\\s*';
    // ① import "x"  (부수효과 전용)
    const bare = new RegExp(BOUND + 'import\\s*["\']([^"\']+)["\']', 'g');
    // ② import <절> from "x" · export <절> from "x"
    const withFrom = new RegExp(BOUND + '(?:import|export)\\s*[^"\';]*?from\\s*["\']([^"\']+)["\']', 'g');
    for (const re of [bare, withFrom]) {
        let m;
        while ((m = re.exec(src)) !== null) out.push(m[1]);
    }
    return out;
}

/** `../chunks/a.js` 를 `chunks/a.js` 처럼 루트 기준 경로로 바꾼다. */
export function resolveSpec(fromPath, spec) {
    if (!spec.startsWith('.')) return null; // 외부 모듈 — 산출물 안에 없다
    const base = fromPath.split('/').slice(0, -1);
    const parts = spec.split('/');
    for (const p of parts) {
        if (p === '.' || p === '') continue;
        if (p === '..') base.pop();
        else base.push(p);
    }
    return base.join('/');
}

/**
 * `entry` 에서 도달 가능한 파일 전체(자기 포함).
 * ⛔ 순환 import 가 있어도 멈춰야 한다 — 방문 집합으로 막는다.
 */
export function closure(graph, entry) {
    const seen = new Set();
    const stack = [entry];
    while (stack.length) {
        const cur = stack.pop();
        if (seen.has(cur)) continue;
        seen.add(cur);
        for (const next of graph[cur] || []) {
            if (!seen.has(next)) stack.push(next);
        }
    }
    return seen;
}

function median(xs) {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 라우트별 파일 수 배열 → 요약. ⛔ 최대만 보면 안 되고 중위도 같이 봐야 한다. */
export function summarize(perRoute) {
    const counts = perRoute.map((r) => r.files);
    if (!counts.length) {
        return { routes: 0, min: 0, median: 0, mean: 0, max: 0, top: [] };
    }
    const sum = counts.reduce((a, b) => a + b, 0);
    return {
        routes: counts.length,
        min: Math.min(...counts),
        median: median(counts),
        mean: Math.round((sum / counts.length) * 10) / 10,
        max: Math.max(...counts),
        top: [...perRoute].sort((a, b) => b.files - a.files).slice(0, 5)
    };
}

/**
 * 임계 판정. 넘으면 사유 목록을 돌려준다(비면 통과).
 * ⭐ 중위·최대를 **각각** 본다. 중위만 보면 214 같은 괴물 라우트가 숨는다.
 */
export function shapeFails(summary, limits) {
    const f = [];
    if (!summary.routes) return ['라우트를 하나도 찾지 못했다 — 측정기가 산출물을 못 읽었다'];
    if (limits.maxFiles != null && summary.max > limits.maxFiles) {
        const who = summary.top[0];
        f.push(`최대 ${summary.max}개 > 임계 ${limits.maxFiles} (${who ? who.route : '?'})`);
    }
    if (limits.medianFiles != null && summary.median > limits.medianFiles) {
        f.push(`중위 ${summary.median}개 > 임계 ${limits.medianFiles}`);
    }
    return f;
}

export function formatReport(summary, mode) {
    const lines = [
        `모드: ${mode}`,
        `라우트 ${summary.routes}개 · 라우트당 파일 수 — ` +
            `최소 ${summary.min} · **중위 ${summary.median}** · 평균 ${summary.mean} · **최대 ${summary.max}**`
    ];
    if (summary.top.length) {
        lines.push('', '가장 무거운 라우트:');
        for (const t of summary.top) lines.push(`  ${String(t.files).padStart(4)}개  ${t.route}`);
    }
    return lines.join('\n');
}
