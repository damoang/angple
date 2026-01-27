/**
 * 플러그인 서버 API
 *
 * 파일 시스템 기반 플러그인 관리 및 settings.json 통합
 * 테마 서버 API(themes/index.ts)와 동일한 패턴으로 구현되었습니다.
 */

import {
    scanPlugins,
    getPluginManifest,
    getPluginPath,
    isPluginInstalled,
    isCustomPlugin
} from './scanner';
import { pluginSettingsProvider } from '../settings/plugin-settings-provider';
import type { PluginManifest } from '$lib/types/plugin';

/**
 * 설치된 플러그인의 전체 정보
 */
export interface InstalledPlugin {
    /** 플러그인 매니페스트 */
    manifest: PluginManifest;

    /** 현재 설정값 (settings.json에서 로드) */
    currentSettings?: Record<string, unknown>;

    /** 플러그인 디렉터리 절대 경로 */
    path: string;

    /** 활성 플러그인 여부 */
    isActive: boolean;

    /** 플러그인 출처 (official: Git 추적, custom: 사용자 업로드) */
    source: 'official' | 'custom';
}

/**
 * 설치된 모든 플러그인 목록 가져오기
 *
 * @returns 플러그인 ID를 key로 하는 InstalledPlugin 맵
 */
export async function getInstalledPlugins(): Promise<Map<string, InstalledPlugin>> {
    const plugins = new Map<string, InstalledPlugin>();

    // 1. 파일 시스템에서 플러그인 스캔
    const manifests = scanPlugins();

    // 2. 활성 플러그인 ID 목록 조회
    const activePluginIds = await pluginSettingsProvider.getActivePlugins();

    // 3. 각 플러그인에 대해 InstalledPlugin 객체 생성
    for (const [pluginId, manifest] of manifests) {
        const currentSettings = await pluginSettingsProvider.getPluginSettings(pluginId);

        plugins.set(pluginId, {
            manifest,
            currentSettings,
            path: getPluginPath(pluginId),
            isActive: activePluginIds.includes(pluginId),
            source: isCustomPlugin(pluginId) ? 'custom' : 'official'
        });
    }

    return plugins;
}

/**
 * 특정 플러그인 정보 가져오기
 */
export async function getPluginById(pluginId: string): Promise<InstalledPlugin | null> {
    if (!isPluginInstalled(pluginId)) {
        return null;
    }

    const manifest = getPluginManifest(pluginId);
    if (!manifest) {
        return null;
    }

    const currentSettings = await pluginSettingsProvider.getPluginSettings(pluginId);
    const activePluginIds = await pluginSettingsProvider.getActivePlugins();

    return {
        manifest,
        currentSettings,
        path: getPluginPath(pluginId),
        isActive: activePluginIds.includes(pluginId),
        source: isCustomPlugin(pluginId) ? 'custom' : 'official'
    };
}

/**
 * 활성화된 모든 플러그인 가져오기
 */
export async function getActivePlugins(): Promise<InstalledPlugin[]> {
    const activePluginIds = await pluginSettingsProvider.getActivePlugins();
    const activePlugins: InstalledPlugin[] = [];

    for (const pluginId of activePluginIds) {
        const plugin = await getPluginById(pluginId);
        if (plugin) {
            activePlugins.push(plugin);
        }
    }

    return activePlugins;
}

/**
 * 플러그인 활성화
 *
 * settings.json의 activePlugins 배열에 플러그인 ID를 추가합니다.
 */
export async function activatePlugin(pluginId: string): Promise<boolean> {
    // 플러그인이 설치되어 있는지 확인
    if (!isPluginInstalled(pluginId)) {
        console.error(`❌ [Plugin API] 플러그인이 설치되지 않음: ${pluginId}`);
        return false;
    }

    // Provider를 통해 플러그인 활성화
    await pluginSettingsProvider.activatePlugin(pluginId);

    console.log(`✅ [Plugin API] 플러그인 활성화: ${pluginId}`);
    return true;
}

/**
 * 플러그인 비활성화
 *
 * settings.json의 activePlugins 배열에서 플러그인 ID를 제거합니다.
 */
export async function deactivatePlugin(pluginId: string): Promise<boolean> {
    // Provider를 통해 플러그인 비활성화
    await pluginSettingsProvider.deactivatePlugin(pluginId);

    console.log(`✅ [Plugin API] 플러그인 비활성화: ${pluginId}`);
    return true;
}

/**
 * 플러그인 설정값 업데이트
 */
export async function updatePluginSettings(
    pluginId: string,
    newSettings: Record<string, unknown>
): Promise<boolean> {
    // Provider를 통해 플러그인 설정 업데이트
    await pluginSettingsProvider.setPluginSettings(pluginId, newSettings);

    console.log(`✅ [Plugin API] 플러그인 설정 업데이트: ${pluginId}`);
    return true;
}

// Re-export scanner functions
export {
    getPluginManifest,
    getPluginPath,
    isPluginInstalled,
    scanPlugins,
    isCustomPlugin
} from './scanner';
