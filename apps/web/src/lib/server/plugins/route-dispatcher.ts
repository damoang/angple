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

/**
 * `:param` 형태의 path 파라미터를 정규식으로 변환해 매칭한다.
 * 예: `/buildings/:id/bricks` → `^/buildings/([^/]+)/bricks$`
 * 매칭 시 추출한 파라미터는 `event.params` 처럼 `RouteParams` 로 반환된다.
 */
export type RouteParams = Record<string, string>;

interface MatchResult {
    route: ExtensionAPIRoute;
    params: RouteParams;
}

function compileRoutePattern(pattern: string): { regex: RegExp; keys: string[] } {
    const keys: string[] = [];
    const escaped = pattern.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
    const regexBody = escaped.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, key: string) => {
        keys.push(key);
        return '([^/]+)';
    });
    return { regex: new RegExp(`^${regexBody}$`), keys };
}

function matchRoute(
    routes: ExtensionAPIRoute[],
    requestPath: string,
    method: Method,
    prefix: string
): MatchResult | null {
    const normalizedPrefix = prefix.startsWith('/') ? prefix : `/${prefix}`;
    const stripped = requestPath.startsWith(normalizedPrefix)
        ? requestPath.slice(normalizedPrefix.length) || '/'
        : requestPath;

    // 1차: 정확 매칭 (성능 최적화 + 정적 경로 우선)
    for (const route of routes) {
        if (route.method !== method) continue;
        if (route.path === stripped || route.path === requestPath) {
            return { route, params: {} };
        }
    }
    // 2차: `:param` 동적 매칭
    for (const route of routes) {
        if (route.method !== method) continue;
        if (!route.path.includes(':')) continue;
        const { regex, keys } = compileRoutePattern(route.path);
        const m = regex.exec(stripped) ?? regex.exec(requestPath);
        if (!m) continue;
        const params: RouteParams = {};
        for (let i = 0; i < keys.length; i++) {
            params[keys[i]] = decodeURIComponent(m[i + 1] ?? '');
        }
        return { route, params };
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

    const handlerPath = path.join(plugin.path, matched.route.handler);
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

    // 동적 path 파라미터를 `event.params` 에 합쳐 핸들러에 전달.
    // 기존 SvelteKit 의 catch-all params (`id`, `rest`) 은 plugin params 로 덮어쓰지 않도록 보존한다.
    if (Object.keys(matched.params).length > 0) {
        const proxiedParams = { ...input.event.params, ...matched.params };
        Object.defineProperty(input.event, 'params', {
            value: proxiedParams,
            writable: true,
            configurable: true
        });
    }

    try {
        return await fn(input.event);
    } catch (err) {
        console.error(`${LOG_PREFIX} handler error in ${input.pluginId}${input.rest}:`, err);
        // plugin handler 가 status 를 가진 에러(ApiError 등)를 throw 하면 그 코드로 응답한다.
        // plugin 은 별도 모듈 그래프에서 동적 import 되므로 instanceof 로 식별할 수 없어
        // duck-typing 으로 .status 를 확인한다.
        const status =
            err && typeof (err as { status?: unknown }).status === 'number'
                ? (err as { status: number }).status
                : 500;
        const message =
            status !== 500 && err instanceof Error ? err.message : 'Plugin handler error';
        return new Response(message, { status });
    }
}

export function invalidateHandlerCache(): void {
    moduleCache.clear();
}
