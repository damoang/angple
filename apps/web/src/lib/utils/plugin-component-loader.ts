/**
 * 플러그인 Component 자동 로더
 *
 * plugin.json의 components 배열을 읽어 슬롯에 자동으로 컴포넌트를 등록합니다.
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
 */
const pluginComponents = import.meta.glob('../../../../../plugins/**/*.svelte');
const customPluginComponents = import.meta.glob('../../../../../custom-plugins/**/*.svelte');

/**
 * 모든 플러그인 컴포넌트 파일 병합
 */
const allPluginComponents = { ...pluginComponents, ...customPluginComponents };

/**
 * 플러그인의 컴포넌트를 슬롯에 자동 등록
 */
export async function loadPluginComponents(
    pluginId: string,
    manifest?: Partial<ExtensionManifest>
): Promise<boolean> {
    try {
        // 이미 로드된 플러그인이면 스킵
        if (loadedPluginIds.has(pluginId)) {
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
                console.error('[Plugin Loader] Failed to load plugin manifest:', {
                    pluginId,
                    error
                });
                return false;
            }
        }

        // manifest가 여전히 없으면 종료
        if (!manifest) {
            console.error(`[Plugin Loader] Manifest is undefined for ${pluginId}`);
            return false;
        }

        // components가 없으면 종료
        if (!manifest.components || manifest.components.length === 0) {
            loadedPluginIds.add(pluginId);
            return true;
        }

        // 각 컴포넌트 로드 및 등록
        let loadedCount = 0;
        let failedCount = 0;

        for (const componentDef of manifest.components) {
            try {
                const officialPath = `../../../../../plugins/${pluginId}/${componentDef.path}`;
                const customPath = `../../../../../custom-plugins/${pluginId}/${componentDef.path}`;

                let moduleKey: string | null = null;

                if (officialPath in allPluginComponents) {
                    moduleKey = officialPath;
                } else if (customPath in allPluginComponents) {
                    moduleKey = customPath;
                }

                if (!moduleKey) {
                    console.error('[Plugin Loader] Component file not found:', componentDef.path);
                    failedCount++;
                    continue;
                }

                const module = (await allPluginComponents[moduleKey]()) as { default: Component };
                const SvelteComponent = module.default;

                registerComponent(
                    componentDef.slot as SlotName,
                    SvelteComponent,
                    componentDef.priority || 10,
                    componentDef.props || {},
                    `plugin:${pluginId}`
                );

                loadedCount++;
            } catch (error) {
                console.error(
                    '[Plugin Loader] Failed to load component:',
                    componentDef.name,
                    error
                );
                failedCount++;
            }
        }

        loadedPluginIds.add(pluginId);

        return failedCount === 0;
    } catch (error) {
        console.error('[Plugin Loader] Fatal error loading plugin components:', error);
        return false;
    }
}

/**
 * 플러그인의 모든 컴포넌트 제거
 */
export function unloadPluginComponents(pluginId: string): void {
    removeComponentsBySource(`plugin:${pluginId}`);
    loadedPluginIds.delete(pluginId);
}

/**
 * 여러 플러그인의 컴포넌트를 일괄 로드
 */
export async function loadAllPluginComponents(
    plugins: Array<{ id: string; manifest?: Partial<ExtensionManifest> }>
): Promise<void> {
    for (const plugin of plugins) {
        await loadPluginComponents(plugin.id, plugin.manifest);
    }
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
    for (const pluginId of loadedPluginIds) {
        removeComponentsBySource(`plugin:${pluginId}`);
    }
    loadedPluginIds.clear();
}
