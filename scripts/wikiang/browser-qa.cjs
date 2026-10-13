if (process.env.GITHUB_ACTIONS !== 'true')
    throw new Error('QA browsers run on GitHub Actions only.');
const { createRequire } = require('node:module');
const req = createRequire(process.cwd() + '/apps/web/package.json');
const { chromium } = req('playwright');
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
