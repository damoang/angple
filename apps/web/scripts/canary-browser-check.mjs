#!/usr/bin/env node
/**
 * 카나리 브라우저 검사 — 서버가 200 을 내도 브라우저 안에서 나는 사고(청크 복구 새로고침 루프 등)를 잡는다.
 *
 * verify-canary 잡이 **GitHub 러너에서** 공개 주소 https://canary.damoang.net 으로 실행한다 — 운영 노드에 헤드리스를
 * 띄우지 않는다(내 도구가 운영을 흔든 선례). 자산(static.damoang.net)은 CORS 대상이라 실제 브라우저·실제 Origin 으로 재야 한다.
 *   node canary-browser-check.mjs <base> [뷰포트W] [뷰포트H] [관찰초] [다운로드kbps] [RTTms]
 * 판정(하나라도 걸리면 exit 1 → 승격 차단):
 *   - 초기 로드 뒤 메인 프레임 재내비게이션 0회 (리로드·리다이렉트 루프 지문)
 *   - 청크 오류 콘솔 메시지 0
 *   - window.__angpleChunkError.getState().stage === 0, pending 없음, 복구 상태줄(#angple-recovery-bar) 없음
 *   - 하이드레이션 완료(window.__angpleHydrateAt) — 25초 안
 * 조건: 모바일 384×780 · CPU 4배 스로틀 · 네트워크 기본 4Mbps/RTT 100ms(일반 4G). 빠른 망에선 재현이 안 된다.
 *   ⛔ Slow 4G(400kbps)는 현재 단일 번들 6MB 가 2분 넘게 걸려 게이트로 못 쓴다 — 코드 분할 뒤 낮춘다.
 * 안전: 브라우저 1개·페이지 순차. 실행 호스트 1분 부하 8 초과면 60초 대기 ×3 후 실패.
 */
import { readFileSync } from 'node:fs';

// playwright 모듈 경로: CI 러너는 PW_MODULE 로 넘긴다(예: /tmp/pw/node_modules/playwright/index.mjs). 없으면 로컬 pnpm 스토어 경로.
const PW =
    process.env.PW_MODULE ||
    '/home/angple/web/node_modules/.pnpm/playwright@1.58.0/node_modules/playwright/index.mjs';
const base = (process.argv[2] || 'https://canary.damoang.net').replace(/\/$/, '');
const W = Number(process.argv[3] || 384),
    H = Number(process.argv[4] || 780);
const OBSERVE_MS = Number(process.argv[5] || 45) * 1000;
const KBPS = Number(process.argv[6] || 4000),
    RTT = Number(process.argv[7] || 100);
const UA =
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 angple-canary-check';
const CHUNK_RE =
    /(failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|chunkloaderror|blocked by CORS policy|net::ERR_|failed to load resource)/i;

function load1() {
    try {
        return Number(readFileSync('/proc/loadavg', 'utf8').split(' ')[0]);
    } catch {
        return 0;
    }
}
for (let i = 0; i < 3 && load1() > 8; i++) {
    console.log(`load1=${load1()} > 8 — 60초 대기 (${i + 1}/3)`);
    await new Promise((r) => setTimeout(r, 60000));
}
if (load1() > 8) {
    console.log(`FAIL: 노드 부하 ${load1()} 로 검사 불가`);
    process.exit(1);
}

