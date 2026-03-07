/**
 * 플러그인 서버 API
 *
 * 파일 시스템 기반 플러그인 관리 및 settings.json 통합
 * 테마 서버 API(themes/index.ts)와 동일한 패턴으로 구현되었습니다.
 *
 * ExtensionManifest 사용:
 * - category가 'plugin'인 ExtensionManifest만 반환
 * - 통합된 스키마로 테마와 동일한 구조 사용
 */

import {
    scanPlugins,
    getPluginManifest,
    getPluginPath,
    isPluginInstalled,
    isCustomPlugin
} from './scanner';
import { pluginSettingsProvider } from '../settings/plugin-settings-provider';
import { TieredCache } from '$lib/server/cache';
import type { ExtensionManifest } from '@angple/types';

/**
 * 설치된 플러그인의 전체 정보
 */
export interface InstalledPlugin {
    /** 플러그인 매니페스트 (ExtensionManifest with category='plugin') */
    manifest: ExtensionManifest;

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
    const manifests = await scanPlugins();

    // 2. 활성 플러그인 ID 목록 조회
    const activePluginIds = await pluginSettingsProvider.getActivePlugins();

    // 3. 각 플러그인에 대해 InstalledPlugin 객체 생성
    for (const [pluginId, manifest] of manifests) {
        const currentSettings = await pluginSettingsProvider.getPluginSettings(pluginId);

        plugins.set(pluginId, {
            manifest,
            currentSettings,
            path: await getPluginPath(pluginId),
            isActive: activePluginIds.includes(pluginId),
            source: (await isCustomPlugin(pluginId)) ? 'custom' : 'official'
        });
    }

    return plugins;
}

/**
 * 특정 플러그인 정보 가져오기
 */
export async function getPluginById(pluginId: string): Promise<InstalledPlugin | null> {
    if (!(await isPluginInstalled(pluginId))) {
        return null;
    }

    const manifest = await getPluginManifest(pluginId);
    if (!manifest) {
        return null;
    }

    const currentSettings = await pluginSettingsProvider.getPluginSettings(pluginId);
    const activePluginIds = await pluginSettingsProvider.getActivePlugins();

    return {
        manifest,
        currentSettings,
        path: await getPluginPath(pluginId),
        isActive: activePluginIds.includes(pluginId),
        source: (await isCustomPlugin(pluginId)) ? 'custom' : 'official'
    };
}

// --- 2-tier 캐시: 활성 플러그인 (L1 30초, L2 5분) ---
const activePluginsTieredCache = new TieredCache<InstalledPlugin[]>('plugins:active', 30_000, 300, 10);

/**
 * 활성화된 모든 플러그인 가져오기 (TieredCache: L1 30초, L2 5분)
 */
export async function getActivePlugins(): Promise<InstalledPlugin[]> {
    return activePluginsTieredCache.getOrFetch('list', async () => {
        const activePluginIds = await pluginSettingsProvider.getActivePlugins();
        const activePlugins: InstalledPlugin[] = [];

        for (const pluginId of activePluginIds) {
            const plugin = await getPluginById(pluginId);
            if (plugin) {
                activePlugins.push(plugin);
            }
        }

        return activePlugins;
    });
}

/** 플러그인 캐시 무효화 (활성화/비활성화 시 호출) */
export async function invalidateActivePluginsCache(): Promise<void> {
    await activePluginsTieredCache.delete('list');
}

/**
 * 플러그인 활성화
 *
 * settings.json의 activePlugins 배열에 플러그인 ID를 추가합니다.
 */
export async function activatePlugin(pluginId: string): Promise<boolean> {
    // 플러그인이 설치되어 있는지 확인
    if (!(await isPluginInstalled(pluginId))) {
        console.error(`[Plugin API] 플러그인이 설치되지 않음: ${pluginId}`);
        return false;
    }

    // Provider를 통해 플러그인 활성화
    await pluginSettingsProvider.activatePlugin(pluginId);
    await invalidateActivePluginsCache();

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
    await invalidateActivePluginsCache();

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
