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

    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    const logoLink = page.locator('header a[aria-label="홈"]').first();
    await expect(logoLink).toBeVisible({ timeout: 10_000 });

    // element click — 좌표 계산 없이 Playwright가 안전하게 클릭
    await logoLink.click();
    await expect(page).toHaveURL(homeUrlPattern);

    expect(
        mixedContentMessages,
        `unexpected mixed-content console messages: ${mixedContentMessages.join(' | ')}`
    ).toEqual([]);
});
