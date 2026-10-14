if (
    process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.QA_BASE !== 'http://127.0.0.1:43120' ||
    process.env.DB_NAME !== 'wikiang_qa'
)
    throw new Error('Isolated GitHub Actions only');
const { createRequire } = require('node:module');
const req = createRequire(process.cwd() + '/apps/web/package.json');
const { chromium, expect } = req('@playwright/test');
const mysql = req('mysql2/promise');
const Redis = req('ioredis');
const { randomBytes, createHash } = require('node:crypto');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
    const base = process.env.QA_BASE,
        out = process.env.QA_OUTPUT || 'qa-results';
    const db = await mysql.createConnection({
        host: '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'wikiang_qa'
    });
    const redis = new Redis({ host: '127.0.0.1' });
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const checks = [];
    try {
        await context.addCookies([
            { name: 'damoang_jwt', value: 'forged-community-token', url: base },
            { name: 'angple_sid', value: 'old-community-session', url: base }
        ]);
        await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(base + '/wiki-auth');
        await expect(page.getByRole('heading', { name: '위키앙 로그인' })).toBeVisible();
        for (const width of [375, 768, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await expect(page.getByRole('link', { name: 'Google 계정으로 계속' })).toBeVisible();
            assert.equal(
                await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
                false
            );
            await page.screenshot({ path: out + '/wiki-login-' + width + '.png', fullPage: true });
        }
        for (const path of [
            '/auth/start?provider=google',
            '/api/auth/login',
            '/api/auth/logout',
            '/register'
        ]) {
            const r = await context.request.get(base + path);
            assert.equal(r.status(), 404);
        }
        checks.push(
            'Independent login UI at three widths; community credentials ignored and endpoints blocked'
        );
        const start = await context.request.get(base + '/wiki-auth/google?returnTo=//evil.test', {
            maxRedirects: 0
        });
        assert.equal(start.status(), 303);
        const target = new URL(start.headers().location);
        assert.equal(target.origin, 'https://accounts.google.com');
        assert.equal(target.searchParams.get('client_id'), process.env.WIKIANG_GOOGLE_CLIENT_ID);
        assert.equal(target.searchParams.get('scope'), 'openid');
        assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
        const bad = await context.request.get(base + '/wiki-auth/callback?state=wrong&code=fake', {
            maxRedirects: 0
        });
        assert.equal(bad.headers().location, '/wiki-auth?failed=1');
        checks.push('OAuth start uses Wikiang credentials and PKCE; invalid callback rejected');
        const [created] = await db.query(
            "INSERT INTO wikiang_users (username,display_name,provider) VALUES ('ci_wiki_member','위키검증회원','google')"
        );
        const token = randomBytes(32).toString('base64url'),
            csrf = randomBytes(32).toString('base64url');
        const key = 'wikiang:auth:session:' + createHash('sha256').update(token).digest('hex');
        await redis.set(key, JSON.stringify({ userId: created.insertId, csrf }), 'EX', 600);
        await context.addCookies([
            { name: 'wikiang_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' }
        ]);
        await page.goto(base + '/대문', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.account')).toHaveText('위키검증회원');
        const [[doc]] = await db.query(
            "SELECT id,path,title,content,content_type FROM wikiang_pages WHERE path='/QA_편집_검증'"
        );
        const [[rev]] = await db.query(
            'SELECT MAX(version_number) n FROM wikiang_revisions WHERE page_id=?',
            [doc.id]
        );
        const body = {
            title: doc.title,
            content: doc.content,
            content_type: doc.content_type,
            base_revision: rev.n,
            comment: '독립 계정 귀속 확인'
        };
        const forbidden = await context.request.put(base + '/api/wiki/pages/' + doc.id, {
            data: body
        });
        assert.equal(forbidden.status(), 403);
        const foreign = await context.request.put(base + '/api/wiki/pages/' + doc.id, {
            data: body,
            headers: { Origin: 'https://evil.test', 'X-CSRF-Token': csrf }
        });
        assert.equal(foreign.status(), 403);
        const write = await context.request.put(base + '/api/wiki/pages/' + doc.id, {
            data: body,
            headers: { 'X-CSRF-Token': csrf }
        });
        assert.equal(write.status(), 200);
        const [[author]] = await db.query(
            'SELECT author_id FROM wikiang_revisions WHERE page_id=? ORDER BY id DESC LIMIT 1',
            [doc.id]
        );
        assert.equal(author.author_id, created.insertId);
        await page.goto(base + doc.path + '/history', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.history-page')).toContainText('위키검증회원');
        checks.push(
            'Wiki session drives header and revision attribution; missing CSRF and foreign origin rejected'
        );
        const oldLogout = await context.request.get(base + '/wiki-auth/logout');
        assert.equal(oldLogout.status(), 405);
        await page.goto(base + '/wiki-auth', { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: '로그아웃', exact: true }).click();
        await expect(page.locator('.account')).toHaveText('로그인');
        assert.equal(await redis.get(key), null);
        checks.push('POST logout revokes server session and clears independent login');
        assert.deepEqual(errors, []);
        fs.writeFileSync(out + '/auth.json', JSON.stringify({ checks, errors }, null, 2));
    } finally {
        await browser.close();
        await db.end();
        await redis.quit();
    }
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
