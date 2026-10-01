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
 *   - 🔴 하이드레이션 레인 오류 0 — `$set` undefined · HierarchyRequestError · Failed to hydrate
 *        (1차 split 실패 2026-06-29 #1691 의 지문. 기존 검사는 청크 레인만 봐서 이걸 놓쳤다)
 *   - 🔴 셸·본문 존재 — 콘솔 오류 없이도 화면이 빌 수 있다(#12836: 좌측 메뉴·로그인 메뉴바 미출력)
 *   - 🔴 목록→글 **클릭 이동(SPA)** 과 뒤로가기 복귀 — #12842 는 「클릭하면 안 열리고, 두 번째에 열리는데
 *        목록이 안 나온다」였다. 직접 이동(goto)만으로는 그 경로를 한 번도 밟지 않는다
 * 조건: 모바일 384×780 · CPU 4배 스로틀 · 네트워크 기본 4Mbps/RTT 100ms(일반 4G). 빠른 망에선 재현이 안 된다.
 *   ⛔ Slow 4G(400kbps)는 현재 단일 번들 6MB 가 2분 넘게 걸려 게이트로 못 쓴다 — 코드 분할 뒤 낮춘다.
 * 안전: 브라우저 1개·페이지 순차. 실행 호스트 1분 부하 8 초과면 60초 대기 ×3 후 실패.
 */
import { readFileSync } from 'node:fs';
import { classify } from './canary-error-lanes.mjs';
import { shellFails } from './canary-shell-verdict.mjs';

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

// ⛔ 브라우저 1종·1뷰포트로는 부족하다. 2026-06 1차 split 실패 신고가 그 증거다 —
//    #12836 은 **Firefox PC**, #12842 는 **Chrome 데스크탑**이었다. 모바일 Chromium 만
//    통과시키고 운영에 올리면 6월을 반복한다.
//    PW_BROWSER=chromium|firefox · 뷰포트는 argv 3·4 로 받는다(기존과 호환).
const BROWSER = (process.env.PW_BROWSER || 'chromium').toLowerCase();
const pw = await import(PW);
const engine = pw[BROWSER];
if (!engine) {
    console.log(`FAIL: 알 수 없는 브라우저 ${BROWSER}`);
    process.exit(1);
}
const browser = await engine.launch(
    BROWSER === 'chromium' ? { args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {}
);
// ⛔ isMobile/deviceScaleFactor 는 Firefox 가 지원하지 않는다(launch 시 예외) — 엔진별로 가른다.
//    데스크탑 뷰포트(폭 >= 1024)면 모바일 플래그를 끈다.
const MOBILE = W < 1024;
const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    userAgent: UA,
    ...(BROWSER === 'chromium' && MOBILE
        ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
        : {})
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
// ⛔ CDP 는 **Chromium 전용**이다. Firefox 에서 호출하면 예외로 검사가 통째로 죽는다 —
//    스로틀 없이라도 돌리는 편이 낫다(6월 지문은 스로틀과 무관한 컴포넌트·하이드레이션 오류다).
let throttled = false;
if (BROWSER === 'chromium') {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: RTT,
        downloadThroughput: (KBPS * 1024) / 8,
        uploadThroughput: (KBPS * 1024) / 8
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    throttled = true;
}
console.log(
    `엔진 ${BROWSER} · 뷰포트 ${W}x${H} (${MOBILE ? '모바일' : '데스크탑'})` +
        ` · 스로틀 ${throttled ? `${KBPS}kbps/RTT${RTT}ms/CPU4x` : '없음(Chromium 전용)'}`
);

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

// ⛔ 우리 자산에 관한 것만 센다 — 서드파티(turnstile·광고) 경고는 판정에서 제외.
//    단 하이드레이션 레인은 메시지에 URL 이 없어 **스택·소스 URL** 로 판별한다(canary-error-lanes).
function attach(page) {
    const st = { navs: 0, navUrls: [], initialDone: false, chunk: [], hydrate: [] };
    const push = (lane, t) => (lane === 'chunk' ? st.chunk : st.hydrate).push(t.slice(0, 160));
    // ⛔ framenavigated 는 history.replaceState(같은 문서)에도 발화한다 — 문서 요청만 센다.
    //    SvelteKit 의 정상 SPA 이동은 문서 요청이 아니므로 클릭으로는 올라가지 않는다.
    const onNav = (req) => {
        if (
            st.initialDone &&
            req.isNavigationRequest() &&
            req.resourceType() === 'document' &&
            req.frame() === page.mainFrame()
        ) {
            st.navs++;
            st.navUrls.push(req.url().slice(0, 120));
        }
    };
    const onConsole = (m) => {
        const lane = classify(m.text(), '', m.location()?.url || '');
        if (lane) push(lane, m.text());
    };
    const onErr = (e) => {
        const lane = classify(e?.message, e?.stack, '');
        if (lane) push(lane, String(e?.message));
    };
    const onReqFail = (r) => {
        if (/_app\/immutable\//.test(r.url()))
            push('chunk', `requestfailed ${r.url().split('/').pop()} :: ${r.failure()?.errorText}`);
    };
    page.on('request', onNav);
    page.on('console', onConsole);
    page.on('pageerror', onErr);
    page.on('requestfailed', onReqFail);
    st.detach = () => {
        page.off('request', onNav);
        page.off('console', onConsole);
        page.off('pageerror', onErr);
        page.off('requestfailed', onReqFail);
    };
    return st;
}

// 🔴 G3: 셸·본문이 실제로 그려졌는지. 콘솔 오류 없이도 화면은 빌 수 있다.
//    ⛔ 384px 모바일에서 돌기 때문에 좌측 사이드바는 없을 수 있다 — 폭에 무관한 것만 단언한다.
const shellProbe = () => {
    const vis = (el) => !!(el && el.offsetParent !== null);
    const links = [...document.querySelectorAll('a[href^="/free/"]')].filter(vis).length;
    const prose = document.querySelector('.prose');

    // ⛔ 2026-09-30: **CSS 가 적용됐는지**를 따로 본다. 이 축이 비어 있어서 실제 피해를 놓쳤다.
    //    코드 분할 반영 후 회원이 bug/14049 로 「목록이 스타일 덜 먹은 표 형태」를 신고했는데,
    //    셸 요소(header·app-root)는 다 있고 콘솔 오류도 없어 검사는 PASS 였다.
    //    재로드율 지표에도 안 잡혔다(재로드 없이 깨진 화면이므로).
    // ⭐ 탐지 원리: **로드에 실패한 `<link rel=stylesheet>` 는 `document.styleSheets` 에 들어가지 않는다.**
    //    그래서 「HTML 의 우리 CSS 링크 수」와 「실제로 올라온 스타일시트 수」의 차이가 곧 그 증상이다.
    //    ⛔ 교차 출처 스타일시트는 `cssRules` 접근이 throw 하지만 `href` 는 읽을 수 있다.
    const ourCss = (u) => typeof u === 'string' && u.indexOf('/_app/immutable/') !== -1;
    const cssLinks = [...document.querySelectorAll('link[rel="stylesheet"]')].filter((l) =>
        ourCss(l.href)
    ).length;
    let cssLoaded = 0;
    try {
        cssLoaded = [...document.styleSheets].filter((sh) => {
            try {
                return ourCss(sh.href);
            } catch {
                return false;
            }
        }).length;
    } catch {
        cssLoaded = -1; // 접근 자체가 막히면 -1 로 표시해 판정에서 제외한다
    }

    return {
        header: !!document.querySelector('header'),
        appRoot: !!document.getElementById('app-root'),
        postLinks: links,
        proseLen: prose ? (prose.textContent || '').trim().length : 0,
        // 사진·영상만 있는 글은 글자 수가 0~몇 자다. 미디어 수를 같이 실어 판정에서 구분한다.
        proseMedia: prose ? prose.querySelectorAll('img, video, iframe').length : 0,
        cssLinks,
        cssLoaded
    };
};

const results = [];
for (const path of targets) {
    const url = `${base}${path}`;
    const col = attach(page);
    const t0 = Date.now();
    let status = 0;
    try {
        const resp = await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
        status = resp?.status() ?? 0;
    } catch (e) {
        col.chunk.push(`goto: ${String(e.message).slice(0, 120)}`);
    }
    col.initialDone = true;
    await page.waitForTimeout(OBSERVE_MS);
    // ⛔ eval 로 프로브를 넘기지 않는다 — 페이지 CSP 에 unsafe-eval 이 없으면 막힌다.
    //    Playwright 는 함수를 그대로 직렬화하므로 evaluate(fn) 으로 넘긴다.
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
    st.shell = await page.evaluate(shellProbe).catch((e) => ({
        evalError: String(e.message).slice(0, 120)
    }));
    col.detach();
    const fails = [];
    if (status !== 200) fails.push(`status ${status}`);
    if (col.navs > 0) fails.push(`재내비게이션 ${col.navs}회`);
    if (col.chunk.length) fails.push(`청크 오류 ${col.chunk.length}건`);
    // 🔴 6월 지문 — 레인을 나눠 보고한다. 고칠 곳이 청크 레인과 다르다.
    if (col.hydrate.length) fails.push(`하이드레이션 오류 ${col.hydrate.length}건`);
    if (st.evalError) fails.push(`evaluate 실패: ${st.evalError}`);
    if (st.hydrated === false) fails.push('하이드레이션 미완료');
    if (st.stage && st.stage > 0) fails.push(`복구 단계 ${st.stage}`);
    if (st.pending) fails.push('복구 pending 잔존');
    if (st.bar) fails.push('복구 상태줄 표시됨');
    if (st.shell?.evalError) fails.push(`셸 프로브 실패: ${st.shell.evalError}`);
    else if (st.shell) fails.push(...shellFails(path, st.shell));
    results.push({
        path,
        status,
        ms: Date.now() - t0,
        navs: col.navs,
        navUrls: col.navUrls,
        chunkErrors: col.chunk.slice(0, 3),
        hydrateErrors: col.hydrate.slice(0, 3),
        ...st,
        fails
    });
    console.log(
        `${fails.length ? 'FAIL' : 'PASS'} ${path.padEnd(16)} status=${status} 재내비=${col.navs} 청크=${col.chunk.length} 하이드=${col.hydrate.length} hydrated=${st.hydrated} stage=${st.stage} bar=${st.bar} shell=${JSON.stringify(st.shell || null)} ${fails.join(' · ')}`
    );
}

// ── 🔴 G2: 목록 → 글 **클릭 이동(SPA)** → 뒤로가기 복귀 ──────────────────────
// #12842(2026-06-29): 「게시물을 클릭하면 열리지 않고 깨진 모양 → 다시 클릭하면 들어가지는데
// 목록이 안 나타나서 뒤로가기로 나가야 한다」. 직접 이동(goto)은 이 경로를 밟지 않는다.
// split 에서 라우트 청크는 **클릭 시점에** 비동기로 불린다 — 거기가 6월에 깨진 자리다.
{
    const col = attach(page);
    const t0 = Date.now();
    const fails = [];
    let clickedHref = null;
    let listBefore = 0,
        listAfterBack = 0;
    let sh = null;
    try {
        const resp = await page.goto(`${base}/free`, { waitUntil: 'commit', timeout: 60000 });
        if ((resp?.status() ?? 0) !== 200) fails.push(`목록 status ${resp?.status()}`);
        col.initialDone = true;
        // 하이드레이션을 기다린다 — 클릭이 SPA 이동이 되려면 먼저 붙어 있어야 한다
        await page
            .waitForFunction(() => typeof window.__angpleHydrateAt !== 'undefined', {
                timeout: 25000
            })
            .catch(() => fails.push('목록 하이드레이션 25초 초과'));
        const link = page.locator('a[href^="/free/"]:visible').first();
        listBefore = await page.locator('a[href^="/free/"]:visible').count();
        if (listBefore < 5) fails.push(`클릭 전 목록 링크 ${listBefore}개(<5)`);
        clickedHref = await link.getAttribute('href').catch(() => null);
        if (!clickedHref) {
            fails.push('클릭할 글 링크를 찾지 못함');
        } else {
            await link.click({ timeout: 15000 });
            await page
                .waitForURL((u) => /\/free\/\d+/.test(u.pathname), { timeout: 20000 })
                .catch(() => fails.push(`클릭 후 ${clickedHref} 로 이동하지 않음`));
            await page.waitForTimeout(8000);
            sh = await page
                .evaluate(shellProbe)
                .catch((e) => ({ evalError: String(e.message).slice(0, 120) }));
            if (sh?.evalError) fails.push(`글 evaluate 실패: ${sh.evalError}`);
            else fails.push(...shellFails('/free/1', sh));
            // 뒤로가기로 목록이 돌아오는가 (#12842 의 「목록이 안 나타나서」)
            await page.goBack({ timeout: 20000 }).catch(() => fails.push('뒤로가기 실패'));
            await page.waitForTimeout(5000);
            listAfterBack = await page.locator('a[href^="/free/"]:visible').count();
            if (listAfterBack < 5) fails.push(`뒤로가기 후 목록 링크 ${listAfterBack}개(<5)`);
        }
    } catch (e) {
        fails.push(`SPA 시나리오 예외: ${String(e.message).slice(0, 120)}`);
    }
    col.detach();
    if (col.navs > 0) fails.push(`SPA 중 문서 재내비게이션 ${col.navs}회`);
    if (col.chunk.length) fails.push(`청크 오류 ${col.chunk.length}건`);
    if (col.hydrate.length) fails.push(`하이드레이션 오류 ${col.hydrate.length}건`);
    results.push({
        path: 'SPA:/free→글→뒤로',
        status: 200,
        ms: Date.now() - t0,
        navs: col.navs,
        navUrls: col.navUrls,
        chunkErrors: col.chunk.slice(0, 3),
        hydrateErrors: col.hydrate.slice(0, 3),
        clickedHref,
        listBefore,
        listAfterBack,
        shell: sh,
        fails
    });
    console.log(
        `${fails.length ? 'FAIL' : 'PASS'} ${'SPA 클릭'.padEnd(16)} 클릭=${clickedHref} 목록 ${listBefore}→${listAfterBack} 재내비=${col.navs} 청크=${col.chunk.length} 하이드=${col.hydrate.length} ${fails.join(' · ')}`
    );
}

await browser.close();
const failed = results.filter((r) => r.fails.length);
const laneTotals = results.reduce(
    (a, r) => ({
        chunk: a.chunk + (r.chunkErrors?.length || 0),
        hydrate: a.hydrate + (r.hydrateErrors?.length || 0)
    }),
    { chunk: 0, hydrate: 0 }
);
// ⭐ 레인을 구별해 찍는다 — 청크 레인은 9월(모드 혼용), 하이드레이션 레인은 6월($set) 계열이다.
console.log(`레인 합계  청크=${laneTotals.chunk}  하이드레이션=${laneTotals.hydrate}`);
console.log(
    JSON.stringify(
        {
            base,
            viewport: `${W}x${H}`,
            observeMs: OBSERVE_MS,
            failed: failed.length,
            laneTotals,
            results
        },
        null,
        0
    )
);
process.exit(failed.length ? 1 : 0);
