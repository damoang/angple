/**
 * SEO 메타 헬퍼
 *
 * 메타태그, Open Graph, Twitter Card, JSON-LD 구조화 데이터를 생성합니다.
 * SvelteKit의 <svelte:head>에서 사용합니다.
 */

import type {
    SeoConfig,
    SeoMeta,
    OgMeta,
    TwitterMeta,
    JsonLdData,
    JsonLdArticle,
    JsonLdWebSite,
    JsonLdBreadcrumb
} from './types';

const DEFAULT_SITE_NAME = 'Angple';
const DEFAULT_LOCALE = 'ko_KR';

/** 사이트 기본 설정 (앱 시작 시 한 번 설정) */
let siteDefaults = {
    siteName: DEFAULT_SITE_NAME,
    siteUrl: '',
    locale: DEFAULT_LOCALE,
    twitterSite: ''
};

/** 사이트 기본값 설정 */
export function configureSeo(config: Partial<typeof siteDefaults>) {
    siteDefaults = { ...siteDefaults, ...config };
}

/** 페이지 타이틀 생성 (사이트명 포함) */
export function buildTitle(pageTitle: string, includeSiteName = true): string {
    if (!includeSiteName || !siteDefaults.siteName) return pageTitle;
    return `${pageTitle} | ${siteDefaults.siteName}`;
}

/** robots 메타 콘텐츠 생성 */
export function buildRobots(meta: SeoMeta): string | null {
    const directives: string[] = [];
    if (meta.noIndex) directives.push('noindex');
    if (meta.noFollow) directives.push('nofollow');
    return directives.length > 0 ? directives.join(', ') : null;
}

/** Open Graph 메타 태그 객체 생성 */
export function buildOgTags(meta: SeoMeta, og?: OgMeta): Record<string, string> {
    const tags: Record<string, string> = {};
    tags['og:title'] = og?.title || meta.title;
    tags['og:type'] = og?.type || 'website';
    tags['og:site_name'] = og?.siteName || siteDefaults.siteName;
    tags['og:locale'] = og?.locale || siteDefaults.locale;

    if (og?.description || meta.description) {
        tags['og:description'] = (og?.description || meta.description)!;
    }
    if (og?.url || meta.canonicalUrl) {
        tags['og:url'] = (og?.url || meta.canonicalUrl)!;
    }
    if (og?.image) {
        tags['og:image'] = og.image;
        if (og.imageWidth) tags['og:image:width'] = String(og.imageWidth);
        if (og.imageHeight) tags['og:image:height'] = String(og.imageHeight);
    }
    return tags;
}

/** Twitter Card 메타 태그 객체 생성 */
export function buildTwitterTags(meta: SeoMeta, twitter?: TwitterMeta): Record<string, string> {
    const tags: Record<string, string> = {};
    tags['twitter:card'] = twitter?.card || 'summary';
    tags['twitter:title'] = twitter?.title || meta.title;

    if (twitter?.site || siteDefaults.twitterSite) {
        tags['twitter:site'] = (twitter?.site || siteDefaults.twitterSite)!;
    }
    if (twitter?.creator) tags['twitter:creator'] = twitter.creator;
    if (twitter?.description || meta.description) {
        tags['twitter:description'] = (twitter?.description || meta.description)!;
    }
    if (twitter?.image) tags['twitter:image'] = twitter.image;
    return tags;
}

/** JSON-LD 스크립트 문자열 생성 */
export function buildJsonLd(data: JsonLdData[]): string {
    const wrapped = data.map((item) => ({
        '@context': 'https://schema.org',
        ...item
    }));

    if (wrapped.length === 1) {
        return JSON.stringify(wrapped[0]);
    }
    return JSON.stringify(wrapped);
}

/** WebSite JSON-LD 생성 헬퍼 */
export function createWebSiteJsonLd(searchUrl?: string): JsonLdWebSite {
    const data: JsonLdWebSite = {
        '@type': 'WebSite',
        name: siteDefaults.siteName,
        url: siteDefaults.siteUrl
    };
    if (searchUrl) {
        data.potentialAction = {
            '@type': 'SearchAction',
            target: searchUrl,
            'query-input': 'required name=search_term_string'
        };
    }
    return data;
}

/** Article JSON-LD 생성 헬퍼 */
export function createArticleJsonLd(options: {
    headline: string;
    author?: string;
    datePublished?: string;
    dateModified?: string;
    image?: string;
    description?: string;
}): JsonLdArticle {
    const data: JsonLdArticle = {
        '@type': 'Article',
        headline: options.headline
    };
    if (options.author) data.author = { '@type': 'Person', name: options.author };
    if (options.datePublished) data.datePublished = options.datePublished;
    if (options.dateModified) data.dateModified = options.dateModified;
    if (options.image) data.image = options.image;
    if (options.description) data.description = options.description;
    return data;
}

/** Breadcrumb JSON-LD 생성 헬퍼 */
export function createBreadcrumbJsonLd(
    items: Array<{ name: string; url?: string }>
): JsonLdBreadcrumb {
    return {
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, i) => ({
            '@type': 'ListItem' as const,
            position: i + 1,
            name: item.name,
            ...(item.url ? { item: item.url } : {})
        }))
    };
}

export type { SeoConfig, SeoMeta, OgMeta, TwitterMeta, JsonLdData };
