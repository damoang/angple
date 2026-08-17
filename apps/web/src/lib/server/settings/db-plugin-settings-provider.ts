/**
 * MySQL(전용 테이블) + Redis 기반 플러그인 설정 Provider — Option C
 *
 * ⭐ 왜 별도 테이블인가 (angple_settings 재사용판인 MySqlPluginSettingsProvider 와의 차이)
 *   활성 목록을 `angple_settings` 의 JSON 배열 1행에 담으면 활성/비활성이
 *   read-modify-write(목록 읽기 → 수정 → 통째로 UPSERT)가 되어, 읽기 순단 중
 *   빈 목록에 하나만 얹어 나머지가 전부 꺼지는 사고에 노출된다.
 *   여기서는 **플러그인당 1행**(angple_plugin_settings)으로 저장해 활성/비활성을
 *   단일 원자적 UPSERT/UPDATE 로 처리한다 — RMW 경쟁이 원천적으로 없다.
 *
 * ⭐ 무효화 (pub/sub 와의 협업)
 *   - MySQL = SoT(단일 진실 공급원, 파드 공유), Redis = L2 캐시(파드 공유), 프로세스 로컬 = L1.
 *   - 쓰기 시 Redis 키를 DEL 하고 로컬 L1 을 비운다. angple_settings 재사용판이 캐시를
 *     "갱신"했던 것과 달리 여기서는 DEL 이 안전하다 — SoT 가 파일(파드별)이 아니라 DB(공유)라
 *     어느 파드가 재적재해도 같은 최신값을 읽기 때문이다. 파드 간 전파는
 *     plugins/invalidation(pub/sub) 이 담당하며, 구독자가 각 파드에서 invalidateLocal() 로
 *     L1 을 비운다.
 *
 * ⛔ 신규 설치(셀프호스팅)는 DB 스키마가 없을 수 있다 — ensureTable() 은 best-effort 이며
 *    실패해도 throw 하지 않는다(mysql-plugin-settings-provider 선례). prod 는 006 DDL 을
 *    수동 선행 적용한다(AutoMigrate 미실행).
 */

import type { PluginSettingsProvider } from './plugin-settings-provider';
import { pool, readPool } from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const TABLE = 'angple_plugin_settings';

/** Redis 캐시 키 */
const KEY_ACTIVE = 'angple:plugin:active';
const keyForSettings = (pluginId: string) => `angple:plugin:settings:${pluginId}`;

/** 활성 목록 캐시 TTL(초). 변경 시 DEL + pub/sub 로 즉시 무효화되므로 넉넉히 잡는다. */
const CACHE_TTL = 300;

interface ActiveRow extends RowDataPacket {
    plugin_id: string;
}

interface SettingsRow extends RowDataPacket {
    settings: string | Record<string, unknown> | null;
}

interface L1Entry<T> {
    value: T;
    expiry: number;
}

/**
 * MySQL 전용 테이블 + Redis 기반 플러그인 설정 Provider.
 * PluginSettingsProvider 인터페이스의 drop-in 구현.
 */
export class DbPluginSettingsProvider implements PluginSettingsProvider {
    private tableChecked = false;

    /** 프로세스 로컬 L1 캐시. pub/sub 구독자가 invalidateLocal() 로 비운다. */
    private local = new Map<string, L1Entry<unknown>>();
    private static readonly L1_TTL_MS = CACHE_TTL * 1000;

    // ========== 캐시 헬퍼 ==========

    private getLocal<T>(key: string): T | null {
        const e = this.local.get(key);
        if (e && Date.now() < e.expiry) return e.value as T;
        if (e) this.local.delete(key);
        return null;
    }

    private setLocal<T>(key: string, value: T): void {
        this.local.set(key, { value, expiry: Date.now() + DbPluginSettingsProvider.L1_TTL_MS });
    }

    private async getCache<T>(key: string): Promise<T | null> {
        try {
            const cached = await getRedis().get(key);
            if (cached) return JSON.parse(cached) as T;
        } catch (err) {
            console.error('[PluginSettings/DB] Redis get 실패:', err);
        }
        return null;
    }

    private async setCache(key: string, value: unknown): Promise<void> {
        try {
            await getRedis().setex(key, CACHE_TTL, JSON.stringify(value));
        } catch (err) {
            console.error('[PluginSettings/DB] Redis set 실패:', err);
        }
    }

    private async delCache(key: string): Promise<void> {
        try {
            await getRedis().del(key);
        } catch (err) {
            console.error('[PluginSettings/DB] Redis del 실패:', err);
        }
    }

    /**
     * 테이블 확인. prod 는 006 DDL 이 선행되므로 no-op 이지만, 신규 설치에서
     * 플러그인을 먼저 건드릴 수 있어 남긴다. ⛔ 실패해도 throw 하지 않는다.
     */
    private async ensureTable(): Promise<void> {
        if (this.tableChecked) return;
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS ${TABLE} (
                    plugin_id VARCHAR(100) PRIMARY KEY,
                    is_active TINYINT(1) NOT NULL DEFAULT 0,
                    settings JSON NULL,
                    activated_at DATETIME NULL,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_is_active (is_active)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            this.tableChecked = true;
        } catch (err) {
            console.error('[PluginSettings/DB] 테이블 확인 실패(무시):', err);
        }
    }

