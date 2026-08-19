import { test, expect, devices } from '@playwright/test';

/**
 * 뒤로가기 스크롤 복원 실측.
 *
 * ## 제보
 *
 * `/free/7060456` (Jei_): "글 보고 백버튼 누르면 원래 위치가 아닌
 * **한참 위** 위치로 돌아가게 되는 불편함이 있습니다"
 *
 * ## 왜 "한참 위" 인가 — 코드상 그 결말은 하나뿐이다
 *
 * `lib/utils/scroll-restore.ts` 는 **문서 높이가 목표에 닿기 전에는 scrollTo 를 부르지 않는다**
 * (부르면 브라우저가 맨 아래로 clamp 해서 "뒤로 가면 바닥" 이 된다 — #9401·#13022·#13221).
 *
 *     if (maxScroll >= target - 2) window.scrollTo(0, target);
 *
 * 그래서 3초(rAF 60프레임 + ResizeObserver) 안에 높이가 안 따라오면
 * **scrollTo 를 한 번도 안 부르고 맨 위에 남는다.** 그게 "한참 위" 다.
 *
 * ## 무엇을 재는가
 *
 * 추측을 늘리는 대신 **시간에 따른 scrollY 와 문서 높이를 함께** 찍는다.
 *   · 높이가 목표에 닿았는데 스크롤이 안 됐다  → 복원 로직/취소 문제
 *   · 높이가 끝내 목표에 못 닿았다             → 콘텐츠가 늦게/덜 그려지는 문제
 *   · 늦게라도 닿았다                          → 상한(3초)이 짧은 문제
 * 셋은 처방이 전혀 다르다. 그래서 둘을 같이 찍어야 갈린다.
 *
 * ⛔ Playwright 의 goBack 은 **진짜 bfcache 복원(pageshow.persisted)을 만들지 않는다**
 *    (2026-08-19 하이드레이션 조사에서 확인). 따라서 app.html 의 iOS 전용
 *    bfcache 리로드 경로는 여기서 재현되지 않는다. 이 테스트가 재는 것은
 *    **SPA 스냅샷 복원 경로**다. 재현이 안 되면 그 사실 자체가 정보다.
 *
 * 수동 실행 전용(`@scroll`). 스케줄 모니터는 이 태그를 제외한다.
 */

const LIST_PATH = process.env.E2E_SCROLL_LIST_PATH ?? '/free';
const TARGET_Y = Number(process.env.E2E_SCROLL_TARGET_Y ?? 1800);
const ITERATIONS = Number(process.env.E2E_SCROLL_ITERATIONS ?? 3);

// 복원 상한이 3초이므로 그 앞뒤를 넉넉히 덮는다.
const SAMPLE_MS = [200, 600, 1200, 2000, 3200, 5000];

const IOS_DEVICE = devices['iPhone 13'];

interface Sample {
    t: number;
    y: number;
    maxScroll: number;
}

interface Run {
    capturedY: number;
    postUrl: string;
    samples: Sample[];
}

