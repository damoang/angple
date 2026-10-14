if (process.env.GITHUB_ACTIONS !== 'true' || process.env.QA_BASE !== 'https://wikiang.org')
    throw new Error('Read-only production check must run in GitHub Actions');
const { createRequire } = require('node:module');
const req = createRequire(process.cwd() + '/apps/web/package.json');
const { chromium, expect } = req('@playwright/test');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    const page = await context.newPage();
    const out = process.env.QA_OUTPUT,
        errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
        await context.addCookies([
            { name: 'damoang_jwt', value: 'qa-invalid-community-token', url: process.env.QA_BASE },
            { name: 'angple_sid', value: 'qa-invalid-community-session', url: process.env.QA_BASE }
        ]);
        for (const width of [375, 768, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            const response = await page.goto(process.env.QA_BASE + '/login', {
                waitUntil: 'domcontentloaded'
            });
            assert.equal(response.status(), 200);
            await expect(page).toHaveURL('https://wikiang.org/wiki-auth');
            await expect(page.getByRole('heading', { name: '위키앙 로그인' })).toBeVisible();
            await expect(page.locator('main')).toContainText('WIKIANG LLC');
            assert.equal(
                await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
                false
            );
            await page.screenshot({
                path: out + '/login-production-' + width + '.png',
                fullPage: true
            });
        }
        const configured =
            (await page.getByRole('link', { name: 'Google 계정으로 계속' }).count()) === 1;
        if (!configured)
            await expect(page.getByRole('status')).toContainText('구글 로그인을 준비 중');
        for (const path of ['/auth/start?provider=google', '/api/auth/login', '/register'])
            assert.equal((await context.request.get(process.env.QA_BASE + path)).status(), 404);
        assert.deepEqual(errors, []);
        fs.writeFileSync(
            out + '/auth-production.json',
            JSON.stringify(
                {
                    independentLogin: true,
                    configured,
                    communityAuthBlocked: true,
                    widths: [375, 768, 1440],
                    errors,
                    realGoogleConsentTested: false
                },
                null,
                2
            )
        );
    } finally {
        await browser.close();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
