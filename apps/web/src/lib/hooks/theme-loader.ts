/**
 * 테마 Hook 자동 로더
 *
 * theme.json에 정의된 Hook을 자동으로 로드하고 레지스트리에 등록합니다.
 */

import { registerHook, removeHooksBySource, type HookType } from './registry';
import type { ThemeManifest } from '$lib/types/theme';

/**
 * 현재 로드된 테마 ID 추적 (중복 로드 방지)
 */
let currentLoadedThemeId: string | null = null;

/**
 * 테마의 Hook을 자동으로 로드하고 등록
 *
 * @param themeId - 테마 ID
 * @param manifest - 테마 매니페스트 (선택 사항, 없으면 자동 로드)
 */
export async function loadThemeHooks(themeId: string, manifest?: ThemeManifest): Promise<void> {
    try {
        console.log(`🔌 [Hook Loader] Loading hooks for theme: ${themeId}`);

        // 이미 로드된 테마면 스킵
        if (currentLoadedThemeId === themeId) {
            console.log(`ℹ️ [Hook Loader] Theme hooks already loaded: ${themeId}`);
            return;
        }

        // 이전 테마의 Hook 제거
        if (currentLoadedThemeId) {
            await unregisterThemeHooks(currentLoadedThemeId);
        }

        // Manifest가 제공되지 않았으면 theme.json 읽기
        if (!manifest) {
            try {
                const manifestModule = await import(`/themes/${themeId}/theme.json`);
                manifest = manifestModule.default || manifestModule;
            } catch (error) {
                console.error(`❌ [Hook Loader] Failed to load theme.json for ${themeId}:`, error);
                return;
            }
        }

        // manifest가 여전히 없으면 종료
        if (!manifest) {
            console.error(`❌ [Hook Loader] Manifest is undefined for ${themeId}`);
            return;
        }

        // Hook 배열이 없으면 종료
        if (!manifest.hooks || manifest.hooks.length === 0) {
            console.log(`ℹ️ [Hook Loader] No hooks defined in theme: ${themeId}`);
            currentLoadedThemeId = themeId;
            return;
        }

        console.log(`📋 [Hook Loader] Found ${manifest.hooks.length} hook(s) in theme: ${themeId}`);

        // 각 Hook을 순회하며 등록
        for (const hookDef of manifest.hooks) {
            try {
                const { name, type, callback, priority } = hookDef;

                // 필수 필드 검증
                if (!name || !callback) {
                    console.error(
                        `❌ [Hook Loader] Invalid hook definition (missing name or callback):`,
                        hookDef
                    );
                    continue;
                }

                // Hook 파일 동적 import
                const callbackPath = `/themes/${themeId}/${callback}`;
                console.log(`📥 [Hook Loader] Importing hook: ${name} from ${callbackPath}`);

                const hookModule = await import(/* @vite-ignore */ callbackPath);
                const hookFunction = hookModule.default || hookModule;

                if (typeof hookFunction !== 'function') {
                    console.error(
                        `❌ [Hook Loader] Hook callback is not a function: ${name} (${callbackPath})`
                    );
                    continue;
                }

                // Hook 레지스트리에 등록
                registerHook(
                    name,
                    hookFunction,
                    priority ?? 10,
                    themeId, // source로 테마 ID 전달
                    (type as HookType) || 'action'
                );

                console.log(
                    `✅ [Hook Loader] Registered ${type} hook: ${name} (priority: ${priority ?? 10})`
                );
            } catch (error) {
                console.error(`❌ [Hook Loader] Failed to load hook "${hookDef.name}":`, error);
                // 에러가 발생해도 다음 Hook 계속 로드
            }
        }

        currentLoadedThemeId = themeId;
        console.log(`✅ [Hook Loader] Successfully loaded hooks for theme: ${themeId}`);
    } catch (error) {
        console.error(`❌ [Hook Loader] Failed to load theme hooks for ${themeId}:`, error);
    }
}

/**
 * 테마의 모든 Hook 제거
 *
 * @param themeId - 테마 ID
 */
export async function unregisterThemeHooks(themeId: string): Promise<void> {
    try {
        console.log(`🗑️ [Hook Loader] Unregistering hooks for theme: ${themeId}`);
        removeHooksBySource(themeId);

        if (currentLoadedThemeId === themeId) {
            currentLoadedThemeId = null;
        }

        console.log(`✅ [Hook Loader] Unregistered hooks for theme: ${themeId}`);
    } catch (error) {
        console.error(`❌ [Hook Loader] Failed to unregister hooks for ${themeId}:`, error);
    }
}

/**
 * 현재 로드된 테마 ID 가져오기
 */
export function getCurrentLoadedThemeId(): string | null {
    return currentLoadedThemeId;
}

/**
 * 테마 Hook 리로드 (개발 모드용)
 *
 * @param themeId - 테마 ID
 */
export async function reloadThemeHooks(themeId: string): Promise<void> {
    console.log(`🔄 [Hook Loader] Reloading hooks for theme: ${themeId}`);
    await unregisterThemeHooks(themeId);
    currentLoadedThemeId = null;
    await loadThemeHooks(themeId);
}
