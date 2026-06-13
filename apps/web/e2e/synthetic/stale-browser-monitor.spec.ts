import { test, expect } from '@playwright/test';

const POST_PATH = process.env.E2E_SYNTHETIC_POST_PATH ?? '/free/5998999';

function isImmutableAsset(url: string): boolean {
    return url.includes('/_app/immutable/') || /\/releases\/sha-[^/]+\/_app\/immutable\//.test(url);
}

test('iOS Safari can load stale-sensitive post flows', async ({ page }) => {
    const pageErrors: string[] = [];
    const failedResponses: Array<{ url: string; status: number }> = [];

    page.on('pageerror', (error) => {
        pageErrors.push(error.message);
    });

    page.on('response', (response) => {
        const url = response.url();
        const status = response.status();
        if (status < 400) return;

        if (
            isImmutableAsset(url) ||
            url.includes('/__data.json') ||
            /\/api\/boards\/[^/]+\/posts\/\d+\/comments/.test(url) ||
            /\/api\/boards\/[^/]+\/posts\/\d+\/like/.test(url)
        ) {
            failedResponses.push({ url, status });
        }
    });

    const immutableResponse = page.waitForResponse(
        (response) => isImmutableAsset(response.url()) && response.status() === 200,
        { timeout: 20_000 }
    );
    // 주의: 댓글/추천은 SSR 직접 로딩으로 전환되어 첫 로드에서 클라이언트 GET 이
    // 발생하지 않을 수 있다 (waitForResponse 로 대기하면 false negative — 2026-06-06
    // run 27058741045 실패 원인). 모니터는 구현 디테일(네트워크 호출 발생) 대신
    // 사용자 가시 결과(댓글 영역 렌더)를 검증하고, 호출이 발생하는 경로(fallback 등)의
    // 4xx/5xx 는 위 failedResponses 리스너가 계속 잡는다.

    await page.goto(POST_PATH, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/댓글|공감|목록/, { timeout: 15_000 });

    // 댓글 영역이 실제로 렌더되었는지 (SSR/CSR 무관한 사용자 가시 결과)
    await expect(page.locator('#comments')).toBeVisible({ timeout: 15_000 });

    await immutableResponse;
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    expect(
        pageErrors.filter(
            (message) =>
                /Failed to fetch dynamically imported module/i.test(message) ||
                /Can't find variable: \$/i.test(message) ||
                /\$ is not defined/i.test(message) ||
                /jQuery/i.test(message)
        ),
        `unexpected Safari bootstrap/runtime errors: ${pageErrors.join(' | ')}`
    ).toEqual([]);

    expect(
        failedResponses,
        `unexpected failed responses: ${failedResponses
            .map((item) => `${item.status} ${item.url}`)
            .join(' | ')}`
    ).toEqual([]);
});
