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

const DEFAULT_SITE_NAME = '다모앙 - 종합 커뮤니티';
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

/** 설정된 사이트 URL 반환 (HTTPS 보장) */
export function getSiteUrl(): string {
    return siteDefaults.siteUrl;
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

/** 유니코드 안전 문자열 자르기 (SEO description/text 용)
 * String.prototype.slice 는 UTF-16 코드유닛 단위라 이모지(서로게이트 쌍)가 경계에 걸리면
 * 반쪽(lone surrogate)만 남아 GSC "잘린 유니코드 문자"(파싱 불가, 심각) 오류가 된다.
 * 코드포인트 단위로 잘라 서로게이트가 절대 깨지지 않게 한다. */
export function truncateText(text: string, maxLength: number): string {
    const points = [...text];
    if (points.length <= maxLength) return text;
    return points.slice(0, maxLength).join('');
}

/** JSON-LD 스크립트 문자열 생성
 * null/undefined 항목은 제외한다 (생성 헬퍼가 유효하지 않은 데이터에 null 을 반환하는 경우).
 * 유효 항목이 없으면 빈 문자열 → SeoHead 의 {#if jsonLdScript} 가 스크립트 자체를 생략. */
export function buildJsonLd(data: Array<JsonLdData | null | undefined>): string {
    const wrapped = data
        .filter((item): item is JsonLdData => item != null)
        .map((item) => ({
            '@context': 'https://schema.org',
            ...item
        }));
    if (wrapped.length === 0) return '';

    const json = wrapped.length === 1 ? JSON.stringify(wrapped[0]) : JSON.stringify(wrapped);
    // </script> 주입 방지
    return json.replace(/<\//g, '<\\/');
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

/** Breadcrumb JSON-LD 생성 헬퍼
 * GSC "'name' 또는 'item.name' 지정 필요" 에러 방지:
 * - name 이 빈 항목(빈 제목 글 등)은 제외하고 position 을 재부여한다.
 * - 유효 항목이 없으면 null 을 반환해 BreadcrumbList 블록 자체를 생략한다.
 *   (breadcrumb 이 없는 것은 정상, 빈/name 누락 breadcrumb 은 리치 결과 오류) */
export function createBreadcrumbJsonLd(
    items: Array<{ name: string | null | undefined; url?: string }>
): JsonLdBreadcrumb | null {
    const valid = items.filter((item) => item.name != null && String(item.name).trim() !== '');
    if (valid.length === 0) return null;
    return {
        '@type': 'BreadcrumbList',
        itemListElement: valid.map((item, i) => ({
            '@type': 'ListItem' as const,
            position: i + 1,
            name: String(item.name).trim(),
            ...(item.url ? { item: item.url } : {})
        }))
    };
}

export type { SeoConfig, SeoMeta, OgMeta, TwitterMeta, JsonLdData };
