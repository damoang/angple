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
 */
export async function loadThemeHooks(themeId: string, manifest?: ThemeManifest): Promise<void> {
    try {
        // 이미 로드된 테마면 스킵
        if (currentLoadedThemeId === themeId) {
            return;
        }

        // 이전 테마의 Hook 제거
        if (currentLoadedThemeId) {
            await unregisterThemeHooks(currentLoadedThemeId);
        }

        // Manifest가 제공되지 않았으면 theme.json 읽기
        if (!manifest) {
            try {
                const response = await fetch(`/themes/${themeId}/theme.json`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                manifest = await response.json();
            } catch (error) {
                console.error('[Hook Loader] Failed to load theme.json:', { themeId, error });
                return;
            }
        }

        // manifest가 여전히 없으면 종료
        if (!manifest) {
            console.error(`[Hook Loader] Manifest is undefined for ${themeId}`);
            return;
        }

        // Hook 배열이 없으면 종료
        if (!manifest.hooks || manifest.hooks.length === 0) {
            currentLoadedThemeId = themeId;
            return;
        }

        // 각 Hook을 순회하며 등록
        for (const hookDef of manifest.hooks) {
            try {
                const { name, type, callback, priority } = hookDef;

                // 필수 필드 검증
                if (!name || !callback) {
                    console.error(
                        `[Hook Loader] Invalid hook definition (missing name or callback):`,
                        hookDef
                    );
                    continue;
                }

                // Hook 파일 동적 import
                const callbackPath = `../../../../../../themes/${themeId}/${callback}`;

                const hookModule = await import(/* @vite-ignore */ callbackPath);
                const hookFunction = hookModule.default || hookModule;

                if (typeof hookFunction !== 'function') {
                    console.error(
                        `[Hook Loader] Hook callback is not a function: ${name} (${callbackPath})`
                    );
                    continue;
                }

                registerHook(
                    name,
                    hookFunction,
                    priority ?? 10,
                    themeId,
                    (type as HookType) || 'action'
                );
            } catch (error) {
                console.error('[Hook Loader] Failed to load hook:', {
                    name: hookDef.name,
                    error
                });
            }
        }

        currentLoadedThemeId = themeId;
    } catch (error) {
        console.error('[Hook Loader] Failed to load theme hooks:', { themeId, error });
    }
}

/**
 * 테마의 모든 Hook 제거
 */
export async function unregisterThemeHooks(themeId: string): Promise<void> {
    try {
        removeHooksBySource(themeId);

        if (currentLoadedThemeId === themeId) {
            currentLoadedThemeId = null;
        }
    } catch (error) {
        console.error('[Hook Loader] Failed to unregister hooks:', { themeId, error });
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
 */
export async function reloadThemeHooks(themeId: string): Promise<void> {
    await unregisterThemeHooks(themeId);
    currentLoadedThemeId = null;
    await loadThemeHooks(themeId);
}
