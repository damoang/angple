import * as DOMPurifyModule from 'isomorphic-dompurify';

type DOMPurifyLike = typeof import('isomorphic-dompurify');

export const dompurify =
    typeof DOMPurifyModule.sanitize === 'function'
        ? (DOMPurifyModule as unknown as DOMPurifyLike)
        : ((DOMPurifyModule.default ?? DOMPurifyModule) as unknown as DOMPurifyLike);

if (typeof dompurify.sanitize !== 'function') {
    throw new Error('DOMPurify import did not expose sanitize()');
}
