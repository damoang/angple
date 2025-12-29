/**
 * 테마 서버 API
 *
 * 파일 시스템 기반 테마 관리 및 settings.json 통합
 */

import { scanThemes, getThemeManifest, getThemePath, isThemeInstalled } from './scanner';
import { settingsProvider } from '../settings/index';
import type { ThemeManifest } from '$lib/types/theme';

/**
 * 설치된 테마의 전체 정보
 */
export interface InstalledTheme {
    /** 테마 매니페스트 */
    manifest: ThemeManifest;

    /** 현재 설정값 (settings.json에서 로드) */
    currentSettings?: Record<string, unknown>;

    /** 테마 디렉터리 절대 경로 */
    path: string;

    /** 활성 테마 여부 */
    isActive: boolean;
}

/**
 * 설치된 모든 테마 목록 가져오기
 *
 * @returns 테마 ID를 key로 하는 InstalledTheme 맵
 */
export async function getInstalledThemes(): Promise<Map<string, InstalledTheme>> {
    const themes = new Map<string, InstalledTheme>();

    // 1. 파일 시스템에서 테마 스캔
    const manifests = scanThemes();

    // 2. 활성 테마 ID 조회
    const activeThemeId = await settingsProvider.getActiveTheme();

    // 3. 각 테마에 대해 InstalledTheme 객체 생성
    for (const [themeId, manifest] of manifests) {
        const currentSettings = await settingsProvider.getThemeSettings(themeId);

        themes.set(themeId, {
            manifest,
            currentSettings,
            path: getThemePath(themeId),
            isActive: themeId === activeThemeId
        });
    }

    return themes;
}

/**
 * 특정 테마 정보 가져오기
 */
export async function getThemeById(themeId: string): Promise<InstalledTheme | null> {
    if (!isThemeInstalled(themeId)) {
        return null;
    }

    const manifest = getThemeManifest(themeId);
    if (!manifest) {
        return null;
    }

    const currentSettings = await settingsProvider.getThemeSettings(themeId);
    const activeThemeId = await settingsProvider.getActiveTheme();

    return {
        manifest,
        currentSettings,
        path: getThemePath(themeId),
        isActive: themeId === activeThemeId
    };
}

/**
 * 활성 테마 가져오기
 */
export async function getActiveTheme(): Promise<InstalledTheme | null> {
    const activeThemeId = await settingsProvider.getActiveTheme();

    if (!activeThemeId) {
        return null;
    }

    return getThemeById(activeThemeId);
}

/**
 * 테마 활성화
 *
 * settings.json의 activeTheme을 변경합니다.
 */
export async function activateTheme(themeId: string): Promise<boolean> {
    // 테마가 설치되어 있는지 확인
    if (!isThemeInstalled(themeId)) {
        console.error(`❌ [Theme API] 테마가 설치되지 않음: ${themeId}`);
        return false;
    }

    // Provider를 통해 테마 활성화
    await settingsProvider.setActiveTheme(themeId);

    console.log(`✅ [Theme API] 테마 활성화: ${themeId}`);
    return true;
}

/**
 * 테마 설정값 업데이트
 */
export async function updateThemeSettings(
    themeId: string,
    newSettings: Record<string, unknown>
): Promise<boolean> {
    // Provider를 통해 테마 설정 업데이트
    await settingsProvider.setThemeSettings(themeId, newSettings);

    console.log(`✅ [Theme API] 테마 설정 업데이트: ${themeId}`);
    return true;
}

// Re-export scanner functions
export { getThemeManifest, getThemePath, isThemeInstalled, scanThemes } from './scanner';
