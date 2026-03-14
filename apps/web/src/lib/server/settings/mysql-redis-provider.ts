/**
 * MySQL + Redis 기반 설정 Provider
 *
 * - MySQL: Source of Truth (영속성)
 * - Redis: 캐시 (성능, 분산 환경 공유)
 *
 * 동시접속 6천~2만명 대응 설계
 * - 읽기: Redis 캐시 우선 (0.1ms), 미스 시 MySQL 조회 후 캐시
 * - 쓰기: MySQL 저장 후 Redis 캐시 갱신 (모든 Pod 즉시 반영)
 */

import type { SettingsProvider } from './provider';
import type { WidgetConfig } from '$lib/stores/widget-layout.svelte';
import { pool } from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

// 캐시 키 접두사
const CACHE_PREFIX = 'angple:settings:';

// 캐시 TTL (초) — 설정은 거의 안 바뀜. 변경 시 Redis DEL로 무효화
const CACHE_TTL = {
    THEME: 86_400, // 24시간 - 테마 변경 시 수동 무효화
    WIDGET_LAYOUT: 604_800, // 7일 - 레이아웃 변경 시 수동 무효화
    DEFAULT: 300 // 5분 - 기타 설정
};

// 설정 저장용 테이블 (없으면 자동 생성)
const SETTINGS_TABLE = 'angple_settings';

interface SettingsRow extends RowDataPacket {
    setting_key: string;
    setting_value: string;
    updated_at: Date;
}

export class MySqlRedisSettingsProvider implements SettingsProvider {
    private tableChecked = false;

    /**
     * 테이블 존재 확인 및 생성
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
            console.error('[Settings] Failed to create table:', err);
        }
    }

    /**
     * Redis에서 캐시 조회
     */
    private async getCache<T>(key: string): Promise<T | null> {
        try {
            const redis = getRedis();
            const cached = await redis.get(CACHE_PREFIX + key);
            if (cached) {
                return JSON.parse(cached) as T;
            }
        } catch (err) {
            console.error('[Settings] Redis get error:', err);
        }
        return null;
    }

    /**
     * Redis에 캐시 저장
     */
    private async setCache(key: string, value: unknown, ttl: number): Promise<void> {
        try {
            const redis = getRedis();
            await redis.setex(CACHE_PREFIX + key, ttl, JSON.stringify(value));
        } catch (err) {
            console.error('[Settings] Redis set error:', err);
        }
    }

    /**
     * Redis 캐시 삭제
     */
    private async delCache(key: string): Promise<void> {
        try {
            const redis = getRedis();
            await redis.del(CACHE_PREFIX + key);
        } catch (err) {
            console.error('[Settings] Redis del error:', err);
        }
    }

    /**
     * MySQL에서 설정 조회
     */
    private async getFromDB(key: string): Promise<string | null> {
        await this.ensureTable();
        try {
            const [rows] = await pool.query<SettingsRow[]>(
                `SELECT setting_value FROM ${SETTINGS_TABLE} WHERE setting_key = ? LIMIT 1`,
                [key]
            );
            return rows[0]?.setting_value ?? null;
        } catch (err) {
            console.error('[Settings] MySQL get error:', err);
            return null;
        }
    }

    /**
     * MySQL에 설정 저장 (UPSERT)
     */
    private async setToDB(key: string, value: string): Promise<void> {
        await this.ensureTable();
        try {
            await pool.query<ResultSetHeader>(
                `INSERT INTO ${SETTINGS_TABLE} (setting_key, setting_value)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
                [key, value]
            );
        } catch (err) {
            console.error('[Settings] MySQL set error:', err);
            throw err;
        }
    }

    /**
     * 설정 조회 (캐시 → DB)
     */
    private async getSetting<T>(key: string, ttl: number): Promise<T | null> {
        // 1. 캐시 확인
        const cached = await this.getCache<T>(key);
        if (cached !== null) {
            return cached;
        }

        // 2. DB 조회
        const dbValue = await this.getFromDB(key);
        if (dbValue === null) {
            return null;
        }

        // 3. 파싱 및 캐시 저장
        try {
            const parsed = JSON.parse(dbValue) as T;
            await this.setCache(key, parsed, ttl);
            return parsed;
        } catch {
            // JSON이 아닌 경우 문자열 그대로 반환
            await this.setCache(key, dbValue, ttl);
            return dbValue as unknown as T;
        }
    }

    /**
     * 설정 저장 (DB → 캐시 갱신)
     */
    private async setSetting(key: string, value: unknown, ttl: number): Promise<void> {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

        // 1. DB 저장
        await this.setToDB(key, stringValue);

        // 2. 캐시 즉시 갱신 (모든 Pod에 반영)
        await this.setCache(key, value, ttl);
    }

    // ========== SettingsProvider 인터페이스 구현 ==========

    async getActiveTheme(): Promise<string | null> {
        return this.getSetting<string>('active_theme', CACHE_TTL.THEME);
    }

    async setActiveTheme(themeId: string): Promise<void> {
        await this.setSetting('active_theme', themeId, CACHE_TTL.THEME);
        await this.setSetting('theme_activated_at', new Date().toISOString(), CACHE_TTL.THEME);
    }

    async getThemeSettings(themeId: string): Promise<Record<string, unknown>> {
        const settings = await this.getSetting<Record<string, unknown>>(
            `theme_settings_${themeId}`,
            CACHE_TTL.THEME
        );
        return settings ?? {};
    }

    async setThemeSettings(themeId: string, settings: Record<string, unknown>): Promise<void> {
        await this.setSetting(`theme_settings_${themeId}`, settings, CACHE_TTL.THEME);
    }

    async getAllSettings(): Promise<Record<string, unknown>> {
        await this.ensureTable();
        // 전체 설정 조회 (디버깅/백업용) - 캐시 무시하고 DB 직접 조회
        try {
            const [rows] = await pool.query<SettingsRow[]>(
                `SELECT setting_key, setting_value FROM ${SETTINGS_TABLE}`
            );

            const result: Record<string, unknown> = {};
            for (const row of rows) {
                try {
                    result[row.setting_key] = JSON.parse(row.setting_value);
                } catch {
                    result[row.setting_key] = row.setting_value;
                }
            }
            return result;
        } catch (err) {
            console.error('[Settings] getAllSettings error:', err);
            return {};
        }
    }

    // ========== 위젯 레이아웃 ==========

    async getWidgetLayout(): Promise<WidgetConfig[] | null> {
        return this.getSetting<WidgetConfig[]>('widget_layout', CACHE_TTL.WIDGET_LAYOUT);
    }

    async setWidgetLayout(widgets: WidgetConfig[]): Promise<void> {
        await this.setSetting('widget_layout', widgets, CACHE_TTL.WIDGET_LAYOUT);
    }

    async getSidebarWidgetLayout(): Promise<WidgetConfig[] | null> {
        return this.getSetting<WidgetConfig[]>('sidebar_widget_layout', CACHE_TTL.WIDGET_LAYOUT);
    }

    async setSidebarWidgetLayout(widgets: WidgetConfig[]): Promise<void> {
        await this.setSetting('sidebar_widget_layout', widgets, CACHE_TTL.WIDGET_LAYOUT);
    }

    // ========== 메뉴 설정 (확장) ==========

    async getMenuLayout(): Promise<unknown[] | null> {
        return this.getSetting<unknown[]>('menu_layout', CACHE_TTL.DEFAULT);
    }

    async setMenuLayout(menu: unknown[]): Promise<void> {
        await this.setSetting('menu_layout', menu, CACHE_TTL.DEFAULT);
    }
}
