/**
 * Settings.json 관리 유틸리티 (서버 전용)
 *
 * Node.js fs 모듈을 사용하므로 서버 사이드에서만 사용 가능합니다.
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const SETTINGS_FILE_PATH = join(process.cwd(), 'data', 'settings.json');

export interface ThemeSettings {
    activeTheme: string | null;
    activatedAt?: string;
    themes: Record<
        string,
        {
            settings: Record<string, unknown>;
        }
    >;
    version: string;
}

/**
 * settings.json 읽기
 */
export async function readSettings(): Promise<ThemeSettings> {
    try {
        const data = await readFile(SETTINGS_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('❌ settings.json 읽기 실패:', error);
        // 파일이 없으면 기본값 반환
        return {
            activeTheme: null,
            themes: {},
            version: '1.0.0'
        };
    }
}

/**
 * settings.json 쓰기
 */
export async function writeSettings(settings: ThemeSettings): Promise<void> {
    try {
        await writeFile(SETTINGS_FILE_PATH, JSON.stringify(settings, null, 2), 'utf-8');
        console.log('✅ settings.json 저장 완료');
    } catch (error) {
        console.error('❌ settings.json 쓰기 실패:', error);
        throw error;
    }
}

/**
 * 테마 설정 제거
 */
export async function removeThemeSettings(themeId: string): Promise<void> {
    try {
        const settings = await readSettings();

        // themes 객체에서 해당 테마 제거
        if (settings.themes[themeId]) {
            delete settings.themes[themeId];
            await writeSettings(settings);
            console.log(`✅ [Settings] 테마 설정 제거: ${themeId}`);
        }
    } catch (error) {
        console.error(`❌ [Settings] 테마 설정 제거 실패: ${themeId}`, error);
        throw error;
    }
}

/**
 * 활성 테마 설정
 */
export async function setActiveTheme(themeId: string): Promise<void> {
    const settings = await readSettings();
    settings.activeTheme = themeId;
    settings.activatedAt = new Date().toISOString();

    // 테마 설정이 없으면 초기화
    if (!settings.themes[themeId]) {
        settings.themes[themeId] = { settings: {} };
    }

    await writeSettings(settings);
}

/**
 * 특정 테마의 설정 조회
 */
export async function getThemeSettings(themeId: string): Promise<Record<string, unknown>> {
    const settings = await readSettings();
    return settings.themes[themeId]?.settings || {};
}

/**
 * 특정 테마의 설정 저장
 */
export async function setThemeSettings(
    themeId: string,
    themeSettings: Record<string, unknown>
): Promise<void> {
    const settings = await readSettings();

    if (!settings.themes[themeId]) {
        settings.themes[themeId] = { settings: {} };
    }

    settings.themes[themeId].settings = themeSettings;
    await writeSettings(settings);
}
