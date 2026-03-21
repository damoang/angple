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
    const commentsResponse = page.waitForResponse(
        (response) =>
            /\/api\/boards\/[^/]+\/posts\/\d+\/comments/.test(response.url()) &&
            response.request().method() === 'GET' &&
            response.status() === 200,
        { timeout: 20_000 }
    );
    const likeResponse = page.waitForResponse(
        (response) =>
            /\/api\/boards\/[^/]+\/posts\/\d+\/like/.test(response.url()) &&
            response.request().method() === 'GET' &&
            response.status() === 200,
        { timeout: 20_000 }
    );

    await page.goto(POST_PATH, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/댓글|공감|목록/, { timeout: 15_000 });

    await Promise.all([immutableResponse, commentsResponse, likeResponse]);
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
