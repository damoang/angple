export {
    configureSeo,
    getSiteUrl,
    buildTitle,
    buildRobots,
    buildOgTags,
    buildTwitterTags,
    buildJsonLd,
    createWebSiteJsonLd,
    createArticleJsonLd,
    createBreadcrumbJsonLd
} from './meta-helper';

export {
    getCanonicalUrl,
    isSearchPage,
    isPaginatedPage,
    hasFilterParams,
    getPaginationSeo,
    getPageSeoConfig
} from './canonical';

export {
    createOrganizationJsonLd,
    createDiscussionForumPostingJsonLd,
    createFAQPageJsonLd
} from './json-ld';

export type {
    SeoConfig,
    SeoMeta,
    OgMeta,
    TwitterMeta,
    JsonLdData,
    JsonLdOrganization,
    JsonLdDiscussionForumPosting,
    JsonLdFAQPage,
    JsonLdFAQItem,
    PaginationSeo
} from './types';

export { default as SeoHead } from './seo-head.svelte';
