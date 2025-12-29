import { JsonSettingsProvider } from './json-provider';
import type { SettingsProvider } from './provider';

/**
 * 설정 Provider Facade
 *
 * 환경변수로 Provider 변경 가능
 * - SETTINGS_PROVIDER=json (기본값)
 * - SETTINGS_PROVIDER=mysql (나중에)
 */

// Provider 선택 (환경변수 또는 기본값)
const PROVIDER_TYPE = process.env.SETTINGS_PROVIDER || 'json';

// Provider 인스턴스 생성
let providerInstance: SettingsProvider;

switch (PROVIDER_TYPE) {
    case 'json':
        providerInstance = new JsonSettingsProvider();
        break;
    // case 'mysql':
    //   providerInstance = new MySqlSettingsProvider();
    //   break;
    default:
        console.warn(`⚠️ 알 수 없는 SETTINGS_PROVIDER: ${PROVIDER_TYPE}, JSON으로 fallback`);
        providerInstance = new JsonSettingsProvider();
}

/**
 * 전역 설정 Provider
 */
export const settingsProvider = providerInstance;

/**
 * 현재 활성화된 테마 ID 조회
 */
export async function getActiveTheme(): Promise<string | null> {
    return settingsProvider.getActiveTheme();
}

/**
 * 테마 활성화
 */
export async function setActiveTheme(themeId: string): Promise<void> {
    return settingsProvider.setActiveTheme(themeId);
}

/**
 * 테마 설정 조회
 */
export async function getThemeSettings(themeId: string): Promise<Record<string, unknown>> {
    return settingsProvider.getThemeSettings(themeId);
}

/**
 * 테마 설정 저장
 */
export async function setThemeSettings(
    themeId: string,
    settings: Record<string, unknown>
): Promise<void> {
    return settingsProvider.setThemeSettings(themeId, settings);
}

/**
 * 전체 설정 조회
 */
export async function getAllSettings(): Promise<Record<string, unknown>> {
    return settingsProvider.getAllSettings();
}

// Export types
export type { SettingsProvider } from './provider';
