/**
 * MySQL + Redis 기반 사이트 설정 Provider
 *
 * 파일 기반(SiteSettingsProvider)이 플러그인 설정과 **같은 결함**을 공유한다:
 * prod web 파드 13개에 볼륨 마운트가 없어 `data/settings/site-settings.json` 이
 * 파드마다 분리된다 → admin 저장이 파드 1개에만 적용되고 재배포 시 소실된다.
 * (플러그인 쪽보다 나쁜 점: 캐시조차 없어 매 요청 파일 I/O 를 한다)
 *
 * 저장 방식은 mysql-plugin-settings-provider 와 동일:
 *   MySQL = 단일 진실 공급원 / Redis = 캐시 / ⛔ 쓰기 시 캐시는 **갱신**(삭제 아님)
 *
 * ⚠️ 이 설정에는 OAuth client secret 이 포함된다. 파일에 평문으로 있던 것과 동일 취급이며
 *    (추가 노출 아님), **값을 로그로 출력하지 말 것**.
 */

import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '$lib/types/admin-settings.js';
import { pool } from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const CACHE_PREFIX = 'angple:settings:';
const SETTINGS_TABLE = 'angple_settings';
const KEY_SITE = 'site_settings';
const CACHE_TTL = 86_400;

interface SettingsRow extends RowDataPacket {
    setting_value: string;
}

export class MySqlSiteSettingsProvider {
    private tableChecked = false;

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
            console.error('[SiteSettings] 테이블 확인 실패:', err);
        }
    }

    /** 전체 설정 로드 (캐시 → DB, 없으면 기본값) */
    async load(): Promise<SiteSettings> {
        try {
            const cached = await getRedis().get(CACHE_PREFIX + KEY_SITE);
            if (cached) {
                return { ...DEFAULT_SITE_SETTINGS, ...(JSON.parse(cached) as SiteSettings) };
            }
        } catch (err) {
            console.error('[SiteSettings] Redis get 실패:', err);
        }

        await this.ensureTable();
        try {
            const [rows] = await pool.query<SettingsRow[]>(
                `SELECT setting_value FROM ${SETTINGS_TABLE} WHERE setting_key = ? LIMIT 1`,
                [KEY_SITE]
            );
            const raw = rows[0]?.setting_value;
            if (!raw) return { ...DEFAULT_SITE_SETTINGS };

            const parsed = JSON.parse(raw) as SiteSettings;
            await this.writeCache(parsed);
            // 기본값과 병합 (새 필드 추가 시 안전 — 파일 구현과 동일)
            return { ...DEFAULT_SITE_SETTINGS, ...parsed };
        } catch (err) {
            console.error('[SiteSettings] MySQL get 실패:', err);
            return { ...DEFAULT_SITE_SETTINGS };
        }
    }

    /** 전체 설정 저장 (DB → 캐시 갱신) */
    async save(settings: SiteSettings): Promise<void> {
        await this.ensureTable();
        await pool.query<ResultSetHeader>(
            `INSERT INTO ${SETTINGS_TABLE} (setting_key, setting_value)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [KEY_SITE, JSON.stringify(settings)]
        );
        await this.writeCache(settings);
    }

    /** 특정 섹션 가져오기 */
    async get<K extends keyof SiteSettings>(section: K): Promise<SiteSettings[K]> {
        return (await this.load())[section];
    }

    /** 특정 섹션 업데이트 */
    async update<K extends keyof SiteSettings>(section: K, data: SiteSettings[K]): Promise<void> {
        const settings = await this.load();
        settings[section] = data;
        await this.save(settings);
    }

    /**
     * ⛔ 캐시는 지우지 않고 갱신한다. 삭제하면 다른 파드가 낡은 소스로 재적재할 창이 생긴다.
     */
    private async writeCache(settings: SiteSettings): Promise<void> {
        try {
            await getRedis().setex(CACHE_PREFIX + KEY_SITE, CACHE_TTL, JSON.stringify(settings));
        } catch (err) {
            console.error('[SiteSettings] Redis set 실패:', err);
        }
    }
}
