import { expect, test } from '@playwright/test';

for (const width of [375, 768]) {
    test(`위키 정규 주소와 실패 시 배지 생략 (${width}px)`, async ({ page }, testInfo) => {
        test.skip(!process.env.CI, 'Disposable fixture is created in CI only');
        await page.setViewportSize({ width, height: 900 });
        let fail = true;
        await page.route('**/api/wikiang/exists?**', async (route) => {
            if (fail) {
                await route.fulfill({ status: 503, json: { error: 'unavailable' } });
                return;
            }
            const titles = new URL(route.request().url()).searchParams.getAll('title');
            expect(titles).toHaveLength(20);
            await route.fulfill({
                json: { checked: titles, pages: [{ title: '문서0', path: '/실제/문서0' }] }
            });
        });
        const failed = page.waitForResponse((response) =>
            response.url().includes('/api/wikiang/exists?')
        );
        await page.goto('/__qa/wiki-links');
        await failed;
        await expect(page.locator('.wikiang-link')).toHaveCount(0);
        await expect(page.locator('[data-wikiang="pending"]')).toHaveCount(0);
        fail = false;
        await page.getByRole('button', { name: '다시 조회' }).click();
        await expect(page.locator('.wikiang-link')).toHaveCount(20);
        const found = page.locator('#wiki0 + .wikiang-link');
        await expect(found).toHaveAttribute(
            'href',
            'https://wikiang.org/%EC%8B%A4%EC%A0%9C/%EB%AC%B8%EC%84%9C0'
        );
        await expect(found).toHaveText('위키앙 문서 보기');
        await expect(page.locator('#wiki1 + .wikiang-link')).toHaveText('위키앙에서 검색');
        await expect(page.locator('#wiki20 + .wikiang-link')).toHaveCount(0);
        await expect(page.locator('#forged + .wikiang-link')).toHaveCount(0);
        await expect(page.locator('#wiki0')).toHaveAttribute(
            'href',
            'https://ko.wikipedia.org/wiki/문서0'
        );
        const box = await found.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        await testInfo.attach(`wiki-links-${width}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png'
        });
    });
}
