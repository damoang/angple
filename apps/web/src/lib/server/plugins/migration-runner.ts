import path from 'node:path';
import fs from 'node:fs/promises';
import { pool } from '$lib/server/db';
import type { RowDataPacket } from 'mysql2/promise';
import type { ExtensionMigration } from '@angple/types';

const LOG_PREFIX = '[plugin-migration]';

const TRACKING_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS plugin_migrations (
    plugin_id VARCHAR(50) NOT NULL,
    version VARCHAR(100) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plugin_id, version),
    INDEX idx_plugin (plugin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

let bootstrapped = false;
async function ensureBootstrap(): Promise<void> {
    if (bootstrapped) return;
    await pool.query(TRACKING_TABLE_DDL);

    // Schema drift repair — `CREATE TABLE IF NOT EXISTS` 가 옛 schema 테이블을 SKIP 하여
    // 누락 column 이 추가되지 않은 운영 환경 대비. 검증: SHOW COLUMNS → 누락 시 ALTER (idempotent).
    // 운영 발견 (5/17): 옛 schema 가 plugin_id/version/applied_at 모두 부재 가능성.
    const requiredCols: Array<{ name: string; ddl: string }> = [
        { name: 'plugin_id', ddl: "ADD COLUMN plugin_id VARCHAR(50) NOT NULL DEFAULT ''" },
        { name: 'version', ddl: "ADD COLUMN version VARCHAR(100) NOT NULL DEFAULT ''" },
        { name: 'applied_at', ddl: 'ADD COLUMN applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' }
    ];
    for (const { name, ddl } of requiredCols) {
        const [cols] = await pool.query<RowDataPacket[]>(
            `SHOW COLUMNS FROM plugin_migrations LIKE ?`,
            [name]
        );
        if (cols.length === 0) {
            console.warn(`${LOG_PREFIX} schema drift — adding '${name}' column`);
            await pool.query(`ALTER TABLE plugin_migrations ${ddl}`);
        }
    }

    bootstrapped = true;
}

async function getAppliedVersions(pluginId: string): Promise<Set<string>> {
    await ensureBootstrap();
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT version FROM plugin_migrations WHERE plugin_id = ?',
        [pluginId]
    );
    return new Set(rows.map((r) => r.version as string));
}

// MySQL는 single-statement만 받으므로 ;로 분리해서 순서대로 실행한다.
function splitStatements(sql: string): string[] {
    return sql
        .split(/;\s*\n/m)
        .map((s) => s.trim())
        .filter(Boolean);
}

export interface PluginMigrationResult {
    applied: string[];
    skipped: string[];
}

export async function runPluginMigrations(
    pluginId: string,
    pluginPath: string,
    migrations: ExtensionMigration[] | undefined
): Promise<PluginMigrationResult> {
    const result: PluginMigrationResult = { applied: [], skipped: [] };
    if (!migrations || migrations.length === 0) return result;

    const appliedSet = await getAppliedVersions(pluginId);

    for (const m of migrations) {
        if (appliedSet.has(m.version)) {
            result.skipped.push(m.version);
            continue;
        }
        const sqlPath = path.join(pluginPath, m.up);
        const sql = await fs.readFile(sqlPath, 'utf-8');

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            for (const stmt of splitStatements(sql)) {
                await conn.query(stmt);
            }
            await conn.query('INSERT INTO plugin_migrations (plugin_id, version) VALUES (?, ?)', [
                pluginId,
                m.version
            ]);
            await conn.commit();
            result.applied.push(m.version);
            console.info(`${LOG_PREFIX} applied ${pluginId}@${m.version} (${m.description})`);
        } catch (err) {
            await conn.rollback();
            const message = (err as Error).message;
            throw new Error(`Migration ${pluginId}@${m.version} failed: ${message}`);
        } finally {
            conn.release();
        }
    }

    return result;
}

export interface PluginRollbackResult {
    rolledBack: string[];
    skipped: string[];
}

export async function rollbackPluginMigrations(
    pluginId: string,
    pluginPath: string,
    migrations: ExtensionMigration[] | undefined,
    options: { until?: string } = {}
): Promise<PluginRollbackResult> {
    const result: PluginRollbackResult = { rolledBack: [], skipped: [] };
    if (!migrations || migrations.length === 0) return result;

    const appliedSet = await getAppliedVersions(pluginId);
    const reversed = [...migrations].reverse();

    for (const m of reversed) {
        if (options.until && m.version === options.until) break;
        if (!appliedSet.has(m.version)) continue;
        if (!m.down) {
            result.skipped.push(m.version);
            console.warn(`${LOG_PREFIX} no down script for ${pluginId}@${m.version}, skipped`);
            continue;
        }

        const sqlPath = path.join(pluginPath, m.down);
        const sql = await fs.readFile(sqlPath, 'utf-8');

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            for (const stmt of splitStatements(sql)) {
                await conn.query(stmt);
            }
            await conn.query('DELETE FROM plugin_migrations WHERE plugin_id = ? AND version = ?', [
                pluginId,
                m.version
            ]);
            await conn.commit();
            result.rolledBack.push(m.version);
            console.info(`${LOG_PREFIX} rolled back ${pluginId}@${m.version}`);
        } catch (err) {
            await conn.rollback();
            const message = (err as Error).message;
            throw new Error(`Rollback ${pluginId}@${m.version} failed: ${message}`);
        } finally {
            conn.release();
        }
    }

    return result;
}

export async function getAppliedMigrations(
    pluginId: string
): Promise<Array<{ version: string; appliedAt: Date }>> {
    await ensureBootstrap();
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT version, applied_at FROM plugin_migrations WHERE plugin_id = ? ORDER BY applied_at ASC',
        [pluginId]
    );
    return rows.map((r) => ({ version: r.version as string, appliedAt: r.applied_at as Date }));
}
