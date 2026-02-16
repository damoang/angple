/**
 * Optional plugin component loader
 *
 * Uses import.meta.glob to discover plugin components at build time.
 * Missing plugins are silently ignored (returns null).
 */

import type { Component } from 'svelte';

// Glob all plugin components (lazy, not eager)
const pluginComponents = import.meta.glob('../../../../../../plugins/*/components/*.svelte');
const pluginLibs = import.meta.glob('../../../../../../plugins/*/lib/*.svelte');

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
    const path = `../../../../../../plugins/${pluginId}/components/${componentName}.svelte`;
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
 * Load a plugin library module dynamically.
 * Returns null if the plugin is not installed.
 */
export async function loadPluginLib<T = Record<string, unknown>>(
    pluginId: string,
    libName: string
): Promise<T | null> {
    const path = `../../../../../../plugins/${pluginId}/lib/${libName}.svelte`;
    const loader = pluginLibs[path];
    if (!loader) return null;

    try {
        return (await loader()) as T;
    } catch {
        return null;
    }
}
