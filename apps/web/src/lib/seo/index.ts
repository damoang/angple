export {
    configureSeo,
    getSiteUrl,
    buildTitle,
    buildRobots,
    buildOgTags,
    buildTwitterTags,
    buildJsonLd,
    truncateText,
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
    createFAQPageJsonLd,
    createQAPageJsonLd,
    createVideoObjectJsonLd,
    createRatedItemJsonLd,
    ratingSchemaTypeForCategory,
    extractVideosFromContent
} from './json-ld';
export type { ExtractedVideo } from './json-ld';

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
    JsonLdVideoObject,
    PaginationSeo
} from './types';

export { default as SeoHead } from './seo-head.svelte';
