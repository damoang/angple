/**
 * 플러그인 Hook 자동 로더
 *
 * plugin.json에 정의된 Hook을 자동으로 로드하고 레지스트리에 등록합니다.
 * 테마 Hook 로더(theme-loader.ts)와 동일한 패턴으로 구현되었습니다.
 */

import { registerHook, removeHooksBySource, type HookType } from './registry';
import type { PluginManifest } from '$lib/types/plugin';

/**
 * 현재 로드된 플러그인 ID 목록 추적 (중복 로드 방지)
 */
const loadedPluginIds = new Set<string>();

/**
 * Vite glob으로 플러그인 Hook 파일 미리 로드
 * 공식 플러그인과 커스텀 플러그인 모두 포함
 */
const pluginHooks = import.meta.glob('../../../../../../plugins/**/hooks/*.{ts,js}');
const customPluginHooks = import.meta.glob('../../../../../../custom-plugins/**/hooks/*.{ts,js}');

/**
 * 모든 플러그인 Hook 파일 병합
 */
const allPluginHooks = { ...pluginHooks, ...customPluginHooks };

/**
 * 플러그인의 Hook을 자동으로 로드하고 등록
 *
 * @param pluginId - 플러그인 ID
 * @param manifest - 플러그인 매니페스트 (선택 사항, 없으면 API에서 로드)
 */
export async function loadPluginHooks(pluginId: string, manifest?: PluginManifest): Promise<void> {
    try {
        console.log(`🔌 [Plugin Loader] Loading hooks for plugin: ${pluginId}`);

        // 이미 로드된 플러그인이면 스킵
        if (loadedPluginIds.has(pluginId)) {
            console.log(`ℹ️ [Plugin Loader] Plugin hooks already loaded: ${pluginId}`);
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
                console.error('❌ [Plugin Loader] Failed to load plugin manifest:', { pluginId, error });
                return;
            }
        }

        // manifest가 여전히 없으면 종료
        if (!manifest) {
            console.error(`❌ [Plugin Loader] Manifest is undefined for ${pluginId}`);
            return;
        }

        // Hook 배열이 없으면 종료
        if (!manifest.hooks || manifest.hooks.length === 0) {
            console.log(`ℹ️ [Plugin Loader] No hooks defined in plugin: ${pluginId}`);
            loadedPluginIds.add(pluginId);
            return;
        }

        console.log(`📋 [Plugin Loader] Found ${manifest.hooks.length} hook(s) in plugin: ${pluginId}`);

        // 각 Hook을 순회하며 등록
        for (const hookDef of manifest.hooks) {
            try {
                const { name, type, callback, priority } = hookDef;

                // 필수 필드 검증
                if (!name || !callback) {
                    console.error(
                        `❌ [Plugin Loader] Invalid hook definition (missing name or callback):`,
                        hookDef
                    );
                    continue;
                }

                // Hook 파일 경로 생성 (plugins/ 또는 custom-plugins/)
                const officialPath = `../../../../../../plugins/${pluginId}/${callback}`;
                const customPath = `../../../../../../custom-plugins/${pluginId}/${callback}`;

                let hookModule: { default?: unknown } | null = null;
                let usedPath = '';

                // 공식 플러그인 경로에서 먼저 찾기
                if (officialPath in allPluginHooks) {
                    hookModule = await allPluginHooks[officialPath]() as { default?: unknown };
                    usedPath = officialPath;
                }
                // 커스텀 플러그인 경로에서 찾기
                else if (customPath in allPluginHooks) {
                    hookModule = await allPluginHooks[customPath]() as { default?: unknown };
                    usedPath = customPath;
                }

                if (!hookModule) {
                    console.error(
                        `❌ [Plugin Loader] Hook file not found: ${callback} (plugin: ${pluginId})`
                    );
                    continue;
                }

                console.log(`📥 [Plugin Loader] Importing hook: ${name} from ${usedPath}`);

                const hookFunction = hookModule.default || hookModule;

                if (typeof hookFunction !== 'function') {
                    console.error(
                        `❌ [Plugin Loader] Hook callback is not a function: ${name} (${usedPath})`
                    );
                    continue;
                }

                // Hook 레지스트리에 등록
                registerHook(
                    name,
                    hookFunction as (...args: unknown[]) => unknown,
                    priority ?? 10,
                    `plugin:${pluginId}`, // source로 플러그인 ID 전달 (plugin: prefix 추가)
                    (type as HookType) || 'action'
                );

                console.log(
                    `✅ [Plugin Loader] Registered ${type} hook: ${name} (priority: ${priority ?? 10})`
                );
            } catch (error) {
                console.error('❌ [Plugin Loader] Failed to load hook:', {
                    name: hookDef.name,
                    error
                });
                // 에러가 발생해도 다음 Hook 계속 로드
            }
        }

        loadedPluginIds.add(pluginId);
        console.log(`✅ [Plugin Loader] Successfully loaded hooks for plugin: ${pluginId}`);
    } catch (error) {
        console.error('❌ [Plugin Loader] Failed to load plugin hooks:', { pluginId, error });
    }
}

/**
 * 플러그인의 모든 Hook 제거
 *
 * @param pluginId - 플러그인 ID
 */
export async function unloadPluginHooks(pluginId: string): Promise<void> {
    try {
        console.log(`🗑️ [Plugin Loader] Unloading hooks for plugin: ${pluginId}`);
        removeHooksBySource(`plugin:${pluginId}`);

        loadedPluginIds.delete(pluginId);

        console.log(`✅ [Plugin Loader] Unloaded hooks for plugin: ${pluginId}`);
    } catch (error) {
        console.error('❌ [Plugin Loader] Failed to unload hooks:', { pluginId, error });
    }
}

/**
 * 여러 플러그인의 Hook을 일괄 로드
 *
 * @param plugins - 로드할 플러그인 목록 [{id, manifest}]
 */
export async function loadAllPluginHooks(
    plugins: Array<{ id: string; manifest?: PluginManifest }>
): Promise<void> {
    console.log(`🔌 [Plugin Loader] Loading hooks for ${plugins.length} plugin(s)...`);

    for (const plugin of plugins) {
        await loadPluginHooks(plugin.id, plugin.manifest);
    }

    console.log(`✅ [Plugin Loader] All plugin hooks loaded`);
}

/**
 * 현재 로드된 플러그인 ID 목록 가져오기
 */
export function getLoadedPluginIds(): string[] {
    return Array.from(loadedPluginIds);
}

/**
 * 플러그인 Hook 리로드 (개발 모드용)
 *
 * @param pluginId - 플러그인 ID
 */
export async function reloadPluginHooks(pluginId: string): Promise<void> {
    console.log(`🔄 [Plugin Loader] Reloading hooks for plugin: ${pluginId}`);
    await unloadPluginHooks(pluginId);
    await loadPluginHooks(pluginId);
}
