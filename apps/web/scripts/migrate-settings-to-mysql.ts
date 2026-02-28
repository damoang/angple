/**
 * JSON 설정 → MySQL 마이그레이션 스크립트
 *
 * 실행: npx tsx scripts/migrate-settings-to-mysql.ts
 */

import fs from 'fs/promises';
import path from 'path';
import mysql from 'mysql2/promise';

// .env 파일 직접 파싱
async function loadEnv(): Promise<Record<string, string>> {
    const envPath = path.join(process.cwd(), '.env');
    try {
        const content = await fs.readFile(envPath, 'utf-8');
        const env: Record<string, string> = {};
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
                const key = trimmed.slice(0, eqIndex);
                let value = trimmed.slice(eqIndex + 1);
                // 따옴표 제거
                if (
                    (value.startsWith("'") && value.endsWith("'")) ||
                    (value.startsWith('"') && value.endsWith('"'))
                ) {
                    value = value.slice(1, -1);
                }
                env[key] = value;
            }
        }
        return env;
    } catch {
        return {};
    }
}

const JSON_PATH = path.join(process.cwd(), 'data', 'settings.json');
const SETTINGS_TABLE = 'angple_settings';

interface JsonSettings {
    activeTheme?: string | null;
    activatedAt?: string;
    themes?: Record<string, { settings: Record<string, unknown> }>;
    version?: string;
    widgetLayout?: unknown[];
    sidebarWidgetLayout?: unknown[];
}

async function migrate() {
    console.log('🚀 JSON → MySQL 마이그레이션 시작\n');

    // 환경변수 로드
    const env = await loadEnv();

    // 1. JSON 파일 읽기
    let jsonSettings: JsonSettings = {};
    try {
        const data = await fs.readFile(JSON_PATH, 'utf-8');
        jsonSettings = JSON.parse(data);
        console.log('✅ JSON 파일 로드 완료:', JSON_PATH);
        console.log('   내용:', JSON.stringify(jsonSettings, null, 2).slice(0, 200) + '...\n');
    } catch (err) {
        console.log('⚠️  JSON 파일 없음 또는 읽기 실패, 빈 설정으로 진행\n');
    }

    // 2. MySQL 연결
    const pool = mysql.createPool({
        host: env.DB_HOST || 'localhost',
        port: parseInt(env.DB_PORT || '3306', 10),
        user: env.DB_USER || 'root',
        password: env.DB_PASSWORD || '',
        database: env.DB_NAME || 'angple',
        waitForConnections: true,
        connectionLimit: 5
    });

    console.log('✅ MySQL 연결됨:', env.DB_HOST);

    // 3. 테이블 확인/생성
    await pool.query(`
        CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE} (
            setting_key VARCHAR(255) PRIMARY KEY,
            setting_value LONGTEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ 테이블 확인/생성 완료:', SETTINGS_TABLE);

    // 4. 설정 마이그레이션
    const settings: Record<string, unknown> = {};

    // 활성 테마
    if (jsonSettings.activeTheme) {
        settings['active_theme'] = jsonSettings.activeTheme;
    }

    // 테마 활성화 시간
    if (jsonSettings.activatedAt) {
        settings['theme_activated_at'] = jsonSettings.activatedAt;
    }

    // 테마별 설정
    if (jsonSettings.themes) {
        for (const [themeId, themeData] of Object.entries(jsonSettings.themes)) {
            if (themeData.settings && Object.keys(themeData.settings).length > 0) {
                settings[`theme_settings_${themeId}`] = themeData.settings;
            }
        }
    }

    // 위젯 레이아웃
    if (jsonSettings.widgetLayout) {
        settings['widget_layout'] = jsonSettings.widgetLayout;
    }

    // 사이드바 위젯 레이아웃
    if (jsonSettings.sidebarWidgetLayout) {
        settings['sidebar_widget_layout'] = jsonSettings.sidebarWidgetLayout;
    }

    // 5. MySQL에 저장 (UPSERT)
    let inserted = 0;
    for (const [key, value] of Object.entries(settings)) {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        await pool.query(
            `INSERT INTO ${SETTINGS_TABLE} (setting_key, setting_value)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [key, stringValue]
        );
        console.log(
            `   📝 ${key}: ${stringValue.slice(0, 50)}${stringValue.length > 50 ? '...' : ''}`
        );
        inserted++;
    }

    console.log(`\n✅ 마이그레이션 완료: ${inserted}개 설정 저장됨`);

    // 6. 결과 확인
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT setting_key, LEFT(setting_value, 60) as value_preview FROM ${SETTINGS_TABLE}`
    );
    console.log('\n📋 현재 MySQL 설정:');
    for (const row of rows) {
        console.log(`   ${row.setting_key}: ${row.value_preview}`);
    }

    await pool.end();
    console.log('\n🎉 완료!');
}

migrate().catch(console.error);
