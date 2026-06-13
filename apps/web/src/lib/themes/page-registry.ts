import type { Component } from 'svelte';

/**
 * 테마 페이지 템플릿 레지스트리 (#1548)
 *
 * layout-registry.ts 와 동일한 빌드타임 eager-glob 패턴을, 페이지 단위 템플릿에 적용.
 * 테마가 `templates/<name>.svelte` 를 제공하면 코어 라우트가 해당 페이지를 그 템플릿으로
 * 렌더할 수 있다 (WordPress 의 page template 격). 미제공 시 코어 기본 콘텐츠 폴백.
 *
 * 예) custom-themes/ipyang/templates/home.svelte → getThemePageTemplate('ipyang', 'home')
 *
 * layout-registry 와 동일하게 SSR 시점 동적 import 없이 즉시 결정 (LCP/FCP·hydration 안전).
 */

const themePageModules = import.meta.glob(
    ['../../../../../../themes/*/templates/*.svelte', '../../../../../themes/*/templates/*.svelte'],
    { eager: true }
) as Record<string, { default: Component }>;

const customThemePageModules = import.meta.glob(
    [
        '../../../../../../custom-themes/*/templates/*.svelte',
        '../../../../../custom-themes/*/templates/*.svelte'
    ],
    { eager: true }
) as Record<string, { default: Component }>;

// (themeId, templateName) → Component
const pageRegistry = new Map<string, Map<string, Component>>();

function register(modules: Record<string, { default: Component }>, pattern: RegExp): void {
    for (const [path, module] of Object.entries(modules)) {
        const match = path.match(pattern);
        if (!match) continue;
        const [, themeId, templateName] = match;
        if (!pageRegistry.has(themeId)) pageRegistry.set(themeId, new Map());
        pageRegistry.get(themeId)!.set(templateName, module.default);
    }
}

// 공식 테마 먼저, 커스텀 테마가 동일 (themeId, template) 을 덮어씀 (커스텀 우선)
register(themePageModules, /themes\/([^/]+)\/templates\/([^/]+)\.svelte$/);
register(customThemePageModules, /custom-themes\/([^/]+)\/templates\/([^/]+)\.svelte$/);

/**
 * 테마 ID + 템플릿 이름으로 페이지 템플릿 컴포넌트를 가져옵니다.
 *
 * @param themeId - 테마 ID (예: 'ipyang'). null 이면 항상 null.
 * @param templateName - 템플릿 이름 (예: 'home', 'board', 'post-detail')
 * @returns 컴포넌트 또는 null (테마가 해당 템플릿 미제공 → 코어 기본 렌더)
 *
 * @example
 * ```svelte
 * <script>
 *   import { getThemePageTemplate } from '$lib/themes/page-registry';
 *   let { data } = $props();
 *   const Tmpl = $derived(getThemePageTemplate(data.site?.theme_id ?? null, 'home'));
 * </script>
 * {#if Tmpl}<Tmpl {data} />{:else}<!-- 코어 기본 -->{/if}
 * ```
 */
export function getThemePageTemplate(
    themeId: string | null,
    templateName: string
): Component | null {
    if (!themeId) return null;
    return pageRegistry.get(themeId)?.get(templateName) ?? null;
}

/** 등록된 (themeId → template 이름들) 맵. 디버깅/개발용. */
export function getRegisteredPageTemplates(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [themeId, templates] of pageRegistry) {
        out[themeId] = Array.from(templates.keys());
    }
    return out;
}

export { pageRegistry };
