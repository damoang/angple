import { test, expect, devices } from '@playwright/test';

/**
 * iOS Safari 하이드레이션 무결성 측정.
 *
 * ## 왜 필요한가
 *
 * 2026-08-19 실측: 하루 **3,302명**이 하이드레이션 실패를 겪고 있고,
 * 대조군(성공 로드 1% 표본)을 넣자 판별자가 브라우저로 갈렸다.
 *
 *   iOS 사파리   실패율 ~68%   (다른 브라우저의 약 50배)
 *   데스크톱     ~1.5%
 *   안드로이드   ~0.4%
 *
 * 하이드레이션이 폐기되면 상호작용이 죽는다 — `classic.svelte:263` 의
 * 2026-07-28 사고 기록에 증상이 적혀 있다: "화면 깜빡임, 글쓰기 버튼 안 보임,
 * 로그인 상태 잘못 표시". `/free/7060456` 제보 내용과 같다.
 *
 * 원격 계측은 "iOS 에서 깨진다"까지 알려줬지만 **왜**는 못 알려준다.
 * 여기서 WebKit 으로 재현해 trace/video 를 남기면 그때부터 디버깅이 된다.
 *
 * ## ⛔ 설계상 지킨 것 세 가지
 *
 * 1. **판정을 새로 만들지 않는다.** 운영 코드(`+layout.svelte`)가 이미
 *    앵커 폐기 여부를 판정해 비콘으로 보낸다. 그 비콘을 가로채 읽는다.
 *    계측이 두 벌이면 서로 어긋나고, 어느 쪽이 맞는지 다투게 된다.
 *
 * 2. **비콘을 실제로 보내지 않는다.** 합성 트래픽이 운영 ClickHouse 에
 *    가짜 오류로 쌓이면 우리가 보는 지표 자체가 오염된다. route 로 가로채고
 *    abort 한다.
 *
 * 3. **단발이 아니라 비율로 잰다.** 실패가 확률적이라 1회 판정은 플래키하다.
 *    N회 반복해 비율을 내면 결과가 안정적이고, 고친 뒤 회귀 감시로 그대로 쓸 수 있다.
 *
 * ## 운영 편입 계획
 *
 * 지금은 `@hydration` 태그로 **수동 실행(workflow_dispatch) 전용**이다.
 * 15분 스케줄 모니터에 지금 넣으면 하루 96번 텔레그램이 울리고 곧 아무도 안 본다.
 * 원인을 고쳐 실패율이 0 이 된 뒤 `E2E_HYDRATION_MAX_FAIL_RATE=0` 으로
 * 스케줄 모니터에 승격한다 — 그때부터 재발 방지 가드가 된다.
 */

const POST_PATH = process.env.E2E_SYNTHETIC_POST_PATH ?? '/free/5998999';
const LIST_PATH = process.env.E2E_HYDRATION_LIST_PATH ?? '/free';
const HOME_PATH = '/';

// 경로별로 N회씩. 기본 4회 × 3경로 = 12 로드 (한 번에 3~4분).
const ITERATIONS = Number(process.env.E2E_HYDRATION_ITERATIONS ?? 4);

// 허용 실패율. 진단 단계에서는 1.0(항상 통과)로 두고 **수치만 본다**.
// 원인을 고친 뒤 0 으로 낮춰 회귀 가드로 승격한다.
const MAX_FAIL_RATE = Number(process.env.E2E_HYDRATION_MAX_FAIL_RATE ?? 1);

// 비콘 전송은 onMount 이후에 일어난다. 로드 완료만으로는 아직 안 나갔을 수 있어
// 짧게 더 기다린다. ⛔ 이 값을 줄이면 실패를 성공으로 오판한다(false negative).
const BEACON_GRACE_MS = 2_000;

interface LoadResult {
    path: string;
    /** 운영 코드가 보낸 앵커 판정. null = 비콘 없음 = 정상(또는 1% 표본 미발화) */
    anchorReason: string | null;
    /** 콘솔에 뜬 하이드레이션 경고 수 (mismatch 계열) */
    hydrationWarnings: number;
    /** 광고 노드 수 — 상관 확인용. 원격 실측에서는 판별자가 아니었다 */
    adNodes: number;
}

