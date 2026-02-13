/**
 * 플러그인 Component 자동 로더
 *
 * plugin.json의 components 배열을 읽어 슬롯에 자동으로 컴포넌트를 등록합니다.
 * 테마 Component 로더(theme-component-loader.ts)와 동일한 패턴으로 구현되었습니다.
 */

import type { Component } from 'svelte';
import {
    registerComponent,
    removeComponentsBySource,
    type SlotName
} from '$lib/components/slot-manager';
import type { ExtensionManifest } from '@angple/types';

/**
 * 현재 로드된 플러그인 ID 목록 추적
 */
const loadedPluginIds = new Set<string>();

/**
 * Vite glob으로 플러그인 컴포넌트 파일 미리 로드
 * 공식 플러그인과 커스텀 플러그인 모두 포함
 */
const pluginComponents = import.meta.glob('../../../../../../plugins/**/*.svelte');
const customPluginComponents = import.meta.glob('../../../../../../custom-plugins/**/*.svelte');

/**
 * 모든 플러그인 컴포넌트 파일 병합
 */
const allPluginComponents = { ...pluginComponents, ...customPluginComponents };

/**
 * 플러그인의 컴포넌트를 슬롯에 자동 등록
 *
 * @param pluginId - 플러그인 ID
 * @param manifest - 플러그인 매니페스트 (부분 데이터 가능, 없으면 API에서 로드)
 * @returns 성공 여부
 */
export async function loadPluginComponents(
    pluginId: string,
    manifest?: Partial<ExtensionManifest>
): Promise<boolean> {
    try {
        console.log('🔌 [Plugin Loader] Loading components for plugin:', pluginId);

        // 이미 로드된 플러그인이면 스킵
        if (loadedPluginIds.has(pluginId)) {
            console.log(`ℹ️ [Plugin Loader] Plugin components already loaded: ${pluginId}`);
            return true;
        }

        // Manifest가 제공되지 않았으면 API에서 로드
        if (!manifest) {
            try {
                const response = await fetch(`/api/plugins/${pluginId}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const data = await response.json();
                manifest = data.plugin?.manifest;
            } catch (error) {
                console.error('❌ [Plugin Loader] Failed to load plugin manifest:', {
                    pluginId,
                    error
                });
                return false;
            }
        }

        // manifest가 여전히 없으면 종료
        if (!manifest) {
            console.error(`❌ [Plugin Loader] Manifest is undefined for ${pluginId}`);
            return false;
        }

        // components가 없으면 종료
        if (!manifest.components || manifest.components.length === 0) {
            console.log('ℹ️ [Plugin Loader] No components to load for plugin:', pluginId);
            loadedPluginIds.add(pluginId);
            return true;
        }

        console.log(
            `📋 [Plugin Loader] Found ${manifest.components.length} component(s) in plugin: ${pluginId}`
        );

        // 각 컴포넌트 로드 및 등록
        let loadedCount = 0;
        let failedCount = 0;

        for (const componentDef of manifest.components) {
            try {
                // 동적 import를 위한 경로 생성
                // plugins/ 또는 custom-plugins/ 경로 모두 시도
                const officialPath = `../../../../../../plugins/${pluginId}/${componentDef.path}`;
                const customPath = `../../../../../../custom-plugins/${pluginId}/${componentDef.path}`;

                console.log(
                    '📦 [Plugin Loader] Loading component:',
                    componentDef.name,
                    'from',
                    componentDef.path
                );

                let moduleKey: string | null = null;

                // 공식 플러그인 경로에서 먼저 찾기
                if (officialPath in allPluginComponents) {
                    moduleKey = officialPath;
                }
                // 커스텀 플러그인 경로에서 찾기
                else if (customPath in allPluginComponents) {
                    moduleKey = customPath;
                }

                if (!moduleKey) {
                    console.error(
                        '❌ [Plugin Loader] Component file not found:',
                        componentDef.path
                    );
                    failedCount++;
                    continue;
                }

                const module = (await allPluginComponents[moduleKey]()) as { default: Component };
                const SvelteComponent = module.default;

                // 슬롯에 등록
                registerComponent(
                    componentDef.slot as SlotName,
                    SvelteComponent,
                    componentDef.priority || 10,
                    componentDef.props || {}, // props 전달
                    `plugin:${pluginId}` // source로 플러그인 ID 사용 (plugin: prefix)
                );

                loadedCount++;
                console.log(
                    '✅ [Plugin Loader] Component registered:',
                    componentDef.name,
                    '→',
                    componentDef.slot
                );
            } catch (error) {
                console.error(
                    '❌ [Plugin Loader] Failed to load component:',
                    componentDef.name,
                    error
                );
                failedCount++;
            }
        }

        loadedPluginIds.add(pluginId);

        console.log(
            '🎉 [Plugin Loader] Plugin components loaded:',
            loadedCount,
            'success,',
            failedCount,
            'failed'
        );

        return failedCount === 0;
    } catch (error) {
        console.error('❌ [Plugin Loader] Fatal error loading plugin components:', error);
        return false;
    }
}

/**
 * 플러그인의 모든 컴포넌트 제거
 *
 * @param pluginId - 플러그인 ID
 */
export function unloadPluginComponents(pluginId: string): void {
    console.log('🗑️ [Plugin Loader] Unloading components from plugin:', pluginId);
    removeComponentsBySource(`plugin:${pluginId}`);
    loadedPluginIds.delete(pluginId);
}

/**
 * 여러 플러그인의 컴포넌트를 일괄 로드
 *
 * @param plugins - 로드할 플러그인 목록 [{id, manifest}]
 */
export async function loadAllPluginComponents(
    plugins: Array<{ id: string; manifest?: Partial<ExtensionManifest> }>
): Promise<void> {
    console.log(`🔌 [Plugin Loader] Loading components for ${plugins.length} plugin(s)...`);

    for (const plugin of plugins) {
        await loadPluginComponents(plugin.id, plugin.manifest);
    }

    console.log(`✅ [Plugin Loader] All plugin components loaded`);
}

/**
 * 현재 로드된 플러그인 ID 목록 가져오기
 */
export function getLoadedPluginComponentIds(): string[] {
    return Array.from(loadedPluginIds);
}

/**
 * 모든 플러그인 컴포넌트 제거
 */
export function unloadAllPluginComponents(): void {
    console.log('🗑️ [Plugin Loader] Unloading all plugin components');
    for (const pluginId of loadedPluginIds) {
        removeComponentsBySource(`plugin:${pluginId}`);
    }
    loadedPluginIds.clear();
}
