import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RequestEvent } from '@sveltejs/kit';
import type { ExtensionAPIRoute } from '@angple/types';
import { getPluginById } from './index';

const LOG_PREFIX = '[plugin-route]';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type HandlerFn = (event: RequestEvent) => Response | Promise<Response>;
type HandlerModule = Partial<Record<Method, HandlerFn>> & { default?: HandlerFn };

const moduleCache = new Map<string, HandlerModule>();

async function loadHandler(absolutePath: string): Promise<HandlerModule> {
    const cached = moduleCache.get(absolutePath);
    if (cached) return cached;
    const mod = (await import(pathToFileURL(absolutePath).href)) as HandlerModule;
    moduleCache.set(absolutePath, mod);
    return mod;
}

function matchRoute(
    routes: ExtensionAPIRoute[],
    requestPath: string,
    method: Method,
    prefix: string
): ExtensionAPIRoute | null {
    const normalizedPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`;
    const stripped = requestPath.startsWith(normalizedPrefix)
        ? requestPath.slice(normalizedPrefix.length) || '/'
        : requestPath;

    for (const route of routes) {
        if (route.method !== method) continue;
        if (route.path === stripped || route.path === requestPath) return route;
    }
    return null;
}

export interface DispatchInput {
    pluginId: string;
    /** plugin prefix를 제거한 나머지 경로 (앞에 '/' 포함) */
    rest: string;
    method: Method;
    event: RequestEvent;
}

export async function dispatchPluginRoute(input: DispatchInput): Promise<Response> {
    const plugin = await getPluginById(input.pluginId);
    if (!plugin) {
        return new Response(`Plugin not found: ${input.pluginId}`, { status: 404 });
    }
    if (!plugin.isActive) {
        return new Response(`Plugin not active: ${input.pluginId}`, { status: 404 });
    }

    const restApi = plugin.manifest.api?.rest;
    if (!restApi || !restApi.routes || restApi.routes.length === 0) {
        return new Response(`Plugin has no routes: ${input.pluginId}`, { status: 404 });
    }

    const matched = matchRoute(restApi.routes, input.rest, input.method, restApi.prefix);
    if (!matched) {
        return new Response(`Route not found in plugin: ${input.pluginId}${input.rest}`, {
            status: 404
        });
    }

    const handlerPath = path.join(plugin.path, matched.handler);
    let mod: HandlerModule;
    try {
        mod = await loadHandler(handlerPath);
    } catch (err) {
        console.error(`${LOG_PREFIX} failed to load handler ${handlerPath}:`, err);
        return new Response(`Plugin handler load error`, { status: 500 });
    }

    const fn = mod[input.method] ?? mod.default;
    if (typeof fn !== 'function') {
        return new Response(`Plugin handler missing ${input.method} export`, { status: 500 });
    }

    try {
        return await fn(input.event);
    } catch (err) {
        console.error(`${LOG_PREFIX} handler error in ${input.pluginId}${input.rest}:`, err);
        return new Response(`Plugin handler error`, { status: 500 });
    }
}

export function invalidateHandlerCache(): void {
    moduleCache.clear();
}