// ⛔ `browser.newContext()` 는 **프로젝트의 `use`(iPhone 13 에뮬레이션)를 상속하지 않는다.**
//    그대로 두면 데스크톱 WebKit 으로 돌면서 "전부 통과" 라는 거짓 결과가 나온다.
//    재현 대상이 iOS Safari 이므로 디바이스 서술자를 명시적으로 주입한다.
const IOS_DEVICE = devices['iPhone 13'];

async function loadOnce(
    browser: import('@playwright/test').Browser,
    path: string,
    baseURL: string
) {
    // ⛔ 매번 새 컨텍스트. 재사용하면 bfcache·세션·캐시가 섞여 재현 조건이 흐려진다.
    const context = await browser.newContext({ ...IOS_DEVICE, baseURL });
    const page = await context.newPage();

    const result: LoadResult = {
        path,
        anchorReason: null,
        hydrationWarnings: 0,
        adNodes: -1
    };

    page.on('console', (msg) => {
        if (/hydrat/i.test(msg.text())) result.hydrationWarnings++;
    });

    // 운영 판정을 읽되 **서버로는 보내지 않는다** (운영 지표 오염 방지).
    //
    // ⛔ abort() 를 쓰면 안 된다. 이 비콘은 Content-Type: application/json +
    //    credentials: 'include' 라 CORS preflight(OPTIONS)가 먼저 나간다.
    //    preflight 를 끊으면 본 POST 가 아예 발생하지 않고, 그러면 판정을 하나도
    //    못 읽은 채 "실패 0건" 이라는 **거짓 통과**가 된다.
    //    로컬에서 CORS 를 만족시키는 응답을 만들어 주고, 서버로는 안 나가게 한다.
    const corsHeaders = {
        'access-control-allow-origin': new URL(baseURL).origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type'
    };
    await page.route('**/api/v1/dantry', async (route) => {
        const request = route.request();
        if (request.method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: corsHeaders });
            return;
        }
        try {
            const body = JSON.parse(request.postData() ?? '{}');
            if (body?.channel === 'anchor' && typeof body.reason === 'string') {
                result.anchorReason = body.reason;
            }
        } catch {
            // 판정 파싱 실패는 조용히 넘긴다 — 관측 코드가 테스트를 죽이면 안 된다
        }
        await route.fulfill({ status: 204, headers: corsHeaders });
    });

    try {
        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(BEACON_GRACE_MS);
        result.adNodes = await page
            .evaluate(
                () => document.querySelectorAll('ins.adsbygoogle, iframe[id^="aswift"]').length
            )
            .catch(() => -1);
    } finally {
        await context.close();
    }
    return result;
}

/**
 * 항해 시나리오 — 목록 → 글 → 뒤로.
 *
 * ⛔ 신선 로드만 재면 0% 가 나온다(2026-08-19 첫 진단, 0/15).
 *    실제 사용자는 목록과 글을 오간다. 그리고 `app.html` 에는 **iOS 전용**
 *    bfcache 스크립트가 있어 `pageshow(persisted)` 에서 `location.reload()` 를 건다.
 *    뒤로가기 복원이 바로 그 경로다 — 신선 로드로는 절대 안 밟는다.
 *    제보의 "뒤로가기 시 위치가 위로 튄다" 도 같은 자리다.
 */
