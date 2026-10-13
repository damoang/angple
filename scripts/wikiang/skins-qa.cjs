if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('Skin QA runs in GitHub Actions only.');
const { createRequire } = require('node:module');
const req = createRequire(process.cwd() + '/apps/web/package.json');
const { chromium, expect } = req('@playwright/test');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = process.env.QA_BASE;
const out = process.env.QA_OUTPUT || 'qa-results';
const skins = ['standard', 'classic', 'reading', 'encyclopedia'];
(async () => {
    fs.mkdirSync(out, { recursive: true });
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const checks = [];
    try {
        for (const width of [375, 768, 1440]) {
            const page = await browser.newPage({ viewport: { width, height: 950 } });
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            const visit = (path) => page.goto(base + path, { waitUntil: 'domcontentloaded' });
            const noOverflow = async () =>
                assert.equal(
                    await page.evaluate(
                        () => document.documentElement.scrollWidth > innerWidth + 1
                    ),
                    false
                );
            try {
                await visit('/%EB%8C%80%EB%AC%B8');
                for (const skin of skins) {
                    await page
                        .getByRole('combobox', { name: '위키 테마', exact: true })
                        .selectOption(skin);
                    await expect(page.locator('.wiki-layout')).toHaveAttribute(
                        'data-wiki-skin',
                        skin
                    );
                    const response = await page.reload({ waitUntil: 'domcontentloaded' });
                    assert.equal(response.status(), 200);
                    assert.ok(
                        (await response.text()).includes(`data-wiki-skin="${skin}"`),
                        'SSR must restore skin before hydration'
                    );
                    await expect(
                        page.getByRole('combobox', { name: '위키 테마', exact: true })
                    ).toHaveValue(skin);
                    await noOverflow();
                    await expect(page.locator('.topics')).not.toContainText('다모앙');
                    await expect(page.locator('.wiki-bottom')).toContainText('운영: WIKIANG LLC');
                    assert.equal(
                        await page
                            .locator(
                                '.site-header a[href*="damoang.net"], .community a[href*="damoang.net"], .wiki-bottom a[href*="damoang.net"]'
                            )
                            .count(),
                        0
                    );
                    await page.screenshot({
                        path: `${out}/skin-${skin}-home-${width}.png`,
                        fullPage: true
                    });
                    await page.getByRole('button', { name: '화면 색상 전환' }).click();
                    await expect(page.locator('html')).toHaveClass(/dark/);
                    await noOverflow();
                    await page.screenshot({
                        path: `${out}/skin-${skin}-dark-${width}.png`,
                        fullPage: true
                    });
                    await visit('/%EC%9D%B4%EC%9E%AC%EB%AA%85');
                    await expect(page.locator('.wiki-layout')).toHaveAttribute(
                        'data-wiki-skin',
                        skin
                    );
                    await expect(page.locator('.wiki-prose')).toBeVisible();
                    await noOverflow();
                    if (skin === 'encyclopedia') {
                        await expect(page.locator('.wiki-appearance')).toBeVisible();
                        if (width === 1440) {
                            const toc = await page.locator('.wiki-toc-rail').boundingBox();
                            const article = await page.locator('.wiki-main').boundingBox();
                            const appearance = await page.locator('.wiki-appearance').boundingBox();
                            assert.ok(
                                toc &&
                                    article &&
                                    appearance &&
                                    toc.x < article.x &&
                                    article.x < appearance.x
                            );
                        }
                        const before = await page
                            .locator('.wiki-prose')
                            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
                        await page
                            .getByRole('combobox', { name: '본문 글자 크기' })
                            .selectOption('large');
                        await expect
                            .poll(() =>
                                page
                                    .locator('.wiki-prose')
                                    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
                            )
                            .toBeGreaterThan(before);
                        await page.reload({ waitUntil: 'domcontentloaded' });
                        await expect(
                            page.getByRole('combobox', { name: '본문 글자 크기' })
                        ).toHaveValue('large');
                        await noOverflow();
                        await page
                            .getByRole('combobox', { name: '본문 글자 크기' })
                            .selectOption('standard');
                    }
                    const collapsedToc = width <= 1200 || skin === 'reading';
                    if (collapsedToc) await page.locator('.mobile-toc summary').click();
                    await expect(
                        page.locator(collapsedToc ? '.mobile-toc a' : '.wiki-toc-rail a').first()
                    ).toBeVisible();
                    if (collapsedToc) await page.locator('.mobile-toc summary').click();
                    await page.getByRole('button', { name: '화면 색상 전환' }).click();
                    await expect(page.locator('html')).not.toHaveClass(/dark/);
                    await page.screenshot({
                        path: `${out}/skin-${skin}-article-${width}.png`,
                        fullPage: true
                    });
                    checks.push({
                        width,
                        skin,
                        persistence: true,
                        navigation: true,
                        darkMode: true,
                        overflow: false
                    });
                    await visit('/%EB%8C%80%EB%AC%B8');
                }
                // An invalid preference must fall back to the default without breaking rendering.
                await page
                    .context()
                    .addCookies([{ name: 'wikiang_skin', value: 'unknown-skin', url: base }]);
                await page.reload({ waitUntil: 'domcontentloaded' });
                await expect(page.locator('.wiki-layout')).toHaveAttribute(
                    'data-wiki-skin',
                    'standard'
                );
                assert.deepEqual(errors, []);
            } catch (error) {
                await page
                    .screenshot({ path: `${out}/skin-failure-${width}.png`, fullPage: true })
                    .catch(() => {});
                throw error;
            } finally {
                await page.close();
            }
        }
    } finally {
        fs.writeFileSync(`${out}/skins.json`, JSON.stringify(checks, null, 2));
        await browser.close();
    }
    console.log(JSON.stringify({ checks: checks.length, skins, widths: [375, 768, 1440] }));
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
