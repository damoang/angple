/**
 * SEO 관련 타입 정의
 */

/** 기본 메타 정보 */
export interface SeoMeta {
    title: string;
    description?: string;
    keywords?: string[];
    canonicalUrl?: string;
    noIndex?: boolean;
    noFollow?: boolean;
    /** false로 설정하면 타이틀에 사이트명을 붙이지 않음 (홈페이지용) */
    includeSiteName?: boolean;
}

/** Open Graph 메타 정보 */
export interface OgMeta {
    title?: string;
    description?: string;
    image?: string;
    imageWidth?: number;
    imageHeight?: number;
    url?: string;
    type?: 'website' | 'article' | 'profile';
    siteName?: string;
    locale?: string;
}

/** Twitter Card 메타 정보 */
export interface TwitterMeta {
    card?: 'summary' | 'summary_large_image';
    site?: string;
    creator?: string;
    title?: string;
    description?: string;
    image?: string;
}

/** JSON-LD 구조화 데이터 - WebSite */
export interface JsonLdWebSite {
    '@type': 'WebSite';
    name: string;
    url: string;
    description?: string;
    potentialAction?: {
        '@type': 'SearchAction';
        target: string;
        'query-input': string;
    };
}

/** JSON-LD 구조화 데이터 - Article */
export interface JsonLdArticle {
    '@type': 'Article';
    headline: string;
    author?: { '@type': 'Person'; name: string };
    datePublished?: string;
    dateModified?: string;
    image?: string;
    description?: string;
}

/** JSON-LD 구조화 데이터 - BreadcrumbList */
export interface JsonLdBreadcrumb {
    '@type': 'BreadcrumbList';
    itemListElement: Array<{
        '@type': 'ListItem';
        position: number;
        name: string;
        item?: string;
    }>;
}

/** JSON-LD 구조화 데이터 - Organization */
export interface JsonLdOrganization {
    '@type': 'Organization';
    name: string;
    url: string;
    logo?: string;
    description?: string;
    sameAs?: string[];
    contactPoint?: {
        '@type': 'ContactPoint';
        contactType: string;
        email?: string;
        telephone?: string;
    };
}

/** JSON-LD 구조화 데이터 - DiscussionForumPosting (커뮤니티 게시글용) */
export interface JsonLdDiscussionForumPosting {
    '@type': 'DiscussionForumPosting';
    headline: string;
    text?: string;
    author: {
        '@type': 'Person';
        name: string;
        url?: string;
    };
    datePublished: string;
    dateModified?: string;
    url: string;
    image?: string;
    interactionStatistic?: Array<{
        '@type': 'InteractionCounter';
        interactionType: string;
        userInteractionCount: number;
    }>;
}

/** JSON-LD 구조화 데이터 - FAQPage */
export interface JsonLdFAQPage {
    '@type': 'FAQPage';
    mainEntity: Array<{
        '@type': 'Question';
        name: string;
        acceptedAnswer: {
            '@type': 'Answer';
            text: string;
        };
    }>;
}

/** FAQ 항목 헬퍼 타입 */
export interface JsonLdFAQItem {
    question: string;
    answer: string;
}

export type JsonLdData =
    | JsonLdWebSite
    | JsonLdArticle
    | JsonLdBreadcrumb
    | JsonLdOrganization
    | JsonLdDiscussionForumPosting
    | JsonLdFAQPage;

/** 페이지네이션 SEO 정보 */
export interface PaginationSeo {
    prev?: string;
    next?: string;
}

/** SEO 헬퍼에 전달하는 통합 옵션 */
export interface SeoConfig {
    meta: SeoMeta;
    og?: OgMeta;
    twitter?: TwitterMeta;
    jsonLd?: JsonLdData[];
    pagination?: PaginationSeo;
}
