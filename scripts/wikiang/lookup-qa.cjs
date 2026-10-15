if (process.env.GITHUB_ACTIONS !== 'true' || process.env.DB_NAME !== 'wikiang_qa')
    throw new Error('Isolated CI only');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const req = createRequire(process.cwd() + '/apps/web/package.json');
const mysql = req('mysql2/promise');
const base = process.env.QA_BASE;
if (base !== 'http://127.0.0.1:43120') throw new Error('Isolated CI URL required');

(async () => {
    const db = await mysql.createConnection({
        host: '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: 'wikiang_qa'
    });
    const prefix = 'QA_lookup_';
    const fixtures = [
        ['public', '/QA_lookup_canonical', 1, 0, 0],
        ['private', '/QA_lookup_private', 1, 1, 0],
        ['draft', '/QA_lookup_draft', 0, 0, 0],
        ['discussion', '/QA_lookup_discussion', 1, 0, 1],
        ['duplicate', '/QA_lookup_duplicate_1', 1, 0, 0],
        ['duplicate', '/QA_lookup_duplicate_2', 1, 0, 0]
    ];
    try {
        for (const [name, path, published, privatePage, namespace] of fixtures) {
            await db.query(
                'INSERT INTO wikiang_pages (title,path,slug,is_published,is_private,namespace_id) VALUES (?,?,?,?,?,?)',
                [prefix + name, path, path.slice(1), published, privatePage, namespace]
            );
        }
        const query = new URLSearchParams();
        for (const name of ['public', 'private', 'draft', 'discussion', 'duplicate', 'absent'])
            query.append('title', prefix + name);
        const response = await fetch(base + '/api/wiki/lookup?' + query);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.checked.length, 6);
        assert.deepEqual(body.pages, [{ title: prefix + 'public', path: '/QA_lookup_canonical' }]);
        const tooMany = new URLSearchParams();
        for (let i = 0; i < 21; i++) tooMany.append('title', prefix + i);
        assert.equal((await fetch(base + '/api/wiki/lookup?' + tooMany)).status, 400);
        console.log(
            'Public lookup: canonical path, private/draft/namespace exclusion, ambiguity and bounds passed'
        );
    } finally {
        await db.query('DELETE FROM wikiang_pages WHERE title LIKE ?', [prefix + '%']);
        await db.end();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
