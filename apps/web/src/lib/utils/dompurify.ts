import * as DOMPurifyModule from 'isomorphic-dompurify';
import { filterUnsafeStyles } from './safe-css.js';

type DOMPurifyLike = typeof import('isomorphic-dompurify');
const safeCssHookRegisteredKey = Symbol.for('angple.dompurify.safeCssHookRegistered');
const hookRegistry = globalThis as typeof globalThis & Record<symbol, boolean | undefined>;

export const dompurify =
    typeof DOMPurifyModule.sanitize === 'function'
        ? (DOMPurifyModule as unknown as DOMPurifyLike)
        : ((DOMPurifyModule.default ?? DOMPurifyModule) as unknown as DOMPurifyLike);

if (typeof dompurify.sanitize !== 'function') {
    throw new Error('DOMPurify import did not expose sanitize()');
}

if (!hookRegistry[safeCssHookRegisteredKey]) {
    dompurify.addHook('afterSanitizeAttributes', (node) => {
        filterUnsafeStyles(node as unknown as Element);
    });
    hookRegistry[safeCssHookRegisteredKey] = true;
}
