import { Marked } from 'marked';
import { dompurify } from '$lib/utils/dompurify';
import { slugify, type TocItem } from '$lib/components/wiki/heading-slug';
import { wikiHref, legacyWikiPath } from './paths';

export type WikiFormat = 'markdown' | 'html' | 'wikitext';
export function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
/** Identical renderer for saved articles and editor previews. No board plugins or lossy HTML conversion. */
export function renderWiki(source: string, format: WikiFormat = 'markdown', existing?: Set<string>, documentPath = ''): { html: string; headings: TocItem[] } {
    const parser = new Marked({ gfm: true, breaks: true });
    parser.use({ extensions: [{
        name: 'wikilink', level: 'inline', start: src => src.indexOf('[['),
        tokenizer(src) {
            const m = /^\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/.exec(src);
            if (m) return { type: 'wikilink', raw: m[0], target: m[1].trim(), label: m[2]?.trim() };
        },
        renderer(token) {
            const target = String(token.target);
            const path = '/' + target.replace(/^\/+/, '');
            const cls = existing && !existing.has(path) ? 'wiki-link red-link' : 'wiki-link';
            return `<a class="${cls}" href="${wikiHref(path)}">${escapeHtml(String(token.label || target.replace(/_/g, ' ')))}</a>`;
        }
    }] });
    // Imported Wiki.js callout attributes and doubled external-link brackets are presentation artifacts.
    const normalized = source.replace(/\[\[([^\]\n]+)\]\]\((https?:\/\/[^\s)]+)\)/g, '[$1]($2)')
        .replace(/\[([^\]\n]+)\]\(\/[^)]+\)\((https?:\/\/[^\s)]+)\)/g, '[$1]($2)')
        .replace(/\s*\{\.is-(?:info|warning|danger|success)\}/g, '');
    const raw = format === 'html' ? source : format === 'wikitext' ? `<pre>${escapeHtml(source)}</pre>` : parser.parse(normalized, { async: false });
    let html = dompurify.sanitize(raw, {
        ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','strong','b','em','i','u','s','del','ul','ol','li','blockquote','code','pre','a','img','table','thead','tbody','tfoot','tr','th','td','caption','hr','div','figure','figcaption','span','details','summary','sup','sub','dl','dt','dd'],
        ALLOWED_ATTR: ['href','src','alt','title','class','id','colspan','rowspan','scope','open','start','reversed'],
        ALLOW_DATA_ATTR: false
    });
    html = html.replace(/href="([^"]*)"/g, (full, href: string) => {
        if (!href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return full;
        const decoded = href.replace(/&amp;/g, '&');
        if (decoded.startsWith('/mailto:')) return `href="${escapeHtml(decoded.slice(1))}"`;
        let target = decoded;
        try { target = decodeURIComponent(decoded); } catch { return full; }
        if (!target.startsWith('/')) target = documentPath.replace(/\/$/, '') + '/' + target;
        const mapped = legacyWikiPath(target);
        return `href="${escapeHtml(wikiHref(mapped))}"`;
    });
    const headings: TocItem[] = [];
    const seen = new Map<string, number>();
    html = html.replace(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level: string, inner: string) => {
        const text = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
        const base = slugify(text); const count = (seen.get(base) || 0) + 1; seen.set(base, count);
        const slug = count === 1 ? base : `${base}-${count}`;
        headings.push({ level: Number(level), text, slug });
        return `<h${level} id="${slug}">${inner}</h${level}>`;
    });
    // Tables scroll within the article on small screens instead of clipping cells.
    html = html.replace(/<table\b/g, '<div class="wiki-table-scroll"><table').replace(/<\/table>/g, '</table></div>');
    return { html, headings };
}
