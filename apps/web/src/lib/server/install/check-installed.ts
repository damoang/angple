import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * 설치 상태 체크
 *
 * settings.json의 installed 값을 확인하여 설치 완료 여부를 반환합니다.
 */

// process.cwd()는 SvelteKit에서 apps/web을 가리킴
const SETTINGS_PATH = join(process.cwd(), 'data', 'settings.json');

interface DatabaseConfig {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
}

interface Settings {
    installed: boolean;
    activeTheme: string;
    themes: Record<string, unknown>;
    version: string;
    siteName?: string;
    siteDescription?: string;
    siteUrl?: string;
    language?: string;
    database?: DatabaseConfig;
    adminEmail?: string;
    adminName?: string;
    adminUsername?: string;
}

/**
 * 설치 완료 여부 확인
 */
export function isInstalled(): boolean {
    try {
        if (!existsSync(SETTINGS_PATH)) {
            return false;
        }

        const content = readFileSync(SETTINGS_PATH, 'utf-8');
        const settings: Settings = JSON.parse(content);

        return settings.installed === true;
    } catch (error) {
        console.error('설치 상태 확인 실패:', error);
        return false;
    }
}

/**
 * 설정 파일 읽기
 */
export function getSettings(): Settings | null {
    try {
        if (!existsSync(SETTINGS_PATH)) {
            return null;
        }

        const content = readFileSync(SETTINGS_PATH, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error('설정 파일 읽기 실패:', error);
        return null;
    }
}

/**
 * 설정 파일 업데이트
 */
export function updateSettings(updates: Partial<Settings>): boolean {
    try {
        const current = getSettings() || {
            installed: false,
            activeTheme: 'damoang-default',
            themes: {},
            version: '1.0.0'
        };

        const updated = { ...current, ...updates };

        writeFileSync(SETTINGS_PATH, JSON.stringify(updated, null, 2), 'utf-8');

        return true;
    } catch (error) {
        console.error('설정 파일 업데이트 실패:', error);
        return false;
    }
}
