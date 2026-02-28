import { JsonSettingsProvider } from './json-provider';
import { MySqlRedisSettingsProvider } from './mysql-redis-provider';
import type { SettingsProvider } from './provider';
import type { WidgetConfig } from '$lib/stores/widget-layout.svelte';
import { env } from '$env/dynamic/private';

/**
 * 설정 Provider Facade
 *
 * 환경변수로 Provider 변경 가능
 * - SETTINGS_PROVIDER=json (기본값, 로컬 개발용)
 * - SETTINGS_PROVIDER=mysql (운영 권장, Redis 캐시 포함)
 */

// Provider 선택 (환경변수 또는 기본값)
const PROVIDER_TYPE = env.SETTINGS_PROVIDER || 'json';

// Provider 인스턴스 생성
let providerInstance: SettingsProvider;

switch (PROVIDER_TYPE) {
    case 'mysql':
        providerInstance = new MySqlRedisSettingsProvider();
        console.log('[Settings] Using MySQL + Redis provider');
        break;
    case 'json':
    default:
        providerInstance = new JsonSettingsProvider();
        console.log('[Settings] Using JSON file provider');
}

/**
 * 전역 설정 Provider
 */
export const settingsProvider = providerInstance;

// ========== 테마 관련 API ==========

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

// ========== 위젯 레이아웃 API ==========

/**
 * 메인 위젯 레이아웃 조회
 */
export async function getWidgetLayout(): Promise<WidgetConfig[] | null> {
    return settingsProvider.getWidgetLayout();
}

/**
 * 메인 위젯 레이아웃 저장
 */
export async function setWidgetLayout(widgets: WidgetConfig[]): Promise<void> {
    return settingsProvider.setWidgetLayout(widgets);
}

/**
 * 사이드바 위젯 레이아웃 조회
 */
export async function getSidebarWidgetLayout(): Promise<WidgetConfig[] | null> {
    return settingsProvider.getSidebarWidgetLayout();
}

/**
 * 사이드바 위젯 레이아웃 저장
 */
export async function setSidebarWidgetLayout(widgets: WidgetConfig[]): Promise<void> {
    return settingsProvider.setSidebarWidgetLayout(widgets);
}

// ========== 하위 호환성 (기존 API 지원) ==========

interface LegacySettings {
    widgetLayout?: WidgetConfig[];
    sidebarWidgetLayout?: WidgetConfig[];
    [key: string]: unknown;
}

/**
 * 전체 설정 읽기 (하위 호환)
 */
export async function readSettings(): Promise<LegacySettings> {
    const [widgetLayout, sidebarWidgetLayout, allSettings] = await Promise.all([
        settingsProvider.getWidgetLayout(),
        settingsProvider.getSidebarWidgetLayout(),
        settingsProvider.getAllSettings()
    ]);

    return {
        ...allSettings,
        widgetLayout: widgetLayout ?? undefined,
        sidebarWidgetLayout: sidebarWidgetLayout ?? undefined
    };
}

/**
 * 설정 쓰기 (하위 호환)
 */
export async function writeSettings(settings: LegacySettings): Promise<void> {
    const promises: Promise<void>[] = [];

    if (settings.widgetLayout !== undefined) {
        promises.push(settingsProvider.setWidgetLayout(settings.widgetLayout));
    }
    if (settings.sidebarWidgetLayout !== undefined) {
        promises.push(settingsProvider.setSidebarWidgetLayout(settings.sidebarWidgetLayout));
    }

    await Promise.all(promises);
}

// Export types
export type { SettingsProvider } from './provider';