async function measure(browser: import('@playwright/test').Browser, baseURL: string): Promise<Run> {
    const context = await browser.newContext({ ...IOS_DEVICE, baseURL });
    const page = await context.newPage();
    try {
        await page.goto(LIST_PATH, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // 목록을 목표 위치까지 내린다. ⛔ 문서가 그만큼 길지 않으면 측정 자체가 무의미하다.
        await page.evaluate((y) => window.scrollTo(0, y), TARGET_Y);
        await page.waitForTimeout(400);
        const capturedY = await page.evaluate(() => window.scrollY);
        expect(
            capturedY,
            `목록이 목표(${TARGET_Y}px)까지 스크롤되지 않았다 — 문서가 짧다(${capturedY}px). 측정 불가`
        ).toBeGreaterThan(TARGET_Y * 0.5);

        // ⛔ `.first()` 를 클릭하면 안 된다. 첫 글은 목록 **맨 위**에 있어서 Playwright 가
        //    클릭 전에 요소를 화면에 보이게 **되올려 스크롤**한다. 그러면 capture() 가
        //    1800 이 아니라 되올라간 위치(실측 215px)를 저장하고, 복원은 그 값으로 정확히
        //    동작한다 — 그런데 겉보기엔 "복원 실패" 로 읽힌다.
        //    실제로 2026-08-19 첫 실행에서 3/3 실패로 나와 하마터면 오진할 뻔했다.
        //    **지금 화면에 보이는 글**을 골라야 스크롤이 안 움직인다.
        const rows = page.locator('a.post-row');
        const count = await rows.count();
        let row = rows.first();
        let href = '';
        const vh = (await page.evaluate(() => window.innerHeight)) || 800;
        for (let i = 0; i < count; i++) {
            const cand = rows.nth(i);
            const box = await cand.boundingBox();
            // boundingBox 는 뷰포트 기준이다. 화면 안(위아래 여백 제외)에 있는 것만 고른다.
            if (box && box.y > 80 && box.y + box.height < vh - 80) {
                row = cand;
                href = (await cand.getAttribute('href')) ?? '';
                break;
            }
        }
        expect(href, '화면에 보이는 글을 못 찾았다 — 측정 불가').not.toBe('');

        const beforeClick = await page.evaluate(() => window.scrollY);
        await row.click({ timeout: 10_000 });
        // ⛔ 클릭이 스크롤을 움직였는지 반드시 확인한다. 움직였다면 이 측정은 무효다.
        expect(
            Math.abs(beforeClick - capturedY),
            `클릭 준비 중 스크롤이 움직였다(${capturedY} → ${beforeClick}) — 측정 무효`
        ).toBeLessThanOrEqual(5);
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(800);

        // 뒤로가기 — 여기서부터 복원이 도는지 시간축으로 찍는다.
        const t0 = Date.now();
        await page.goBack({ waitUntil: 'commit', timeout: 30_000 }).catch(() => {});
        const samples: Sample[] = [];
        for (const ms of SAMPLE_MS) {
            const wait = ms - (Date.now() - t0);
            if (wait > 0) await page.waitForTimeout(wait);
            const s = await page
                .evaluate(() => ({
                    y: window.scrollY,
                    maxScroll: document.documentElement.scrollHeight - window.innerHeight
                }))
                .catch(() => ({ y: -1, maxScroll: -1 }));
            samples.push({ t: ms, ...s });
        }
        return { capturedY, postUrl: href, samples };
    } finally {
        await context.close();
    }
}

test.describe('@scroll 뒤로가기 스크롤 복원', () => {
    test.setTimeout(6 * 60_000);

    test('목록으로 돌아왔을 때 원래 위치로 복원되는가', async ({ browser, baseURL }) => {
        const base = baseURL ?? 'https://damoang.net';
        const runs: Run[] = [];
        for (let i = 0; i < ITERATIONS; i++) {
            runs.push(await measure(browser, base));
        }

        const lines: string[] = ['', '=== 뒤로가기 스크롤 복원 ==='];
        let restored = 0;
        for (const [i, r] of runs.entries()) {
            const last = r.samples[r.samples.length - 1];
            const ok = Math.abs(last.y - r.capturedY) <= 50;
            if (ok) restored++;
            lines.push(
                `  [${i + 1}] 목표 ${r.capturedY}px → 최종 ${last.y}px  ${ok ? '✅' : '⛔'}  (${r.postUrl})`
            );
            lines.push(
                '      ' + r.samples.map((s) => `${s.t}ms:y=${s.y}/h=${s.maxScroll}`).join('  ')
            );
            // 진단의 핵심: 높이가 목표에 닿았는데도 스크롤이 안 됐는가?
            const heightReached = r.samples.some((s) => s.maxScroll >= r.capturedY - 2);
            lines.push(
                `      높이 도달 ${heightReached ? '✅ 예' : '⛔ 아니오'} → ` +
                    (heightReached
                        ? '복원 로직 문제(높이는 됐는데 스크롤 안 됨)'
                        : '콘텐츠 문제(문서가 목표만큼 길어지지 않음)')
            );
        }
        lines.push(`  복원 성공 ${restored}/${runs.length}`, '');
        console.log(lines.join('\n'));

        // 진단 단계라 실패시키지 않는다 — 수치를 보는 게 목적이다.
        expect(runs.length).toBe(ITERATIONS);
    });
});