    /** JSON 컬럼은 드라이버 설정에 따라 문자열 또는 객체로 온다 — 양쪽 모두 안전 처리. */
    private parseSettings(raw: SettingsRow['settings']): Record<string, unknown> {
        if (raw == null) return {};
        if (typeof raw === 'object') return raw as Record<string, unknown>;
        try {
            return JSON.parse(raw) as Record<string, unknown>;
        } catch {
            return {};
        }
    }

    // ========== PluginSettingsProvider 구현 ==========

    async getActivePlugins(): Promise<string[]> {
        const l1 = this.getLocal<string[]>(KEY_ACTIVE);
        if (l1 !== null) return l1;

        const cached = await this.getCache<string[]>(KEY_ACTIVE);
        if (cached !== null) {
            this.setLocal(KEY_ACTIVE, cached);
            return cached;
        }

        try {
            await this.ensureTable();
            const [rows] = await readPool.query<ActiveRow[]>(
                `SELECT plugin_id FROM ${TABLE} WHERE is_active = 1 ORDER BY activated_at, plugin_id`
            );
            const ids = rows.map((r) => r.plugin_id);
            this.setLocal(KEY_ACTIVE, ids);
            await this.setCache(KEY_ACTIVE, ids);
            return ids;
        } catch (err) {
            // 읽기 전용 경로 — 실패 시 빈 목록으로 흡수(화면 전체가 죽지 않게).
            console.error('[PluginSettings/DB] 활성 목록 조회 실패, 빈 목록 사용:', err);
            return [];
        }
    }

    async activatePlugin(pluginId: string): Promise<void> {
        await this.ensureTable();
        // 원자적 UPSERT — 목록 전체를 읽고 덮어쓰지 않는다(RMW 경쟁 없음).
        await pool.query<ResultSetHeader>(
            `INSERT INTO ${TABLE} (plugin_id, is_active, activated_at)
             VALUES (?, 1, NOW())
             ON DUPLICATE KEY UPDATE is_active = 1, activated_at = NOW()`,
            [pluginId]
        );
        await this.delCache(KEY_ACTIVE);
        this.invalidateLocal();
    }

    async deactivatePlugin(pluginId: string): Promise<void> {
        await this.ensureTable();
        await pool.query<ResultSetHeader>(`UPDATE ${TABLE} SET is_active = 0 WHERE plugin_id = ?`, [
            pluginId
        ]);
        await this.delCache(KEY_ACTIVE);
        this.invalidateLocal();
    }

    async getPluginSettings(pluginId: string): Promise<Record<string, unknown>> {
        const cacheKey = keyForSettings(pluginId);

        const l1 = this.getLocal<Record<string, unknown>>(cacheKey);
        if (l1 !== null) return l1;

        const cached = await this.getCache<Record<string, unknown>>(cacheKey);
        if (cached !== null) {
            this.setLocal(cacheKey, cached);
            return cached;
        }

        try {
            await this.ensureTable();
            const [rows] = await readPool.query<SettingsRow[]>(
                `SELECT settings FROM ${TABLE} WHERE plugin_id = ? LIMIT 1`,
                [pluginId]
            );
            const settings = rows[0] ? this.parseSettings(rows[0].settings) : {};
            this.setLocal(cacheKey, settings);
            await this.setCache(cacheKey, settings);
            return settings;
        } catch (err) {
            console.error(`[PluginSettings/DB] 설정 조회 실패 (id=${pluginId}):`, err);
            return {};
        }
    }

    async setPluginSettings(pluginId: string, settings: Record<string, unknown>): Promise<void> {
        await this.ensureTable();
        // 설정만 갱신 — is_active/activated_at 은 기존값 유지(신규 행이면 기본 0).
        await pool.query<ResultSetHeader>(
            `INSERT INTO ${TABLE} (plugin_id, settings)
             VALUES (?, CAST(? AS JSON))
             ON DUPLICATE KEY UPDATE settings = VALUES(settings)`,
            [pluginId, JSON.stringify(settings)]
        );
        await this.delCache(keyForSettings(pluginId));
        this.invalidateLocal();
    }

    /**
     * 전체 설정 조회 (디버깅/백업용).
     * 파일 구현과 같은 모양({activePlugins, plugins, version})으로 돌려준다.
     */
    async getAllPluginSettings(): Promise<Record<string, unknown>> {
        await this.ensureTable();
        const plugins: Record<string, { settings: Record<string, unknown>; activatedAt?: string }> =
            {};
        const activePlugins: string[] = [];
        try {
            const [rows] = await readPool.query<
                (RowDataPacket & {
                    plugin_id: string;
                    is_active: number;
                    settings: SettingsRow['settings'];
                    activated_at: Date | string | null;
                })[]
            >(
                `SELECT plugin_id, is_active, settings, activated_at FROM ${TABLE} ORDER BY activated_at, plugin_id`
            );
            for (const row of rows) {
                plugins[row.plugin_id] = {
                    settings: this.parseSettings(row.settings),
                    activatedAt: row.activated_at
                        ? new Date(row.activated_at).toISOString()
                        : undefined
                };
                if (row.is_active) activePlugins.push(row.plugin_id);
            }
        } catch (err) {
            console.error('[PluginSettings/DB] 전체 조회 실패:', err);
        }
        return { activePlugins, plugins, version: '1.0.0' };
    }

    /**
     * 프로세스 로컬(L1) 캐시 전체 비우기.
     * pub/sub 구독자가 다른 파드의 변경을 수신했을 때 호출한다(파드 간 전파).
     */
    invalidateLocal(): void {
        this.local.clear();
    }
}
