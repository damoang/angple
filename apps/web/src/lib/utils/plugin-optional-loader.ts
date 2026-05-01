/**
 * Optional plugin component loader
 *
 * Uses import.meta.glob to discover plugin components at build time.
 * Missing plugins are silently ignored (returns null).
 */

import type { Component } from 'svelte';

// Glob all plugin components (lazy, not eager)
const pluginComponents = import.meta.glob('../../../../../plugins/*/components/*.svelte');
// Admin / arbitrary svelte files under plugin (used by admin sidebar entries)
const pluginAnySvelte = import.meta.glob('../../../../../plugins/*/**/*.svelte');
// Note: Exclude .server.ts files from glob to prevent server-only code from being bundled for client
const pluginLibs = import.meta.glob([
    '../../../../../plugins/*/lib/*.svelte',
    '../../../../../plugins/*/lib/*.svelte.ts',
    '../../../../../plugins/*/lib/*.ts',
    '!../../../../../plugins/*/lib/*.server.ts'
]);

/**
 * Load a plugin component dynamically.
 * Returns null if the plugin is not installed.
 *
 * @example
 * const MemoBadge = await loadPluginComponent('member-memo', 'memo-badge');
 */
export async function loadPluginComponent(
    pluginId: string,
    componentName: string
): Promise<Component | null> {
    const path = `../../../../../plugins/${pluginId}/components/${componentName}.svelte`;
    const loader = pluginComponents[path];
    if (!loader) return null;

    try {
        const module = (await loader()) as { default: Component };
        return module.default;
    } catch {
        return null;
    }
}

/**
 * Load a plugin svelte file by its relative path from the plugin root.
 * Used by admin sidebar entries — manifest's `ui.admin.menu.component` is a relative path
 * (e.g. "admin/settings.svelte"), so we glob the entire plugin tree.
 */
export async function loadPluginSvelteByPath(
    pluginId: string,
    relativePath: string
): Promise<Component | null> {
    const normalized = relativePath.startsWith('./') ? relativePath.slice(2) : relativePath;
    const fullPath = `../../../../../plugins/${pluginId}/${normalized}`;
    const loader = pluginAnySvelte[fullPath];
    if (!loader) return null;

    try {
        const module = (await loader()) as { default: Component };
        return module.default;
    } catch {
        return null;
    }
}

/**
 * Load a plugin library module dynamically.
 * Returns null if the plugin is not installed.
 */
export async function loadPluginLib<T = Record<string, unknown>>(
    pluginId: string,
    libName: string
): Promise<T | null> {
    // Try extensions in order: .svelte.ts, .ts, .svelte
    const extensions = ['.svelte.ts', '.ts', '.svelte'];
    for (const ext of extensions) {
        const path = `../../../../../plugins/${pluginId}/lib/${libName}${ext}`;
        const loader = pluginLibs[path];
        if (loader) {
            try {
                return (await loader()) as T;
            } catch {
                return null;
            }
        }
    }
    return null;
}
