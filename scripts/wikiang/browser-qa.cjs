if (process.env.GITHUB_ACTIONS !== 'true')
    throw new Error('QA browsers run on GitHub Actions only.');
const { createRequire } = require('node:module');
const req = createRequire(process.cwd() + '/apps/web/package.json');
const { chromium, expect } = req('@playwright/test');
const fs = require('node:fs');
const dir = process.env.QA_OUTPUT || 'qa-results';
const base = process.env.QA_BASE || 'http://127.0.0.1:43120';
(async () => {
    const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    fs.mkdirSync(dir, { recursive: true });
    const results = [];
    const pages = JSON.parse(fs.readFileSync('scripts/wikiang/fixtures/public-documents.json'))
        .wikiang_pages.rows;
    try {
        for (const width of [375, 768, 1440]) {
            const p = await b.newPage({
                viewport: { width, height: 950 },
                ignoreHTTPSErrors: true
            });
            const errors = [];
            p.on('pageerror', (e) => errors.push(e.message));
            await p.goto(base + '/%EB%8C%80%EB%AC%B8', { waitUntil: 'domcontentloaded' });
            await expect(p.getByRole('heading', { name: '주제로 둘러보기' })).toBeVisible();
            await expect(p.locator('.topic')).toHaveCount(4);
            if (width <= 600) {
                const title = await p.locator('.wiki-title').boundingBox();
                const article = await p.locator('.wiki-main').boundingBox();
                if (!title || !article || Math.abs(title.x - article.x) > 2)
                    throw new Error('Mobile article title must align with the reading column');
            }
            if (width <= 900) {
                await p.locator('.mobile-explore summary').click();
                await expect(p.locator('.mobile-explore .wiki-tree')).toBeVisible();
                await p.locator('.mobile-explore summary').click();
            } else {
                await expect(p.locator('.wiki-nav')).toBeVisible();
            }
            await p.getByRole('button', { name: '화면 색상 전환' }).click();
            await expect(p.locator('html')).toHaveClass(/dark/);
            await p.screenshot({ path: dir + `/home-dark-${width}.png`, fullPage: true });
            await p.getByRole('button', { name: '화면 색상 전환' }).click();
            await expect(p.locator('html')).not.toHaveClass(/dark/);
            for (const doc of pages) {
                const r = await p.goto(
                    base + doc.path.split('/').map(encodeURIComponent).join('/'),
                    { waitUntil: 'domcontentloaded', timeout: 60000 }
                );
                await p.locator('.wiki-content').waitFor();
                await p.waitForTimeout(100);
                const result = await p.evaluate(() => ({
                    title: document.title,
                    text: document.querySelector('.wiki-content')?.innerText,
                    overflow: document.documentElement.scrollWidth > innerWidth + 1,
                    headings: [
                        ...document.querySelectorAll(
                            '.wiki-content h2,.wiki-content h3,.wiki-content h4'
                        )
                    ].map((e) => ({ text: e.textContent, id: e.id })),
                    brokenImages: [...document.querySelectorAll('.wiki-content img')]
                        .filter((e) => e.complete && !e.naturalWidth)
                        .map((e) => ({ src: e.getAttribute('src'), alt: e.alt })),
                    links: [...document.querySelectorAll('.wiki-content a')].map((e) => ({
                        href: e.getAttribute('href'),
                        label: e.textContent
                    })),
                    rawArtifacts: /\{\.is-|\[\[|Your content here/.test(
                        document.querySelector('.wiki-content')?.innerText || ''
                    )
                }));
                if (doc.id === 5) {
                    if (width <= 1200) await p.locator('.mobile-toc summary').click();
                    const toc = p.locator(width <= 1200 ? '.mobile-toc' : '.wiki-toc-rail');
                    const first = toc.locator('a').first();
                    await expect(first).toBeVisible();
                    const target = await first.getAttribute('href');
                    await first.click();
                    await expect
                        .poll(() =>
                            p.evaluate((hash) => {
                                const heading = document.getElementById(
                                    decodeURIComponent(hash.slice(1))
                                );
                                return heading
                                    ? Math.abs(heading.getBoundingClientRect().top) < innerHeight
                                    : false;
                            }, target)
                        )
                        .toBe(true);
                    if (width <= 1200) await p.locator('.mobile-toc summary').click();
                    await p.evaluate(() => scrollTo(0, 0));
                }
                results.push({ width, id: doc.id, path: doc.path, status: r.status(), ...result });
                if ([1, 5, 6, 15, 20, 79, 102].includes(doc.id))
                    await p.screenshot({
                        path: dir + `/article-${doc.id}-${width}.png`,
                        fullPage: true
                    });
            }
            fs.writeFileSync(dir + '/crawl.json', JSON.stringify(results, null, 2));
            if (errors.length) throw new Error(errors.join('\n'));
            console.log(
                JSON.stringify({
                    width,
                    documents: pages.length,
                    errors,
                    overflow: results
                        .filter((x) => x.width === width && x.overflow)
                        .map((x) => x.path)
                })
            );
            fs.writeFileSync(dir + '/crawl.json', JSON.stringify(results, null, 2));
            await p.close();
        }
        if (results.some((r) => r.status !== 200 || r.overflow))
            throw new Error('Article HTTP/layout regressions; inspect crawl.json');
    } finally {
        await b.close();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
