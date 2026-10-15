import { expect, test } from '@playwright/test';

for (const width of [375, 768]) {
    test(`작품 링크 제안과 입력 변경 (${width}px)`, async ({ page }, testInfo) => {
        test.skip(!process.env.CI, 'Disposable fixture is created in CI only');
        await page.setViewportSize({ width, height: 900 });
        const source = 'https://www.themoviedb.org/movie/123';
        await page.route('**/api/angtt/detect?**', async (route) => {
            const url = new URL(route.request().url());
            const match = url.searchParams.get('source') === source;
            await route.fulfill({
                json: {
                    match: match
                        ? { slug: 'qa-work-123', title: '테스트 영화 작품', posterUrl: null }
                        : null
                }
            });
        });
        await page.goto('/__qa/context-links');
        const link = page.locator('#link1');
        await link.fill(source);
        const connect = page.getByRole('button', { name: '작품과 연결' });
        await expect(connect).toBeVisible();
        await expect(page.getByText('「테스트 영화 작품」')).toBeVisible();
        const box = await connect.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        await testInfo.attach(`suggestion-${width}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png'
        });
        // A former result must disappear immediately when its source is removed.
        await link.fill('https://example.com/');
        await expect(connect).not.toBeVisible();
        await link.fill(source);
        await expect(connect).toBeVisible();
        await connect.click();
        await expect(connect).not.toBeVisible();
        await expect(page.getByText('qa-work-123', { exact: true })).toBeVisible();
    });
}
