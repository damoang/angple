/**
 * MySQL + Redis 기반 플러그인 설정 Provider
 *
 * ⭐ 왜 필요한가 (2026-07-31 실측)
 *   파일 기반(JsonPluginSettingsProvider)은 **다중 인스턴스에서 성립하지 않는다.**
 *   prod 는 web 파드 13개에 볼륨 마운트가 없어 `data/plugin-settings.json` 이 이미지에
 *   구워진 채 파드마다 분리된다. admin 에서 플러그인을 켜면
 *     - 요청받은 파드 1개의 파일만 바뀌고 (회원은 붙는 파드에 따라 보였다 안 보였다)
 *     - 재배포하면 레포 커밋본으로 되돌아간다
 *   게다가 activePlugins 의 L2 캐시는 Redis 로 13파드가 **공유**하는데 소스인 파일은
 *   파드별이라, A파드에서 켜고 L2 를 지우면 B파드가 자기 구버전으로 L2 를 재적재해
 *   **A의 변경이 스스로 되돌아가는 flapping** 이 발생했다.
 *
 * 설계는 테마/위젯 설정의 MySqlRedisSettingsProvider 를 그대로 따른다:
 *   - MySQL = 단일 진실 공급원, Redis = 캐시
 *   - ⛔ **쓰기 시 캐시를 지우지 않고 갱신한다.** 지우면 다른 파드가 낡은 소스로
 *     재적재할 여지가 생긴다(위 flapping 의 원인). 갱신이면 13파드가 즉시 같은 값을 본다.
 *
 * ⛔ 테이블은 기존 `angple_settings` 를 재사용한다 — prod 는 AutoMigrate 가 돌지 않아
 *    새 테이블은 수동 DDL 선행이 필요하다. 키 접두사로 테마 설정과 분리한다.
 */

import type { PluginSettingsProvider } from './plugin-settings-provider';
import { pool } from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

/** 테마 설정 provider 와 같은 접두사를 쓴다(같은 캐시 네임스페이스) */
const CACHE_PREFIX = 'angple:settings:';
const SETTINGS_TABLE = 'angple_settings';

/** 활성 목록 키 — 테마의 active_theme / theme_settings_* 와 충돌하지 않는다 */
const KEY_ACTIVE = 'active_plugins';
const keyForPlugin = (pluginId: string) => `plugin_settings_${pluginId}`;

/** 설정은 거의 안 바뀌고 변경 시 즉시 갱신하므로 길게 잡는다 */
const CACHE_TTL = 86_400;

interface SettingsRow extends RowDataPacket {
    setting_value: string;
}

export class MySqlPluginSettingsProvider implements PluginSettingsProvider {
    private tableChecked = false;

    /**
     * 테이블 확인. angple_settings 는 테마 설정이 이미 쓰고 있어 실제로는 no-op 이지만,
     * 신규 설치(셀프호스팅)에서 테마보다 플러그인을 먼저 건드릴 수 있어 남겨둔다.
     */
    private async ensureTable(): Promise<void> {
        if (this.tableChecked) return;
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE} (
                    setting_key VARCHAR(255) PRIMARY KEY,
                    setting_value LONGTEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_updated_at (updated_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            this.tableChecked = true;
        } catch (err) {
            console.error('[PluginSettings] 테이블 확인 실패:', err);
        }
    }

    private async getCache<T>(key: string): Promise<T | null> {
        try {
            const cached = await getRedis().get(CACHE_PREFIX + key);
            if (cached) return JSON.parse(cached) as T;
        } catch (err) {
            console.error('[PluginSettings] Redis get 실패:', err);
        }
        return null;
    }

    private async setCache(key: string, value: unknown): Promise<void> {
        try {
            await getRedis().setex(CACHE_PREFIX + key, CACHE_TTL, JSON.stringify(value));
        } catch (err) {
            console.error('[PluginSettings] Redis set 실패:', err);
        }
    }

    private async getFromDB(key: string): Promise<string | null> {
        await this.ensureTable();
        try {
            const [rows] = await pool.query<SettingsRow[]>(
                `SELECT setting_value FROM ${SETTINGS_TABLE} WHERE setting_key = ? LIMIT 1`,
                [key]
            );
            return rows[0]?.setting_value ?? null;
        } catch (err) {
            console.error('[PluginSettings] MySQL get 실패:', err);
            return null;
        }
    }

    private async setToDB(key: string, value: string): Promise<void> {
        await this.ensureTable();
        await pool.query<ResultSetHeader>(
            `INSERT INTO ${SETTINGS_TABLE} (setting_key, setting_value)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [key, value]
        );
    }

    /** 캐시 → DB 순으로 읽고, DB 히트면 캐시를 채운다 */
    private async get<T>(key: string, fallback: T): Promise<T> {
        const cached = await this.getCache<T>(key);
        if (cached !== null) return cached;

        const raw = await this.getFromDB(key);
        if (raw === null) return fallback;

        try {
            const parsed = JSON.parse(raw) as T;
            await this.setCache(key, parsed);
            return parsed;
        } catch {
            console.error(`[PluginSettings] JSON 파싱 실패 (key=${key})`);
            return fallback;
        }
    }

    /**
     * DB 저장 후 **캐시 갱신**.
     * ⛔ delCache 로 바꾸지 말 것 — 삭제하면 다른 파드가 낡은 값으로 재적재할 창이 생긴다.
     */
    private async set(key: string, value: unknown): Promise<void> {
        await this.setToDB(key, JSON.stringify(value));
        await this.setCache(key, value);
    }

    // ========== PluginSettingsProvider 구현 ==========

    async getActivePlugins(): Promise<string[]> {
        return this.get<string[]>(KEY_ACTIVE, []);
    }

    async activatePlugin(pluginId: string): Promise<void> {
        const active = await this.getActivePlugins();
        if (active.includes(pluginId)) return;
        await this.set(KEY_ACTIVE, [...active, pluginId]);
    }

    async deactivatePlugin(pluginId: string): Promise<void> {
        const active = await this.getActivePlugins();
        if (!active.includes(pluginId)) return;
        await this.set(
            KEY_ACTIVE,
            active.filter((id) => id !== pluginId)
        );
    }

    async getPluginSettings(pluginId: string): Promise<Record<string, unknown>> {
        return this.get<Record<string, unknown>>(keyForPlugin(pluginId), {});
    }

    async setPluginSettings(pluginId: string, settings: Record<string, unknown>): Promise<void> {
        await this.set(keyForPlugin(pluginId), settings);
    }

    /**
     * 전체 설정 조회 (디버깅/백업용).
     * 파일 구현과 같은 모양({activePlugins, plugins, version})으로 돌려준다.
     */
    async getAllPluginSettings(): Promise<Record<string, unknown>> {
        await this.ensureTable();
        const activePlugins = await this.getActivePlugins();
        const plugins: Record<string, { settings: Record<string, unknown> }> = {};
        try {
            const [rows] = await pool.query<
                (RowDataPacket & { setting_key: string; setting_value: string })[]
            >(
                `SELECT setting_key, setting_value FROM ${SETTINGS_TABLE} WHERE setting_key LIKE 'plugin_settings_%'`
            );
            for (const row of rows) {
                const id = row.setting_key.replace(/^plugin_settings_/, '');
                try {
                    plugins[id] = { settings: JSON.parse(row.setting_value) };
                } catch {
                    plugins[id] = { settings: {} };
                }
            }
        } catch (err) {
            console.error('[PluginSettings] 전체 조회 실패:', err);
        }
        return { activePlugins, plugins, version: '1.0.0' };
    }
}
