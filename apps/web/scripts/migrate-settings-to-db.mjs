#!/usr/bin/env node
/**
 * 플러그인·사이트 설정 파일 → DB 1회 이전
 *
 * 파일 기반 저장소는 다중 파드에서 성립하지 않는다(파드별 분리·재배포 시 소실).
 * 이 스크립트가 기존 파일 내용을 `angple_settings` 로 옮긴다.
 *
 * ⛔ **멱등**하다: DB 에 이미 값이 있으면 건너뛴다. 여러 번 돌려도 덮어쓰지 않는다.
 *    (덮어쓰기가 필요하면 --force)
 * ⛔ 파일은 지우지 않는다 — env 를 json 으로 되돌리면 즉시 복귀하는 롤백 경로다.
 * ⛔ 운영 DB 쓰기이므로 사장님이 직접 실행한다.
 *
 * 사용:
 *   node apps/web/scripts/migrate-settings-to-db.mjs --dry-run   # 무엇이 옮겨질지만 출력
 *   node apps/web/scripts/migrate-settings-to-db.mjs             # 실제 이전(멱등)
 *   node apps/web/scripts/migrate-settings-to-db.mjs --force     # 기존 DB 값 덮어쓰기
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import mysql from 'mysql2/promise';

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const TABLE = 'angple_settings';

const CWD = process.cwd();
const PLUGIN_FILE = path.join(CWD, 'data', 'plugin-settings.json');
const SITE_FILE = path.join(CWD, 'data', 'settings', 'site-settings.json');

async function readJson(file) {
    try {
        return JSON.parse(await fs.readFile(file, 'utf-8'));
    } catch {
        return null;
    }
}

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    await conn.query(`
        CREATE TABLE IF NOT EXISTS ${TABLE} (
            setting_key VARCHAR(255) PRIMARY KEY,
            setting_value LONGTEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /** DB 에 이미 있으면 건너뛴다(멱등). --force 면 덮어쓴다. */
    async function put(key, value, label) {
        const [rows] = await conn.query(
            `SELECT setting_key FROM ${TABLE} WHERE setting_key = ? LIMIT 1`,
            [key]
        );
        if (rows.length > 0 && !FORCE) {
            console.log(`  = ${label} (${key}) — DB 에 이미 있음, 건너뜀`);
            return;
        }
        const json = JSON.stringify(value);
        if (DRY) {
            // ⛔ 값을 찍지 않는다 — 사이트 설정에는 OAuth client secret 이 들어 있다.
            //    키와 크기만으로 무엇이 옮겨질지 판단할 수 있다.
            console.log(`  + ${label} (${key}) — ${json.length} bytes`);
            return;
        }
        await conn.query(
            `INSERT INTO ${TABLE} (setting_key, setting_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [key, json]
        );
        console.log(`  ✓ ${label} (${key})`);
    }

    console.log(`\n[플러그인 설정] ${PLUGIN_FILE}`);
    const plugin = await readJson(PLUGIN_FILE);
    if (!plugin) {
        console.log('  파일 없음 — 건너뜀');
    } else {
        const active = plugin.activePlugins ?? [];
        await put('active_plugins', active, `활성 ${active.length}개`);
        for (const [id, entry] of Object.entries(plugin.plugins ?? {})) {
            if (!entry?.settings || Object.keys(entry.settings).length === 0) continue;
            await put(`plugin_settings_${id}`, entry.settings, `${id} 설정`);
        }
    }

    console.log(`\n[사이트 설정] ${SITE_FILE}`);
    const site = await readJson(SITE_FILE);
    if (!site) {
        console.log('  파일 없음 — 건너뜀');
    } else {
        // ⚠️ OAuth secret 이 포함되므로 값을 출력하지 않는다
        await put('site_settings', site, `사이트 설정 (${Object.keys(site).length}개 섹션)`);
    }

    await conn.end();
    console.log(
        `\n완료${DRY ? ' (dry-run — 아무것도 쓰지 않았다)' : ''}. ` +
            `적용하려면 .env 에 PLUGIN_SETTINGS_PROVIDER=mysql / SITE_SETTINGS_PROVIDER=mysql 후 재배포.`
    );
}

main().catch((err) => {
    console.error('이전 실패:', err);
    process.exit(1);
});
