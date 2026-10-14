if (process.env.GITHUB_ACTIONS !== 'true')
    throw new Error('QA database fixtures run on GitHub Actions only.');
const { createRequire } = require('node:module');
const req = createRequire(process.cwd() + '/apps/web/package.json');
const mysql = req('mysql2/promise');
const fs = require('node:fs');
(async () => {
    if (process.env.DB_HOST !== '127.0.0.1' || process.env.DB_NAME !== 'wikiang_qa')
        throw new Error('Isolated CI database required');
    const c = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    const data = JSON.parse(fs.readFileSync('scripts/wikiang/fixtures/public-documents.json'));
    await c.query('SET FOREIGN_KEY_CHECKS=0');
    for (const v of Object.values(data)) {
        await c.query(v.ddl.replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS'));
        for (const row of v.rows) {
            const names = Object.keys(row);
            await c.query(
                'INSERT IGNORE INTO ' +
                    v.ddl.match(/CREATE TABLE `([^`]+)`/)[1] +
                    ' (`' +
                    names.join('`,`') +
                    '`) VALUES (' +
                    names.map(() => '?').join(',') +
                    ')',
                names.map((k) =>
                    row[k] === null
                        ? null
                        : typeof row[k] === 'object'
                          ? JSON.stringify(row[k])
                          : typeof row[k] === 'string' &&
                              /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(row[k])
                            ? row[k].replace('T', ' ').slice(0, 19)
                            : row[k]
                )
            );
        }
    }
    await c.query('SET FOREIGN_KEY_CHECKS=1');
    await c.query(fs.readFileSync('migrations/003_wikiang_google_accounts.sql', 'utf8'));
    await c.end();
    console.log('Public document fixture seeded in isolated CI database.');
})().catch((e) => {
    console.error(e.code, e.message);
    process.exit(1);
});
