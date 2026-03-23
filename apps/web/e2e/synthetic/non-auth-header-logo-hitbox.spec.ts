import { test, expect } from '@playwright/test';

test('non-auth header logo hitbox and mixed-content regression check', async ({ page }) => {
    const mixedContentMessages: string[] = [];
    const homeUrlPattern = /^https:\/\/damoang\.net\/(?:\?_v=\d+)?$/;

    page.on('console', (msg) => {
        const text = msg.text();
        if (/mixed content/i.test(text)) {
            mixedContentMessages.push(text);
        }
    });

    for (const point of [0.1, 0.5, 0.9]) {
        await page.goto('/search', { waitUntil: 'domcontentloaded' });

        const logoLink = page.locator('header a[aria-label="홈"]').first();
        await expect(logoLink).toBeVisible({ timeout: 10_000 });
        const logoImage = logoLink.locator('img').first();
        await expect(logoImage).toBeVisible({ timeout: 10_000 });

        const box = await logoImage.boundingBox();
        expect(box, 'logo image bounding box should exist').not.toBeNull();
        if (!box) continue;

        await page.mouse.click(box.x + box.width * point, box.y + box.height / 2);
        await expect(page).toHaveURL(homeUrlPattern);
    }

    expect(
        mixedContentMessages,
        `unexpected mixed-content console messages: ${mixedContentMessages.join(' | ')}`
    ).toEqual([]);
});
