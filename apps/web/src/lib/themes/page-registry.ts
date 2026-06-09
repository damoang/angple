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
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 테마 작성 가이드 — 다크모드(중요)
 *   angple 은 `.dark`/`.amoled` class + CSS 변수 시맨틱 토큰으로 다크모드를 구현한다.
 *   테마의 layout/page/component 는 **고정 색을 쓰지 말고 시맨틱 토큰**을 써야
 *   라이트/다크/AMOLED 가 자동 대응된다 (코어 컴포넌트와 동일 규칙).
 *
 *     ❌ bg-white, text-gray-900, text-gray-500, border-gray-200, hover:bg-gray-50
 *     ✅ bg-background / bg-card / bg-muted                 (배경)
 *     ✅ text-foreground / text-muted-foreground            (글씨)
 *     ✅ text-primary / bg-primary text-primary-foreground  (강조·버튼)
 *     ✅ hover:bg-accent / hover:text-foreground            (호버)
 *     ✅ border-border                                       (경계)
 *
 *   브랜드 고유색은 테마 CSS 변수로 정의하되 다크모드 값을 함께 둘 것:
 *     :global(.my-theme)            { --brand: #ef6c4d; }
 *     :global(.dark .my-theme),
 *     :global(.amoled .my-theme)    { --brand: #fd8b6c; }
 *   (themes/sample-theme/templates/home.svelte 의 예시 참고)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const themePageModules = import.meta.glob(
    [
        '../../../../../../themes/*/templates/*.svelte',
        '../../../../../themes/*/templates/*.svelte'
    ],
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

function register(
    modules: Record<string, { default: Component }>,
    pattern: RegExp
): void {
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
