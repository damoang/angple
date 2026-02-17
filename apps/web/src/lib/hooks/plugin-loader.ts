/**
 * 플러그인 Hook 자동 로더
 *
 * plugin.json에 정의된 Hook을 자동으로 로드하고 레지스트리에 등록합니다.
 */

import { registerHook, removeHooksBySource, type HookType } from './registry';
import type { ExtensionManifest } from '@angple/types';

/**
 * 현재 로드된 플러그인 ID 목록 추적 (중복 로드 방지)
 */
const loadedPluginIds = new Set<string>();

/**
 * Vite glob으로 플러그인 Hook 파일 미리 로드
 */
const pluginHooks = import.meta.glob('../../../../../plugins/**/hooks/*.{ts,js}');
const customPluginHooks = import.meta.glob('../../../../../custom-plugins/**/hooks/*.{ts,js}');

/**
 * 모든 플러그인 Hook 파일 병합
 */
const allPluginHooks = { ...pluginHooks, ...customPluginHooks };

/**
 * 플러그인의 Hook을 자동으로 로드하고 등록
 */
export async function loadPluginHooks(
    pluginId: string,
    manifest?: Partial<ExtensionManifest>
): Promise<void> {
    try {
        // 이미 로드된 플러그인이면 스킵
        if (loadedPluginIds.has(pluginId)) {
            return;
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
                return;
            }
        }

        // manifest가 여전히 없으면 종료
        if (!manifest) {
            console.error(`[Plugin Loader] Manifest is undefined for ${pluginId}`);
            return;
        }

        // Hook 배열이 없으면 종료
        if (!manifest.hooks || manifest.hooks.length === 0) {
            loadedPluginIds.add(pluginId);
            return;
        }

        // 각 Hook을 순회하며 등록
        for (const hookDef of manifest.hooks) {
            try {
                const { name, type, callback, priority } = hookDef;

                // 필수 필드 검증
                if (!name || !callback) {
                    console.error(
                        `[Plugin Loader] Invalid hook definition (missing name or callback):`,
                        hookDef
                    );
                    continue;
                }

                // Hook 파일 경로 생성
                const officialPath = `../../../../../plugins/${pluginId}/${callback}`;
                const customPath = `../../../../../custom-plugins/${pluginId}/${callback}`;

                let hookModule: { default?: unknown } | null = null;

                if (officialPath in allPluginHooks) {
                    hookModule = (await allPluginHooks[officialPath]()) as { default?: unknown };
                } else if (customPath in allPluginHooks) {
                    hookModule = (await allPluginHooks[customPath]()) as { default?: unknown };
                }

                if (!hookModule) {
                    console.error(
                        `[Plugin Loader] Hook file not found: ${callback} (plugin: ${pluginId})`
                    );
                    continue;
                }

                const hookFunction = hookModule.default || hookModule;

                if (typeof hookFunction !== 'function') {
                    console.error(
                        `[Plugin Loader] Hook callback is not a function: ${name}`
                    );
                    continue;
                }

                registerHook(
                    name,
                    hookFunction as (...args: unknown[]) => unknown,
                    priority ?? 10,
                    `plugin:${pluginId}`,
                    (type as HookType) || 'action'
                );
            } catch (error) {
                console.error('[Plugin Loader] Failed to load hook:', {
                    name: hookDef.name,
                    error
                });
            }
        }

        loadedPluginIds.add(pluginId);
    } catch (error) {
        console.error('[Plugin Loader] Failed to load plugin hooks:', { pluginId, error });
    }
}

/**
 * 플러그인의 모든 Hook 제거
 */
export async function unloadPluginHooks(pluginId: string): Promise<void> {
    try {
        removeHooksBySource(`plugin:${pluginId}`);
        loadedPluginIds.delete(pluginId);
    } catch (error) {
        console.error('[Plugin Loader] Failed to unload hooks:', { pluginId, error });
    }
}

/**
 * 여러 플러그인의 Hook을 일괄 로드
 */
export async function loadAllPluginHooks(
    plugins: Array<{ id: string; manifest?: Partial<ExtensionManifest> }>
): Promise<void> {
    for (const plugin of plugins) {
        await loadPluginHooks(plugin.id, plugin.manifest);
    }
}

/**
 * 현재 로드된 플러그인 ID 목록 가져오기
 */
export function getLoadedPluginIds(): string[] {
    return Array.from(loadedPluginIds);
}

/**
 * 플러그인 Hook 리로드 (개발 모드용)
 */
export async function reloadPluginHooks(pluginId: string): Promise<void> {
    await unloadPluginHooks(pluginId);
    await loadPluginHooks(pluginId);
}
