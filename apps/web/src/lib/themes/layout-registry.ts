import type { Component } from 'svelte';

/**
 * 테마 레이아웃 레지스트리
 *
 * SSR 성능 최적화를 위해 import.meta.glob({ eager: true })를 사용하여
 * 빌드 시점에 모든 테마 레이아웃을 번들에 포함합니다.
 *
 * 장점:
 * - SSR 시점에 동적 import 없이 즉시 레이아웃 결정
 * - LCP/FCP 개선 (invisible 대기 시간 제거)
 * - Hydration mismatch 방지
 *
 * 단점:
 * - 번들 크기 증가 (~30KB gzip, 모든 테마 레이아웃 포함)
 * - 사용하지 않는 테마도 번들에 포함됨
 */

// Eager import: 빌드 시점에 모든 공식 테마 레이아웃 번들 포함
// 경로: src/lib/themes → ../../../../../../themes/*/layouts/main-layout.svelte
const themeLayoutModules = import.meta.glob(
    [
        '../../../../../../themes/*/layouts/main-layout.svelte',
        '../../../../../themes/*/layouts/main-layout.svelte'
    ],
    { eager: true }
) as Record<string, { default: Component }>;

// Eager import: 빌드 시점에 모든 커스텀 테마 레이아웃 번들 포함
const customThemeLayoutModules = import.meta.glob(
    [
        '../../../../../../custom-themes/*/layouts/main-layout.svelte',
        '../../../../../custom-themes/*/layouts/main-layout.svelte'
    ],
    { eager: true }
) as Record<string, { default: Component }>;

// 테마 ID → 레이아웃 컴포넌트 맵
const layoutRegistry = new Map<string, Component>();

// 공식 테마 등록
for (const [path, module] of Object.entries(themeLayoutModules)) {
    // 경로에서 테마 ID 추출: .../themes/{themeId}/layouts/main-layout.svelte
    const match = path.match(/themes\/([^/]+)\/layouts\/main-layout\.svelte$/);
    if (match) {
        layoutRegistry.set(match[1], module.default);
    }
}

// 커스텀 테마 등록 (공식 테마와 동일한 ID가 있으면 커스텀 테마가 우선)
for (const [path, module] of Object.entries(customThemeLayoutModules)) {
    // 경로에서 테마 ID 추출: .../custom-themes/{themeId}/layouts/main-layout.svelte
    const match = path.match(/custom-themes\/([^/]+)\/layouts\/main-layout\.svelte$/);
    if (match) {
        layoutRegistry.set(match[1], module.default);
    }
}

/**
 * 테마 ID로 레이아웃 컴포넌트를 가져옵니다.
 *
 * @param themeId - 테마 ID (예: 'damoang-default', 'damoang-classic')
 * @returns 테마 레이아웃 컴포넌트 또는 null (테마가 없는 경우)
 *
 * @example
 * ```ts
 * const ThemeLayout = getThemeLayout('damoang-default');
 * if (ThemeLayout) {
 *   // 테마 레이아웃 사용
 * }
 * ```
 */
export function getThemeLayout(themeId: string | null): Component | null {
    if (!themeId) return null;
    return layoutRegistry.get(themeId) ?? null;
}

/**
 * 등록된 모든 테마 ID 목록을 반환합니다.
 * 디버깅/개발용으로 사용합니다.
 */
export function getRegisteredThemeIds(): string[] {
    return Array.from(layoutRegistry.keys());
}

export { layoutRegistry };
