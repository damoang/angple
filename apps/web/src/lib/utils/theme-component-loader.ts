/**
 * 테마 Component 자동 로더
 *
 * theme.json의 components 배열을 읽어 슬롯에 자동으로 컴포넌트를 등록합니다.
 */

import type { Component } from 'svelte';
import {
    registerComponent,
    removeComponentsBySource,
    type SlotName
} from '$lib/components/slot-manager';
import type { ThemeManifest } from '$lib/types/theme';

/**
 * 현재 로드된 테마 ID 추적
 */
let currentThemeId: string | null = null;

/**
 * 활성 테마의 컴포넌트를 슬롯에 자동 등록
 *
 * @param themeId - 테마 ID
 * @returns 성공 여부
 */
export async function loadThemeComponents(themeId: string): Promise<boolean> {
    try {
        console.log('🎨 [Theme Loader] Loading components for theme:', themeId);

        // 이전 테마 컴포넌트 제거
        if (currentThemeId && currentThemeId !== themeId) {
            console.log(
                '🗑️ [Theme Loader] Removing components from previous theme:',
                currentThemeId
            );
            removeComponentsBySource(currentThemeId);
        }

        // 테마 목록 조회
        const themesResponse = await fetch('/api/themes');
        if (!themesResponse.ok) {
            console.error('❌ [Theme Loader] Failed to fetch themes list');
            return false;
        }

        const { themes } = await themesResponse.json();
        const theme = themes.find((t: { manifest: ThemeManifest }) => t.manifest.id === themeId);

        if (!theme) {
            console.error('❌ [Theme Loader] Theme not found:', themeId);
            return false;
        }

        const manifest: ThemeManifest = theme.manifest;

        // components가 없으면 종료
        if (!manifest.components || manifest.components.length === 0) {
            console.log('ℹ️ [Theme Loader] No components to load for theme:', themeId);
            currentThemeId = themeId;
            return true;
        }

        // 각 컴포넌트 로드 및 등록
        let loadedCount = 0;
        let failedCount = 0;

        for (const componentDef of manifest.components) {
            try {
                // 동적 import를 위한 경로 생성
                // Vite는 정적 분석을 위해 템플릿 리터럴의 일부가 고정되어야 함
                const componentPath = `/themes/${themeId}/${componentDef.path}`;

                console.log(
                    '📦 [Theme Loader] Loading component:',
                    componentDef.name,
                    'from',
                    componentPath
                );

                // 동적 import (Vite glob import 사용)
                const modules = import.meta.glob('/themes/**/*.svelte');
                const moduleKey = componentPath;

                if (!modules[moduleKey]) {
                    console.error('❌ [Theme Loader] Component file not found:', moduleKey);
                    failedCount++;
                    continue;
                }

                const module = (await modules[moduleKey]()) as { default: Component };
                const SvelteComponent = module.default;

                // 슬롯에 등록
                registerComponent(
                    componentDef.slot as SlotName,
                    SvelteComponent,
                    componentDef.priority || 10,
                    {}, // props는 나중에 설정에서 가져올 수 있음
                    themeId // source로 테마 ID 사용
                );

                loadedCount++;
                console.log(
                    '✅ [Theme Loader] Component registered:',
                    componentDef.name,
                    '→',
                    componentDef.slot
                );
            } catch (error) {
                console.error(
                    '❌ [Theme Loader] Failed to load component:',
                    componentDef.name,
                    error
                );
                failedCount++;
            }
        }

        currentThemeId = themeId;

        console.log(
            '🎉 [Theme Loader] Theme components loaded:',
            loadedCount,
            'success,',
            failedCount,
            'failed'
        );

        return failedCount === 0;
    } catch (error) {
        console.error('❌ [Theme Loader] Fatal error loading theme components:', error);
        return false;
    }
}

/**
 * 모든 테마 컴포넌트 제거
 */
export function unloadAllThemeComponents(): void {
    if (currentThemeId) {
        console.log('🗑️ [Theme Loader] Unloading all components from theme:', currentThemeId);
        removeComponentsBySource(currentThemeId);
        currentThemeId = null;
    }
}

/**
 * 현재 로드된 테마 ID 가져오기
 */
export function getCurrentThemeId(): string | null {
    return currentThemeId;
}
