/**
 * 검색어를 HTML mark 태그로 하이라이트.
 * XSS 방지를 위해 텍스트를 먼저 이스케이프한 후 mark 태그를 삽입.
 */
export function highlightQuery(text: string, query: string): string {
    if (!query || !text) return text;
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escaped.replace(
        regex,
        '<mark class="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">$1</mark>'
    );
}
