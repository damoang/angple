/**
 * CSS 속성 화이트리스트 필터
 * DOMPurify와 함께 사용하여 위험한 CSS 속성 제거
 */

export const SAFE_CSS_PROPERTIES = new Set([
    'font-size',
    'font-weight',
    'font-style',
    'font-family',
    'color',
    'background-color',
    'text-align',
    'text-decoration',
    'line-height',
    'letter-spacing',
    'margin',
    'margin-top',
    'margin-bottom',
    'margin-left',
    'margin-right',
    'padding',
    'padding-top',
    'padding-bottom',
    'padding-left',
    'padding-right',
    'border',
    'border-radius',
    'width',
    'max-width',
    'height',
    'max-height'
]);

/**
 * DOM 노드의 style 속성에서 화이트리스트 외 CSS 속성을 제거한다.
 * DOMPurify afterSanitizeAttributes 훅에서 사용.
 */
export function filterUnsafeStyles(node: Element): void {
    if (!node.hasAttribute?.('style')) return;

    const style = node.getAttribute('style');
    if (!style) {
        node.removeAttribute('style');
        return;
    }

    const filtered = style
        .split(';')
        .map((decl) => decl.trim())
        .filter((decl) => {
            if (!decl) return false;
            const colonIdx = decl.indexOf(':');
            if (colonIdx === -1) return false;
            const prop = decl.substring(0, colonIdx).trim().toLowerCase();
            return SAFE_CSS_PROPERTIES.has(prop);
        })
        .join('; ');

    if (filtered) {
        node.setAttribute('style', filtered);
    } else {
        node.removeAttribute('style');
    }
}