const { chromium } = await import(PW);
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent: UA
});
// ⛔ extraHTTPHeaders 로 x-real-ip 를 전역에 붙이면 static.damoang.net 모듈 import 가 비단순 CORS 요청이 되어
//    OPTIONS 준비요청 → R2 가 403 → 「CORS 차단」 오탐(9/29 3/3 FAIL 이 이것). 헤더는 카나리 호스트에만 붙인다.
const baseHost = new URL(base).host;
await ctx.route('**/*', (route) => {
    const req = route.request();
    if (new URL(req.url()).host === baseHost)
        return route.continue({ headers: { ...req.headers(), 'x-real-ip': '127.0.0.1' } });
    return route.continue();
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: RTT,
    downloadThroughput: (KBPS * 1024) / 8,
    uploadThroughput: (KBPS * 1024) / 8
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

async function latestPostPath() {
    try {
        const r = await fetch(`${base}/api/v1/boards/free/posts?page=1&limit=1&summary=1`, {
            headers: { 'x-real-ip': '127.0.0.1', 'user-agent': UA }
        });
        const j = await r.json();
        const id = j?.data?.[0]?.id;
        return id ? `/free/${id}` : null;
    } catch {
        return null;
    }
}
const targets = ['/', '/free', await latestPostPath()].filter(Boolean);

const results = [];
for (const path of targets) {
    const url = `${base}${path}`;
    let navs = 0,
        initialDone = false;
    const consoleErrors = [];
    const navUrls = [];
    // ⛔ framenavigated 는 history.replaceState(같은 문서)에도 발화한다 — 문서 요청만 센다
    const onNav = (req) => {
        if (
            initialDone &&
            req.isNavigationRequest() &&
            req.resourceType() === 'document' &&
            req.frame() === page.mainFrame()
        ) {
            navs++;
            navUrls.push(req.url().slice(0, 120));
        }
    };
    // 우리 자산(/_app/immutable/)에 관한 것만 센다 — 서드파티(터ンstile·광고) CORS 경고는 판정에서 제외
    const ours = (t) => /_app\/immutable\//.test(t);
    const onConsole = (m) => {
        const t = m.text();
        if (CHUNK_RE.test(t) && ours(t)) consoleErrors.push(t.slice(0, 160));
    };
    const onErr = (e) => {
        const t = String(e?.message);
        if (CHUNK_RE.test(t) && ours(t)) consoleErrors.push(t.slice(0, 160));
    };
    const onReqFail = (r) => {
        if (ours(r.url()))
            consoleErrors.push(
                `requestfailed ${r.url().split('/').pop()} :: ${r.failure()?.errorText}`
            );
    };
    page.on('request', onNav);
    page.on('console', onConsole);
    page.on('pageerror', onErr);
    page.on('requestfailed', onReqFail);
    const t0 = Date.now();
    let status = 0;
    try {
        const resp = await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
        status = resp?.status() ?? 0;
    } catch (e) {
        consoleErrors.push(`goto: ${String(e.message).slice(0, 120)}`);
    }
    initialDone = true;
    await page.waitForTimeout(OBSERVE_MS);
    const st = await page
        .evaluate(() => {
            const g =
                window.__angpleChunkError && window.__angpleChunkError.getState
                    ? window.__angpleChunkError.getState()
                    : null;
            return {
                hydrated: typeof window.__angpleHydrateAt !== 'undefined',
                stage: g ? g.stage : null,
                pending: g ? !!g.pending : null,
                enabled: g ? g.enabled : null,
                bar: !!document.getElementById('angple-recovery-bar'),
                finalUrl: location.href
            };
        })
        .catch((e) => ({ evalError: String(e.message).slice(0, 120) }));
    page.off('request', onNav);
    page.off('console', onConsole);
    page.off('pageerror', onErr);
    page.off('requestfailed', onReqFail);
    const fails = [];
    if (status !== 200) fails.push(`status ${status}`);
    if (navs > 0) fails.push(`재내비게이션 ${navs}회`);
    if (consoleErrors.length) fails.push(`청크 오류 ${consoleErrors.length}건`);
    if (st.evalError) fails.push(`evaluate 실패: ${st.evalError}`);
    if (st.hydrated === false) fails.push('하이드레이션 미완료');
    if (st.stage && st.stage > 0) fails.push(`복구 단계 ${st.stage}`);
    if (st.pending) fails.push('복구 pending 잔존');
    if (st.bar) fails.push('복구 상태줄 표시됨');
    results.push({
        path,
        status,
        ms: Date.now() - t0,
        navs,
        navUrls,
        consoleErrors: consoleErrors.slice(0, 3),
        ...st,
        fails
    });
    console.log(
        `${fails.length ? 'FAIL' : 'PASS'} ${path.padEnd(16)} status=${status} 재내비=${navs} 청크오류=${consoleErrors.length} hydrated=${st.hydrated} stage=${st.stage} bar=${st.bar} enabled=${st.enabled} ${fails.join(' · ')}`
    );
}
await browser.close();
const failed = results.filter((r) => r.fails.length);
console.log(
    JSON.stringify(
        { base, viewport: `${W}x${H}`, observeMs: OBSERVE_MS, failed: failed.length, results },
        null,
        0
    )
);
process.exit(failed.length ? 1 : 0);
