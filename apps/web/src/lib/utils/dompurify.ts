import * as DOMPurifyModule from 'isomorphic-dompurify';
import { browser } from '$app/environment';
import { filterUnsafeStyles } from './safe-css.js';

type DOMPurifyLike = typeof import('isomorphic-dompurify');
type HookEntryPoint = Parameters<DOMPurifyLike['addHook']>[0];
type HookFunction = Parameters<DOMPurifyLike['addHook']>[1];
type ClearWindowCapable = DOMPurifyLike & { clearWindow?: () => void };

const safeCssHookRegisteredKey = Symbol.for('angple.dompurify.safeCssHookRegistered');
const hookRegistry = globalThis as typeof globalThis & Record<symbol, boolean | undefined>;

const importedDompurify =
    typeof DOMPurifyModule.sanitize === 'function'
        ? (DOMPurifyModule as unknown as DOMPurifyLike)
        : ((DOMPurifyModule.default ?? DOMPurifyModule) as unknown as DOMPurifyLike);

if (typeof importedDompurify.sanitize !== 'function') {
    throw new Error('DOMPurify import did not expose sanitize()');
}

const DEFAULT_SERVER_CLEAR_WINDOW_EVERY = 100;
const serverClearWindowEvery = Number(
    process.env.DOMPURIFY_CLEAR_WINDOW_EVERY ?? DEFAULT_SERVER_CLEAR_WINDOW_EVERY
);

function createServerDompurify(baseDompurify: DOMPurifyLike): DOMPurifyLike {
    const serverDompurify = baseDompurify as ClearWindowCapable;

    if (typeof serverDompurify.clearWindow !== 'function') {
        return baseDompurify;
    }

    const hooks: Array<[HookEntryPoint, HookFunction]> = [];
    const addHook = serverDompurify.addHook.bind(serverDompurify);
    const clearWindow = serverDompurify.clearWindow.bind(serverDompurify);
    let sanitizeCount = 0;

    return new Proxy(baseDompurify, {
        get(target, prop, receiver) {
            if (prop === 'addHook') {
                return (entryPoint: HookEntryPoint, hookFunction: HookFunction) => {
                    hooks.push([entryPoint, hookFunction]);
                    return addHook(entryPoint, hookFunction);
                };
            }

            if (prop === 'sanitize') {
                return (...args: Parameters<DOMPurifyLike['sanitize']>) => {
                    const sanitized = serverDompurify.sanitize(...args);
                    sanitizeCount += 1;

                    if (sanitizeCount >= serverClearWindowEvery) {
                        sanitizeCount = 0;
                        clearWindow();
                        for (const [entryPoint, hookFunction] of hooks) {
                            addHook(entryPoint, hookFunction);
                        }
                    }

                    return sanitized;
                };
            }

            const value = Reflect.get(target, prop, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    }) as DOMPurifyLike;
}

export const dompurify =
    !browser && serverClearWindowEvery > 0
        ? createServerDompurify(importedDompurify)
        : importedDompurify;

if (!hookRegistry[safeCssHookRegisteredKey]) {
    dompurify.addHook('afterSanitizeAttributes', (node) => {
        filterUnsafeStyles(node as unknown as Element);
    });
    hookRegistry[safeCssHookRegisteredKey] = true;
}
