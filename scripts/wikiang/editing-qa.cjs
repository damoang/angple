if (process.env.GITHUB_ACTIONS !== 'true')
    throw new Error('Editing QA runs on GitHub Actions only.');
const { createRequire } = require('node:module');
const req = createRequire(process.cwd() + '/apps/web/package.json');
const { chromium, expect } = req('@playwright/test');
const mysql = req('mysql2/promise');
const Redis = req('ioredis');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = process.env.QA_BASE;
const out = process.env.QA_OUTPUT || 'qa-results';
if (base !== 'http://127.0.0.1:43120' || process.env.DB_NAME !== 'wikiang_qa')
    throw new Error('Isolated CI app required');
(async () => {
    fs.mkdirSync(out, { recursive: true });
    const db = await mysql.createConnection({
        host: '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'wikiang_qa'
    });
    const redis = new Redis({ host: '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379) });
    const resetLimit = async () => {
        const keys = await redis.keys('wiki:rl:*');
        if (keys.length) await redis.del(...keys);
    };
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
    // External imported images may never finish loading; readiness is asserted on UI controls below.
    const navigate = (url) => page.goto(url, { waitUntil: 'domcontentloaded' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const checks = [];
    const source =
        '## 저장 검증\n\n**굵은 글씨**와 [[다모앙]]\n\n| 제목 | 값 |\n|---|---|\n| 보존 | 123 |\n\n`[[코드 원문]]`\n\n<details><summary>펼쳐 보기</summary>숨은 설명</details>\n\n<img src=x onerror="window.__wikiXss=1">';
    let documentId;
    try {
        await navigate(base + '/Special:NewPage');
        await page.getByRole('textbox', { name: '새 문서 제목' }).fill('QA_편집_검증');
        await page.getByRole('button', { name: '편집 시작' }).click();
        await page.locator('#wiki-content-source').fill(source);
        await page.getByRole('button', { name: '미리보기', exact: true }).click();
        await expect(page.locator('.md-preview table')).toBeVisible();
        await page.screenshot({ path: out + '/editor-preview-375.png', fullPage: true });
        const created = page.waitForResponse(
            (r) => r.url().endsWith('/api/wiki/pages') && r.request().method() === 'POST'
        );
        await page.getByRole('button', { name: '문서 생성', exact: true }).click();
        const createdResponse = await created;
        assert.equal(createdResponse.status(), 200);
        await expect(page.locator('.wiki-content')).toBeVisible();
        const [[createdRow]] = await db.query('SELECT id FROM wikiang_pages WHERE path=?', [
            '/QA_편집_검증'
        ]);
        documentId = createdRow.id;
        await expect(page.locator('.wiki-content strong')).toHaveText('굵은 글씨');
        assert.equal(await page.evaluate(() => window.__wikiXss), undefined);
        const [[row]] = await db.query(
            'SELECT content, content_raw, content_type FROM wikiang_pages WHERE id=?',
            [documentId]
        );
        assert.equal(row.content, source);
        assert.equal(row.content_raw, source);
        assert.equal(row.content_type, 'markdown');
        checks.push('UI create → preview → save → rendered article → exact DB source');

        await navigate(base + '/QA_편집_검증/edit');
        await expect(page.locator('#wiki-content-source')).toHaveValue(source);
        await page.locator('#wiki-content-source').fill(source + '\n\n추가한 문장');
        const updated = page.waitForResponse(
            (r) =>
                r.url().endsWith('/api/wiki/pages/' + documentId) && r.request().method() === 'PUT'
        );
        await page.getByRole('button', { name: '저장', exact: true }).click();
        assert.equal((await updated).status(), 200);
        await expect(page.locator('.wiki-content')).toContainText('추가한 문장');
        checks.push('UI reopen → edit → save → latest article');

        let response = await page.request.put(base + '/api/wiki/pages/' + documentId, {
            data: {
                title: 'QA_편집_검증',
                content: 'stale edit',
                content_type: 'markdown',
                base_revision: 1
            }
        });
        assert.equal(response.status(), 409);
        checks.push('Stale editor receives 409; latest content remains intact');
        await navigate(base + '/QA_편집_검증/history');
        await expect(page.locator('.history-page')).toContainText('익명(');
        page.once('dialog', (d) => d.accept());
        const reverted = page.waitForResponse((r) => r.url().endsWith('/revert'));
        await page.getByRole('button', { name: '되돌리기', exact: true }).first().click();
        assert.equal((await reverted).status(), 200);
        await expect(page.locator('.wiki-content')).not.toContainText('추가한 문장');
        const [[versions]] = await db.query(
            'SELECT COUNT(*) n, COUNT(author_ip_hash) attributed FROM wikiang_revisions WHERE page_id=?',
            [documentId]
        );
        assert.equal(versions.n, 3);
        assert.equal(versions.attributed, 3);
        checks.push('UI history/revert preserves all 3 revisions and anonymous attribution');
        await resetLimit();
        const race = await Promise.all(
            ['동시 수정 A', '동시 수정 B'].map((content) =>
                page.request.put(base + '/api/wiki/pages/' + documentId, {
                    data: {
                        title: 'QA_편집_검증',
                        content,
                        content_type: 'markdown',
                        base_revision: 3
                    }
                })
            )
        );
        assert.deepEqual(race.map((response) => response.status()).sort(), [200, 409]);
        const [[raceVersions]] = await db.query(
            'SELECT COUNT(*) n, MAX(version_number) latest FROM wikiang_revisions WHERE page_id=?',
            [documentId]
        );
        assert.equal(raceVersions.n, 4);
        assert.equal(raceVersions.latest, 4);
        checks.push('Two concurrent saves: exactly one commit and one conflict');
        await resetLimit();

        response = await page.request.post(base + '/api/wiki/pages', {
            data: {
                path: '/QA_편집_검증',
                title: '중복',
                content: '중복',
                content_type: 'markdown'
            }
        });
        assert.equal(response.status(), 409);
        response = await page.request.post(base + '/api/wiki/pages', {
            data: {
                path: '/api/private',
                title: '예약 경로',
                content: '내용',
                content_type: 'markdown'
            }
        });
        assert.equal(response.status(), 400);
        response = await page.request.put(base + '/api/wiki/pages/' + documentId, {
            data: { title: '빈 문서', content: '', content_type: 'markdown', base_revision: 3 }
        });
        assert.equal(response.status(), 400);
        checks.push('Duplicate/invalid path/empty source reject without overwriting data');
        await resetLimit();

        const docs = JSON.parse(fs.readFileSync('scripts/wikiang/fixtures/public-documents.json'))
            .wikiang_pages.rows;
        // Every editable imported document must open the same source that readers see.
        for (const doc of docs.filter((d) => d.namespace_id !== 8)) {
            await navigate(base + doc.path.split('/').map(encodeURIComponent).join('/') + '/edit');
            await expect(page.locator('#wiki-content-source')).toHaveValue(
                doc.content ?? doc.content_raw ?? ''
            );
        }
        checks.push(
            'All ' +
                docs.filter((d) => d.namespace_id !== 8).length +
                ' editable public documents open the rendered-format source'
        );
        const htmlDoc = docs.find((d) => d.content_type === 'html');
        await navigate(base + htmlDoc.path.split('/').map(encodeURIComponent).join('/') + '/edit');
        const htmlSave = page.waitForResponse(
            (r) =>
                r.url().endsWith('/api/wiki/pages/' + htmlDoc.id) && r.request().method() === 'PUT'
        );
        await page.getByRole('button', { name: '저장', exact: true }).click();
        assert.equal((await htmlSave).status(), 200);
        const [[htmlRow]] = await db.query(
            'SELECT content,content_type FROM wikiang_pages WHERE id=?',
            [htmlDoc.id]
        );
        assert.equal(htmlRow.content, htmlDoc.content);
        assert.equal(htmlRow.content_type, 'html');
        checks.push('HTML save round trip preserves exact HTML and format');
        await navigate(base + '/QA_편집_검증/edit');
        await expect(page.locator('#wiki-content-source')).toBeEnabled();
        await page.getByRole('button', { name: '화면 색상 전환' }).click();
        await expect(page.locator('html')).toHaveClass(/dark/);
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const source = document.querySelector('#wiki-content-source');
                    return ['title', 'description', 'comment'].every(
                        (id) =>
                            getComputedStyle(document.getElementById(id)).color ===
                            getComputedStyle(source).color
                    );
                })
            )
            .toBe(true);
        await page.screenshot({ path: out + '/editor-dark-375.png', fullPage: true });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(page.locator('html')).toHaveClass(/dark/);
        await page.getByRole('button', { name: '화면 색상 전환' }).click();
        await expect(page.locator('html')).not.toHaveClass(/dark/);
        checks.push('Mobile dark editor is readable and toggles without losing source');
        for (const width of [375, 768, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await navigate(base + '/Special:Search?q=' + encodeURIComponent('라즈베리파이'));
            await expect(page.locator('.special')).toContainText('라즈베리파이');
            assert.equal(
                await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
                false
            );
            await page.screenshot({ path: out + '/search-' + width + '.png', fullPage: true });
        }
        for (const route of [
            '/특수:최근바뀜',
            '/특수:분류',
            '/특수:새문서',
            '/w/다모앙',
            '/wiki/다모앙'
        ]) {
            response = await navigate(base + route);
            assert.equal(response.status(), 200);
            await expect(page.locator('main')).not.toContainText('이 기능은 준비 중입니다.');
            await expect(page.locator('main')).not.toContainText(
                '이 문서는 아직 위키앙에 없습니다.'
            );
        }
        response = await page.request.get(base + '/sitemap.xml');
        assert.match(await response.text(), /sitemap-wiki.xml/);
        response = await page.request.get(base + '/sitemap-wiki.xml');
        assert.doesNotMatch(await response.text(), /wikiang.org\/wiki\//);
        checks.push('Public search, Korean aliases, old Damoang URLs and sitemap pass');
        assert.deepEqual(errors, []);
        fs.writeFileSync(out + '/editing.json', JSON.stringify({ checks, errors }, null, 2));
        console.log(checks.join('\n'));
    } finally {
        fs.writeFileSync(
            out + '/editing-progress.json',
            JSON.stringify({ checks, errors }, null, 2)
        );
        await page
            .screenshot({ path: out + '/editing-last-screen.png', fullPage: true })
            .catch(() => {});
        await browser.close();
        await db.end();
        await redis.quit();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