async function navigateOnce(
    browser: import('@playwright/test').Browser,
    baseURL: string
): Promise<LoadResult[]> {
    const context = await browser.newContext({ ...IOS_DEVICE, baseURL });
    const page = await context.newPage();
    const collected: LoadResult[] = [];
    let current: LoadResult = {
        path: 'nav:list',
        anchorReason: null,
        hydrationWarnings: 0,
        adNodes: -1
    };

    page.on('console', (msg) => {
        if (/hydrat/i.test(msg.text())) current.hydrationWarnings++;
    });

    const corsHeaders = {
        'access-control-allow-origin': new URL(baseURL).origin,
        'access-control-allow-credentials': 'true',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type'
    };
    await page.route('**/api/v1/dantry', async (route) => {
        const request = route.request();
        if (request.method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers: corsHeaders });
            return;
        }
        try {
            const body = JSON.parse(request.postData() ?? '{}');
            if (body?.channel === 'anchor' && typeof body.reason === 'string') {
                current.anchorReason = body.reason;
            }
        } catch {
            /* 관측 실패는 테스트를 죽이지 않는다 */
        }
        await route.fulfill({ status: 204, headers: corsHeaders });
    });

    const settle = async () => {
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(BEACON_GRACE_MS);
    };

    try {
        // ① 목록 진입
        await page.goto(LIST_PATH, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await settle();
        collected.push(current);

        // ② 글로 이동 (SPA 내비게이션 — 실제 사용자 경로)
        current = { path: 'nav:post', anchorReason: null, hydrationWarnings: 0, adNodes: -1 };
        const firstPost = page.locator('a.post-row').first();
        if ((await firstPost.count()) > 0) {
            await firstPost.click({ timeout: 10_000 }).catch(() => {});
        } else {
            await page.goto(POST_PATH, { waitUntil: 'domcontentloaded' });
        }
        await settle();
        collected.push(current);

        // ③ 뒤로가기 — bfcache 복원 경로. iOS 전용 reload 스크립트가 여기서 발화한다.
        current = { path: 'nav:back', anchorReason: null, hydrationWarnings: 0, adNodes: -1 };
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
        await settle();
        collected.push(current);
    } finally {
        await context.close();
    }
    return collected;
}

test.describe('@hydration iOS Safari hydration integrity', () => {
    // 반복 로드라 기본 타임아웃으로는 부족하다.
    test.setTimeout(10 * 60_000);

    test('하이드레이션이 iOS Safari 에서 유지되는가', async ({ browser, baseURL }) => {
        const base = baseURL ?? 'https://damoang.net';
        const paths = [POST_PATH, LIST_PATH, HOME_PATH];
        const results: LoadResult[] = [];

        // ⛔ 에뮬레이션이 실제로 걸렸는지 먼저 확인한다. 안 걸린 채 "전부 통과" 가
        //    나오는 것이 이 테스트의 가장 위험한 실패 모드다.
        const probe = await browser.newContext({ ...IOS_DEVICE, baseURL: base });
        const probePage = await probe.newPage();
        const ua = await probePage.evaluate(() => navigator.userAgent);
        await probe.close();
        expect(ua, `iOS 에뮬레이션이 걸리지 않았다: ${ua}`).toMatch(/iPhone/);

        for (const path of paths) {
            for (let i = 0; i < ITERATIONS; i++) {
                results.push(await loadOnce(browser, path, base));
            }
        }

        // 항해 시나리오(목록→글→뒤로)를 함께 잰다. 신선 로드만으로는 0% 가 나왔다.
        for (let i = 0; i < ITERATIONS; i++) {
            results.push(...(await navigateOnce(browser, base)));
        }

        const failed = results.filter(
            (r) => r.anchorReason === 'anchor_detached' || r.anchorReason === 'anchor_missing'
        );
        const rate = failed.length / results.length;

        // 사람이 읽을 수 있게 남긴다 — 이 로그가 이번 작업의 산출물이다.
        const allPaths = [...paths, 'nav:list', 'nav:post', 'nav:back'];
        const byPath = allPaths.map((p) => {
            const rs = results.filter((r) => r.path === p);
            const f = rs.filter((r) => r.anchorReason && r.anchorReason !== 'anchor_ok');
            return `  ${p.padEnd(18)} 실패 ${f.length}/${rs.length}  경고 ${rs.reduce((a, r) => a + r.hydrationWarnings, 0)}  광고 ${rs.map((r) => r.adNodes).join(',')}`;
        });
        const reasons = results
            .map((r) => r.anchorReason)
            .filter(Boolean)
            .join(', ');

        console.log(
            [
                '',
                '=== iOS Safari 하이드레이션 무결성 ===',
                ...byPath,
                `  전체 실패율 ${(rate * 100).toFixed(1)}% (${failed.length}/${results.length})`,
                `  판정 내역: ${reasons || '(없음 = 전부 정상)'}`,
                ''
            ].join('\n')
        );

        expect(
            rate,
            `iOS Safari 하이드레이션 실패율 ${(rate * 100).toFixed(1)}% ` +
                `(허용 ${(MAX_FAIL_RATE * 100).toFixed(0)}%). 판정: ${reasons || '없음'}`
        ).toBeLessThanOrEqual(MAX_FAIL_RATE);
    });
});
